from typing import Optional, List, Any
from pydantic import BaseModel, HttpUrl

class WorkspaceCreateRequest(BaseModel):
    business_name: str
    website_url: str
    industry: str
    logo_url: Optional[str] = None

class WorkspaceSetupRequest(BaseModel):
    name: str
    website_url: Optional[str] = None
    industry: Optional[str] = None
    brand_name: Optional[str] = None
    primary_color: Optional[str] = "#D4AF37"
    greeting_message: Optional[str] = "Hello! How can we help you today?"
    plan_name: Optional[str] = "Free"

class BusinessResponse(BaseModel):
    id: str
    name: str
    website_url: Optional[str] = None
    industry: Optional[str] = None
    logo_url: Optional[str] = None
    created_at: str

class WidgetConfigResponse(BaseModel):
    id: str
    brand_name: str
    tagline: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: str
    greeting_message: str

class WorkspaceResponse(BaseModel):
    id: str
    business_id: str
    workspace_uuid: str
    role: str
    status: str
    business: Optional[BusinessResponse] = None
    widget_config: Optional[WidgetConfigResponse] = None
    created_at: str
