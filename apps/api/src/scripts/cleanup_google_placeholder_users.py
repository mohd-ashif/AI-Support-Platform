import asyncio
import logging
from sqlalchemy import select, delete
from apps.api.src.database.session import AsyncSessionLocal
from apps.api.src.models.core import User, RefreshToken, TeamMember

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cleanup_google_users")

async def cleanup_placeholder_google_users():
    """
    Inspects database for any legacy placeholder Google user records
    (e.g., email matching 'google_user_%' or name 'Google User') and removes unlinked placeholders
    or prepares them for profile re-sync.
    """
    logger.info("Checking database for legacy placeholder Google users...")
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            select(User).where(
                (User.email.like("google_user_%")) | (User.name == "Google User")
            )
        )
        placeholder_users = res.scalars().all()
        logger.info(f"Found {len(placeholder_users)} placeholder Google user(s).")
        
        for user in placeholder_users:
            logger.info(f"Placeholder User ID: {user.id}, Email: {user.email}, Name: {user.name}, Google ID: {user.google_id}")
            member_res = await db.execute(select(TeamMember).where(TeamMember.user_id == user.id))
            memberships = member_res.scalars().all()
            if not memberships:
                logger.info(f"Cleaning up unused placeholder user {user.id} ({user.email})...")
                await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
                await db.delete(user)

        await db.commit()
        logger.info("Cleanup completed successfully.")

if __name__ == "__main__":
    asyncio.run(cleanup_placeholder_google_users())
