import re
import hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Group, Cheatsheet
from app.deps import get_current_user

router = APIRouter(prefix="/api", tags=["groups"])


@router.get("/groups")
def get_groups(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    groups = db.query(Group).filter_by(user_id=current_user.id).all()
    return [{"id": g.id, "name": g.name, "color": g.color} for g in groups]


@router.post("/groups")
def create_group(body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Group name is required")

    existing = db.query(Group).filter_by(user_id=current_user.id).all()
    if any(g.name.lower() == name.lower() for g in existing):
        raise HTTPException(status_code=400, detail="Group already exists")

    group_id = re.sub(r"[^a-zA-Z0-9]", "_", name.lower())[:20]
    group_id = f"{group_id}_{hashlib.md5(f'{current_user.id}:{name}'.encode()).hexdigest()[:4]}"

    new_group = Group(
        id=group_id,
        user_id=current_user.id,
        name=name,
        color=body.get("color", "#667eea"),
    )
    db.add(new_group)
    db.commit()
    return {"success": True, "group": {"id": group_id, "name": name, "color": new_group.color}}


@router.put("/groups/{group_id}")
def update_group(group_id: str, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    group = db.query(Group).filter_by(id=group_id, user_id=current_user.id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if "name" in body:
        group.name = body["name"]
    if "color" in body:
        group.color = body["color"]
    db.commit()
    return {"success": True, "group": {"id": group.id, "name": group.name, "color": group.color}}


@router.delete("/groups/{group_id}")
def delete_group(group_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    group = db.query(Group).filter_by(id=group_id, user_id=current_user.id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    for cs in db.query(Cheatsheet).filter_by(group_id=group_id, user_id=current_user.id).all():
        cs.group_id = None
        cs_data = dict(cs.data)
        cs_data["group"] = ""
        cs.data = cs_data

    db.delete(group)
    db.commit()
    return {"success": True}
