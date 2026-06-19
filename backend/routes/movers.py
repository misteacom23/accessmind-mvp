from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from mover_detection import detect_movers

router = APIRouter(prefix="/detect-movers", tags=["Mover Detection"])


@router.post("/")
def run_mover_detection(db: Session = Depends(get_db)):
    return detect_movers(db=db)
