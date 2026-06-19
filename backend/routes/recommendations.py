from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from recommendation_engine import recommend_access

router = APIRouter(prefix="/recommend-access", tags=["Recommendations"])


class RecommendRequest(BaseModel):
    name: str = ""
    team: str
    role: str


@router.post("/")
def get_recommendations(req: RecommendRequest, db: Session = Depends(get_db)):
    result = recommend_access(team=req.team, role=req.role, db=db)
    return result
