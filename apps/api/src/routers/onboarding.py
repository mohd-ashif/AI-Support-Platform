from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from apps.api.src.database.session import get_db
from apps.api.src.dependencies.auth import get_current_user
from apps.api.src.models.core import (
    User,
    Workspace,
    TeamMember,
    WidgetConfig,
    SourceWeb,
    SourceFile,
)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

class StepStatus(BaseModel):
    key: str
    label: str
    completed: bool

class OnboardingStatusResponse(BaseModel):
    steps: List[StepStatus]
    completed_count: int
    total: int
    percent: int

@router.get("/status", response_model=OnboardingStatusResponse)
async def get_onboarding_status(
    x_workspace_id: Optional[str] = Header(None, alias="X-Workspace-Id"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Find user's active/primary workspace if header not passed
    workspace = None
    if x_workspace_id:
        res_ws = await db.execute(select(Workspace).where(Workspace.id == x_workspace_id))
        workspace = res_ws.scalars().first()

    if not workspace:
        res_mem = await db.execute(select(TeamMember).where(TeamMember.user_id == current_user.id))
        mem = res_mem.scalars().first()
        if mem:
            res_ws = await db.execute(select(Workspace).where(Workspace.id == mem.workspace_id))
            workspace = res_ws.scalars().first()

    if not workspace:
        return OnboardingStatusResponse(
            steps=[
                StepStatus(key="has_sources", label="Add Knowledge Sources", completed=False),
                StepStatus(key="has_widget_customized", label="Customize Chat Widget", completed=False),
                StepStatus(key="has_viewed_integration", label="View Integration Snippet", completed=False),
                StepStatus(key="has_invited_team", label="Invite Team Members", completed=False),
                StepStatus(key="has_tested_widget", label="Test Floating Widget", completed=False),
            ],
            completed_count=0,
            total=5,
            percent=0,
        )

    # 1. has_sources
    res_web = await db.execute(
        select(SourceWeb).where(SourceWeb.workspace_id == workspace.id, SourceWeb.status != "failed")
    )
    res_file = await db.execute(
        select(SourceFile).where(SourceFile.workspace_id == workspace.id, SourceFile.status != "failed")
    )
    has_sources = bool(res_web.scalars().first() or res_file.scalars().first())

    # 2. has_widget_customized
    res_wc = await db.execute(select(WidgetConfig).where(WidgetConfig.workspace_id == workspace.id))
    wc = res_wc.scalars().first()
    has_widget_customized = bool(wc and wc.greeting_message and wc.greeting_message.strip() != "")

    # 3. has_viewed_integration
    has_viewed_integration = bool(workspace.integration_viewed)

    # 4. has_invited_team
    res_tm = await db.execute(
        select(TeamMember).where(TeamMember.workspace_id == workspace.id, TeamMember.role != "owner")
    )
    has_invited_team = bool(res_tm.scalars().first())

    # 5. has_tested_widget (stubbed, remains false until Phase 6 trigger)
    has_tested_widget = bool(workspace.widget_tested)

    steps = [
        StepStatus(key="has_sources", label="Add Knowledge Sources", completed=has_sources),
        StepStatus(key="has_widget_customized", label="Customize Chat Widget", completed=has_widget_customized),
        StepStatus(key="has_viewed_integration", label="View Integration Snippet", completed=has_viewed_integration),
        StepStatus(key="has_invited_team", label="Invite Team Members", completed=has_invited_team),
        StepStatus(key="has_tested_widget", label="Test Floating Widget", completed=has_tested_widget),
    ]

    completed_count = sum(1 for s in steps if s.completed)
    percent = int((completed_count / 5) * 100)

    return OnboardingStatusResponse(
        steps=steps,
        completed_count=completed_count,
        total=5,
        percent=percent,
    )
