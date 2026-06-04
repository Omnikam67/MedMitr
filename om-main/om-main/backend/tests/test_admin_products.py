from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_admin_products():
    from backend.app.core.security import create_access_token
    token = create_access_token({"role": "admin", "sub": "admin-id"})
    headers = {"Authorization": f"Bearer {token}"}

    # ensure the endpoint returns a JSON with products list and analysis summary
    resp = client.get("/admin/products", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    assert "products" in data
    assert "analysis" in data
    assert isinstance(data["products"], list)
    assert isinstance(data["analysis"], dict)
