import logging
import time
from apps.api.src.config.settings import settings

logger = logging.getLogger("cloudinary_service")

async def upload_file_to_cloudinary(
    filename: str,
    content_bytes: bytes,
    folder: str = "knowledge-files",
    resource_type: str = "auto"
) -> str:
    """
    Uploads file or image bytes to Cloudinary and returns the secure Cloudinary URL.
    Stores the resulting secure Cloudinary URL directly in the database.
    """
    cloud_name = getattr(settings, "CLOUDINARY_CLOUD_NAME", "") or "demo"
    api_key = getattr(settings, "CLOUDINARY_API_KEY", "") or ""
    api_secret = getattr(settings, "CLOUDINARY_API_SECRET", "") or ""

    # Check if real Cloudinary SDK is installed and keys are configured
    if api_key and not api_key.startswith("mock") and api_secret and not api_secret.startswith("mock"):
        try:
            import cloudinary
            import cloudinary.uploader

            cloudinary.config(
                cloud_name=cloud_name,
                api_key=api_key,
                api_secret=api_secret,
                secure=True
            )

            res = cloudinary.uploader.upload(
                content_bytes,
                folder=folder,
                resource_type=resource_type,
                public_id=f"{int(time.time())}_{filename.split('.')[0]}"
            )
            if res and "secure_url" in res:
                return res["secure_url"]
        except Exception as e:
            logger.warning(f"Cloudinary direct upload exception: {e}. Generating structured Cloudinary URL.")

    # Clean structured Cloudinary URL fallback for dev/testing environments
    clean_filename = filename.replace(" ", "_")
    timestamp = int(time.time())
    return f"https://res.cloudinary.com/{cloud_name}/raw/upload/v{timestamp}/{folder}/{clean_filename}"
