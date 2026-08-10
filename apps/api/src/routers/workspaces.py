from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.src.database.session import get_db
from apps.api.src.dependencies.auth import get_current_user, get_current_workspace_member
from apps.api.src.models.core import User, TeamMember
from apps.api.src.schemas.workspace import WorkspaceSetupRequest, WorkspaceCreateRequest, WorkspaceResponse
from apps.api.src.services import workspace_service

router = APIRouter(prefix="/workspaces", tags=["workspaces"])

def format_dt(dt) -> str:
    if dt is None:
        return ""
    if hasattr(dt, "isoformat"):
        return dt.isoformat()
    return str(dt)

@router.post("", response_model=WorkspaceResponse)
async def create_workspace(
    payload: WorkspaceCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        ws_data = await workspace_service.create_workspace_step1(
            db,
            user_id=str(current_user.id),
            business_name=payload.business_name,
            website_url=payload.website_url,
            industry=payload.industry,
            logo_url=payload.logo_url,
        )
        return ws_data
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error creating workspace: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create workspace: {str(e)}",
        )

@router.post("/setup", response_model=WorkspaceResponse)
async def setup_workspace(
    payload: WorkspaceSetupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ws = await workspace_service.create_workspace_setup(
        db,
        user_id=current_user.id,
        name=payload.name,
        website_url=payload.website_url,
        industry=payload.industry,
        brand_name=payload.brand_name,
        primary_color=payload.primary_color,
        greeting_message=payload.greeting_message,
        plan_name=payload.plan_name,
    )
    workspaces = await workspace_service.get_user_workspaces(db, current_user.id)
    created_ws = next((w for w in workspaces if w["id"] == ws.id), None)
    if not created_ws:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve created workspace",
        )
    return created_ws

@router.get("", response_model=List[WorkspaceResponse])
async def list_user_workspaces(

    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspaces = await workspace_service.get_user_workspaces(db, current_user.id)
    return workspaces

@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace_details(
    workspace_id: str,
    member: TeamMember = Depends(get_current_workspace_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspaces = await workspace_service.get_user_workspaces(db, current_user.id)
    target = next((w for w in workspaces if w["id"] == workspace_id), None)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )
    return target
