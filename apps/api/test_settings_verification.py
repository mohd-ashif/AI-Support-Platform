import sys
import os
import asyncio
from pathlib import Path

api_dir = Path(__file__).resolve().parent
project_root = api_dir.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(api_dir))

from dotenv import load_dotenv
load_dotenv(str(api_dir / ".env"))

from apps.api.src.config.settings import settings

async def run_settings_verification():
    print("=" * 70)
    print("VERIFICATION TEST: GET /settings/team & Header Validation")
    print("=" * 70)

    db_url = getattr(settings, "DATABASE_URL", "")
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy import select
    from apps.api.src.models.core import User, TeamMember, Workspace

    engine = create_async_engine(db_url)
    async with AsyncSession(engine) as session:
        # Get active user & workspace
        res_user = await session.execute(select(User).limit(1))
        user = res_user.scalars().first()
        
        res_ws = await session.execute(select(Workspace).order_by(Workspace.created_at.desc()).limit(1))
        ws = res_ws.scalars().first()

        if not user or not ws:
            print("ERROR: User or Workspace not found in database.")
            return

        print(f"Testing for User: {user.email} (ID: {user.id})")
        print(f"Testing for Workspace: {ws.id} (UUID: {ws.workspace_uuid})")

        # Test get_current_workspace_member dependency directly
        from apps.api.src.dependencies.auth import get_current_workspace_member
        
        # Scenario 1: X-Workspace-Id header supplied
        member_with_header = await get_current_workspace_member(
            x_workspace_id=ws.id,
            current_user=user,
            db=session,
        )
        print(f"\n[1/2] Dependency Test with X-Workspace-Id='{ws.id}':")
        print(f"      Member ID: {member_with_header.id} | Role: {member_with_header.role} | Workspace: {member_with_header.workspace_id} -> SUCCESS")

        # Scenario 2: X-Workspace-Id header omitted / None
        member_without_header = await get_current_workspace_member(
            x_workspace_id=None,
            current_user=user,
            db=session,
        )
        print(f"\n[2/2] Dependency Test with X-Workspace-Id=None (Fallback to primary workspace):")
        print(f"      Member ID: {member_without_header.id} | Role: {member_without_header.role} | Workspace: {member_without_header.workspace_id} -> SUCCESS")

        # Test list_team_members endpoint function
        from apps.api.src.routers.settings import list_team_members
        team_members_res = await list_team_members(member=member_with_header, db=session)
        print(f"\n[3/3] list_team_members execution returned {len(team_members_res)} team members.")
        for tm in team_members_res:
            print(f"      - Member Name: {tm.name} | Email: {tm.email} | Role: {tm.role}")

    await engine.dispose()
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_settings_verification())
