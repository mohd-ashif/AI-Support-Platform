from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field, field_validator
from apps.api.src.utils.security import validate_password_rules

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(...)
    name: str = Field(..., min_length=1)

    @field_validator("email", mode="before")
    def normalize_email(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip().lower()
        return v

    @field_validator("password")
    def validate_password(cls, v: str) -> str:
        validate_password_rules(v)
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email", mode="before")
    def normalize_email(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip().lower()
        return v

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True

class WorkspaceMemberInfo(BaseModel):
    workspace_id: str
    role: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    workspaces: List[Any] = Field(default_factory=list)

class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class GoogleAuthRequest(BaseModel):
    code: Optional[str] = None
    id_token: Optional[str] = None
    redirect_uri: Optional[str] = None
