import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Cheatsheet
from app.deps import get_current_user

router = APIRouter(tags=["export"])


@router.get("/download-json/{cheatsheet_id}")
def download_json(
    cheatsheet_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cs = db.query(Cheatsheet).filter_by(id=cheatsheet_id, user_id=current_user.id).first()
    if not cs:
        raise HTTPException(status_code=404, detail="Cheatsheet not found")

    json_content = json.dumps(cs.data, indent=2, ensure_ascii=False)
    safe_title = "".join(c for c in cs.title if c.isalnum() or c in (" ", "-", "_")).rstrip()
    filename = f"{safe_title}.json"

    return Response(
        content=json_content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
