import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.agents.execution_agent import ExecutionAgent


class DummyProductService:
    def get_all_products(self):
        return [
            {
                "product_id": "1",
                "product_name": "Diclo-ratiopharm Schmerzgel",
                "price": 10.0,
                "stock": 5,
                "description": "Topical gel for muscle pain, joint pain, sprain, strain, and swelling.",
                "prescription_required": False,
            },
            {
                "product_id": "2",
                "product_name": "Paracetamol apodiscounter 500 mg",
                "price": 4.0,
                "stock": 20,
                "description": "Tablet for mild to moderate pain and fever.",
                "prescription_required": False,
            },
            {
                "product_id": "3",
                "product_name": "Iberogast Classic",
                "price": 8.0,
                "stock": 10,
                "description": "Digestive support for stomach discomfort and bloating.",
                "prescription_required": False,
            },
        ]

    def get_product_by_name(self, name: str):
        for p in self.get_all_products():
            if p["product_name"] == name:
                return p
        return None


def test_hybrid_symptom_ranking_prefers_relevant_leg_pain_product(monkeypatch):
    agent = ExecutionAgent.__new__(ExecutionAgent)
    agent.product_service = DummyProductService()
    agent.order_service = None

    monkeypatch.setattr("app.agents.execution_agent.search_product", lambda symptom, n_results=5: [
        {"name": "Diclo-ratiopharm Schmerzgel"},
        {"name": "Paracetamol apodiscounter 500 mg"},
    ])
    monkeypatch.setattr(agent, "_rank_candidates_with_ai", lambda symptom, candidates: candidates)

    candidates = agent._collect_relevant_products(
        "leg pain",
        ["Diclo-ratiopharm Schmerzgel", "Paracetamol apodiscounter 500 mg"],
    )

    assert candidates
    assert candidates[0]["name"] == "Diclo-ratiopharm Schmerzgel"
    assert any(item["name"] == "Paracetamol apodiscounter 500 mg" for item in candidates)
