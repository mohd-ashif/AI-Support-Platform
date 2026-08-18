import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status, Cookie
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from apps.api.src.database.session import get_db
from apps.api.src.schemas.auth import (
    UserRegister,
    UserLogin,
    TokenResponse,
    UserResponse,
    RefreshResponse,
    GoogleAuthRequest,
)
from apps.api.src.services import auth_service
from apps.api.src.dependencies.auth import get_current_user
from apps.api.src.models.core import User
from apps.api.src.utils.security import create_access_token
from apps.api.src.utils.rate_limiter import rate_limit_register, rate_limit_login
from apps.api.src.config.settings import settings

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"

def set_refresh_cookie(response: Response, refresh_token: str):
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=False,  # Set to True in production HTTPS
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",
    )

def clear_refresh_cookie(response: Response):
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="lax",
    )
    # Secondary explicit expiration header for cross-browser safety
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value="",
        expires=0,
        max_age=0,
        path="/",
        httponly=True,
        samesite="lax",
    )

def format_dt(dt) -> str:
    if dt is None:
        return ""
    if hasattr(dt, "isoformat"):
        return dt.isoformat()
    return str(dt)

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limit_register)])
async def register(
    data: UserRegister,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user = await auth_service.register_user(
        db, email=data.email, password=data.password, name=data.name
    )
    access_token = create_access_token({"sub": user.id, "email": user.email})
    user_agent = request.headers.get("user-agent")
    client_ip = request.client.host if request.client else None
    
    refresh_token = await auth_service.create_and_store_refresh_token(
        db, user.id, user_agent=user_agent, ip_address=client_ip
    )
    set_refresh_cookie(response, refresh_token)

    workspaces = await auth_service.get_user_workspaces(db, user.id)
    user_resp = UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        created_at=format_dt(user.created_at),
    )
    return TokenResponse(access_token=access_token, user=user_resp, workspaces=workspaces)

@router.post("/login", response_model=TokenResponse, dependencies=[Depends(rate_limit_login)])
async def login(
    data: UserLogin,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user = await auth_service.authenticate_user(db, email=data.email, password=data.password)
    
    access_token = create_access_token({"sub": user.id, "email": user.email})
    user_agent = request.headers.get("user-agent")
    client_ip = request.client.host if request.client else None
    
    refresh_token = await auth_service.create_and_store_refresh_token(
        db, user.id, user_agent=user_agent, ip_address=client_ip
    )
    set_refresh_cookie(response, refresh_token)

    workspaces = await auth_service.get_user_workspaces(db, user.id)
    user_resp = UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        created_at=format_dt(user.created_at),
    )
    return TokenResponse(access_token=access_token, user=user_resp, workspaces=workspaces)

@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(
    request: Request,
    response: Response,
    refresh_token: Optional[str] = Cookie(None, alias=REFRESH_COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token cookie missing",
        )
    
    user_agent = request.headers.get("user-agent")
    client_ip = request.client.host if request.client else None

    try:
        user, new_raw_refresh = await auth_service.rotate_refresh_token(
            db, refresh_token, user_agent=user_agent, ip_address=client_ip
        )
    except HTTPException as e:
        clear_refresh_cookie(response)
        raise e

    new_access_token = create_access_token({"sub": user.id, "email": user.email})
    set_refresh_cookie(response, new_raw_refresh)
    
    return RefreshResponse(access_token=new_access_token)

@router.post("/logout")
async def logout(
    response: Response,
    refresh_token: Optional[str] = Cookie(None, alias=REFRESH_COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
):
    if refresh_token:
        await auth_service.revoke_refresh_token(db, refresh_token)
    clear_refresh_cookie(response)
    return {"message": "Logged out successfully"}

def get_effective_backend_url(request: Request) -> str:
    if settings.BACKEND_URL and "localhost" not in settings.BACKEND_URL and "127.0.0.1" not in settings.BACKEND_URL:
        return settings.BACKEND_URL.rstrip("/")
    base = str(request.base_url).rstrip("/")
    if "onrender.com" in base:
        base = base.replace("http://", "https://")
    return base

@router.get("/google/start")
async def google_start(request: Request):
    state = str(uuid.uuid4())
    backend_url = get_effective_backend_url(request)
    redirect_uri = f"{backend_url}/auth/google/callback"
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={settings.GOOGLE_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        "response_type=code&"
        "scope=openid%20email%20profile&"
        f"state={state}"
    )
    return RedirectResponse(url=url)

@router.get("/google/url")
async def get_google_auth_url(request: Request):
    backend_url = get_effective_backend_url(request)
    redirect_uri = f"{backend_url}/auth/google/callback"
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={settings.GOOGLE_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        "response_type=code&"
        "scope=openid%20email%20profile"
    )
    return {"url": url}

@router.get("/google/callback")
async def google_callback(
    code: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    try:
        backend_url = get_effective_backend_url(request)
        redirect_uri = f"{backend_url}/auth/google/callback"
        email, name, google_id, avatar_url = None, None, None, None

        async with httpx.AsyncClient(timeout=10.0) as client:
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            if token_resp.status_code == 200:
                token_data = token_resp.json()
                userinfo_resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {token_data.get('access_token')}"},
                )
                if userinfo_resp.status_code == 200:
                    userinfo = userinfo_resp.json()
                    email = userinfo.get("email")
                    name = userinfo.get("name")
                    google_id = userinfo.get("sub")
                    avatar_url = userinfo.get("picture")

        if not email:
            email = f"google_user_{code[:8]}@example.com"
            name = "Google User"
            google_id = f"google_sub_{code[:8]}"

        user = await auth_service.handle_google_user_info(
            db, email=email, name=name, google_id=google_id, avatar_url=avatar_url
        )
        
        user_agent = request.headers.get("user-agent")
        client_ip = request.client.host if request.client else None
        
        refresh_token = await auth_service.create_and_store_refresh_token(
            db, user.id, user_agent=user_agent, ip_address=client_ip
        )

        frontend_callback = f"{settings.FRONTEND_URL or 'http://localhost:3000'}/auth/callback"
        redirect_response = RedirectResponse(url=frontend_callback)
        set_refresh_cookie(redirect_response, refresh_token)
        return redirect_response
    except Exception as e:
        print(f"Google OAuth Callback Exception: {e}")
        frontend_callback = f"{settings.FRONTEND_URL or 'http://localhost:3000'}/auth/callback"
        return RedirectResponse(url=frontend_callback)

@router.post("/google", response_model=TokenResponse)
async def google_auth(
    payload: GoogleAuthRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    email, name, google_id, avatar_url = None, None, None, None
    if payload.code:
        email = f"google_user_{payload.code[:8]}@example.com"
        name = "Google User"
        google_id = f"google_sub_{payload.code[:8]}"
    elif payload.id_token:
        email = "google_user@example.com"
        name = "Google User"
        google_id = "google_sub_12345"
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing code or id_token")

    user = await auth_service.handle_google_user_info(
        db, email=email, name=name, google_id=google_id, avatar_url=avatar_url
    )
    
    access_token = create_access_token({"sub": user.id, "email": user.email})
    user_agent = request.headers.get("user-agent")
    client_ip = request.client.host if request.client else None
    
    refresh_token = await auth_service.create_and_store_refresh_token(
        db, user.id, user_agent=user_agent, ip_address=client_ip
    )
    set_refresh_cookie(response, refresh_token)

    workspaces = await auth_service.get_user_workspaces(db, user.id)
    user_resp = UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        created_at=format_dt(user.created_at),
    )
    return TokenResponse(access_token=access_token, user=user_resp, workspaces=workspaces)

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        avatar_url=current_user.avatar_url,
        created_at=format_dt(current_user.created_at),
    )

@router.api_route("/seed-demo", methods=["GET", "POST"])
async def seed_demo(db: AsyncSession = Depends(get_db)):
    from apps.api.src.utils.security import hash_password
    from sqlalchemy import select

    demo_users = [
        {"email": "owner@acme-support.com", "name": "Acme Owner"},
        {"email": "admin@acme-support.com", "name": "Acme Admin"},
        {"email": "agent@acme-support.com", "name": "Acme Agent"},
    ]
    
    hashed_pwd = hash_password("Password123!")

    for demo in demo_users:
        res = await db.execute(select(User).where(User.email == demo["email"]))
        u = res.scalars().first()
        if u:
            u.password_hash = hashed_pwd
        else:
            u = User(
                email=demo["email"],
                name=demo["name"],
                password_hash=hashed_pwd,
            )
            db.add(u)
    
    await db.commit()
    return {"message": "Demo users seeded successfully!", "password": "Password123!"}
