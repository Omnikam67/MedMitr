from app.agents.execution_agent import send_notification
from app.services.user_service import UserService
import os

def test_send_notification_no_credentials(monkeypatch):
    # ensure no exception when Twilio not configured
    # temporarily unset env vars
    monkeypatch.delenv("TWILIO_ACCOUNT_SID", raising=False)
    monkeypatch.delenv("TWILIO_AUTH_TOKEN", raising=False)
    monkeypatch.delenv("TWILIO_WHATSAPP_FROM", raising=False)
    # call with dummy phone
    send_notification("+1234567890", "Test message")
    # if we reach here without error, it's fine


def test_user_service_register_and_notify():
    # register a user and ensure user data persists
    import uuid
    phone = "555" + "".join(ch for ch in uuid.uuid4().hex if ch.isdigit())[:7]
    result = UserService.register_user('Notify', phone, None, 'pw', None, 'user')
    assert result['success']
    user = UserService.get_user(result['user']['id'])
    assert user['phone'] == UserService.normalize_phone(phone)
