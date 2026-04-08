import os
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import get_current_auth_payload, require_roles, require_subject_match
from app.core.security import create_access_token
from app.models.user import (
    AuthResponse,
    ForgotPasswordRequest,
    ManagerActionRequest,
    PharmacistSignupRequest,
    ResetPasswordRequest,
    SystemManagerLoginRequest,
    UserLogin,
    UserRegister,
)
from app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _build_access_token(user: dict) -> str:
    return create_access_token(
        {
            "sub": user.get("id"),
            "role": user.get("role"),
            "phone": user.get("phone"),
            "shop_id": user.get("shop_id"),
            "pharma_id": user.get("pharma_id"),
            "name": user.get("name"),
        }
    )


@router.post("/register", response_model=AuthResponse)
async def register(request: UserRegister):
    if request.phone:
        role = "user"
        result = UserService.register_user(
            name=request.name,
            phone=request.phone,
            shop_id=None,
            password=request.password,
            age=request.age,
            role=role,
            preferred_language=request.preferred_language,
        )
    elif request.shop_id:
        role = "admin"
        result = UserService.register_user(
            name=request.name,
            phone=None,
            shop_id=request.shop_id,
            password=request.password,
            age=None,
            role=role,
            preferred_language=request.preferred_language,
        )
    else:
        return AuthResponse(success=False, message="Either phone or shop_id is required")

    if result["success"]:
        return AuthResponse(
            success=True,
            message=result["message"],
            user=result["user"],
            session_id=result["user"]["id"],
            access_token=_build_access_token(result["user"]),
        )
    return AuthResponse(success=False, message=result["message"])


@router.post("/login", response_model=AuthResponse)
async def login(request: UserLogin):
    if request.phone:
        result = UserService.login_user(
            phone=request.phone,
            shop_id=None,
            password=request.password,
            role="user",
        )
    elif request.shop_id or request.pharma_id:
        result = UserService.login_user(
            phone=None,
            shop_id=request.shop_id or request.pharma_id,
            password=request.password,
            role="admin",
            pharma_id=request.pharma_id,
        )
    else:
        return AuthResponse(success=False, message="Either phone or shop_id is required")

    if result["success"]:
        return AuthResponse(
            success=True,
            message=result["message"],
            user=result["user"],
            session_id=result["user"]["id"],
            access_token=_build_access_token(result["user"]),
        )
    return AuthResponse(success=False, message=result["message"])


@router.post("/forgot-password/request")
async def request_password_reset(request: ForgotPasswordRequest):
    return UserService.request_password_reset(request.phone)


@router.post("/forgot-password/reset")
async def reset_password(request: ResetPasswordRequest):
    if len(request.new_password or "") < 6:
        return {"success": False, "message": "Password must be at least 6 characters"}
    return UserService.reset_password(
        phone=request.phone,
        otp=request.otp,
        new_password=request.new_password,
    )


class ProfileUpdate(BaseModel):
    user_id: str
    name: Optional[str] = None
    phone: Optional[str] = None
    preferred_language: Optional[str] = None


class TrustedContactsImportRequest(BaseModel):
    user_id: str
    contacts: list[str]


@router.post("/profile", response_model=AuthResponse)
async def update_profile(request: ProfileUpdate, auth: dict = Depends(get_current_auth_payload)):
    require_subject_match(request.user_id, auth, allow_roles=("admin", "system_manager"))
    updated = UserService.update_profile(
        user_id=request.user_id,
        name=request.name,
        phone=request.phone,
        preferred_language=request.preferred_language,
    )
    if not updated:
        return AuthResponse(success=False, message="User not found")
    return AuthResponse(
        success=True,
        message="Profile updated",
        user=updated,
        session_id=updated.get("id"),
        access_token=_build_access_token(updated),
    )


@router.post("/contacts/import")
async def import_trusted_contacts(
    request: TrustedContactsImportRequest,
    auth: dict = Depends(get_current_auth_payload),
):
    require_subject_match(request.user_id, auth)
    return UserService.import_trusted_contacts(
        user_id=request.user_id,
        contacts=request.contacts,
    )


@router.get("/contacts/status/{user_id}")
async def get_trusted_contacts_status(user_id: str, auth: dict = Depends(get_current_auth_payload)):
    require_subject_match(user_id, auth, allow_roles=("system_manager",))
    return UserService.get_trusted_contact_status(user_id)


@router.get("/contacts/{user_id}")
async def get_trusted_contacts(user_id: str, auth: dict = Depends(get_current_auth_payload)):
    require_subject_match(user_id, auth, allow_roles=("system_manager",))
    return UserService.get_trusted_contacts(user_id)


@router.post("/pharmacist/request")
async def pharmacist_request(request: PharmacistSignupRequest):
    required_values = [
        request.store_name,
        request.owner_name,
        request.mobile_number,
        request.email,
        request.pharma_id,
        request.store_address,
        request.pharmacy_license_number,
        request.pharmacy_address,
        request.password,
    ]
    if any(not str(value).strip() for value in required_values):
        return {"success": False, "message": "All pharmacist registration fields are required"}
    return UserService.request_pharmacist_signup(
        store_name=request.store_name.strip(),
        owner_name=request.owner_name.strip(),
        mobile_number=request.mobile_number.strip(),
        email=request.email.strip(),
        pharma_id=request.pharma_id.strip(),
        store_address=request.store_address.strip(),
        pharmacy_license_number=request.pharmacy_license_number.strip(),
        pharmacy_address=request.pharmacy_address.strip(),
        password=request.password,
    )


def _validate_system_manager(manager_id: str, password: str) -> bool:
    expected_id = os.getenv("SYSTEM_MANAGER_ID", "sysmanager")
    expected_password = os.getenv("SYSTEM_MANAGER_PASSWORD", "SysManager@123")
    return manager_id == expected_id and password == expected_password


@router.post("/system-manager/login", response_model=AuthResponse)
async def system_manager_login(request: SystemManagerLoginRequest):
    if not _validate_system_manager(request.manager_id, request.password):
        return AuthResponse(success=False, message="Invalid System Manager credentials")
    user = {
        "id": "system-manager-001",
        "name": "System Manager",
        "phone": None,
        "shop_id": request.manager_id,
        "role": "system_manager",
        "preferred_language": "en",
    }
    return AuthResponse(
        success=True,
        message="System Manager login successful",
        user=user,
        session_id=user["id"],
        access_token=create_access_token(
            {
                "sub": user["id"],
                "role": "system_manager",
                "manager_id": request.manager_id,
                "name": user["name"],
            }
        ),
    )


@router.post("/system-manager/pharmacist-requests")
async def list_pharmacist_requests(
    request: ManagerActionRequest,
    _: dict = Depends(require_roles("system_manager")),
):
    return {"success": True, "requests": UserService.list_pharmacist_requests()}


@router.post("/system-manager/pharmacist-history")
async def list_pharmacist_history(
    request: ManagerActionRequest,
    _: dict = Depends(require_roles("system_manager")),
):
    return {"success": True, "requests": UserService.list_pharmacist_request_history()}


@router.post("/system-manager/pharmacist-requests/{request_id}/approve")
async def approve_pharmacist_request(
    request_id: str,
    request: ManagerActionRequest,
    _: dict = Depends(require_roles("system_manager")),
):
    return UserService.approve_pharmacist_request(request_id)


@router.post("/system-manager/pharmacist-requests/{request_id}/reject")
async def reject_pharmacist_request(
    request_id: str,
    request: ManagerActionRequest,
    _: dict = Depends(require_roles("system_manager")),
):
    return UserService.reject_pharmacist_request(request_id)
