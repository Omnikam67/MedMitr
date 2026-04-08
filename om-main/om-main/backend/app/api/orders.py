from fastapi import APIRouter, Depends
from langfuse import observe

from app.core.auth import get_current_auth_payload, require_roles, require_subject_match
from app.services.order_service import OrderService

router = APIRouter()
service = OrderService()


@router.post("/orders")
@observe(name="create_order_api")
def create_order(payload: dict, auth: dict = Depends(require_roles("user", "admin"))):
    order_payload = dict(payload or {})
    if str(auth.get("role") or "").lower() == "user":
        order_payload["patient_id"] = auth.get("sub")
    result = service.create_order(**order_payload)
    if isinstance(result, dict):
        result = dict(result)
        result.pop("otp_code", None)
    return result


@router.get("/admin/orders")
def get_all_orders_with_user_info(_: dict = Depends(require_roles("admin", "system_manager"))):
    return service.get_all_orders_with_user_info()


@router.get("/admin/order-analytics")
def get_order_analytics(_: dict = Depends(require_roles("admin", "system_manager"))):
    return service.get_order_analytics()


@router.post("/orders/{order_id}/cancel")
def cancel_order(order_id: int, payload: dict, auth: dict = Depends(get_current_auth_payload)):
    patient_id = payload.get("patient_id") or payload.get("session_id") or auth.get("sub")
    require_subject_match(patient_id, auth, allow_roles=("admin", "system_manager"))
    return service.cancel_order(order_id=order_id, patient_id=patient_id)


@router.put("/admin/orders/{order_id}/status")
def admin_set_order_status(
    order_id: int,
    payload: dict,
    _: dict = Depends(require_roles("admin", "system_manager")),
):
    status = payload.get("status")
    otp = payload.get("otp")
    return service.admin_set_order_status(order_id=order_id, status=status, otp=otp)
