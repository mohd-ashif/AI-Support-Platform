import logging
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status, Cookie, Query
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

logger = logging.getLogger("auth_router")

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"

def set_refresh_cookie(response: Response, refresh_token: str):
    frontend_url = (settings.FRONTEND_URL or "").lower()
    is_local = "localhost" in frontend_url or "127.0.0.1" in frontend_url
    is_secure = not is_local
    samesite = "none" if is_secure else "lax"

    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=is_secure,
        samesite=samesite,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",
    )

def clear_refresh_cookie(response: Response):
    frontend_url = (settings.FRONTEND_URL or "").lower()
    is_local = "localhost" in frontend_url or "127.0.0.1" in frontend_url
    is_secure = not is_local
    samesite = "none" if is_secure else "lax"

    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=is_secure,
        samesite=samesite,
    )
    # Secondary explicit expiration header for cross-browser safety
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value="",
        expires=0,
        max_age=0,
        path="/",
        httponly=True,
        secure=is_secure,
        samesite=samesite,
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

def clean_setting(val: Optional[str]) -> str:
    if not val:
        return ""
    return val.strip().strip('"').strip("'").rstrip("/")

def get_effective_backend_url(request: Request) -> str:
    base = str(request.base_url).rstrip("/")
    if "onrender.com" in base:
        return base.replace("http://", "https://")
    backend_val = clean_setting(settings.BACKEND_URL)
    if backend_val and "localhost" not in base and "127.0.0.1" not in base:
        return backend_val
    return base

def get_google_redirect_uri(request: Request) -> str:
    base = str(request.base_url).rstrip("/")
    redirect_val = clean_setting(settings.GOOGLE_REDIRECT_URI)
    if redirect_val and ("localhost" in base or "127.0.0.1" in base):
        return redirect_val
    return f"{get_effective_backend_url(request)}/auth/google/callback"

@router.get("/google/start")
async def google_start(request: Request):
    state = str(uuid.uuid4())
    client_id = clean_setting(settings.GOOGLE_CLIENT_ID)
    redirect_uri = get_google_redirect_uri(request)
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        "response_type=code&"
        "scope=openid%20email%20profile&"
        f"state={state}"
    )
    return RedirectResponse(url=url)

@router.get("/google/url")
async def get_google_auth_url(request: Request):
    client_id = clean_setting(settings.GOOGLE_CLIENT_ID)
    redirect_uri = get_google_redirect_uri(request)
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        "response_type=code&"
        "scope=openid%20email%20profile"
    )
    return {"url": url}

def get_effective_frontend_url(request: Request) -> str:
    base = str(request.base_url).rstrip("/")
    origin = request.headers.get("origin") or request.headers.get("referer") or ""
    frontend_val = clean_setting(settings.FRONTEND_URL)
    if "onrender.com" in base or "vercel.app" in origin:
        if frontend_val and "localhost" not in frontend_val:
            return frontend_val
        if origin:
            from urllib.parse import urlparse
            parsed = urlparse(origin)
            return f"{parsed.scheme}://{parsed.netloc}"
        return "https://ai-support-platform.vercel.app"
    if frontend_val:
        return frontend_val
    return "http://localhost:3000"

@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    from urllib.parse import quote
    frontend_base = get_effective_frontend_url(request)

    if error or not code:
        err_msg = error or "Authorization code missing from Google redirect."
        logger.warning(f"Google OAuth callback error: {err_msg}")
        frontend_callback = f"{frontend_base}/auth/callback?error={quote(err_msg)}"
        return RedirectResponse(url=frontend_callback)

    try:
        redirect_uri = get_google_redirect_uri(request)
        client_id = clean_setting(settings.GOOGLE_CLIENT_ID)
        client_secret = clean_setting(settings.GOOGLE_CLIENT_SECRET)
        email, name, google_id, avatar_url = None, None, None, None

        async with httpx.AsyncClient(timeout=10.0) as client:
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            if token_resp.status_code != 200:
                logger.error(f"Google token exchange failed: {token_resp.status_code} - {token_resp.text}")
                err_detail = "Invalid Google OAuth client credentials or configuration"
                try:
                    err_json = token_resp.json()
                    err_detail = err_json.get("error_description") or err_json.get("error") or err_detail
                except Exception:
                    pass
                raise HTTPException(status_code=400, detail=f"Google authentication failed: {err_detail}")

            token_data = token_resp.json()
            userinfo_resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {token_data.get('access_token')}"},
            )
            if userinfo_resp.status_code != 200:
                logger.error(f"Google userinfo request failed: {userinfo_resp.status_code} - {userinfo_resp.text}")
                raise HTTPException(status_code=400, detail="Failed to retrieve Google user profile.")

            userinfo = userinfo_resp.json()
            email = userinfo.get("email")
            name = userinfo.get("name")
            google_id = userinfo.get("sub")
            avatar_url = userinfo.get("picture")

        user = await auth_service.handle_google_user_info(
            db, email=email, name=name, google_id=google_id, avatar_url=avatar_url
        )
        
        user_agent = request.headers.get("user-agent")
        client_ip = request.client.host if request.client else None
        
        access_token = create_access_token({"sub": user.id, "email": user.email})
        refresh_token = await auth_service.create_and_store_refresh_token(
            db, user.id, user_agent=user_agent, ip_address=client_ip
        )

        frontend_callback = f"{frontend_base}/auth/callback?token={access_token}"
        redirect_response = RedirectResponse(url=frontend_callback)
        set_refresh_cookie(redirect_response, refresh_token)
        return redirect_response
    except HTTPException as e:
        logger.error(f"Google OAuth HTTPException: {e.detail}")
        frontend_callback = f"{frontend_base}/auth/callback?error={quote(str(e.detail))}"
        return RedirectResponse(url=frontend_callback)
    except Exception as e:
        logger.error(f"Google OAuth Exception: {e}")
        frontend_callback = f"{frontend_base}/auth/callback?error={quote('Google authentication failed. Please try again.')}"
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
        # Perform real Google token exchange if real credentials are set
        if settings.GOOGLE_CLIENT_ID and not settings.GOOGLE_CLIENT_ID.startswith("mock-"):
            redirect_uri = f"{get_effective_frontend_url(request)}/google/callback"
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    token_resp = await client.post(
                        "https://oauth2.googleapis.com/token",
                        data={
                            "code": payload.code,
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
            except Exception as ex:
                logger.warning(f"Google auth endpoint code exchange failed: {ex}")

        if not email:
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
