import time
import hashlib
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from apps.api.src.dependencies.auth import get_current_user
from apps.api.src.models.core import User
from apps.api.src.config.settings import settings

router = APIRouter(prefix="/uploads", tags=["uploads"])

@router.get("/cloudinary-signature")
async def get_cloudinary_signature(
    current_user: User = Depends(get_current_user),
):
    timestamp = int(time.time())
    folder = "workspace-logos"

    # Cloudinary signature format: sort params alphabetically, join with &, append secret
    params_to_sign = f"folder={folder}&timestamp={timestamp}{settings.CLOUDINARY_API_SECRET}"
    signature = hashlib.sha256(params_to_sign.encode("utf-8")).hexdigest()

    return {
        "timestamp": timestamp,
        "signature": signature,
        "api_key": settings.CLOUDINARY_API_KEY,
        "cloud_name": settings.CLOUDINARY_CLOUD_NAME,
        "folder": folder,
    }

@router.post("/image")
async def upload_image_direct(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    from apps.api.src.services.cloudinary_service import upload_file_to_cloudinary
    content_bytes = await file.read()
    cloudinary_url = await upload_file_to_cloudinary(
        file.filename, content_bytes, folder="workspace-uploads", resource_type="image"
    )
    return {"url": cloudinary_url, "filename": file.filename}
