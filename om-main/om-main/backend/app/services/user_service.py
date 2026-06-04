import uuid
import json
import random
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List
from app.core.database import SessionLocal
from app.core.models import User, UserRole, UserTrustedContact
from app.core.security import hash_password, verify_password
from app.services.whatsapp_service import WhatsAppService


class UserService:
    """MySQL-backed user service"""
    _pending_file = Path(__file__).resolve().parents[2] / "pharmacist_requests.json"

    @staticmethod
    def _hash_password(password: str) -> str:
        return hash_password(password)

    @staticmethod
    def _load_pending_requests():
        if not UserService._pending_file.exists():
            return []
        try:
            with open(UserService._pending_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, list) else []
        except Exception:
            return []

    @staticmethod
    def _save_pending_requests(items):
        try:
            with open(UserService._pending_file, "w", encoding="utf-8") as f:
                json.dump(items, f, indent=2)
        except Exception:
            pass

    @staticmethod
    def _user_to_dict(user: User) -> Dict[str, Any]:
        return {
            "id": user.id,
            "name": user.name,
            "owner_name": getattr(user, "owner_name", None),
            "store_name": getattr(user, "store_name", None),
            "phone": user.phone,
            "email": getattr(user, "email", None),
            "shop_id": user.shop_id,
            "pharma_id": getattr(user, "pharma_id", None),
            "address": getattr(user, "address", None),
            "store_address": getattr(user, "store_address", None),
            "pharmacy_address": getattr(user, "pharmacy_address", None),
            "pharmacy_license_number": getattr(user, "pharmacy_license_number", None),
            "role": user.role.value if hasattr(user.role, "value") else user.role,
            "preferred_language": user.preferred_language or "en"
        }

    @staticmethod
    def normalize_phone(value: Optional[str]) -> str:
        digits = re.sub(r"\D", "", (value or "").strip())
        if len(digits) > 10:
            digits = digits[-10:]
        return digits

    @staticmethod
    def _serialize_trusted_contact(item: UserTrustedContact) -> Dict[str, Any]:
        return {
            "id": item.id,
            "user_id": item.user_id,
            "contact_phone": item.contact_phone,
            "source": item.source,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        }

    @staticmethod
    def register_user(
        name: str,
        phone: Optional[str],
        shop_id: Optional[str],
        password: str,
        age: Optional[int],
        role: str,
        preferred_language: Optional[str] = None,
        address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Register a new user (phone for regular users, shop_id for admins)"""
        db = SessionLocal()
        try:
            normalized_phone = UserService.normalize_phone(phone) if role == "user" else None
            if role == "user" and phone:
                existing = db.query(User).filter(User.phone == normalized_phone).first()
                if existing:
                    return {"success": False, "message": "Phone number already registered"}
            if role == "admin" and shop_id:
                existing = db.query(User).filter(User.shop_id == shop_id).first()
                if existing:
                    return {"success": False, "message": "Shop ID already registered"}

            user_id = str(uuid.uuid4())
            db_user = User(
                id=user_id,
                name=name,
                phone=normalized_phone if role == "user" else None,
                shop_id=shop_id if role == "admin" else None,
                password_hash=UserService._hash_password(password),
                age=age,
                role=UserRole(role),
                preferred_language=preferred_language or "en",
                address=address
            )
            db.add(db_user)
            db.commit()

            return {
                "success": True,
                "message": "User registered successfully",
                "user": UserService._user_to_dict(db_user)
            }
        except Exception as e:
            db.rollback()
            return {"success": False, "message": f"Registration failed: {e}"}
        finally:
            db.close()

    @staticmethod
    def login_user(phone: Optional[str], shop_id: Optional[str], password: str, role: str, pharma_id: Optional[str] = None) -> Dict[str, Any]:
        """Login a user by phone/shop_id and password"""
        db = SessionLocal()
        try:
            if role == "user":
                normalized_phone = UserService.normalize_phone(phone)
                user = db.query(User).filter(User.phone == normalized_phone, User.role == UserRole.USER).first()
            else:
                login_id = pharma_id or shop_id
                user = db.query(User).filter(User.pharma_id == login_id, User.role == UserRole.ADMIN).first()
                if not user and shop_id:
                    user = db.query(User).filter(User.shop_id == shop_id, User.role == UserRole.ADMIN).first()

            if not user:
                return {"success": False, "message": "Invalid credentials"}

            if not verify_password(password, user.password_hash):
                return {"success": False, "message": "Invalid credentials"}

            return {"success": True, "message": "Login successful", "user": UserService._user_to_dict(user)}
        finally:
            db.close()

    @staticmethod
    def request_password_reset(phone: str) -> Dict[str, Any]:
        db = SessionLocal()
        try:
            clean_phone = UserService.normalize_phone(phone)
            user = db.query(User).filter(User.phone == clean_phone, User.role == UserRole.USER).first()
            if not user:
                return {"success": False, "message": "No customer account found for this phone number"}

            otp = f"{random.randint(0, 999999):06d}"
            user.password_reset_otp = otp
            user.password_reset_expires_at = datetime.utcnow() + timedelta(minutes=10)
            db.commit()

            send_result = WhatsAppService._send_message(
                WhatsAppService.format_phone_number(clean_phone),
                (
                    "Password Reset OTP\n\n"
                    f"Your Pharma AI password reset code is {otp}.\n"
                    "This OTP is valid for 10 minutes."
                ),
            )

            if send_result.get("success"):
                return {"success": True, "message": "Password reset OTP sent to your WhatsApp number"}

            return {
                "success": False,
                "message": send_result.get("message") or "Unable to send WhatsApp OTP right now. Please try again.",
            }
        except Exception as e:
            db.rollback()
            return {"success": False, "message": f"Failed to send password reset OTP: {e}"}
        finally:
            db.close()

    @staticmethod
    def reset_password(phone: str, otp: str, new_password: str) -> Dict[str, Any]:
        db = SessionLocal()
        try:
            clean_phone = UserService.normalize_phone(phone)
            clean_otp = (otp or "").strip()
            user = db.query(User).filter(User.phone == clean_phone, User.role == UserRole.USER).first()
            if not user:
                return {"success": False, "message": "No customer account found for this phone number"}
            if not user.password_reset_otp or not user.password_reset_expires_at:
                return {"success": False, "message": "No active password reset request found"}
            if datetime.utcnow() > user.password_reset_expires_at:
                user.password_reset_otp = None
                user.password_reset_expires_at = None
                db.commit()
                return {"success": False, "message": "OTP has expired. Please request a new one"}
            if clean_otp != str(user.password_reset_otp).strip():
                return {"success": False, "message": "Invalid OTP"}

            user.password_hash = UserService._hash_password(new_password)
            user.password_reset_otp = None
            user.password_reset_expires_at = None
            db.commit()
            return {"success": True, "message": "Password reset successful. You can now log in"}
        except Exception as e:
            db.rollback()
            return {"success": False, "message": f"Password reset failed: {e}"}
        finally:
            db.close()

    @staticmethod
    def get_user(user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID"""
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            return UserService._user_to_dict(user) if user else None
        finally:
            db.close()

    @staticmethod
    def update_profile(
        user_id: str,
        name: Optional[str] = None,
        phone: Optional[str] = None,
        preferred_language: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return None
            if name is not None:
                user.name = name.strip()
            if phone is not None:
                clean_phone = UserService.normalize_phone(phone)
                if clean_phone:
                    existing_user = db.query(User).filter(User.phone == clean_phone, User.id != user_id).first()
                    if existing_user:
                        raise ValueError("Phone number already in use")
                user.phone = clean_phone or None
            if preferred_language is not None:
                user.preferred_language = preferred_language
            db.commit()
            return UserService._user_to_dict(user)
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    @staticmethod
    def request_pharmacist_signup(
        store_name: str,
        owner_name: str,
        mobile_number: str,
        email: str,
        pharma_id: str,
        store_address: str,
        pharmacy_license_number: str,
        pharmacy_address: str,
        password: str,
    ) -> Dict[str, Any]:
        db = SessionLocal()
        try:
            existing = db.query(User).filter(
                (User.pharma_id == pharma_id) | (User.shop_id == pharma_id) | (User.email == email) | (User.pharmacy_license_number == pharmacy_license_number),
                User.role == UserRole.ADMIN
            ).first()
            if existing:
                return {"success": False, "message": "Pharmacist already registered with this Pharma ID, email, or license number"}
        finally:
            db.close()

        pending = UserService._load_pending_requests()
        if any(
            (
                str(p.get("pharma_id")) == str(pharma_id)
                or str(p.get("email")) == str(email)
                or str(p.get("pharmacy_license_number")) == str(pharmacy_license_number)
            ) and p.get("status") == "pending"
            for p in pending
        ):
            return {"success": False, "message": "A pharmacist request with this Pharma ID, email, or license number is already pending"}

        req = {
            "request_id": str(uuid.uuid4()),
            "name": owner_name,
            "owner_name": owner_name,
            "store_name": store_name,
            "mobile_number": mobile_number,
            "phone": mobile_number,
            "email": email,
            "pharma_id": pharma_id,
            "shop_id": pharma_id,
            "store_address": store_address,
            "pharmacy_license_number": pharmacy_license_number,
            "pharmacy_address": pharmacy_address,
            "password_hash": UserService._hash_password(password),
            "status": "pending",
            "created_at": datetime.utcnow().isoformat()
        }
        pending.append(req)
        UserService._save_pending_requests(pending)
        return {"success": True, "message": "Pharmacist request submitted for System Manager approval", "request": req}

    @staticmethod
    def list_pharmacist_requests():
        pending = UserService._load_pending_requests()
        return [p for p in pending if p.get("status") == "pending"]

    @staticmethod
    def list_pharmacist_request_history():
        pending = UserService._load_pending_requests()
        reviewed = [p for p in pending if p.get("status") in {"approved", "rejected"}]
        reviewed.sort(key=lambda item: item.get("decided_at") or item.get("created_at") or "", reverse=True)
        return reviewed

    @staticmethod
    def approve_pharmacist_request(request_id: str) -> Dict[str, Any]:
        pending = UserService._load_pending_requests()
        req = next((p for p in pending if p.get("request_id") == request_id and p.get("status") == "pending"), None)
        if not req:
            return {"success": False, "message": "Pending request not found"}

        db = SessionLocal()
        try:
            existing = db.query(User).filter(User.pharma_id == req.get("pharma_id"), User.role == UserRole.ADMIN).first()
            if existing:
                req["status"] = "approved"
                req["decided_at"] = datetime.utcnow().isoformat()
                UserService._save_pending_requests(pending)
                return {"success": True, "message": "Pharmacist already exists", "user": UserService._user_to_dict(existing)}

            phone_value = req.get("mobile_number")
            if phone_value:
                phone_in_use = db.query(User).filter(User.phone == phone_value).first()
                if phone_in_use:
                    phone_value = None

            email_value = req.get("email")
            if email_value:
                email_in_use = db.query(User).filter(User.email == email_value).first()
                if email_in_use:
                    email_value = None

            db_user = User(
                id=str(uuid.uuid4()),
                name=req.get("name"),
                owner_name=req.get("owner_name"),
                store_name=req.get("store_name"),
                phone=phone_value,
                email=email_value,
                shop_id=req.get("shop_id"),
                pharma_id=req.get("pharma_id"),
                store_address=req.get("store_address"),
                pharmacy_license_number=req.get("pharmacy_license_number"),
                pharmacy_address=req.get("pharmacy_address"),
                address=req.get("pharmacy_address"),
                password_hash=req.get("password_hash"),
                age=None,
                role=UserRole.ADMIN,
                preferred_language="en"
            )
            db.add(db_user)
            db.commit()
            req["status"] = "approved"
            req["decided_at"] = datetime.utcnow().isoformat()
            UserService._save_pending_requests(pending)
            warning_parts = []
            if phone_value is None and req.get("mobile_number"):
                warning_parts.append("mobile number already existed and was not stored on the pharmacist account")
            if email_value is None and req.get("email"):
                warning_parts.append("email already existed and was not stored on the pharmacist account")

            message = "Pharmacist account approved and created"
            if warning_parts:
                message = f"{message}; " + "; ".join(warning_parts)

            return {"success": True, "message": message, "user": UserService._user_to_dict(db_user)}
        except Exception as e:
            db.rollback()
            return {"success": False, "message": f"Approval failed: {e}"}
        finally:
            db.close()

    @staticmethod
    def reject_pharmacist_request(request_id: str) -> Dict[str, Any]:
        pending = UserService._load_pending_requests()
        req = next((p for p in pending if p.get("request_id") == request_id and p.get("status") == "pending"), None)
        if not req:
            return {"success": False, "message": "Pending request not found"}
        req["status"] = "rejected"
        req["decided_at"] = datetime.utcnow().isoformat()
        UserService._save_pending_requests(pending)
        return {"success": True, "message": "Pharmacist request rejected"}

    @staticmethod
    def import_trusted_contacts(user_id: str, contacts: List[str]) -> Dict[str, Any]:
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id, User.role == UserRole.USER).first()
            if not user:
                return {"success": False, "message": "User not found"}

            normalized_contacts = []
            for raw_value in contacts or []:
                normalized = UserService.normalize_phone(raw_value)
                if len(normalized) != 10:
                    continue
                if normalized == UserService.normalize_phone(user.phone):
                    continue
                normalized_contacts.append(normalized)

            deduped_contacts = sorted(set(normalized_contacts))
            if not deduped_contacts:
                return {"success": False, "message": "Add at least one valid 10-digit phone number"}

            db.query(UserTrustedContact).filter(UserTrustedContact.user_id == user_id).delete()
            for phone in deduped_contacts:
                db.add(
                    UserTrustedContact(
                        id=str(uuid.uuid4()),
                        user_id=user_id,
                        contact_phone=phone,
                        source="manual_upload",
                    )
                )

            db.commit()
            saved_items = db.query(UserTrustedContact).filter(
                UserTrustedContact.user_id == user_id
            ).order_by(UserTrustedContact.created_at.desc()).all()
            return {
                "success": True,
                "message": "Trusted contacts imported successfully",
                "contacts": [UserService._serialize_trusted_contact(item) for item in saved_items],
                "count": len(saved_items),
            }
        except Exception as e:
            db.rollback()
            return {"success": False, "message": f"Failed to import contacts: {e}"}
        finally:
            db.close()

    @staticmethod
    def get_trusted_contacts(user_id: str) -> Dict[str, Any]:
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id, User.role == UserRole.USER).first()
            if not user:
                return {"success": False, "message": "User not found", "contacts": [], "count": 0}
            contacts = db.query(UserTrustedContact).filter(
                UserTrustedContact.user_id == user_id
            ).order_by(UserTrustedContact.created_at.desc()).all()
            return {
                "success": True,
                "contacts": [UserService._serialize_trusted_contact(item) for item in contacts],
                "count": len(contacts),
            }
        finally:
            db.close()

    @staticmethod
    def get_trusted_contact_status(user_id: str) -> Dict[str, Any]:
        payload = UserService.get_trusted_contacts(user_id)
        return {
            "success": payload.get("success", False),
            "count": payload.get("count", 0),
            "has_contacts": payload.get("count", 0) > 0,
        }

    @staticmethod
    def get_trusted_contact_phone_set(user_id: Optional[str]) -> set[str]:
        if not user_id:
            return set()
        db = SessionLocal()
        try:
            contacts = db.query(UserTrustedContact.contact_phone).filter(
                UserTrustedContact.user_id == user_id
            ).all()
            return {UserService.normalize_phone(item[0]) for item in contacts if UserService.normalize_phone(item[0])}
        finally:
            db.close()
