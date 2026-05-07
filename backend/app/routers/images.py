from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session
from werkzeug.utils import secure_filename
from app.database import get_db
from app.models import User, Cheatsheet, Image
from app.deps import get_current_user, get_optional_user
from app.utils import allowed_image_file, generate_image_filename
from app.config import settings

router = APIRouter(tags=["images"])


@router.get("/images/{cheatsheet_id}/{filename}")
def serve_image(
    cheatsheet_id: str,
    filename: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    cs = db.query(Cheatsheet).filter_by(id=cheatsheet_id).first()
    if not cs:
        raise HTTPException(status_code=404)

    if not cs.is_public:
        if not current_user or cs.user_id != current_user.id:
            raise HTTPException(status_code=404)

    image = db.query(Image).filter_by(cheatsheet_id=cheatsheet_id, filename=filename).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    return Response(
        content=image.data,
        media_type=image.content_type,
        headers={"Cache-Control": "max-age=3600"},
    )


@router.post("/api/cheatsheet/{cheatsheet_id}/image")
async def upload_image(
    cheatsheet_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.filename or file.filename == "":
        raise HTTPException(status_code=400, detail="No file selected")

    if not allowed_image_file(file.filename):
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: png, jpg, jpeg, gif, webp, svg")

    image_data = await file.read()
    if len(image_data) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")

    original_filename = secure_filename(file.filename) or "image.png"
    filename = generate_image_filename(original_filename)

    image = Image(
        cheatsheet_id=cheatsheet_id,
        filename=filename,
        data=image_data,
        content_type=file.content_type or "image/png",
    )
    db.add(image)
    db.commit()

    return {"success": True, "url": f"/images/{cheatsheet_id}/{filename}", "filename": filename}


@router.delete("/api/cheatsheet/{cheatsheet_id}/image/{filename}")
def delete_image(
    cheatsheet_id: str,
    filename: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cs = db.query(Cheatsheet).filter_by(id=cheatsheet_id, user_id=current_user.id).first()
    if not cs:
        raise HTTPException(status_code=404, detail="Cheatsheet not found")

    image = db.query(Image).filter_by(cheatsheet_id=cheatsheet_id, filename=filename).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    db.delete(image)
    db.commit()
    return {"success": True, "message": "Image deleted"}
