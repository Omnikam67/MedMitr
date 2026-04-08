import os

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_auth_payload, require_roles, require_subject_match
from app.core.security import create_access_token
from app.models.delivery import (
    DeliveryBoyActionRequest,
    DeliveryBoyApprovalRequest,
    DeliveryBoyLoginRequest,
    DeliveryBoyRegisterRequest,
)
from app.services.delivery_service import DeliveryService


router = APIRouter(prefix="/delivery", tags=["Delivery Management"])


def _validate_system_manager(manager_id: str, manager_password: str) -> bool:
    expected_id = os.getenv("SYSTEM_MANAGER_ID", "sysmanager")
    expected_password = os.getenv("SYSTEM_MANAGER_PASSWORD", "SysManager@123")
    return manager_id == expected_id and manager_password == expected_password


@router.post("/register")
async def register_delivery_boy(request: DeliveryBoyRegisterRequest):
    return DeliveryService.register_delivery_boy(
        name=request.name,
        phone=request.phone,
        age=request.age,
        gender=request.gender,
        password=request.password,
    )


@router.post("/login")
async def login_delivery_boy(request: DeliveryBoyLoginRequest):
    result = DeliveryService.login_delivery_boy(request.name, request.password)
    if not result.get("success"):
        raise HTTPException(status_code=401, detail=result.get("message"))
    delivery_boy = result.get("delivery_boy") or {}
    result["access_token"] = create_access_token(
        {
            "sub": delivery_boy.get("id"),
            "role": "delivery_boy",
            "name": delivery_boy.get("name"),
            "phone": delivery_boy.get("phone"),
        }
    )
    result["token_type"] = "bearer"
    return result


@router.post("/manager/pending")
async def pending_delivery_boys(
    payload: dict,
    _: dict = Depends(require_roles("system_manager")),
):
    return {"success": True, "requests": DeliveryService.get_pending_delivery_boys()}


@router.post("/manager/history")
async def delivery_boy_history(
    payload: dict,
    _: dict = Depends(require_roles("system_manager")),
):
    return {"success": True, "requests": DeliveryService.get_delivery_boy_history()}


@router.post("/manager/approve")
async def approve_or_reject_delivery_boy(
    request: DeliveryBoyApprovalRequest,
    _: dict = Depends(require_roles("system_manager")),
):
    if request.approved:
        return DeliveryService.approve_delivery_boy(request.delivery_boy_id, request.manager_id)
    return DeliveryService.reject_delivery_boy(
        request.delivery_boy_id,
        request.manager_id,
        request.reason or "Rejected by system manager",
    )


@router.get("/orders/{delivery_boy_id}")
async def get_delivery_orders(
    delivery_boy_id: str,
    status: str | None = None,
    auth: dict = Depends(get_current_auth_payload),
):
    require_subject_match(delivery_boy_id, auth, allow_roles=("system_manager",))
    return {
        "success": True,
        "orders": DeliveryService.get_orders_for_delivery_boy(delivery_boy_id, status=status),
    }


@router.post("/orders/{order_id}/complete")
async def complete_delivery_order(
    order_id: int,
    request: DeliveryBoyActionRequest,
    auth: dict = Depends(get_current_auth_payload),
):
    require_subject_match(request.delivery_boy_id, auth, allow_roles=("system_manager",))
    result = DeliveryService.complete_order(order_id, request.delivery_boy_id, request.otp or "")
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message") or "Failed to complete order")
    return result


@router.post("/orders/{order_id}/cancel")
async def cancel_delivery_order(
    order_id: int,
    request: DeliveryBoyActionRequest,
    auth: dict = Depends(get_current_auth_payload),
):
    require_subject_match(request.delivery_boy_id, auth, allow_roles=("system_manager",))
    if not (request.reason or "").strip():
        raise HTTPException(status_code=400, detail="Cancellation reason is required")
    return DeliveryService.cancel_order(order_id, request.delivery_boy_id, request.reason or "")
