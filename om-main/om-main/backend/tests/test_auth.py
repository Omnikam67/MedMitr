import uuid
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_register_and_login_user():
    import uuid
    # Use clean, unique, digit-only phone to prevent collisions in multiple test runs
    phone = "555" + "".join(ch for ch in uuid.uuid4().hex if ch.isdigit())[:7]
    payload = {
        "name": "Test User",
        "phone": phone,
        "password": "pass123",
        "age": 30
    }
    r = client.post("/auth/register", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["success"]
    assert data["user"]["phone"] == phone

    # duplicate register should fail
    r2 = client.post("/auth/register", json=payload)
    assert r2.status_code == 200
    assert not r2.json()["success"]

    # login with correct credentials
    login_payload = {"phone": phone, "password": "pass123"}
    r3 = client.post("/auth/login", json=login_payload)
    assert r3.status_code == 200
    d3 = r3.json()
    assert d3["success"]
    assert d3["user"]["phone"] == phone

    # login with bad password
    r4 = client.post("/auth/login", json={"phone": phone, "password": "wrong"})
    assert r4.status_code == 200
    assert not r4.json()["success"]


def test_register_and_login_admin():
    import uuid
    # Use unique shop_id to prevent collisions
    shop_id = "SHOP" + uuid.uuid4().hex[:6].upper()
    payload = {
        "name": "Test Admin",
        "shop_id": shop_id,
        "password": "adminpass"
    }
    r = client.post("/auth/register", json=payload)
    assert r.status_code == 200
    assert r.json()["success"]
    assert r.json()["user"]["shop_id"] == shop_id

    r2 = client.post("/auth/login", json={"shop_id": shop_id, "password": "adminpass"})
    assert r2.status_code == 200
    assert r2.json()["success"]
    assert r2.json()["user"]["shop_id"] == shop_id
