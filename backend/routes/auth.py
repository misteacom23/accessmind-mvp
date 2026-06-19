from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Dependency — extracts and validates JWT from Authorization header.
    Use this in any endpoint that requires authentication.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    user = auth_service.get_current_user_from_token(token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


def require_can_approve(current_user=Depends(get_current_user)):
    if not auth_service.can_approve(current_user.role):
        raise HTTPException(
            status_code=403,
            detail=f"Role '{current_user.role}' cannot approve or reject requests. Required: manager or admin."
        )
    return current_user


def require_can_create(current_user=Depends(get_current_user)):
    if not auth_service.can_create_requests(current_user.role):
        raise HTTPException(
            status_code=403,
            detail=f"Role '{current_user.role}' cannot create governance requests. Required: analyst or admin."
        )
    return current_user


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    try:
        return auth_service.login(db, req.email, req.password)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/me")
def get_me(current_user=Depends(get_current_user)):
    return auth_service.format_user(current_user)
