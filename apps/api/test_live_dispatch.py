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

from apps.api.src.services.email_service import send_team_invitation_email

async def main():
    target = "muhammedashif2819@gmail.com"
    print(f"Triggering email dispatch service for: {target}...")
    success = await send_team_invitation_email(
        to_email=target,
        role="admin",
        invite_link="http://localhost:3000/invite/live_test_token_999",
        workspace_name="SupportAI Production Workspace",
    )
    if success:
        print(f"\n[PASS] Real invitation email successfully dispatched to {target}!")
    else:
        print(f"\n[FAIL] Failed to dispatch email to {target}.")

if __name__ == "__main__":
    asyncio.run(main())
