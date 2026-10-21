from fastapi import APIRouter, Depends
from supabase import Client

from app.core.auth import CurrentUser, get_current_user
from app.core.db import get_db
from app.services import notifications as svc

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    return svc.list_for_user(db, user.id)


@router.post("/read-all", status_code=204)
def read_all(user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    svc.mark_all_read(db, user.id)


@router.post("/{notification_id}/read", status_code=204)
def read_one(notification_id: str, user: CurrentUser = Depends(get_current_user), db: Client = Depends(get_db)):
    svc.mark_read(db, notification_id, user.id)
