import re
import hashlib
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Cheatsheet, Group
from app.deps import get_current_user
from app.utils import generate_cheatsheet_id

router = APIRouter(prefix="/api", tags=["cheatsheets"])


@router.post("/cheatsheet")
def create_cheatsheet(request_data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cheatsheet_id = request_data.get("id")
    if not cheatsheet_id:
        title = request_data.get("title", "Untitled")
        cheatsheet_id = generate_cheatsheet_id(title, current_user.id)

    now = datetime.utcnow()
    cheatsheet_data = {
        "id": cheatsheet_id,
        "title": request_data.get("title", "Untitled"),
        "group": request_data.get("group", ""),
        "sections": request_data.get("sections", []),
        "created_at": request_data.get("created_at") or now.isoformat(),
        "updated_at": now.isoformat(),
    }

    group_id = request_data.get("group") or None
    if group_id:
        existing_group = db.query(Group).filter_by(id=group_id, user_id=current_user.id).first()
        if not existing_group:
            db.add(Group(id=group_id, user_id=current_user.id, name=group_id))

    existing = db.query(Cheatsheet).filter_by(id=cheatsheet_id, user_id=current_user.id).first()
    if existing:
        existing.title = cheatsheet_data["title"]
        existing.data = cheatsheet_data
        existing.group_id = group_id
        existing.updated_at = now
    else:
        cs = Cheatsheet(
            id=cheatsheet_id,
            user_id=current_user.id,
            title=cheatsheet_data["title"],
            data=cheatsheet_data,
            group_id=group_id,
            created_at=now,
            updated_at=now,
        )
        db.add(cs)

    db.commit()
    return {"success": True, "id": cheatsheet_id, "message": "Cheatsheet saved successfully"}


@router.get("/cheatsheet/{cheatsheet_id}")
def get_cheatsheet(cheatsheet_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cs = db.query(Cheatsheet).filter_by(id=cheatsheet_id, user_id=current_user.id).first()
    if not cs:
        raise HTTPException(status_code=404, detail="Cheatsheet not found")
    return cs.data


@router.get("/cheatsheets")
def get_cheatsheets(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cheatsheets = (
        db.query(Cheatsheet)
        .filter_by(user_id=current_user.id)
        .order_by(Cheatsheet.updated_at.desc())
        .all()
    )
    return [
        {
            "id": c.id,
            "title": c.title,
            "group": c.group_id or "",
            "created_at": c.created_at.isoformat() if c.created_at else "",
            "updated_at": c.updated_at.isoformat() if c.updated_at else "",
        }
        for c in cheatsheets
    ]


@router.delete("/cheatsheet/{cheatsheet_id}")
def delete_cheatsheet(cheatsheet_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cs = db.query(Cheatsheet).filter_by(id=cheatsheet_id, user_id=current_user.id).first()
    if not cs:
        raise HTTPException(status_code=404, detail="Cheatsheet not found")
    db.delete(cs)
    db.commit()
    return {"success": True, "message": "Cheatsheet deleted"}


@router.put("/cheatsheet/{cheatsheet_id}/group")
def update_cheatsheet_group(
    cheatsheet_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cs = db.query(Cheatsheet).filter_by(id=cheatsheet_id, user_id=current_user.id).first()
    if not cs:
        raise HTTPException(status_code=404, detail="Cheatsheet not found")

    group_id = body.get("group", "") or None
    if group_id:
        existing_group = db.query(Group).filter_by(id=group_id, user_id=current_user.id).first()
        if not existing_group:
            db.add(Group(id=group_id, user_id=current_user.id, name=group_id))
    cs.group_id = group_id
    cs_data = dict(cs.data)
    cs_data["group"] = group_id
    cs.data = cs_data
    db.commit()
    return {"success": True}


@router.get("/cheatsheet/public/{cheatsheet_id}")
def get_public_cheatsheet(cheatsheet_id: str, db: Session = Depends(get_db)):
    cs = db.query(Cheatsheet).filter_by(id=cheatsheet_id, is_public=True).first()
    if not cs:
        raise HTTPException(status_code=404, detail="Cheatsheet not found or not public")
    return cs.data


@router.put("/cheatsheet/{cheatsheet_id}/share")
def toggle_share(cheatsheet_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cs = db.query(Cheatsheet).filter_by(id=cheatsheet_id, user_id=current_user.id).first()
    if not cs:
        raise HTTPException(status_code=404, detail="Cheatsheet not found")

    cs.is_public = not cs.is_public
    db.commit()

    share_url = f"/shared/{cheatsheet_id}" if cs.is_public else None
    return {"success": True, "is_public": cs.is_public, "share_url": share_url}
