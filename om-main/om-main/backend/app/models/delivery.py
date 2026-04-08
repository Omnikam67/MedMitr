from pydantic import BaseModel
from typing import Optional


class DeliveryBoyRegisterRequest(BaseModel):
    name: str
    phone: str
    age: int
    gender: str
    password: str


class DeliveryBoyLoginRequest(BaseModel):
    name: str
    password: str


class DeliveryBoyApprovalRequest(BaseModel):
    delivery_boy_id: str
    manager_id: str
    manager_password: Optional[str] = None
    approved: bool
    reason: Optional[str] = None


class DeliveryBoyActionRequest(BaseModel):
    delivery_boy_id: str
    otp: Optional[str] = None
    reason: Optional[str] = None
