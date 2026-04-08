import uuid
from datetime import datetime
from typing import Dict, List, Optional

from app.core.database import SessionLocal
from app.core.models import DeliveryBoy, Order, Product, User
from app.core.security import hash_password, verify_password
from app.services.whatsapp_service import WhatsAppService


class DeliveryService:
    @staticmethod
    def register_delivery_boy(name: str, phone: str, age: int, gender: str, password: str) -> Dict:
        db = SessionLocal()
        try:
            clean_name = (name or "").strip()
            clean_phone = (phone or "").strip()
            if not clean_name or not clean_phone:
                return {"success": False, "message": "Name and phone are required"}

            existing = db.query(DeliveryBoy).filter(
                (DeliveryBoy.name == clean_name) | (DeliveryBoy.phone == clean_phone)
            ).first()
            if existing:
                return {"success": False, "message": "Delivery boy with same name or phone already exists"}

            delivery_boy = DeliveryBoy(
                id=str(uuid.uuid4()),
                name=clean_name,
                phone=clean_phone,
                age=int(age),
                gender=(gender or "Other").strip() or "Other",
                password_hash=hash_password(password),
                status="pending",
            )
            db.add(delivery_boy)
            db.commit()
            return {
                "success": True,
                "message": "Delivery boy registration submitted for approval.",
                "delivery_boy": DeliveryService._delivery_boy_to_dict(delivery_boy),
            }
        except Exception as e:
            db.rollback()
            return {"success": False, "message": str(e)}
        finally:
            db.close()

    @staticmethod
    def login_delivery_boy(name: str, password: str) -> Dict:
        db = SessionLocal()
        try:
            clean_name = (name or "").strip()
            delivery_boy = db.query(DeliveryBoy).filter(DeliveryBoy.name == clean_name).first()
            if not delivery_boy:
                return {"success": False, "message": "Delivery boy account not found"}
            if delivery_boy.status == "rejected":
                return {"success": False, "message": "Account has been rejected by system manager"}
            if delivery_boy.status != "approved":
                return {"success": False, "message": "Account not approved yet"}
            if not verify_password(password, delivery_boy.password_hash):
                return {"success": False, "message": "Invalid password"}
            return {
                "success": True,
                "message": "Login successful",
                "delivery_boy": DeliveryService._delivery_boy_to_dict(delivery_boy),
            }
        finally:
            db.close()

    @staticmethod
    def get_pending_delivery_boys() -> List[Dict]:
        db = SessionLocal()
        try:
            pending = db.query(DeliveryBoy).filter(DeliveryBoy.status == "pending").order_by(DeliveryBoy.created_at.asc()).all()
            return [DeliveryService._delivery_boy_to_dict(item) for item in pending]
        finally:
            db.close()

    @staticmethod
    def get_delivery_boy_history() -> List[Dict]:
        db = SessionLocal()
        try:
            reviewed = db.query(DeliveryBoy).filter(
                DeliveryBoy.status.in_(["approved", "rejected"])
            ).order_by(DeliveryBoy.approved_at.desc(), DeliveryBoy.updated_at.desc(), DeliveryBoy.created_at.desc()).all()
            return [DeliveryService._delivery_boy_to_dict(item) for item in reviewed]
        finally:
            db.close()

    @staticmethod
    def approve_delivery_boy(delivery_boy_id: str, manager_id: str) -> Dict:
        db = SessionLocal()
        try:
            delivery_boy = db.query(DeliveryBoy).filter(DeliveryBoy.id == delivery_boy_id).first()
            if not delivery_boy:
                return {"success": False, "message": "Delivery boy not found"}
            delivery_boy.status = "approved"
            delivery_boy.rejection_reason = None
            delivery_boy.approved_by = manager_id
            delivery_boy.approved_at = datetime.utcnow()
            db.commit()
            return {"success": True, "message": f"{delivery_boy.name} approved successfully"}
        except Exception as e:
            db.rollback()
            return {"success": False, "message": str(e)}
        finally:
            db.close()

    @staticmethod
    def reject_delivery_boy(delivery_boy_id: str, manager_id: str, reason: str) -> Dict:
        db = SessionLocal()
        try:
            delivery_boy = db.query(DeliveryBoy).filter(DeliveryBoy.id == delivery_boy_id).first()
            if not delivery_boy:
                return {"success": False, "message": "Delivery boy not found"}
            delivery_boy.status = "rejected"
            delivery_boy.rejection_reason = reason
            delivery_boy.approved_by = manager_id
            delivery_boy.approved_at = datetime.utcnow()
            db.commit()
            return {"success": True, "message": f"{delivery_boy.name} rejected"}
        except Exception as e:
            db.rollback()
            return {"success": False, "message": str(e)}
        finally:
            db.close()

    @staticmethod
    def get_orders_for_delivery_boy(delivery_boy_id: str, status: Optional[str] = None) -> List[Dict]:
        db = SessionLocal()
        try:
            query = db.query(Order)
            if status == "pending":
                query = query.filter(
                    Order.status == "pending",
                    ((Order.delivery_boy_id.is_(None)) | (Order.delivery_boy_id == delivery_boy_id)),
                )
            elif status in {"completed", "cancelled"}:
                query = query.filter(
                    Order.status == status,
                    Order.delivery_boy_id == delivery_boy_id,
                )
            else:
                query = query.filter(
                    ((Order.status == "pending") & ((Order.delivery_boy_id.is_(None)) | (Order.delivery_boy_id == delivery_boy_id)))
                    | ((Order.status.in_(["completed", "cancelled"])) & (Order.delivery_boy_id == delivery_boy_id))
                )
            query = query.order_by(Order.order_date.desc())
            orders = query.all()
            return [DeliveryService._order_to_delivery_dict(db, order, delivery_boy_id) for order in orders]
        finally:
            db.close()

    @staticmethod
    def complete_order(order_id: int, delivery_boy_id: str, otp: str) -> Dict:
        db = SessionLocal()
        try:
            order = db.query(Order).filter(Order.id == order_id).first()
            if not order:
                return {"success": False, "message": "Order not found"}
            if order.delivery_boy_id and str(order.delivery_boy_id) != str(delivery_boy_id):
                return {"success": False, "message": "Order is assigned to another delivery partner"}
            if str(order.status).lower() == "cancelled":
                return {"success": False, "message": "Cancelled order cannot be completed"}
            expected_otp = str(order.otp_code or "").strip()
            submitted_otp = str(otp or "").strip()
            if not expected_otp:
                return {"success": False, "message": "No OTP available for this order"}
            if submitted_otp != expected_otp:
                return {"success": False, "message": "Invalid OTP"}

            order.status = "completed"
            order.delivery_boy_id = delivery_boy_id
            order.delivery_completed_at = datetime.utcnow()
            order.updated_at = datetime.utcnow()
            db.commit()

            user = db.query(User).filter(User.id == order.patient_id).first()
            if user and user.phone:
                WhatsAppService._send_message(
                    WhatsAppService.format_phone_number(user.phone),
                    (
                        "Order Delivered\n\n"
                        f"Your medicine order #{order.id} has been delivered successfully.\n"
                        "Thank you for using our pharmacy service."
                    ),
                )

            return {"success": True, "message": "Order marked as completed", "order_id": order.id, "status": order.status}
        except Exception as e:
            db.rollback()
            return {"success": False, "message": str(e)}
        finally:
            db.close()

    @staticmethod
    def cancel_order(order_id: int, delivery_boy_id: str, reason: str) -> Dict:
        db = SessionLocal()
        try:
            order = db.query(Order).filter(Order.id == order_id).first()
            if not order:
                return {"success": False, "message": "Order not found"}
            if order.delivery_boy_id and str(order.delivery_boy_id) != str(delivery_boy_id):
                return {"success": False, "message": "Order is assigned to another delivery partner"}
            if str(order.status).lower() == "completed":
                return {"success": False, "message": "Completed order cannot be cancelled"}
            if str(order.status).lower() == "cancelled":
                return {"success": True, "message": "Order already cancelled", "order_id": order.id, "status": order.status}

            for item in order.items:
                product = db.query(Product).filter(Product.id == item.product_id).first()
                if product:
                    product.stock = int(product.stock or 0) + int(item.quantity)

            order.status = "cancelled"
            order.delivery_boy_id = delivery_boy_id
            order.delivery_cancel_reason = (reason or "").strip()
            order.delivery_cancelled_at = datetime.utcnow()
            order.updated_at = datetime.utcnow()
            db.commit()

            user = db.query(User).filter(User.id == order.patient_id).first()
            if user and user.phone:
                WhatsAppService._send_message(
                    WhatsAppService.format_phone_number(user.phone),
                    (
                        "Order Cancelled\n\n"
                        f"Your medicine order #{order.id} was cancelled by delivery partner.\n"
                        f"Reason: {order.delivery_cancel_reason or 'Not provided'}"
                    ),
                )

            return {"success": True, "message": "Order cancelled", "order_id": order.id, "status": order.status}
        except Exception as e:
            db.rollback()
            return {"success": False, "message": str(e)}
        finally:
            db.close()

    @staticmethod
    def _delivery_boy_to_dict(delivery_boy: DeliveryBoy) -> Dict:
        return {
            "id": delivery_boy.id,
            "name": delivery_boy.name,
            "phone": delivery_boy.phone,
            "age": delivery_boy.age,
            "gender": delivery_boy.gender,
            "status": delivery_boy.status,
            "rejection_reason": delivery_boy.rejection_reason,
            "approved_by": delivery_boy.approved_by,
            "approved_at": delivery_boy.approved_at.isoformat() if delivery_boy.approved_at else None,
            "created_at": delivery_boy.created_at.isoformat() if delivery_boy.created_at else None,
        }

    @staticmethod
    def _order_to_delivery_dict(db, order: Order, delivery_boy_id: str) -> Dict:
        user = db.query(User).filter(User.id == order.patient_id).first()
        item = order.items[0] if order.items else None
        product_name = "Unknown"
        quantity = 0
        if item:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            product_name = product.product_name if product else "Unknown"
            quantity = item.quantity
        return {
            "order_id": order.id,
            "customer_name": user.name if user else "Unknown",
            "customer_phone": user.phone if user else "",
            "medicine": product_name,
            "quantity": quantity,
            "delivery_location": order.delivery_location,
            "delivery_map_url": order.delivery_map_url,
            "status": order.status,
            "delivery_cancel_reason": order.delivery_cancel_reason,
            "handled_by_me": str(order.delivery_boy_id or "") == str(delivery_boy_id),
            "date": order.order_date.isoformat() if order.order_date else None,
        }
