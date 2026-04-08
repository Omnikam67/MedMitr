from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
import os
from app.models.doctor import (
    DoctorRegisterRequest,
    DoctorLoginRequest,
    DoctorRegistrationApprovalRequest,
    AppointmentRequest,
    AppointmentActionRequest,
    AppointmentCompleteRequest,
    ReferralCreateRequest,
    ReferredAppointmentBookingRequest,
    DoctorFeedbackCreateRequest,
    DoctorResponse,
    AppointmentResponse,
    RevenueAnalyticsRequest,
    RevenueAnalyticsResponse,
    DashboardStatsResponse
)
from app.core.auth import get_current_auth_payload, get_optional_auth_payload, require_roles, require_subject_match
from app.core.security import create_access_token
from app.services.doctor_service import DoctorService
from app.services.whatsapp_service import WhatsAppService

router = APIRouter(prefix="/doctor", tags=["Doctor Management"])


def _validate_system_manager(manager_id: str, manager_password: Optional[str]) -> bool:
    system_manager_id = os.getenv("SYSTEM_MANAGER_ID", "sysmanager")
    system_manager_password = os.getenv("SYSTEM_MANAGER_PASSWORD", "SysManager@123")
    return bool(
        manager_password
        and system_manager_password
        and manager_id == system_manager_id
        and manager_password == system_manager_password
    )


# ===== DOCTOR AUTHENTICATION =====

@router.post("/register")
async def register_doctor(request: DoctorRegisterRequest):
    """Register a new doctor (creates pending approval status)"""
    result = DoctorService.register_doctor(
        doctor_id=request.doctor_id,
        name=request.name,
        email=request.email,
        phone=request.phone,
        gender=request.gender,
        specialty=request.specialty,
        experience_years=request.experience_years,
        qualification=request.qualification,
        password=request.password,
        hospital_name=request.hospital_name,
        address=request.address,
        clinic_name=request.clinic_name,
        clinic_address=request.clinic_address,
        appointment_fee=request.appointment_fee,
        profile_image=request.profile_image,
        degree_certificate_image=request.degree_certificate_image,
        preferred_language=request.preferred_language
    )
    
    return result


@router.post("/login")
async def login_doctor(request: DoctorLoginRequest):
    """Login a doctor"""
    result = DoctorService.login_doctor(
        login_id=request.email or request.doctor_id or "",
        password=request.password
    )
    
    if not result["success"]:
        raise HTTPException(status_code=401, detail=result["message"])

    doctor = result.get("doctor") or {}
    result["access_token"] = create_access_token(
        {
            "sub": doctor.get("id"),
            "role": "doctor",
            "doctor_id": doctor.get("doctor_id"),
            "email": doctor.get("email"),
            "phone": doctor.get("phone"),
            "name": doctor.get("name"),
        }
    )
    result["token_type"] = "bearer"
    return result


# ===== SYSTEM MANAGER ENDPOINTS =====

class SystemManagerLoginRequest(BaseModel):
    manager_id: str
    password: Optional[str] = None


@router.post("/manager/login")
async def manager_login(request: SystemManagerLoginRequest):
    """System manager login"""
    if _validate_system_manager(request.manager_id, request.password):
        return {
            "success": True,
            "message": "Manager login successful",
            "manager_id": request.manager_id,
            "access_token": create_access_token(
                {
                    "sub": "system-manager-001",
                    "role": "system_manager",
                    "manager_id": request.manager_id,
                    "name": "System Manager",
                }
            ),
            "token_type": "bearer",
        }
    
    raise HTTPException(status_code=401, detail="Invalid manager credentials")


@router.post("/manager/pending-registrations")
async def get_pending_registrations(
    request: SystemManagerLoginRequest,
    _: dict = Depends(require_roles("system_manager")),
):
    registrations = DoctorService.get_pending_registrations()
    return {"registrations": registrations}


@router.post("/manager/history")
async def get_registration_history(
    request: SystemManagerLoginRequest,
    _: dict = Depends(require_roles("system_manager")),
):
    registrations = DoctorService.get_registration_history()
    return {"success": True, "registrations": registrations}


@router.post("/manager/approve")
async def approve_doctor_registration(
    request: DoctorRegistrationApprovalRequest,
    _: dict = Depends(require_roles("system_manager")),
):
    if request.approved:
        result = DoctorService.approve_doctor(
            doctor_id=request.doctor_id,
            manager_id=request.manager_id,
            notes=request.reason
        )
    else:
        result = DoctorService.reject_doctor(
            doctor_id=request.doctor_id,
            manager_id=request.manager_id,
            reason=request.reason or "Registration rejected by manager"
        )
    
    return result


# ===== APPOINTMENT MANAGEMENT =====

@router.post("/appointment/create")
async def create_appointment(request: AppointmentRequest):
    """Create an appointment request (from user booking view)"""
    result = DoctorService.create_appointment_request(
        doctor_id=request.doctor_id,
        patient_name=request.patient_name,
        patient_phone=request.patient_phone,
        patient_age=request.patient_age,
        patient_gender=request.patient_gender,
        appointment_date=request.appointment_date,
        appointment_time=request.appointment_time,
        notes=request.notes,
        referral_id=request.referral_id,
    )
    
    return result


@router.get("/appointments/pending/{doctor_id}")
async def get_pending_appointments(doctor_id: str, auth: dict = Depends(get_current_auth_payload)):
    require_subject_match(doctor_id, auth, allow_roles=("system_manager",))
    appointments = DoctorService.get_pending_appointments(doctor_id)
    return {"appointments": appointments}


@router.get("/appointments/approved/{doctor_id}")
async def get_approved_appointments(doctor_id: str, auth: dict = Depends(get_current_auth_payload)):
    require_subject_match(doctor_id, auth, allow_roles=("system_manager",))
    appointments = DoctorService.get_appointments_by_status(doctor_id, "approved")
    return {"appointments": appointments}


@router.get("/appointments/cancelled/{doctor_id}")
async def get_cancelled_appointments(doctor_id: str, auth: dict = Depends(get_current_auth_payload)):
    require_subject_match(doctor_id, auth, allow_roles=("system_manager",))
    appointments = DoctorService.get_appointments_by_status(doctor_id, "cancelled")
    return {"appointments": appointments}


@router.get("/appointments/completed/{doctor_id}")
async def get_completed_appointments(doctor_id: str, auth: dict = Depends(get_current_auth_payload)):
    require_subject_match(doctor_id, auth, allow_roles=("system_manager",))
    appointments = DoctorService.get_appointments_by_status(doctor_id, "completed")
    return {"appointments": appointments}


@router.post("/appointments/action")
async def handle_appointment_action(request: AppointmentActionRequest, auth: dict = Depends(get_current_auth_payload)):
    require_subject_match(request.doctor_id, auth, allow_roles=("system_manager",))
    if request.action == "approve":
        result = DoctorService.approve_appointment(
            appointment_id=request.appointment_id,
            revenue_amount=request.revenue_amount or 0.0
        )
    elif request.action == "cancel":
        result = DoctorService.cancel_appointment(
            appointment_id=request.appointment_id,
            reason=request.cancellation_reason
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    return result


@router.post("/appointments/complete")
async def complete_appointment(request: AppointmentCompleteRequest, auth: dict = Depends(get_current_auth_payload)):
    require_subject_match(request.doctor_id, auth, allow_roles=("system_manager",))
    result = DoctorService.complete_appointment(
        appointment_id=request.appointment_id,
        doctor_id=request.doctor_id,
        prescription_notes=request.prescription_notes,
        medicines=[medicine.model_dump() for medicine in request.medicines],
    )
    return result


@router.post("/referrals/create")
async def create_referral(request: ReferralCreateRequest, auth: dict = Depends(get_current_auth_payload)):
    require_subject_match(request.from_doctor_id, auth, allow_roles=("system_manager",))
    result = DoctorService.create_referral(
        source_appointment_id=request.source_appointment_id,
        from_doctor_id=request.from_doctor_id,
        to_doctor_id=request.to_doctor_id,
        reason=request.reason,
        clinical_notes=request.clinical_notes,
    )
    return result


@router.get("/referrals/patient/{patient_phone}")
async def get_patient_referrals(patient_phone: str):
    referrals = DoctorService.get_referrals_for_patient(patient_phone)
    return {"success": True, "referrals": referrals, "count": len(referrals)}


@router.get("/referrals/source/{doctor_id}")
async def get_source_doctor_referrals(doctor_id: str, auth: dict = Depends(get_current_auth_payload)):
    require_subject_match(doctor_id, auth, allow_roles=("system_manager",))
    referrals = DoctorService.get_referrals_for_source_doctor(doctor_id)
    return {"success": True, "referrals": referrals, "count": len(referrals)}


@router.get("/referrals/target/{doctor_id}")
async def get_target_doctor_referrals(doctor_id: str, auth: dict = Depends(get_current_auth_payload)):
    require_subject_match(doctor_id, auth, allow_roles=("system_manager",))
    referrals = DoctorService.get_referrals_for_target_doctor(doctor_id)
    return {"success": True, "referrals": referrals, "count": len(referrals)}


@router.get("/referrals/{referral_id}")
async def get_referral_detail(referral_id: str):
    referral = DoctorService.get_referral_detail(referral_id)
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    return {"success": True, "referral": referral}


@router.post("/referrals/book")
async def book_referred_appointment(request: ReferredAppointmentBookingRequest):
    referral = DoctorService.get_referral_detail(request.referral_id)
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")

    result = DoctorService.create_appointment_request(
        doctor_id=referral["to_doctor_id"],
        patient_name=request.patient_name,
        patient_phone=request.patient_phone,
        patient_age=request.patient_age,
        patient_gender=request.patient_gender,
        appointment_date=request.appointment_date,
        appointment_time=request.appointment_time,
        notes=request.notes,
        referral_id=request.referral_id,
    )
    return result


@router.post("/feedback/create")
async def create_doctor_feedback(request: DoctorFeedbackCreateRequest):
    result = DoctorService.submit_doctor_feedback(
        appointment_id=request.appointment_id,
        patient_phone=request.patient_phone,
        rating=request.rating,
        review_title=request.review_title,
        review_text=request.review_text,
        would_recommend=request.would_recommend,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to submit feedback"))
    return result


@router.get("/feedback/doctor/{doctor_id}")
async def get_doctor_feedback(
    doctor_id: str,
    limit: int = 50,
    viewer_user_id: Optional[str] = None,
    auth: Optional[dict] = Depends(get_optional_auth_payload),
):
    auth_viewer_id = auth.get("sub") if auth and str(auth.get("role") or "").lower() == "user" else None
    if viewer_user_id and not auth_viewer_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    if viewer_user_id and auth_viewer_id and viewer_user_id != auth_viewer_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    reviews = DoctorService.get_doctor_feedback(
        doctor_id,
        limit=limit,
        viewer_user_id=auth_viewer_id or viewer_user_id,
    )
    trusted_review_count = len([item for item in reviews if item.get("is_trusted_contact_review")])
    return {
        "success": True,
        "reviews": reviews,
        "count": len(reviews),
        "trusted_review_count": trusted_review_count,
    }


@router.get("/feedback/summary/{doctor_id}")
async def get_doctor_feedback_summary(
    doctor_id: str,
    viewer_user_id: Optional[str] = None,
    auth: Optional[dict] = Depends(get_optional_auth_payload),
):
    auth_viewer_id = auth.get("sub") if auth and str(auth.get("role") or "").lower() == "user" else None
    if viewer_user_id and not auth_viewer_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    if viewer_user_id and auth_viewer_id and viewer_user_id != auth_viewer_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return {
        "success": True,
        "summary": DoctorService.get_doctor_feedback_summary(
            doctor_id,
            viewer_user_id=auth_viewer_id or viewer_user_id,
        ),
    }


@router.get("/appointments/{appointment_id}/prescription-download")
async def download_prescription(appointment_id: str):
    """Download the prescription file for an appointment."""
    payload = DoctorService.get_prescription_download_payload(appointment_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Prescription not found")
    content, media_type, filename = payload

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ===== REVENUE & ANALYTICS =====

@router.get("/revenue/{doctor_id}")
async def get_revenue_analytics(
    doctor_id: str,
    filter_type: str = "today",
    auth: dict = Depends(get_current_auth_payload),
):
    require_subject_match(doctor_id, auth, allow_roles=("system_manager",))
    result = DoctorService.get_revenue_analytics(doctor_id, filter_type)
    return result


@router.get("/dashboard/stats/{doctor_id}")
async def get_dashboard_stats(
    doctor_id: str,
    overall_filter: str = "all",
    auth: dict = Depends(get_current_auth_payload),
):
    require_subject_match(doctor_id, auth, allow_roles=("system_manager",))
    stats = DoctorService.get_doctor_stats(doctor_id, overall_filter)
    return stats


# ===== PUBLIC ENDPOINTS =====

@router.get("/available")
async def get_available_doctors():
    """Get all available doctors for booking"""
    doctors = DoctorService.get_available_doctors()
    return {"doctors": doctors, "count": len(doctors)}


class DoctorListResponse(BaseModel):
    id: str
    name: str
    specialty: str
    experience_years: int
    clinic_name: Optional[str]
    phone: str


@router.get("/list")
async def list_available_doctors():
    """Get list of available doctors with details"""
    doctors = DoctorService.get_available_doctors()
    return {
        "success": True,
        "doctors": doctors,
        "count": len(doctors)
    }


@router.get("/appointment-history/{patient_phone}")
async def get_appointment_history(patient_phone: str, auth: dict = Depends(get_current_auth_payload)):
    role = str(auth.get("role") or "").lower()
    if role not in {"system_manager", "doctor"}:
        normalized_requested = "".join(ch for ch in str(patient_phone) if ch.isdigit())[-10:]
        normalized_auth = "".join(ch for ch in str(auth.get("phone") or "") if ch.isdigit())[-10:]
        if normalized_requested != normalized_auth:
            raise HTTPException(status_code=403, detail="Forbidden")
    appointments = DoctorService.get_patient_appointment_history(patient_phone)
    return {
        "success": True,
        "appointments": appointments,
        "count": len(appointments)
    }


@router.get("/medicines/search")
async def search_medicines(prefix: str = "", limit: int = 10):
    """Search medicines whose names start with a prefix"""
    medicines = DoctorService.search_medicines(prefix=prefix, limit=limit)
    return {"medicines": medicines, "count": len(medicines)}


# ===== WHATSAPP NOTIFICATIONS =====

class WhatsAppRequest(BaseModel):
    phone: str
    message_type: str  # appointment_approved, appointment_cancelled, appointment_reminder, doctor_approval, appointment_completed
    doctor_name: Optional[str] = None
    appointment_date: Optional[str] = None
    appointment_time: Optional[str] = None
    reason: Optional[str] = None
    prescription_notes: Optional[str] = None
    prescription_image: Optional[str] = None


@router.post("/send-whatsapp")
async def send_whatsapp_notification(request: WhatsAppRequest):
    """Send WhatsApp notification to patient or doctor"""
    
    if request.message_type == "appointment_approved":
        result = WhatsAppService.send_appointment_approved(
            patient_phone=request.phone,
            doctor_name=request.doctor_name or "Doctor",
            appointment_date=request.appointment_date,
            appointment_time=request.appointment_time
        )
    elif request.message_type == "appointment_cancelled":
        result = WhatsAppService.send_appointment_cancelled(
            patient_phone=request.phone,
            doctor_name=request.doctor_name or "Doctor",
            reason=request.reason
        )
    elif request.message_type == "appointment_reminder":
        result = WhatsAppService.send_appointment_reminder(
            patient_phone=request.phone,
            doctor_name=request.doctor_name or "Doctor",
            appointment_time=request.appointment_time or "scheduled time"
        )
    elif request.message_type == "doctor_approval":
        result = WhatsAppService.send_doctor_approval_notification(
            doctor_phone=request.phone,
            doctor_name=request.doctor_name or "Doctor"
        )
    elif request.message_type == "appointment_completed":
        result = WhatsAppService.send_appointment_completed(
            patient_phone=request.phone,
            doctor_name=request.doctor_name or "Doctor",
            prescription_image=request.prescription_image,
            prescription_notes=request.prescription_notes,
        )
    else:
        return {
            "success": False,
            "message": f"Unknown message type: {request.message_type}"
        }
    
    return result
