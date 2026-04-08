from pydantic import BaseModel
from typing import Optional

class UserBase(BaseModel):
    phone: Optional[str] = None
    shop_id: Optional[str] = None
    pharma_id: Optional[str] = None

class UserRegister(UserBase):
    password: str
    name: str
    age: Optional[int] = None
    preferred_language: Optional[str] = "en"

class UserLogin(BaseModel):
    phone: Optional[str] = None
    shop_id: Optional[str] = None
    pharma_id: Optional[str] = None
    password: str


class ForgotPasswordRequest(BaseModel):
    phone: str


class ResetPasswordRequest(BaseModel):
    phone: str
    otp: str
    new_password: str

class UserResponse(BaseModel):
    id: str
    name: str
    owner_name: Optional[str] = None
    store_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    shop_id: Optional[str] = None
    pharma_id: Optional[str] = None
    address: Optional[str] = None
    store_address: Optional[str] = None
    pharmacy_address: Optional[str] = None
    pharmacy_license_number: Optional[str] = None
    role: str  # "user" or "admin"
    preferred_language: Optional[str] = "en"

class AuthResponse(BaseModel):
    success: bool
    message: str
    user: Optional[UserResponse] = None
    session_id: Optional[str] = None
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"


class PharmacistSignupRequest(BaseModel):
    store_name: str
    owner_name: str
    mobile_number: str
    email: str
    pharma_id: str
    store_address: str
    pharmacy_license_number: str
    pharmacy_address: str
    password: str


class SystemManagerLoginRequest(BaseModel):
    manager_id: str
    password: str


class ManagerActionRequest(BaseModel):
    manager_id: str
    password: Optional[str] = None
