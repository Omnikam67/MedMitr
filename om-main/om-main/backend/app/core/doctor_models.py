from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.dialects.mysql import LONGTEXT
from datetime import datetime
from app.core.database import Base
import uuid


class DoctorTable(Base):
    __tablename__ = "doctors"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    doctor_id = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    phone = Column(String(20), nullable=False)
    password_hash = Column(String(255), nullable=False)
    specialty = Column(String(255), nullable=False)
    gender = Column(String(20), nullable=False, default="Other")
    experience_years = Column(Integer, nullable=False)
    qualification = Column(String(255), nullable=False)
    hospital_name = Column(String(255), nullable=True)
    clinic_name = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    clinic_address = Column(Text, nullable=True)
    appointment_fee = Column(Float, nullable=True)  # Doctor's consultation fee
    profile_image = Column(Text().with_variant(LONGTEXT, "mysql"), nullable=True)
    degree_certificate_image = Column(Text().with_variant(LONGTEXT, "mysql"), nullable=True)
    availability = Column(Text, nullable=True)  # JSON format
    status = Column(String(20), default="pending")  # pending, approved, rejected
    preferred_language = Column(String(10), default="en")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<Doctor {self.name} ({self.email})>"


class DoctorRegistrationRequest(Base):
    __tablename__ = "doctor_registration_requests"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    doctor_id = Column(String(36), ForeignKey("doctors.id"), nullable=False)
    status = Column(String(20), default="pending")  # pending, approved, rejected
    request_date = Column(DateTime, default=datetime.utcnow)
    reviewed_by = Column(String(255), nullable=True)  # manager_id
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    
    def __repr__(self):
        return f"<RegistrationRequest {self.doctor_id} - {self.status}>"


class AppointmentRequestTable(Base):
    __tablename__ = "appointment_requests"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    doctor_id = Column(String(36), ForeignKey("doctors.id"), nullable=False)
    patient_name = Column(String(255), nullable=False)
    patient_phone = Column(String(20), nullable=False)
    patient_age = Column(Integer, nullable=False)
    patient_gender = Column(String(10), nullable=False)  # M, F, Other
    appointment_date = Column(String(10), nullable=True)  # YYYY-MM-DD
    appointment_time = Column(String(5), nullable=True)  # HH:MM
    notes = Column(Text, nullable=True)
    referral_id = Column(String(36), ForeignKey("patient_referrals.id", name="fk_appointment_referral", use_alter=True), nullable=True, index=True)
    status = Column(String(20), default="pending")  # pending, approved, completed, cancelled
    reason = Column(Text, nullable=True)  # cancellation or approval reason
    prescription_notes = Column(Text, nullable=True)
    prescription_text = Column(Text, nullable=True)
    prescription_image = Column(Text().with_variant(LONGTEXT, "mysql"), nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    whatsapp_sent = Column(Boolean, default=False)
    
    def __repr__(self):
        return f"<Appointment {self.patient_name} - {self.status}>"


class PatientReferralTable(Base):
    __tablename__ = "patient_referrals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_appointment_id = Column(String(36), ForeignKey("appointment_requests.id", name="fk_referral_source_appointment", use_alter=True), nullable=False, index=True)
    from_doctor_id = Column(String(36), ForeignKey("doctors.id"), nullable=False, index=True)
    to_doctor_id = Column(String(36), ForeignKey("doctors.id"), nullable=False, index=True)
    patient_name = Column(String(255), nullable=False)
    patient_phone = Column(String(20), nullable=False, index=True)
    patient_age = Column(Integer, nullable=True)
    patient_gender = Column(String(10), nullable=True)
    reason = Column(Text, nullable=False)
    clinical_notes = Column(Text, nullable=True)
    status = Column(String(30), default="pending_booking")  # pending_booking, booked, approved, completed, cancelled
    referred_appointment_id = Column(String(36), ForeignKey("appointment_requests.id", name="fk_referral_referred_appointment", use_alter=True), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Referral {self.id} {self.from_doctor_id}->{self.to_doctor_id} {self.status}>"


class DoctorFeedbackTable(Base):
    __tablename__ = "doctor_feedback"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    appointment_id = Column(String(36), ForeignKey("appointment_requests.id"), nullable=False, unique=True, index=True)
    doctor_id = Column(String(36), ForeignKey("doctors.id"), nullable=False, index=True)
    patient_phone = Column(String(20), nullable=False, index=True)
    patient_name = Column(String(255), nullable=True)
    rating = Column(Integer, nullable=False)
    review_title = Column(String(255), nullable=True)
    review_text = Column(Text, nullable=True)
    would_recommend = Column(Boolean, default=True)
    is_visible = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<DoctorFeedback {self.doctor_id} {self.rating} stars>"


class RevenueTable(Base):
    __tablename__ = "revenues"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    doctor_id = Column(String(36), ForeignKey("doctors.id"), nullable=False)
    appointment_id = Column(String(36), ForeignKey("appointment_requests.id"), nullable=False)
    amount = Column(Float, nullable=False)
    date = Column(String(10), nullable=False)  # YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<Revenue {self.doctor_id} - {self.amount}>"
