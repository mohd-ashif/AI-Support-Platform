from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field

class TeamMemberInvite(BaseModel):
    email: EmailStr
    role: str = Field("agent", pattern="^(owner|admin|agent)$")

class RoleUpdateRequest(BaseModel):
    role: str = Field(..., pattern="^(owner|admin|agent)$")

class TeamMemberResponse(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    name: str
    email: str
    role: str
    avatar_url: Optional[str] = None
    joined_at: str

class DemoAccountInfo(BaseModel):
    email: str
    password: str = "Password123!"
    role: str
    name: str

class DemoAccountsSeedResponse(BaseModel):
    message: str
    accounts: List[DemoAccountInfo]
