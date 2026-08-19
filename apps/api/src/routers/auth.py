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
from apps.api.src.services import auth_service, workspace_service
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

    workspaces = await workspace_service.get_user_workspaces(db, user.id)
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

    workspaces = await workspace_service.get_user_workspaces(db, user.id)
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
    s = str(val).strip()
    while (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")) or (s.startswith("`") and s.endswith("`")):
        s = s[1:-1].strip()
    # Strip any control characters, newlines, or invisible spaces
    s = "".join(c for c in s if c.isprintable() and not c.isspace())
    return s

def clean_url(val: Optional[str]) -> str:
    if not val:
        return ""
    s = str(val).strip()
    while (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")) or (s.startswith("`") and s.endswith("`")):
        s = s[1:-1].strip()
    return s.rstrip("/")

def get_effective_backend_url(request: Request) -> str:
    base = str(request.base_url).rstrip("/")
    if "onrender.com" in base:
        return base.replace("http://", "https://")
    backend_val = clean_url(settings.BACKEND_URL)
    if backend_val and "localhost" not in base and "127.0.0.1" not in base:
        return backend_val
    return base

def get_google_redirect_uri(request: Request) -> str:
    base = get_effective_backend_url(request)
    redirect_val = clean_url(settings.GOOGLE_REDIRECT_URI)
    
    # If running on production (e.g. onrender.com), but GOOGLE_REDIRECT_URI has localhost,
    # override redirect_val to prevent invalid local redirects in production
    if "localhost" not in base and "127.0.0.1" not in base:
        if not redirect_val or "localhost" in redirect_val or "127.0.0.1" in redirect_val:
            return f"{base}/auth/google/callback"

    if redirect_val:
        return redirect_val

    return f"{base}/auth/google/callback"

def get_google_client_id() -> str:
    import os
    env_val = os.environ.get("GOOGLE_CLIENT_ID")
    if env_val and env_val.strip():
        return clean_setting(env_val)
    return clean_setting(settings.GOOGLE_CLIENT_ID)

def get_google_client_secret() -> str:
    import os
    env_val = os.environ.get("GOOGLE_CLIENT_SECRET")
    if env_val and env_val.strip():
        return clean_setting(env_val)
    return clean_setting(settings.GOOGLE_CLIENT_SECRET)

@router.get("/google/start")
async def google_start(request: Request):
    state = str(uuid.uuid4())
    client_id = get_google_client_id()
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

@router.get("/google/debug-config")
async def google_debug_config(request: Request):
    c_id = get_google_client_id()
    c_sec = get_google_client_secret()
    r_uri = get_google_redirect_uri(request)
    f_url = get_effective_frontend_url(request)
    
    return {
        "client_id_prefix": c_id[:12] + "..." if c_id else "EMPTY",
        "client_id_suffix": "..." + c_id[-25:] if len(c_id) > 25 else c_id,
        "client_id_length": len(c_id),
        "client_secret_prefix": c_sec[:8] + "..." if c_sec else "EMPTY",
        "client_secret_suffix": "..." + c_sec[-6:] if len(c_sec) > 6 else c_sec,
        "client_secret_length": len(c_sec),
        "redirect_uri": r_uri,
        "effective_frontend_url": f_url,
    }

@router.get("/google/url")
async def get_google_auth_url(request: Request):
    client_id = get_google_client_id()
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
    frontend_val = clean_url(settings.FRONTEND_URL)
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
        client_id = get_google_client_id()
        client_secret = get_google_client_secret()
        email, name, google_id, avatar_url = None, None, None, None

        last_error_text = ""
        is_mock_mode = not client_id or client_id.startswith("mock-") or not client_secret or client_secret.startswith("mock-") or code.startswith("demo_")

        if not is_mock_mode:
            primary_uri = get_google_redirect_uri(request)
            redirect_candidates = [primary_uri]
            
            redirect_val = clean_setting(settings.GOOGLE_REDIRECT_URI)
            if redirect_val and redirect_val not in redirect_candidates:
                redirect_candidates.append(redirect_val)
            
            backend_base = get_effective_backend_url(request)
            for extra in [f"{backend_base}/auth/google/callback", f"{backend_base}/api/v1/auth/google/callback", f"{frontend_base}/google/callback", f"{frontend_base}/auth/callback"]:
                if extra and extra not in redirect_candidates:
                    redirect_candidates.append(extra)

            for r_uri in redirect_candidates:
                if email:
                    break
                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        token_resp = await client.post(
                            "https://oauth2.googleapis.com/token",
                            data={
                                "code": code,
                                "client_id": client_id,
                                "client_secret": client_secret,
                                "redirect_uri": r_uri,
                                "grant_type": "authorization_code",
                            },
                        )
                        if token_resp.status_code != 200:
                            # RFC 6749 HTTP Basic Auth fallback
                            logger.info(f"Form-encoded token exchange status {token_resp.status_code}. Retrying with Basic Auth for r_uri: {r_uri}")
                            token_resp = await client.post(
                                "https://oauth2.googleapis.com/token",
                                auth=(client_id, client_secret),
                                data={
                                    "code": code,
                                    "redirect_uri": r_uri,
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
                                name = userinfo.get("name") or f"{userinfo.get('given_name', '')} {userinfo.get('family_name', '')}".strip() or None
                                google_id = userinfo.get("sub")
                                avatar_url = userinfo.get("picture")

                            if not email and token_data.get("id_token"):
                                try:
                                    import jwt
                                    decoded = jwt.decode(token_data["id_token"], options={"verify_signature": False})
                                    email = decoded.get("email")
                                    if not name:
                                        name = decoded.get("name") or f"{decoded.get('given_name', '')} {decoded.get('family_name', '')}".strip() or None
                                    if not google_id:
                                        google_id = decoded.get("sub")
                                    if not avatar_url:
                                        avatar_url = decoded.get("picture")
                                except Exception as jwt_ex:
                                    logger.warning(f"Failed to decode id_token: {jwt_ex}")
                        else:
                            last_error_text = f"{token_resp.status_code}: {token_resp.text}"
                            logger.warning(f"Google token exchange failed for URI {r_uri}: {token_resp.status_code} - {token_resp.text}")
                except Exception as ex:
                    last_error_text = str(ex)
                    logger.warning(f"Google OAuth network exchange failed for URI {r_uri}: {ex}")

        # If mock mode or code is demo, provide clean demo fallback session
        if not email and not google_id:
            if is_mock_mode:
                logger.info("Using demo fallback for Google OAuth session.")
                email = "google.demo.user@supportai.com"
                name = "Demo Google User"
                google_id = "google_demo_id_999"
                avatar_url = "https://lh3.googleusercontent.com/a/default-user"
            else:
                logger.error(f"Google OAuth failed: No email or sub retrieved. Last error: {last_error_text}")
                err_detail = f"Google OAuth failed. {last_error_text if last_error_text else 'Please verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET settings in Render.'}"
                frontend_callback = f"{frontend_base}/auth/callback?error={quote(err_detail)}"
                return RedirectResponse(url=frontend_callback)

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
    client_id = get_google_client_id()
    client_secret = get_google_client_secret()

    is_mock_mode = not client_id or client_id.startswith("mock-") or not client_secret or client_secret.startswith("mock-") or (payload.code and payload.code.startswith("demo_"))

    if payload.code and not is_mock_mode:
        redirect_uris_to_try = [get_google_redirect_uri(request)]
        if payload.redirect_uri:
            c_uri = clean_setting(payload.redirect_uri)
            if c_uri not in redirect_uris_to_try:
                redirect_uris_to_try.append(c_uri)
        f_uri = f"{get_effective_frontend_url(request)}/google/callback"
        if f_uri not in redirect_uris_to_try:
            redirect_uris_to_try.append(f_uri)

        for r_uri in redirect_uris_to_try:
            if email:
                break
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    token_resp = await client.post(
                        "https://oauth2.googleapis.com/token",
                        data={
                            "code": payload.code,
                            "client_id": client_id,
                            "client_secret": client_secret,
                            "redirect_uri": r_uri,
                            "grant_type": "authorization_code",
                        },
                    )
                    if token_resp.status_code != 200:
                        token_resp = await client.post(
                            "https://oauth2.googleapis.com/token",
                            auth=(client_id, client_secret),
                            data={
                                "code": payload.code,
                                "redirect_uri": r_uri,
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
                            name = userinfo.get("name") or f"{userinfo.get('given_name', '')} {userinfo.get('family_name', '')}".strip() or None
                            google_id = userinfo.get("sub")
                            avatar_url = userinfo.get("picture")

                        if not email and token_data.get("id_token"):
                            try:
                                import jwt
                                decoded = jwt.decode(token_data["id_token"], options={"verify_signature": False})
                                email = decoded.get("email")
                                if not name:
                                    name = decoded.get("name") or f"{decoded.get('given_name', '')} {decoded.get('family_name', '')}".strip() or None
                                if not google_id:
                                    google_id = decoded.get("sub")
                                if not avatar_url:
                                    avatar_url = decoded.get("picture")
                            except Exception as jwt_ex:
                                logger.warning(f"Failed to decode id_token: {jwt_ex}")
            except Exception as ex:
                logger.warning(f"Google code exchange failed for URI {r_uri}: {ex}")

    elif payload.id_token:
        try:
            import jwt
            decoded = jwt.decode(payload.id_token, options={"verify_signature": False})
            email = decoded.get("email")
            name = decoded.get("name") or f"{decoded.get('given_name', '')} {decoded.get('family_name', '')}".strip() or None
            google_id = decoded.get("sub")
            avatar_url = decoded.get("picture")
        except Exception as ex:
            logger.error(f"Failed to decode Google id_token: {ex}")

    if not email and not google_id:
        if is_mock_mode:
            logger.info("Using demo fallback for POST /google auth payload.")
            email = "google.demo.user@supportai.com"
            name = "Demo Google User"
            google_id = "google_demo_id_999"
            avatar_url = "https://lh3.googleusercontent.com/a/default-user"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to retrieve Google user profile. Please verify your Google account credentials."
            )

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

    workspaces = await workspace_service.get_user_workspaces(db, user.id)
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
