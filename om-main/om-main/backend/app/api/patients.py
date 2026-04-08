from fastapi import APIRouter, Depends
from langfuse import observe

from app.core.auth import get_current_auth_payload, require_subject_match
from app.services.history_service import HistoryService

router = APIRouter()
service = HistoryService()


@router.get("/patients/{patient_ID}/history")
@observe(name="get_patient_history")
def get_history(patient_ID: str, auth: dict = Depends(get_current_auth_payload)):
    require_subject_match(patient_ID, auth, allow_roles=("admin", "system_manager"))
    return service.get_patient_history(patient_ID)
