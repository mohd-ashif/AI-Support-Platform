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

async def run_invite_endpoint_test():
    print("=" * 70)
    print("TESTING POST /settings/team/invite ENDPOINT DIRECTLY")
    print("=" * 70)

    db_url = getattr(settings, "DATABASE_URL", "")
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy import select
    from apps.api.src.models.core import User, TeamMember, Workspace

    engine = create_async_engine(db_url)
    async with AsyncSession(engine) as session:
        res_user = await session.execute(select(User).limit(1))
        user = res_user.scalars().first()

        res_ws = await session.execute(select(Workspace).order_by(Workspace.created_at.desc()).limit(1))
        ws = res_ws.scalars().first()

        if not user or not ws:
            print("ERROR: No user or workspace found.")
            return

        res_mem = await session.execute(
            select(TeamMember).where(TeamMember.workspace_id == ws.id, TeamMember.user_id == user.id)
        )
        member = res_mem.scalars().first()
        if not member:
            print("Creating temporary owner member for testing...")
            member = TeamMember(workspace_id=ws.id, user_id=user.id, role="owner")
            session.add(member)
            await session.commit()

        from apps.api.src.schemas.team import TeamMemberInvite
        from apps.api.src.routers.settings import create_team_invite, InviteRequest

        test_email = f"test_member_{os.urandom(4).hex()}@example.com"
        print(f"Calling create_team_invite for email: {test_email} with role: admin")

        payload = InviteRequest(email=test_email, role="admin")
        try:
            res = await create_team_invite(payload=payload, member=member, db=session)
            print("SUCCESS! Invite Created:")
            print(f"  - Invite ID: {res.id}")
            print(f"  - Target Email: {res.email}")
            print(f"  - Role: {res.role}")
            print(f"  - Link: {res.invite_link}")
        except Exception as e:
            print(f"ERROR executing create_team_invite: {e}")
            import traceback
            traceback.print_exc()

    await engine.dispose()
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_invite_endpoint_test())
