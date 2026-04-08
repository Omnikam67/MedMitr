import base64
import html
import json
import re

from sqlalchemy.orm import Session
from app.core.doctor_models import (
    DoctorTable,
    DoctorRegistrationRequest,
    AppointmentRequestTable,
    PatientReferralTable,
    DoctorFeedbackTable,
    RevenueTable,
)
from app.core.database import SessionLocal
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple
from app.core.security import hash_password, verify_password
from app.services.user_service import UserService
from app.services.product_service import ProductService


class DoctorService:
    """Service for managing doctors and appointments"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password using PBKDF2-SHA256."""
        return hash_password(password)
    
    @staticmethod
    def verify_password(password: str, hash_value: str) -> bool:
        """Verify password against stored hash."""
        return verify_password(password, hash_value)

    @staticmethod
    def _get_doctor_by_identifier(db, doctor_identifier: Optional[str]) -> Optional[DoctorTable]:
        """Resolve a doctor by internal id or public doctor_id/login id."""
        normalized = (doctor_identifier or "").strip()
        if not normalized:
            return None

        doctor = db.query(DoctorTable).filter(DoctorTable.id == normalized).first()
        if doctor:
            return doctor

        return db.query(DoctorTable).filter(DoctorTable.doctor_id == normalized.lower()).first()

    @staticmethod
    def _serialize_medicines(medicines: Optional[List[Dict]]) -> str:
        cleaned = []
        for item in medicines or []:
            name = (item.get("medicine_name") or "").strip()
            if not name:
                continue
            cleaned.append(
                {
                    "medicine_name": name,
                    "dosage": (item.get("dosage") or "").strip(),
                    "frequency": (item.get("frequency") or "").strip(),
                    "duration": (item.get("duration") or "").strip(),
                    "notes": (item.get("notes") or "").strip(),
                }
            )
        return json.dumps(cleaned)

    @staticmethod
    def _deserialize_medicines(raw_value: Optional[str]) -> List[Dict]:
        if not raw_value:
            return []
        try:
            parsed = json.loads(raw_value)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []

    @staticmethod
    def _build_prescription_svg(
        doctor_name: str,
        clinic_name: Optional[str],
        specialty: Optional[str],
        patient_name: str,
        patient_age: Optional[int],
        appointment_date: Optional[str],
        appointment_time: Optional[str],
        medicines: List[Dict],
        notes: Optional[str],
    ) -> str:
        lines = DoctorService._build_prescription_lines(
            doctor_name=doctor_name,
            clinic_name=clinic_name,
            specialty=specialty,
            patient_name=patient_name,
            patient_age=patient_age,
            appointment_date=appointment_date,
            appointment_time=appointment_time,
            medicines=medicines,
            notes=notes,
        )

        height = max(320, 120 + len(lines) * 26)
        text_nodes = []
        y = 50
        for line in lines:
            escaped = html.escape(line)
            text_nodes.append(f"<text x='36' y='{y}' font-size='18' fill='#0f172a'>{escaped}</text>")
            y += 26

        return (
            f"<svg xmlns='http://www.w3.org/2000/svg' width='900' height='{height}' viewBox='0 0 900 {height}'>"
            "<rect width='100%' height='100%' fill='#f8fafc'/>"
            f"<rect x='18' y='18' width='864' height='{height - 36}' rx='24' fill='#ffffff' stroke='#bfdbfe' stroke-width='2'/>"
            "<text x='36' y='36' font-size='24' font-weight='700' fill='#1d4ed8'>Medical Prescription</text>"
            + "".join(text_nodes)
            + "</svg>"
        )

    @staticmethod
    def _build_prescription_lines(
        doctor_name: str,
        clinic_name: Optional[str],
        specialty: Optional[str],
        patient_name: str,
        patient_age: Optional[int],
        appointment_date: Optional[str],
        appointment_time: Optional[str],
        medicines: List[Dict],
        notes: Optional[str],
    ) -> List[str]:
        lines = [
            f"Doctor: Dr. {doctor_name}",
            f"Clinic: {clinic_name or 'Clinic not specified'}",
            f"Specialty: {specialty or 'General Consultation'}",
            f"Patient: {patient_name}",
            f"Age: {patient_age if patient_age is not None else 'Not specified'}",
            f"Date: {appointment_date or 'Not specified'}",
            f"Time: {appointment_time or 'Not specified'}",
            "",
            "Medicines:",
        ]
        if medicines:
            for idx, item in enumerate(medicines, start=1):
                medicine_name = item.get("medicine_name") or "Medicine"
                lines.append(f"{idx}. Medicine name: {medicine_name}")
                if item.get("frequency"):
                    lines.append(f"   Frequency: {item['frequency']}")
                if item.get("duration"):
                    lines.append(f"   Duration: {item['duration']}")
                if item.get("notes"):
                    lines.append(f"   Extra note: {item['notes']}")
                lines.append("")
        else:
            lines.append("1. No medicines added")

        clean_notes = (notes or "").strip()
        if clean_notes:
            lines.extend(["Prescription notes:", clean_notes])

        return lines

    @staticmethod
    def _escape_pdf_text(value: str) -> str:
        return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    @staticmethod
    def _append_pdf_text(commands: List[str], x: float, y: float, text: str, font: str, size: int) -> None:
        commands.extend(
            [
                "BT",
                f"/{font} {size} Tf",
                f"{x:.2f} {y:.2f} Td",
                f"({DoctorService._escape_pdf_text(text)}) Tj",
                "ET",
            ]
        )

    @staticmethod
    def _append_pdf_line(commands: List[str], x1: float, y1: float, x2: float, y2: float, width: float = 1) -> None:
        commands.extend(
            [
                f"{width:.2f} w",
                f"{x1:.2f} {y1:.2f} m",
                f"{x2:.2f} {y2:.2f} l",
                "S",
            ]
        )

    @staticmethod
    def _append_pdf_rect(commands: List[str], x: float, y: float, width: float, height: float) -> None:
        commands.append(f"{x:.2f} {y:.2f} {width:.2f} {height:.2f} re S")

    @staticmethod
    def _estimate_notes_line_count(text: str, line_limit: int = 72) -> int:
        if not text:
            return 0
        lines = 0
        for chunk in text.splitlines() or [""]:
            normalized = chunk.strip()
            if not normalized:
                lines += 1
                continue
            lines += max(1, (len(normalized) + line_limit - 1) // line_limit)
        return lines

    @staticmethod
    def _build_prescription_reference(appointment_id: Optional[str], patient_name: Optional[str]) -> str:
        raw_patient = DoctorService._sanitize_filename_part(patient_name, "PT").upper()
        patient_code = raw_patient[:6] or "PT"
        raw_appointment = (appointment_id or "RX0000").replace("-", "").upper()
        return f"RX-{patient_code}-{raw_appointment[:8]}"

    @staticmethod
    def _append_pdf_fill_rect(commands: List[str], x: float, y: float, width: float, height: float) -> None:
        commands.append(f"{x:.2f} {y:.2f} {width:.2f} {height:.2f} re f")

    @staticmethod
    def _append_pdf_barcode(commands: List[str], x: float, y: float, code: str) -> None:
        encoded = "".join(str(ord(ch)) for ch in code)
        cursor = x
        for idx, digit in enumerate(encoded):
            bar_width = 1.1 if idx % 2 == 0 else 0.6
            bar_height = 24 if int(digit) % 2 == 0 else 18
            if digit in {"0", "1"}:
                cursor += 0.8
                continue
            DoctorService._append_pdf_fill_rect(commands, cursor, y, bar_width, bar_height)
            cursor += bar_width + 1.2

    @staticmethod
    def _build_prescription_layout_stream(
        appointment_id: Optional[str],
        doctor_name: str,
        clinic_name: Optional[str],
        specialty: Optional[str],
        patient_name: str,
        patient_age: Optional[int],
        appointment_date: Optional[str],
        appointment_time: Optional[str],
        medicines: List[Dict],
        notes: Optional[str],
        page_height: int,
    ) -> bytes:
        left = 42
        right = 553
        top = page_height - 42
        prescription_reference = DoctorService._build_prescription_reference(appointment_id, patient_name)
        commands: List[str] = [
            "0.13 0.16 0.22 RG",
            "0.13 0.16 0.22 rg",
        ]

        DoctorService._append_pdf_rect(commands, 28, 28, 539, page_height - 56)

        commands.extend(["0.11 0.29 0.85 RG", "0.11 0.29 0.85 rg"])
        DoctorService._append_pdf_rect(commands, left - 2, top - 48, 54, 54)
        DoctorService._append_pdf_text(commands, left + 8, top - 9, "Rx", "F2", 30)
        DoctorService._append_pdf_text(commands, left + 5, top - 31, "Clinic Mark", "F1", 8)
        commands.extend(["0.13 0.16 0.22 RG", "0.13 0.16 0.22 rg"])

        DoctorService._append_pdf_text(commands, left + 72, top - 2, f"Dr. {doctor_name}", "F2", 22)
        DoctorService._append_pdf_text(commands, left + 72, top - 26, specialty or "General Consultation", "F1", 13)
        DoctorService._append_pdf_text(commands, left + 72, top - 44, clinic_name or "Clinic not specified", "F1", 11)
        DoctorService._append_pdf_text(commands, left + 72, top - 60, f"Prescription ID: {prescription_reference}", "F1", 9)

        DoctorService._append_pdf_text(commands, right - 132, top - 8, "Date:", "F2", 12)
        DoctorService._append_pdf_text(commands, right - 88, top - 8, appointment_date or "Not specified", "F1", 12)
        DoctorService._append_pdf_line(commands, right - 92, top - 12, right - 6, top - 12, 0.8)
        DoctorService._append_pdf_text(commands, right - 132, top - 30, "Time:", "F2", 12)
        DoctorService._append_pdf_text(commands, right - 88, top - 30, appointment_time or "Not specified", "F1", 12)
        DoctorService._append_pdf_line(commands, right - 92, top - 34, right - 6, top - 34, 0.8)

        header_rule_y = top - 78
        DoctorService._append_pdf_line(commands, left, header_rule_y, right, header_rule_y, 0.8)

        patient_row_y = header_rule_y - 30
        DoctorService._append_pdf_text(commands, left, patient_row_y, "Patient:", "F2", 12)
        DoctorService._append_pdf_text(commands, left + 54, patient_row_y, patient_name or "Not specified", "F1", 12)
        DoctorService._append_pdf_line(commands, left + 50, patient_row_y - 4, 340, patient_row_y - 4, 0.8)

        DoctorService._append_pdf_text(commands, 390, patient_row_y, "Age:", "F2", 12)
        DoctorService._append_pdf_text(
            commands,
            420,
            patient_row_y,
            str(patient_age) if patient_age is not None else "Not specified",
            "F1",
            12,
        )
        DoctorService._append_pdf_line(commands, 418, patient_row_y - 4, right, patient_row_y - 4, 0.8)

        body_rule_y = patient_row_y - 18
        DoctorService._append_pdf_line(commands, left, body_rule_y, right, body_rule_y, 0.8)

        body_y = body_rule_y - 36
        DoctorService._append_pdf_text(commands, left, body_y, "Medical Prescription", "F2", 20)
        y = body_y - 28

        if medicines:
            for idx, item in enumerate(medicines, start=1):
                DoctorService._append_pdf_text(commands, left, y, f"{idx}. Medicine name:", "F2", 12)
                DoctorService._append_pdf_text(commands, left + 118, y, item.get("medicine_name") or "Medicine", "F1", 12)
                y -= 18
                if item.get("frequency"):
                    DoctorService._append_pdf_text(commands, left + 18, y, f"Frequency: {item['frequency']}", "F1", 11)
                    y -= 16
                if item.get("duration"):
                    DoctorService._append_pdf_text(commands, left + 18, y, f"Duration: {item['duration']}", "F1", 11)
                    y -= 16
                if item.get("notes"):
                    DoctorService._append_pdf_text(commands, left + 18, y, f"Extra note: {item['notes']}", "F1", 11)
                    y -= 16
                y -= 10
        else:
            DoctorService._append_pdf_text(commands, left, y, "1. Medicine name: No medicines added", "F1", 12)
            y -= 24

        clean_notes = (notes or "").strip()
        if clean_notes:
            DoctorService._append_pdf_text(commands, left, y, "Prescription notes:", "F2", 12)
            y -= 18
            for chunk in clean_notes.splitlines():
                text = chunk.strip() or " "
                DoctorService._append_pdf_text(commands, left + 18, y, text, "F1", 11)
                y -= 16

        signature_y = max(124, y - 34)
        DoctorService._append_pdf_line(commands, 360, signature_y, right - 18, signature_y, 0.8)
        DoctorService._append_pdf_text(commands, 388, signature_y + 8, f"Dr. {doctor_name}", "F3", 16)
        DoctorService._append_pdf_text(commands, 388, signature_y - 18, "Authorized Signature", "F1", 9)

        footer_top = signature_y - 52
        DoctorService._append_pdf_line(commands, left, footer_top, right, footer_top, 0.8)
        DoctorService._append_pdf_text(commands, left, footer_top - 18, "Issued by:", "F2", 10)
        DoctorService._append_pdf_text(commands, left + 54, footer_top - 18, clinic_name or "Clinic not specified", "F1", 10)
        DoctorService._append_pdf_text(commands, left, footer_top - 34, "Reference:", "F2", 10)
        DoctorService._append_pdf_text(commands, left + 54, footer_top - 34, prescription_reference, "F1", 10)
        DoctorService._append_pdf_text(commands, 386, footer_top - 18, "Verification Code", "F2", 9)
        DoctorService._append_pdf_barcode(commands, 384, footer_top - 50, prescription_reference)

        return "\n".join(commands).encode("latin-1", errors="replace")

    @staticmethod
    def _build_simple_pdf(
        appointment_id: Optional[str],
        doctor_name: str,
        clinic_name: Optional[str],
        specialty: Optional[str],
        patient_name: str,
        patient_age: Optional[int],
        appointment_date: Optional[str],
        appointment_time: Optional[str],
        medicines: List[Dict],
        notes: Optional[str],
    ) -> bytes:
        medicine_height = 34
        for item in medicines or []:
            medicine_height += 28
            if item.get("frequency"):
                medicine_height += 16
            if item.get("duration"):
                medicine_height += 16
            if item.get("notes"):
                medicine_height += 16
            medicine_height += 10
        notes_height = 0
        clean_notes = (notes or "").strip()
        if clean_notes:
            notes_height = 28 + (DoctorService._estimate_notes_line_count(clean_notes) * 16)

        page_height = max(842, 300 + medicine_height + notes_height + 120)
        stream = DoctorService._build_prescription_layout_stream(
            appointment_id=appointment_id,
            doctor_name=doctor_name,
            clinic_name=clinic_name,
            specialty=specialty,
            patient_name=patient_name,
            patient_age=patient_age,
            appointment_date=appointment_date,
            appointment_time=appointment_time,
            medicines=medicines,
            notes=notes,
            page_height=page_height,
        )

        objects = [
            b"<< /Type /Catalog /Pages 2 0 R >>",
            b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 {page_height}] "
                "/Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> /Contents 4 0 R >>"
            ).encode("ascii"),
            b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream",
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>",
        ]

        pdf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0]
        for index, obj in enumerate(objects, start=1):
            offsets.append(len(pdf))
            pdf.extend(f"{index} 0 obj\n".encode("ascii"))
            pdf.extend(obj)
            pdf.extend(b"\nendobj\n")

        xref_start = len(pdf)
        pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
        pdf.extend(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
        pdf.extend(
            (
                f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
                f"startxref\n{xref_start}\n%%EOF"
            ).encode("ascii")
        )
        return bytes(pdf)

    @staticmethod
    def _sanitize_filename_part(value: Optional[str], fallback: str) -> str:
        cleaned = re.sub(r"[^A-Za-z0-9_-]+", "-", (value or "").strip()).strip("-")
        return cleaned or fallback

    @staticmethod
    def _serialize_feedback(feedback: DoctorFeedbackTable) -> Dict:
        return {
            "id": feedback.id,
            "appointment_id": feedback.appointment_id,
            "doctor_id": feedback.doctor_id,
            "patient_phone": feedback.patient_phone,
            "patient_name": feedback.patient_name,
            "rating": feedback.rating,
            "review_title": feedback.review_title,
            "review_text": feedback.review_text,
            "would_recommend": bool(feedback.would_recommend),
            "is_visible": bool(feedback.is_visible),
            "created_at": feedback.created_at.isoformat() if feedback.created_at else None,
            "updated_at": feedback.updated_at.isoformat() if feedback.updated_at else None,
        }

    @staticmethod
    def _normalize_phone(value: Optional[str]) -> str:
        return UserService.normalize_phone(value)

    @staticmethod
    def _serialize_feedback_for_viewer(
        feedback: DoctorFeedbackTable,
        trusted_phone_set: Optional[set[str]] = None,
    ) -> Dict:
        payload = DoctorService._serialize_feedback(feedback)
        normalized_phone = DoctorService._normalize_phone(feedback.patient_phone)
        is_trusted_contact_review = bool(normalized_phone and trusted_phone_set and normalized_phone in trusted_phone_set)
        payload["is_trusted_contact_review"] = is_trusted_contact_review
        payload["review_priority"] = 0 if is_trusted_contact_review else 1
        payload["reviewer_label"] = feedback.patient_name or ("A trusted contact" if is_trusted_contact_review else "Verified patient")
        if is_trusted_contact_review:
            payload["patient_phone"] = None
        return payload

    @staticmethod
    def _resolve_feedback_target(
        db: Session,
        appointment: AppointmentRequestTable,
        doctor: Optional[DoctorTable] = None,
        referral: Optional[PatientReferralTable] = None,
    ) -> Tuple[AppointmentRequestTable, Optional[DoctorTable], bool]:
        source_of_truth_appointment = appointment
        target_doctor = doctor
        show_feedback_on_this_card = True
        linked_referral = referral

        if linked_referral is None and appointment.referral_id:
            linked_referral = db.query(PatientReferralTable).filter(
                PatientReferralTable.id == appointment.referral_id
            ).first()

        if linked_referral and linked_referral.referred_appointment_id:
            referred_appointment = db.query(AppointmentRequestTable).filter(
                AppointmentRequestTable.id == linked_referral.referred_appointment_id
            ).first()
            if referred_appointment and referred_appointment.status == "completed":
                source_of_truth_appointment = referred_appointment
                target_doctor = db.query(DoctorTable).filter(
                    DoctorTable.id == referred_appointment.doctor_id
                ).first()
                show_feedback_on_this_card = appointment.id == linked_referral.referred_appointment_id
            elif appointment.id == linked_referral.source_appointment_id:
                show_feedback_on_this_card = False

        return source_of_truth_appointment, target_doctor, show_feedback_on_this_card

    @staticmethod
    def _build_feedback_context(
        db: Session,
        appointment: AppointmentRequestTable,
        doctor: Optional[DoctorTable] = None,
        referral: Optional[PatientReferralTable] = None,
    ) -> Dict:
        target_appointment, target_doctor, show_feedback_on_this_card = DoctorService._resolve_feedback_target(
            db,
            appointment,
            doctor,
            referral,
        )
        feedback_record = db.query(DoctorFeedbackTable).filter(
            DoctorFeedbackTable.appointment_id == target_appointment.id
        ).first()
        is_completed = target_appointment.status == "completed"

        return {
            "target_appointment_id": target_appointment.id if is_completed else None,
            "target_doctor_id": target_doctor.id if target_doctor and is_completed else None,
            "target_doctor_name": target_doctor.name if target_doctor and is_completed else None,
            "can_submit": bool(is_completed and show_feedback_on_this_card and not feedback_record),
            "submitted": bool(feedback_record),
            "show_on_card": bool(is_completed and show_feedback_on_this_card),
            "review": DoctorService._serialize_feedback(feedback_record) if feedback_record else None,
        }

    @staticmethod
    def _get_feedback_summary_for_doctor(
        db: Session,
        doctor_id: str,
        viewer_user_id: Optional[str] = None,
    ) -> Dict:
        reviews = db.query(DoctorFeedbackTable).filter(
            DoctorFeedbackTable.doctor_id == doctor_id,
            DoctorFeedbackTable.is_visible == True,
        ).order_by(DoctorFeedbackTable.created_at.desc()).all()
        count = len(reviews)
        average_rating = round(sum(item.rating for item in reviews) / count, 1) if count else 0.0
        recommendation_rate = round((sum(item.rating for item in reviews) / (count * 5)) * 100, 1) if count else 0.0
        rating_breakdown = {
            stars: len([item for item in reviews if item.rating == stars])
            for stars in range(5, 0, -1)
        }
        trusted_phone_set = UserService.get_trusted_contact_phone_set(viewer_user_id)
        trusted_reviews = [
            item
            for item in reviews
            if DoctorService._normalize_phone(item.patient_phone) in trusted_phone_set
        ]
        trusted_review_count = len(trusted_reviews)
        trusted_average_rating = round(
            sum(item.rating for item in trusted_reviews) / trusted_review_count,
            1,
        ) if trusted_review_count else 0.0
        trusted_recommendation_rate = round(
            (sum(item.rating for item in trusted_reviews) / (trusted_review_count * 5)) * 100,
            1,
        ) if trusted_review_count else 0.0
        trust_signal = "trusted_circle" if trusted_review_count else ("verified_reviews" if count else "new")
        return {
            "doctor_id": doctor_id,
            "average_rating": average_rating,
            "review_count": count,
            "recommendation_rate": recommendation_rate,
            "rating_breakdown": rating_breakdown,
            "trusted_review_count": trusted_review_count,
            "trusted_average_rating": trusted_average_rating,
            "trusted_recommendation_rate": trusted_recommendation_rate,
            "trust_signal": trust_signal,
        }

    @staticmethod
    def _referral_to_dict(
        referral: PatientReferralTable,
        from_doctor: Optional[DoctorTable] = None,
        to_doctor: Optional[DoctorTable] = None,
        referred_appointment: Optional[AppointmentRequestTable] = None,
    ) -> Dict:
        linked_appointment = referred_appointment
        linked_doctor = to_doctor
        if linked_appointment and not linked_doctor:
            linked_doctor = to_doctor

        return {
            "id": referral.id,
            "source_appointment_id": referral.source_appointment_id,
            "from_doctor_id": referral.from_doctor_id,
            "from_doctor_name": from_doctor.name if from_doctor else None,
            "to_doctor_id": referral.to_doctor_id,
            "to_doctor_name": to_doctor.name if to_doctor else None,
            "to_doctor_specialty": to_doctor.specialty if to_doctor else None,
            "patient_name": referral.patient_name,
            "patient_phone": referral.patient_phone,
            "patient_age": referral.patient_age,
            "patient_gender": referral.patient_gender,
            "reason": referral.reason,
            "clinical_notes": referral.clinical_notes,
            "status": referral.status,
            "referred_appointment_id": referral.referred_appointment_id,
            "referred_appointment_status": linked_appointment.status if linked_appointment else None,
            "has_result_prescription": bool(linked_appointment and linked_appointment.prescription_image),
            "created_at": referral.created_at.isoformat() if referral.created_at else None,
            "updated_at": referral.updated_at.isoformat() if referral.updated_at else None,
        }

    @staticmethod
    def _appointment_to_dict(
        app: AppointmentRequestTable,
        doctor: Optional[DoctorTable] = None,
        referral: Optional[PatientReferralTable] = None,
        from_doctor: Optional[DoctorTable] = None,
        to_doctor: Optional[DoctorTable] = None,
    ) -> Dict:
        db = SessionLocal()
        medicines = DoctorService._deserialize_medicines(app.prescription_text)
        referred_appointment = None
        try:
            if referral and referral.referred_appointment_id:
                if referral.referred_appointment_id == app.id:
                    referred_appointment = app
                else:
                    referred_appointment = db.query(AppointmentRequestTable).filter(
                        AppointmentRequestTable.id == referral.referred_appointment_id
                    ).first()

            referral_payload = DoctorService._referral_to_dict(
                referral,
                from_doctor,
                to_doctor,
                referred_appointment,
            ) if referral else None
            if referral_payload and referred_appointment:
                referral_payload["result_appointment"] = {
                    "id": referred_appointment.id,
                    "status": referred_appointment.status,
                    "appointment_date": referred_appointment.appointment_date,
                    "appointment_time": referred_appointment.appointment_time,
                    "has_prescription_image": bool(referred_appointment.prescription_image),
                    "prescription_medicines": DoctorService._deserialize_medicines(referred_appointment.prescription_text),
                    "prescription_notes": referred_appointment.prescription_notes,
                }

            feedback_context = DoctorService._build_feedback_context(
                db,
                app,
                doctor,
                referral,
            )

            return {
                "id": app.id,
                "doctor_id": app.doctor_id,
                "doctor_name": doctor.name if doctor else None,
                "doctor_specialty": doctor.specialty if doctor else None,
                "clinic_name": doctor.clinic_name if doctor else None,
                "appointment_fee": doctor.appointment_fee if doctor else None,
                "patient_name": app.patient_name,
                "patient_phone": app.patient_phone,
                "patient_age": app.patient_age,
                "patient_gender": app.patient_gender,
                "appointment_date": app.appointment_date,
                "appointment_time": app.appointment_time,
                "notes": app.notes,
                "referral_id": app.referral_id,
                "is_referred": bool(app.referral_id),
                "status": app.status,
                "reason": app.reason,
                "prescription_medicines": medicines,
                "prescription_notes": app.prescription_notes,
                "has_prescription_image": bool(app.prescription_image),
                "referral": referral_payload,
                "feedback": feedback_context,
                "created_at": app.created_at.isoformat() if app.created_at else None,
                "updated_at": app.updated_at.isoformat() if app.updated_at else None,
                "completed_at": app.completed_at.isoformat() if app.completed_at else None,
            }
        finally:
            db.close()
    
    @staticmethod
    def register_doctor(
        doctor_id: Optional[str],
        name: str,
        email: str,
        phone: str,
        gender: str,
        specialty: str,
        experience_years: int,
        qualification: str,
        password: str,
        hospital_name: Optional[str] = None,
        address: Optional[str] = None,
        clinic_name: Optional[str] = None,
        clinic_address: Optional[str] = None,
        appointment_fee: Optional[float] = None,
        profile_image: Optional[str] = None,
        degree_certificate_image: Optional[str] = None,
        preferred_language: str = "en"
    ) -> Dict:
        """Register a new doctor (creates pending status)"""
        db = SessionLocal()
        try:
            clean_email = email.strip().lower()
            normalized_doctor_id = (doctor_id or clean_email.split("@")[0]).strip().lower()
            if not normalized_doctor_id:
                return {"success": False, "message": "Doctor ID could not be generated"}

            # Check if doctor id or email already exists
            existing_by_doctor_id = db.query(DoctorTable).filter(DoctorTable.doctor_id == normalized_doctor_id).first()
            if existing_by_doctor_id:
                return {"success": False, "message": "Doctor ID already registered"}

            existing = db.query(DoctorTable).filter(DoctorTable.email == clean_email).first()
            if existing:
                return {"success": False, "message": "Email already registered"}
            
            # Create doctor record
            doctor = DoctorTable(
                doctor_id=normalized_doctor_id,
                name=name.strip(),
                email=clean_email,
                phone=phone.strip(),
                gender=(gender or "Other").strip() or "Other",
                specialty=specialty,
                experience_years=experience_years,
                qualification=qualification,
                password_hash=DoctorService.hash_password(password),
                hospital_name=hospital_name,
                address=address,
                clinic_name=clinic_name,
                clinic_address=clinic_address,
                appointment_fee=appointment_fee,
                profile_image=profile_image,
                degree_certificate_image=degree_certificate_image,
                preferred_language=preferred_language,
                status="pending"
            )
            
            db.add(doctor)
            db.commit()
            
            # Create registration request
            reg_request = DoctorRegistrationRequest(
                doctor_id=doctor.id,
                status="pending"
            )
            
            db.add(reg_request)
            db.commit()
            
            return {
                "success": True,
                "message": "Registration request submitted. Awaiting system manager approval.",
                "doctor_id": doctor.id,
                "login_id": doctor.doctor_id,
                "status": "pending"
            }
        except Exception as e:
            db.rollback()
            return {"success": False, "message": str(e)}
        finally:
            db.close()
    
    @staticmethod
    def login_doctor(login_id: str, password: str) -> Dict:
        """Login a doctor"""
        db = SessionLocal()
        try:
            normalized_login = (login_id or "").strip().lower()
            doctor = db.query(DoctorTable).filter(
                (DoctorTable.doctor_id == normalized_login) | (DoctorTable.email == normalized_login)
            ).first()
            
            if not doctor:
                return {"success": False, "message": "Doctor account not found"}
            
            if doctor.status == "rejected":
                return {"success": False, "message": "Account has been rejected by system manager"}
            if doctor.status != "approved":
                return {"success": False, "message": "Account not approved yet"}
            
            if not DoctorService.verify_password(password, doctor.password_hash):
                return {"success": False, "message": "Invalid password"}
            
            return {
                "success": True,
                "message": "Login successful",
                "doctor": {
                    "id": doctor.id,
                    "doctor_id": doctor.doctor_id,
                    "name": doctor.name,
                    "email": doctor.email,
                    "phone": doctor.phone,
                    "specialty": doctor.specialty,
                    "clinic_name": doctor.clinic_name,
                    "preferred_language": doctor.preferred_language
                }
            }
        except Exception as e:
            return {"success": False, "message": str(e)}
        finally:
            db.close()
    
    @staticmethod
    def get_pending_registrations() -> List[Dict]:
        """Get all pending doctor registrations"""
        db = SessionLocal()
        try:
            requests = db.query(DoctorTable).filter(
                DoctorTable.status == "pending"
            ).all()
            
            return [
                {
                    "id": doc.id,
                    "doctor_id": doc.doctor_id,
                    "name": doc.name,
                    "email": doc.email,
                    "phone": doc.phone,
                    "gender": doc.gender,
                    "specialty": doc.specialty,
                    "experience_years": doc.experience_years,
                    "qualification": doc.qualification,
                    "hospital_name": doc.hospital_name,
                    "address": doc.address,
                    "clinic_name": doc.clinic_name,
                    "clinic_address": doc.clinic_address,
                    "appointment_fee": doc.appointment_fee,
                    "created_at": doc.created_at.isoformat()
                }
                for doc in requests
            ]
        finally:
            db.close()

    @staticmethod
    def get_registration_history() -> List[Dict]:
        """Get reviewed doctor registrations for system manager history"""
        db = SessionLocal()
        try:
            doctors = db.query(DoctorTable).filter(
                DoctorTable.status.in_(["approved", "rejected"])
            ).order_by(DoctorTable.updated_at.desc(), DoctorTable.created_at.desc()).all()

            history = []
            for doc in doctors:
                reg_request = db.query(DoctorRegistrationRequest).filter(
                    DoctorRegistrationRequest.doctor_id == doc.id
                ).first()
                history.append(
                    {
                        "id": doc.id,
                        "doctor_id": doc.doctor_id,
                        "name": doc.name,
                        "email": doc.email,
                        "phone": doc.phone,
                        "specialty": doc.specialty,
                        "qualification": doc.qualification,
                        "experience_years": doc.experience_years,
                        "status": doc.status,
                        "created_at": doc.created_at.isoformat() if doc.created_at else None,
                        "reviewed_at": reg_request.reviewed_at.isoformat() if reg_request and reg_request.reviewed_at else None,
                        "reviewed_by": reg_request.reviewed_by if reg_request else None,
                        "review_notes": reg_request.review_notes if reg_request else None,
                    }
                )
            return history
        finally:
            db.close()
    
    @staticmethod
    def approve_doctor(doctor_id: str, manager_id: str, notes: Optional[str] = None) -> Dict:
        """Approve doctor registration"""
        db = SessionLocal()
        try:
            doctor = db.query(DoctorTable).filter(DoctorTable.id == doctor_id).first()
            
            if not doctor:
                return {"success": False, "message": "Doctor not found"}
            
            doctor.status = "approved"
            doctor.updated_at = datetime.utcnow()
            
            reg_request = db.query(DoctorRegistrationRequest).filter(
                DoctorRegistrationRequest.doctor_id == doctor_id
            ).first()
            
            if reg_request:
                reg_request.status = "approved"
                reg_request.reviewed_by = manager_id
                reg_request.reviewed_at = datetime.utcnow()
                reg_request.review_notes = notes
            
            db.commit()
            
            return {
                "success": True,
                "message": f"Doctor {doctor.name} has been approved"
            }
        except Exception as e:
            db.rollback()
            return {"success": False, "message": str(e)}
        finally:
            db.close()
    
    @staticmethod
    def reject_doctor(doctor_id: str, manager_id: str, reason: str) -> Dict:
        """Reject doctor registration"""
        db = SessionLocal()
        try:
            doctor = db.query(DoctorTable).filter(DoctorTable.id == doctor_id).first()
            
            if not doctor:
                return {"success": False, "message": "Doctor not found"}
            
            doctor.status = "rejected"
            doctor.updated_at = datetime.utcnow()
            
            reg_request = db.query(DoctorRegistrationRequest).filter(
                DoctorRegistrationRequest.doctor_id == doctor_id
            ).first()
            
            if reg_request:
                reg_request.status = "rejected"
                reg_request.reviewed_by = manager_id
                reg_request.reviewed_at = datetime.utcnow()
                reg_request.review_notes = reason
            
            db.commit()
            
            return {
                "success": True,
                "message": f"Doctor {doctor.name} has been rejected"
            }
        except Exception as e:
            db.rollback()
            return {"success": False, "message": str(e)}
        finally:
            db.close()
    
    @staticmethod
    def create_appointment_request(
        doctor_id: str,
        patient_name: str,
        patient_phone: str,
        patient_age: int,
        patient_gender: str,
        appointment_date: Optional[str] = None,
        appointment_time: Optional[str] = None,
        notes: Optional[str] = None,
        referral_id: Optional[str] = None,
    ) -> Dict:
        """Create an appointment request"""
        db = SessionLocal()
        try:
            doctor = DoctorService._get_doctor_by_identifier(db, doctor_id)
            if doctor and doctor.status != "approved":
                doctor = None
            if not doctor:
                return {"success": False, "message": "Doctor not found"}

            referral = None
            if referral_id:
                referral = db.query(PatientReferralTable).filter(PatientReferralTable.id == referral_id).first()
                if not referral:
                    return {"success": False, "message": "Referral not found"}
                if referral.to_doctor_id != doctor.id:
                    return {"success": False, "message": "Referral doctor does not match selected doctor"}
                if referral.status not in {"pending_booking", "cancelled"}:
                    return {"success": False, "message": "Referral is already booked or closed"}
            
            appointment = AppointmentRequestTable(
                doctor_id=doctor.id,
                patient_name=patient_name,
                patient_phone=patient_phone,
                patient_age=patient_age,
                patient_gender=patient_gender,
                appointment_date=appointment_date,
                appointment_time=appointment_time,
                notes=notes,
                referral_id=referral.id if referral else None,
                status="pending"
            )
            
            db.add(appointment)
            db.flush()

            if referral:
                referral.patient_name = patient_name
                referral.patient_phone = patient_phone
                referral.patient_age = patient_age
                referral.patient_gender = patient_gender
                referral.referred_appointment_id = appointment.id
                referral.status = "booked"
                referral.updated_at = datetime.utcnow()

            db.commit()
            
            return {
                "success": True,
                "message": "Appointment request created",
                "appointment_id": appointment.id,
                "referral_id": referral.id if referral else None,
            }
        except Exception as e:
            db.rollback()
            return {"success": False, "message": str(e)}
        finally:
            db.close()
    
    @staticmethod
    def get_pending_appointments(doctor_id: str) -> List[Dict]:
        """Get all pending appointments for a doctor"""
        db = SessionLocal()
        try:
            doctor = DoctorService._get_doctor_by_identifier(db, doctor_id)
            if not doctor:
                return []
            appointments = db.query(AppointmentRequestTable).filter(
                AppointmentRequestTable.doctor_id == doctor.id,
                AppointmentRequestTable.status == "pending"
            ).all()
            result = []
            for app in appointments:
                referral = db.query(PatientReferralTable).filter(PatientReferralTable.id == app.referral_id).first() if app.referral_id else None
                from_doctor = db.query(DoctorTable).filter(DoctorTable.id == referral.from_doctor_id).first() if referral else None
                to_doctor = db.query(DoctorTable).filter(DoctorTable.id == referral.to_doctor_id).first() if referral else None
                result.append(DoctorService._appointment_to_dict(app, doctor, referral, from_doctor, to_doctor))
            return result
        finally:
            db.close()

    @staticmethod
    def create_referral(
        source_appointment_id: str,
        from_doctor_id: str,
        to_doctor_id: str,
        reason: str,
        clinical_notes: Optional[str] = None,
    ) -> Dict:
        """Create a referral linked to an existing appointment."""
        db = SessionLocal()
        try:
            source_doctor = DoctorService._get_doctor_by_identifier(db, from_doctor_id)
            target_doctor = DoctorService._get_doctor_by_identifier(db, to_doctor_id)
            if not source_doctor:
                return {"success": False, "message": "Referring doctor not found"}
            if not target_doctor or target_doctor.status != "approved":
                return {"success": False, "message": "Referred doctor not found or not approved"}
            if source_doctor.id == target_doctor.id:
                return {"success": False, "message": "Doctor cannot refer patient to self"}
            if not (reason or "").strip():
                return {"success": False, "message": "Referral reason is required"}

            appointment = db.query(AppointmentRequestTable).filter(
                AppointmentRequestTable.id == source_appointment_id,
                AppointmentRequestTable.doctor_id == source_doctor.id,
            ).first()
            if not appointment:
                return {"success": False, "message": "Source appointment not found"}
            if appointment.status not in {"approved", "completed"}:
                return {"success": False, "message": "Only approved or completed appointments can be referred"}
            if appointment.referral_id:
                existing = db.query(PatientReferralTable).filter(PatientReferralTable.id == appointment.referral_id).first()
                if existing:
                    return {
                        "success": True,
                        "message": "Referral already exists for this appointment",
                        "referral": DoctorService._referral_to_dict(existing, source_doctor, target_doctor),
                    }

            referral = PatientReferralTable(
                source_appointment_id=appointment.id,
                from_doctor_id=source_doctor.id,
                to_doctor_id=target_doctor.id,
                patient_name=appointment.patient_name,
                patient_phone=appointment.patient_phone,
                patient_age=appointment.patient_age,
                patient_gender=appointment.patient_gender,
                reason=reason.strip(),
                clinical_notes=(clinical_notes or "").strip() or None,
                status="pending_booking",
            )
            db.add(referral)
            db.flush()

            appointment.referral_id = referral.id
            appointment.updated_at = datetime.utcnow()
            db.commit()

            return {
                "success": True,
                "message": "Referral created successfully",
                "referral": DoctorService._referral_to_dict(referral, source_doctor, target_doctor),
            }
        except Exception as e:
            db.rollback()
            return {"success": False, "message": str(e)}
        finally:
            db.close()
    
    @staticmethod
    def approve_appointment(appointment_id: str, revenue_amount: float = 0.0) -> Dict:
        """Approve an appointment request and send WhatsApp confirmation"""
        db = SessionLocal()
        try:
            appointment = db.query(AppointmentRequestTable).filter(
                AppointmentRequestTable.id == appointment_id
            ).first()
            
            if not appointment:
                return {"success": False, "message": "Appointment not found"}
            
            appointment.status = "approved"
            appointment.updated_at = datetime.utcnow()
            appointment.whatsapp_sent = False
            if appointment.referral_id:
                referral = db.query(PatientReferralTable).filter(PatientReferralTable.id == appointment.referral_id).first()
                if referral:
                    referral.status = "approved"
                    referral.updated_at = datetime.utcnow()
            db.commit()

            doctor = db.query(DoctorTable).filter(DoctorTable.id == appointment.doctor_id).first()

            # Record revenue
            if revenue_amount > 0:
                revenue = RevenueTable(
                    doctor_id=appointment.doctor_id,
                    appointment_id=appointment_id,
                    amount=revenue_amount,
                    date=datetime.utcnow().strftime("%Y-%m-%d")
                )
                db.add(revenue)
                db.commit()
            
            # Send WhatsApp confirmation to patient
            from app.services.whatsapp_service import WhatsAppService
            whatsapp_result = WhatsAppService.send_appointment_approved(
                patient_phone=appointment.patient_phone,
                doctor_name=doctor.name if doctor else "Doctor",
                appointment_date=appointment.appointment_date,
                appointment_time=appointment.appointment_time
            )
            appointment.whatsapp_sent = bool(whatsapp_result.get("success"))
            db.commit()
            
            return {
                "success": True,
                "message": "Appointment approved",
                "whatsapp_sent": whatsapp_result.get("success", False),
                "patient_phone": appointment.patient_phone,
                "doctor_name": doctor.name if doctor else "Doctor",
                "appointment_date": appointment.appointment_date,
                "appointment_time": appointment.appointment_time
            }
        except Exception as e:
            db.rollback()
            return {"success": False, "message": str(e)}
        finally:
            db.close()
    
    @staticmethod
    def cancel_appointment(appointment_id: str, reason: Optional[str] = None) -> Dict:
        """Cancel an appointment request"""
        db = SessionLocal()
        try:
            appointment = db.query(AppointmentRequestTable).filter(
                AppointmentRequestTable.id == appointment_id
            ).first()
            
            if not appointment:
                return {"success": False, "message": "Appointment not found"}
            
            appointment.status = "cancelled"
            appointment.reason = reason
            appointment.updated_at = datetime.utcnow()
            if appointment.referral_id:
                referral = db.query(PatientReferralTable).filter(PatientReferralTable.id == appointment.referral_id).first()
                if referral:
                    referral.status = "cancelled"
                    referral.updated_at = datetime.utcnow()
            db.commit()

            doctor = db.query(DoctorTable).filter(DoctorTable.id == appointment.doctor_id).first()
            from app.services.whatsapp_service import WhatsAppService
            whatsapp_result = WhatsAppService.send_appointment_cancelled(
                patient_phone=appointment.patient_phone,
                doctor_name=doctor.name if doctor else "Doctor",
                reason=reason
            )
            
            return {
                "success": True,
                "message": "Appointment cancelled",
                "patient_phone": appointment.patient_phone,
                "doctor_name": doctor.name if doctor else "Doctor",
                "whatsapp_sent": whatsapp_result.get("success", False)
            }
        except Exception as e:
            db.rollback()
            return {"success": False, "message": str(e)}
        finally:
            db.close()

    @staticmethod
    def complete_appointment(
        appointment_id: str,
        doctor_id: str,
        prescription_notes: Optional[str] = None,
        medicines: Optional[List[Dict]] = None
    ) -> Dict:
        """Complete an approved appointment and share prescription details."""
        db = SessionLocal()
        try:
            doctor = DoctorService._get_doctor_by_identifier(db, doctor_id)
            if not doctor:
                return {"success": False, "message": "Doctor not found"}

            appointment = db.query(AppointmentRequestTable).filter(
                AppointmentRequestTable.id == appointment_id,
                AppointmentRequestTable.doctor_id == doctor.id
            ).first()

            if not appointment:
                return {"success": False, "message": "Appointment not found"}
            if appointment.status != "approved":
                return {"success": False, "message": "Only approved appointments can be completed"}

            serialized_medicines = DoctorService._serialize_medicines(medicines)
            pdf_bytes = DoctorService._build_simple_pdf(
                appointment_id=appointment.id,
                doctor_name=doctor.name if doctor else "Doctor",
                clinic_name=(doctor.clinic_name if doctor else None) or (doctor.hospital_name if doctor else None),
                specialty=doctor.specialty if doctor else None,
                patient_name=appointment.patient_name,
                patient_age=appointment.patient_age,
                appointment_date=appointment.appointment_date,
                appointment_time=appointment.appointment_time,
                medicines=medicines or [],
                notes=prescription_notes,
            )
            prescription_image = "data:application/pdf;base64," + base64.b64encode(pdf_bytes).decode("utf-8")

            appointment.status = "completed"
            appointment.prescription_notes = prescription_notes
            appointment.prescription_text = serialized_medicines
            appointment.prescription_image = prescription_image
            appointment.completed_at = datetime.utcnow()
            appointment.updated_at = datetime.utcnow()
            if appointment.referral_id:
                referral = db.query(PatientReferralTable).filter(PatientReferralTable.id == appointment.referral_id).first()
                if referral:
                    referral.status = "completed"
                    referral.updated_at = datetime.utcnow()
            db.commit()

            from app.services.whatsapp_service import WhatsAppService
            whatsapp_result = WhatsAppService.send_appointment_completed(
                patient_phone=appointment.patient_phone,
                doctor_name=doctor.name if doctor else "Doctor",
                prescription_image=prescription_image,
                medicines=medicines or [],
                prescription_notes=prescription_notes,
            )

            return {
                "success": True,
                "message": "Appointment completed and prescription generated",
                "appointment": DoctorService._appointment_to_dict(appointment, doctor),
                "whatsapp_sent": whatsapp_result.get("success", False),
            }
        except Exception as e:
            db.rollback()
            return {"success": False, "message": str(e)}
        finally:
            db.close()
    
    @staticmethod
    def get_appointments_by_status(doctor_id: str, status: str) -> List[Dict]:
        """Get appointments by status"""
        db = SessionLocal()
        try:
            doctor = DoctorService._get_doctor_by_identifier(db, doctor_id)
            if not doctor:
                return []
            appointments = db.query(AppointmentRequestTable).filter(
                AppointmentRequestTable.doctor_id == doctor.id
            ).all()
            result = []
            for app in appointments:
                referral = db.query(PatientReferralTable).filter(PatientReferralTable.id == app.referral_id).first() if app.referral_id else None
                from_doctor = db.query(DoctorTable).filter(DoctorTable.id == referral.from_doctor_id).first() if referral else None
                to_doctor = db.query(DoctorTable).filter(DoctorTable.id == referral.to_doctor_id).first() if referral else None
                effective_status = app.status
                if referral and referral.from_doctor_id == doctor.id and referral.status == "completed":
                    effective_status = "completed"
                elif referral and referral.from_doctor_id == doctor.id and referral.status == "cancelled":
                    effective_status = "cancelled"

                if effective_status == status:
                    result.append(DoctorService._appointment_to_dict(app, doctor, referral, from_doctor, to_doctor))
            return result
        finally:
            db.close()
    
    @staticmethod
    def _resolve_filter_window(filter_type: str):
        today = datetime.utcnow().date()
        if filter_type in ("today",):
            start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            end = start + timedelta(days=1)
        elif filter_type in ("day", "previous_day"):
            end = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            start = end - timedelta(days=1)
        elif filter_type in ("week",):
            end = datetime.utcnow() + timedelta(seconds=1)
            start = end - timedelta(days=7)
        elif filter_type in ("previous_week",):
            end = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=today.weekday())
            start = end - timedelta(days=7)
        elif filter_type in ("month",):
            start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if start.month == 12:
                end = start.replace(year=start.year + 1, month=1)
            else:
                end = start.replace(month=start.month + 1)
        elif filter_type in ("previous_month",):
            month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end = month_start
            if month_start.month == 1:
                start = month_start.replace(year=month_start.year - 1, month=12)
            else:
                start = month_start.replace(month=month_start.month - 1)
        else:
            start = None
            end = None
        return start, end

    @staticmethod
    def get_revenue_analytics(doctor_id: str, filter_type: str = "today") -> Dict:
        """Get revenue analytics for a doctor"""
        db = SessionLocal()
        try:
            doctor = DoctorService._get_doctor_by_identifier(db, doctor_id)
            if not doctor:
                return {
                    "total_revenue": 0,
                    "total_appointments": 0,
                    "approved_appointments": 0,
                    "cancelled_appointments": 0,
                    "pending_appointments": 0,
                    "daily_breakdown": {}
                }
            start_dt, end_dt = DoctorService._resolve_filter_window(filter_type)

            revenue_query = db.query(RevenueTable).filter(RevenueTable.doctor_id == doctor.id)
            appointment_query = db.query(AppointmentRequestTable).filter(
                AppointmentRequestTable.doctor_id == doctor.id
            )

            if start_dt and end_dt:
                revenue_query = revenue_query.filter(
                    RevenueTable.created_at >= start_dt,
                    RevenueTable.created_at < end_dt
                )
                appointment_query = appointment_query.filter(
                    AppointmentRequestTable.created_at >= start_dt,
                    AppointmentRequestTable.created_at < end_dt
                )

            revenues = revenue_query.all()
            total_revenue = sum(r.amount for r in revenues)

            appointments = appointment_query.all()
            total_appts = len(appointments)
            approved_appts = len([a for a in appointments if a.status == "approved"])
            cancelled_appts = len([a for a in appointments if a.status == "cancelled"])

            daily_breakdown = {}
            for revenue in revenues:
                day_key = revenue.created_at.strftime("%Y-%m-%d")
                daily_breakdown[day_key] = round(daily_breakdown.get(day_key, 0) + float(revenue.amount), 2)
            
            return {
                "total_revenue": total_revenue,
                "total_appointments": total_appts,
                "approved_appointments": approved_appts,
                "cancelled_appointments": cancelled_appts,
                "pending_appointments": total_appts - approved_appts - cancelled_appts,
                "daily_breakdown": daily_breakdown
            }
        finally:
            db.close()
    
    @staticmethod
    def get_doctor_stats(doctor_id: str, overall_filter: str = "all") -> Dict:
        """Get dashboard statistics for a doctor"""
        db = SessionLocal()
        try:
            doctor = DoctorService._get_doctor_by_identifier(db, doctor_id)
            if not doctor:
                return {
                    "today_appointments": 0,
                    "today_revenue": 0,
                    "total_appointments": 0,
                    "total_revenue": 0,
                    "pending_requests": 0,
                    "approved_requests": 0,
                    "completed_requests": 0,
                    "cancelled_requests": 0,
                    "overall_filter": overall_filter
                }
            today = datetime.utcnow().date()
            today_str = today.isoformat()
            
            # Today's stats
            today_revenue = db.query(RevenueTable).filter(
                RevenueTable.doctor_id == doctor.id,
                RevenueTable.date == today_str
            ).all()
            
            today_revenue_amount = sum(r.amount for r in today_revenue)
            
            today_appointments = db.query(AppointmentRequestTable).filter(
                AppointmentRequestTable.doctor_id == doctor.id,
                AppointmentRequestTable.status == "approved"
            ).filter(
                AppointmentRequestTable.created_at >= datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            ).count()
            
            # Filtered overall stats (used by dashboard lower cards)
            overall_start_dt, overall_end_dt = DoctorService._resolve_filter_window(overall_filter)

            overall_revenue_query = db.query(RevenueTable).filter(
                RevenueTable.doctor_id == doctor.id
            )
            overall_appointments_query = db.query(AppointmentRequestTable).filter(
                AppointmentRequestTable.doctor_id == doctor.id,
                AppointmentRequestTable.status == "approved"
            )

            if overall_start_dt and overall_end_dt:
                overall_revenue_query = overall_revenue_query.filter(
                    RevenueTable.created_at >= overall_start_dt,
                    RevenueTable.created_at < overall_end_dt
                )
                overall_appointments_query = overall_appointments_query.filter(
                    AppointmentRequestTable.created_at >= overall_start_dt,
                    AppointmentRequestTable.created_at < overall_end_dt
                )

            total_revenue_amount = sum(r.amount for r in overall_revenue_query.all())
            total_appointments = overall_appointments_query.count()
            
            # Pending requests
            pending_requests = db.query(AppointmentRequestTable).filter(
                AppointmentRequestTable.doctor_id == doctor.id,
                AppointmentRequestTable.status == "pending"
            ).count()

            all_doctor_appointments = db.query(AppointmentRequestTable).filter(
                AppointmentRequestTable.doctor_id == doctor.id
            ).all()
            approved_requests = 0
            completed_requests = 0
            cancelled_requests = 0
            for appointment in all_doctor_appointments:
                effective_status = appointment.status
                if appointment.referral_id:
                    referral = db.query(PatientReferralTable).filter(
                        PatientReferralTable.id == appointment.referral_id
                    ).first()
                    if referral and referral.from_doctor_id == doctor.id and referral.status in {"completed", "cancelled"}:
                        effective_status = referral.status

                if effective_status == "approved":
                    approved_requests += 1
                elif effective_status == "completed":
                    completed_requests += 1
                elif effective_status == "cancelled":
                    cancelled_requests += 1
            
            return {
                "today_appointments": today_appointments,
                "today_revenue": today_revenue_amount,
                "total_appointments": total_appointments,
                "total_revenue": total_revenue_amount,
                "pending_requests": pending_requests,
                "approved_requests": approved_requests,
                "completed_requests": completed_requests,
                "cancelled_requests": cancelled_requests,
                "overall_filter": overall_filter
            }
        finally:
            db.close()
    
    @staticmethod
    def get_available_doctors() -> List[Dict]:
        """Get all approved doctors"""
        db = SessionLocal()
        try:
            doctors = db.query(DoctorTable).filter(
                DoctorTable.status == "approved"
            ).all()
            
            items = []
            for doc in doctors:
                summary = DoctorService._get_feedback_summary_for_doctor(db, doc.id)
                items.append(
                    {
                        "id": doc.id,
                        "doctor_id": doc.doctor_id,
                        "name": doc.name,
                        "specialty": doc.specialty,
                        "experience_years": doc.experience_years,
                        "hospital_name": doc.hospital_name,
                        "clinic_name": doc.clinic_name,
                        "address": doc.address,
                        "phone": doc.phone,
                        "email": doc.email,
                        "appointment_fee": doc.appointment_fee,
                        "average_rating": summary["average_rating"],
                        "review_count": summary["review_count"],
                        "recommendation_rate": summary["recommendation_rate"],
                    }
                )
            return sorted(
                items,
                key=lambda item: (
                    item.get("average_rating", 0),
                    item.get("recommendation_rate", 0),
                    item.get("review_count", 0),
                    item.get("experience_years", 0),
                ),
                reverse=True,
            )
        finally:
            db.close()

    @staticmethod
    def submit_doctor_feedback(
        appointment_id: str,
        patient_phone: str,
        rating: int,
        review_title: Optional[str] = None,
        review_text: Optional[str] = None,
        would_recommend: bool = True,
    ) -> Dict:
        db = SessionLocal()
        try:
            appointment = db.query(AppointmentRequestTable).filter(
                AppointmentRequestTable.id == appointment_id
            ).first()
            if not appointment:
                return {"success": False, "message": "Appointment not found"}

            doctor = db.query(DoctorTable).filter(DoctorTable.id == appointment.doctor_id).first()
            referral = db.query(PatientReferralTable).filter(
                PatientReferralTable.id == appointment.referral_id
            ).first() if appointment.referral_id else None
            target_appointment, target_doctor, _ = DoctorService._resolve_feedback_target(
                db,
                appointment,
                doctor,
                referral,
            )

            if target_appointment.status != "completed":
                return {"success": False, "message": "Feedback is only allowed for completed treatment"}
            if (target_appointment.patient_phone or "").strip() != (patient_phone or "").strip():
                return {"success": False, "message": "Feedback can only be submitted by the treated patient"}
            if not target_doctor:
                return {"success": False, "message": "Doctor not found for this completed treatment"}

            existing_feedback = db.query(DoctorFeedbackTable).filter(
                DoctorFeedbackTable.appointment_id == target_appointment.id
            ).first()
            if existing_feedback:
                return {
                    "success": True,
                    "message": "Feedback already submitted",
                    "feedback": DoctorService._serialize_feedback(existing_feedback),
                }

            feedback = DoctorFeedbackTable(
                appointment_id=target_appointment.id,
                doctor_id=target_doctor.id,
                patient_phone=target_appointment.patient_phone,
                patient_name=target_appointment.patient_name,
                rating=max(1, min(int(rating), 5)),
                review_title=(review_title or "").strip() or None,
                review_text=(review_text or "").strip() or None,
                would_recommend=bool(would_recommend),
                is_visible=True,
            )
            db.add(feedback)
            db.commit()

            return {
                "success": True,
                "message": "Feedback submitted successfully",
                "feedback": DoctorService._serialize_feedback(feedback),
                "doctor_summary": DoctorService._get_feedback_summary_for_doctor(db, target_doctor.id),
            }
        except Exception as e:
            db.rollback()
            return {"success": False, "message": str(e)}
        finally:
            db.close()

    @staticmethod
    def get_doctor_feedback(doctor_id: str, limit: int = 50, viewer_user_id: Optional[str] = None) -> List[Dict]:
        db = SessionLocal()
        try:
            doctor = DoctorService._get_doctor_by_identifier(db, doctor_id)
            if not doctor:
                return []
            trusted_phone_set = UserService.get_trusted_contact_phone_set(viewer_user_id)
            reviews = db.query(DoctorFeedbackTable).filter(
                DoctorFeedbackTable.doctor_id == doctor.id,
                DoctorFeedbackTable.is_visible == True,
            ).order_by(DoctorFeedbackTable.created_at.desc()).limit(max(1, min(limit, 100))).all()
            serialized_reviews = [
                DoctorService._serialize_feedback_for_viewer(item, trusted_phone_set)
                for item in reviews
            ]
            serialized_reviews.sort(key=lambda item: item.get("review_priority", 1))
            return serialized_reviews
        finally:
            db.close()

    @staticmethod
    def get_doctor_feedback_summary(doctor_id: str, viewer_user_id: Optional[str] = None) -> Dict:
        db = SessionLocal()
        try:
            doctor = DoctorService._get_doctor_by_identifier(db, doctor_id)
            if not doctor:
                return {
                    "doctor_id": doctor_id,
                    "average_rating": 0.0,
                    "review_count": 0,
                    "recommendation_rate": 0.0,
                    "rating_breakdown": {stars: 0 for stars in range(5, 0, -1)},
                    "trusted_review_count": 0,
                    "trusted_average_rating": 0.0,
                    "trusted_recommendation_rate": 0.0,
                    "trust_signal": "new",
                }
            return DoctorService._get_feedback_summary_for_doctor(db, doctor.id, viewer_user_id=viewer_user_id)
        finally:
            db.close()
    
    @staticmethod
    def get_patient_appointment_history(patient_phone: str) -> List[Dict]:
        """Get all appointments for a patient by phone number"""
        db = SessionLocal()
        try:
            appointments = db.query(AppointmentRequestTable).filter(
                AppointmentRequestTable.patient_phone == patient_phone
            ).order_by(AppointmentRequestTable.created_at.desc()).all()
            
            result = []
            for app in appointments:
                doctor = db.query(DoctorTable).filter(DoctorTable.id == app.doctor_id).first()
                referral = db.query(PatientReferralTable).filter(PatientReferralTable.id == app.referral_id).first() if app.referral_id else None
                from_doctor = db.query(DoctorTable).filter(DoctorTable.id == referral.from_doctor_id).first() if referral else None
                to_doctor = db.query(DoctorTable).filter(DoctorTable.id == referral.to_doctor_id).first() if referral else None
                result.append(DoctorService._appointment_to_dict(app, doctor, referral, from_doctor, to_doctor))
            return result
        finally:
            db.close()

    @staticmethod
    def get_referrals_for_patient(patient_phone: str) -> List[Dict]:
        db = SessionLocal()
        try:
            referrals = db.query(PatientReferralTable).filter(
                PatientReferralTable.patient_phone == patient_phone
            ).order_by(PatientReferralTable.created_at.desc()).all()
            result = []
            for referral in referrals:
                from_doctor = db.query(DoctorTable).filter(DoctorTable.id == referral.from_doctor_id).first()
                to_doctor = db.query(DoctorTable).filter(DoctorTable.id == referral.to_doctor_id).first()
                referred_appointment = db.query(AppointmentRequestTable).filter(
                    AppointmentRequestTable.id == referral.referred_appointment_id
                ).first() if referral.referred_appointment_id else None
                item = DoctorService._referral_to_dict(referral, from_doctor, to_doctor, referred_appointment)
                if referred_appointment:
                    item["result_appointment"] = DoctorService._appointment_to_dict(
                        referred_appointment,
                        to_doctor,
                        referral,
                        from_doctor,
                        to_doctor,
                    )
                result.append(item)
            return result
        finally:
            db.close()

    @staticmethod
    def get_referrals_for_source_doctor(doctor_id: str) -> List[Dict]:
        db = SessionLocal()
        try:
            doctor = DoctorService._get_doctor_by_identifier(db, doctor_id)
            if not doctor:
                return []
            referrals = db.query(PatientReferralTable).filter(
                PatientReferralTable.from_doctor_id == doctor.id
            ).order_by(PatientReferralTable.created_at.desc()).all()
            result = []
            for referral in referrals:
                to_doctor = db.query(DoctorTable).filter(DoctorTable.id == referral.to_doctor_id).first()
                referred_appointment = db.query(AppointmentRequestTable).filter(
                    AppointmentRequestTable.id == referral.referred_appointment_id
                ).first() if referral.referred_appointment_id else None
                item = DoctorService._referral_to_dict(referral, doctor, to_doctor, referred_appointment)
                if referred_appointment:
                    item["result_appointment"] = DoctorService._appointment_to_dict(
                        referred_appointment,
                        to_doctor,
                        referral,
                        doctor,
                        to_doctor,
                    )
                result.append(item)
            return result
        finally:
            db.close()

    @staticmethod
    def get_referrals_for_target_doctor(doctor_id: str) -> List[Dict]:
        db = SessionLocal()
        try:
            doctor = DoctorService._get_doctor_by_identifier(db, doctor_id)
            if not doctor:
                return []
            referrals = db.query(PatientReferralTable).filter(
                PatientReferralTable.to_doctor_id == doctor.id
            ).order_by(PatientReferralTable.created_at.desc()).all()
            result = []
            for referral in referrals:
                from_doctor = db.query(DoctorTable).filter(DoctorTable.id == referral.from_doctor_id).first()
                referred_appointment = db.query(AppointmentRequestTable).filter(
                    AppointmentRequestTable.id == referral.referred_appointment_id
                ).first() if referral.referred_appointment_id else None
                item = DoctorService._referral_to_dict(referral, from_doctor, doctor, referred_appointment)
                if referred_appointment:
                    item["result_appointment"] = DoctorService._appointment_to_dict(
                        referred_appointment,
                        doctor,
                        referral,
                        from_doctor,
                        doctor,
                    )
                result.append(item)
            return result
        finally:
            db.close()

    @staticmethod
    def get_referral_detail(referral_id: str) -> Optional[Dict]:
        db = SessionLocal()
        try:
            referral = db.query(PatientReferralTable).filter(PatientReferralTable.id == referral_id).first()
            if not referral:
                return None
            from_doctor = db.query(DoctorTable).filter(DoctorTable.id == referral.from_doctor_id).first()
            to_doctor = db.query(DoctorTable).filter(DoctorTable.id == referral.to_doctor_id).first()
            referred_appointment = db.query(AppointmentRequestTable).filter(
                AppointmentRequestTable.id == referral.referred_appointment_id
            ).first() if referral.referred_appointment_id else None
            item = DoctorService._referral_to_dict(referral, from_doctor, to_doctor, referred_appointment)
            if referred_appointment:
                item["result_appointment"] = DoctorService._appointment_to_dict(
                    referred_appointment,
                    to_doctor,
                    referral,
                    from_doctor,
                    to_doctor,
                )
            return item
        finally:
            db.close()

    @staticmethod
    def search_medicines(prefix: str, limit: int = 10) -> List[Dict]:
        """Return medicines whose names start with the given prefix."""
        service = ProductService()
        clean_prefix = (prefix or "").strip().lower()
        if not clean_prefix:
            return service.get_all_products()[:limit]

        matches = []
        for product in service.get_all_products():
            name = str(product.get("product_name") or "")
            if name.lower().startswith(clean_prefix):
                matches.append(product)
            if len(matches) >= limit:
                break
        return matches

    @staticmethod
    def get_prescription_image_data(appointment_id: str) -> Optional[str]:
        """Fetch stored prescription image data URI by appointment id."""
        db = SessionLocal()
        try:
            appointment = db.query(AppointmentRequestTable).filter(
                AppointmentRequestTable.id == appointment_id
            ).first()
            if not appointment:
                return None
            return appointment.prescription_image
        finally:
            db.close()

    @staticmethod
    def get_prescription_download_payload(appointment_id: str) -> Optional[Tuple[bytes, str, str]]:
        """Return a downloadable prescription file payload, preferring PDF."""
        db = SessionLocal()
        try:
            appointment = db.query(AppointmentRequestTable).filter(
                AppointmentRequestTable.id == appointment_id
            ).first()
            if not appointment:
                return None

            doctor = db.query(DoctorTable).filter(DoctorTable.id == appointment.doctor_id).first()
            patient_slug = DoctorService._sanitize_filename_part(appointment.patient_name, "patient")

            if appointment.prescription_image and "," in appointment.prescription_image:
                header, encoded = appointment.prescription_image.split(",", 1)
                media_type = header.split(";")[0].split(":", 1)[1] if ":" in header else "application/octet-stream"
                try:
                    content = base64.b64decode(encoded)
                except Exception:
                    content = b""
                if media_type == "application/pdf" and content:
                    return content, media_type, f"prescription-{patient_slug}.pdf"

            medicines = DoctorService._deserialize_medicines(appointment.prescription_text)
            if not medicines and not appointment.prescription_notes:
                return None

            pdf_bytes = DoctorService._build_simple_pdf(
                appointment_id=appointment.id,
                doctor_name=doctor.name if doctor else "Doctor",
                clinic_name=(doctor.clinic_name if doctor else None) or (doctor.hospital_name if doctor else None),
                specialty=doctor.specialty if doctor else None,
                patient_name=appointment.patient_name,
                patient_age=appointment.patient_age,
                appointment_date=appointment.appointment_date,
                appointment_time=appointment.appointment_time,
                medicines=medicines,
                notes=appointment.prescription_notes,
            )
            return pdf_bytes, "application/pdf", f"prescription-{patient_slug}.pdf"
        finally:
            db.close()
