import sys, os
import pytest
import asyncio

# make sure backend module is on sys.path for imports when pytest runs from workspace root
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.app.agents.decision_agent import DecisionAgent
from backend.app.services.user_service import UserService


def _run_test_logic():
    da = DecisionAgent()

    # register a user with a random phone to avoid collisions in repeated runs
    import uuid
    phone = "555" + "".join(ch for ch in uuid.uuid4().hex if ch.isdigit())[:7]
    reg = UserService.register_user("PendingTester", phone, None, "pw", None, "user", address="123 Test St")
    assert reg.get("success"), "user registration failed in test"
    session = reg.get("user", {}).get("id")
    assert session, "Session ID should not be None"

    # ask to order a medicine but omit the quantity requirement
    first_msg = "Order Cystinol akut"
    parsed1 = {
        "intent": "order",
        "product_name": "Cystinol akut",
        "quantity": None,
        "missing": "quantity",
        "symptom": None,
        "friendly_response": ""
    }
    resp1 = asyncio.run(da.decide(parsed1, raw_message=first_msg, session_id=session))
    assert "Cystinol" in resp1.get("message", ""), "Initial prompt should reference Cystinol"

    # now send only a number as the user's message
    second_msg = "5"
    parsed2 = {
        "intent": "order",
        "product_name": None,
        "quantity": 5,
        "missing": None,
        "symptom": None,
        "friendly_response": ""
    }
    resp2 = asyncio.run(da.decide(parsed2, raw_message=second_msg, session_id=session))

    # verify the final order used the correct product
    assert "Cystinol" in resp2.get("message", ""), "Quantity reply should inherit the earlier product"
    assert "Order Confirmed" in resp2.get("message", ""), "Order should complete successfully"


# additional scenario: quantity reply that includes wrong product name

def _run_misleading_product():
    da = DecisionAgent()
    import uuid
    phone = "555" + "".join(ch for ch in uuid.uuid4().hex if ch.isdigit())[:7]
    reg = UserService.register_user("PendingTester", phone, None, "pw", None, "user", address="123 Test St")
    session = reg.get("user", {}).get("id")

    # prompt for NORSAN but LLM later mis-parses the follow-up quantity as Nurofen
    first_msg = "Order NORSAN Omega-3 Vegan"
    parsed1 = {
        "intent": "order",
        "product_name": "NORSAN Omega-3 Vegan",
        "quantity": None,
        "missing": "quantity",
        "symptom": None,
        "friendly_response": ""
    }
    resp1 = asyncio.run(da.decide(parsed1, raw_message=first_msg, session_id=session))
    assert "NORSAN" in resp1.get("message", "")

    # now the user replies with a number but parser wrongly assigns Nurofen
    second_msg = "10"
    parsed2 = {
        "intent": "order",
        "product_name": "Nurofen 200 mg Schmelztabletten Lemon",  # incorrect parse
        "quantity": 10,
        "missing": None,
        "symptom": None,
        "friendly_response": ""
    }
    resp2 = asyncio.run(da.decide(parsed2, raw_message=second_msg, session_id=session))

    # we expect the decision agent to ignore the wrong name and use pending product
    assert "NORSAN" in resp2.get("message", ""), "Should have ordered NORSAN despite parser mistake"
    assert "Order Confirmed" in resp2.get("message", "")


def _run_prescription_flow():
    """Simulate a prescription-required order, then uploading an image."""
    da = DecisionAgent()
    import uuid
    phone = "555" + "".join(ch for ch in uuid.uuid4().hex if ch.isdigit())[:7]
    reg = UserService.register_user("PrescTester", phone, None, "pw", None, "user", address="123 Test St")
    session = reg.get("user", {}).get("id")

    # monkey-patch safety to force prescription requirement
    def fake_validate(patient_id, product_name, quantity, has_prescription):
        if not has_prescription:
            return {"approved": False, "reason": "Prescription required", "needs_prescription": True}
        return {"approved": True, "reason": "ok", "needs_prescription": False}
    da.safety_agent.validate_order = fake_validate

    # first request should ask for prescription
    parsed1 = {
        "intent": "order",
        "product_name": "AnyMedicine",
        "quantity": 2,
        "missing": None,
        "symptom": None,
        "friendly_response": ""
    }
    resp1 = asyncio.run(da.decide(parsed1, raw_message="Order AnyMedicine", session_id=session))
    assert "Prescription Required" in resp1.get("message", ""), "Should ask for prescription"

    # now upload image
    parsed2 = parsed1.copy()
    parsed2["quantity"] = 2
    resp2 = asyncio.run(da.decide(parsed2, raw_message="Here is my prescription", session_id=session, image="base64data"))
    assert "Order Confirmed" in resp2.get("message", ""), "Order should complete after image"


def test_quantity_followup_preserves_product():
    _run_test_logic()
    _run_misleading_product()
    _run_prescription_flow()


def test_quantity_followup_preserves_product():
    _run_test_logic()
