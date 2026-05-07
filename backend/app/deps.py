from fastapi import Depends, HTTPException, Query, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.auth.service import verify_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user(
    header_token: str | None = Depends(oauth2_scheme),
    token_param: str | None = Query(default=None, alias="token"),
    db: Session = Depends(get_db),
) -> User:
    token = header_token or token_param
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_optional_user(
    header_token: str | None = Depends(oauth2_scheme_optional),
    token_param: str | None = Query(default=None, alias="token"),
    db: Session = Depends(get_db),
) -> User | None:
    token = header_token or token_param
    if not token:
        return None
    user_id = verify_token(token)
    if not user_id:
        return None
    return db.get(User, user_id)
