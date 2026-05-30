import httpx
from langfuse import observe
from app.services.order_service import OrderService
from app.services.product_service import ProductService
from app.services.vector_store import search_product
from app.services.user_service import UserService
from app.services.translation_service import translate_text
import os
from datetime import datetime
import re
import json

# import Twilio only if available
try:
    from twilio.rest import Client
except ImportError:
    Client = None

# Configuration
WAREHOUSE_WEBHOOK = "http://localhost:9000/fulfill"  # Mock webhook


def _normalize_whatsapp_phone(phone: str) -> str:
    """Normalize common phone inputs to E.164 format for WhatsApp."""
    raw = str(phone or "").strip()
    if not raw:
        return ""
    if raw.startswith("whatsapp:"):
        raw = raw.split("whatsapp:", 1)[1].strip()
    digits = re.sub(r"[^\d+]", "", raw)
    if not digits:
        return ""
    if digits.startswith("+"):
        return digits
    only = re.sub(r"\D", "", digits)
    if len(only) == 10:
        return f"+91{only}"
    return f"+{only}"


def send_notification(phone: str, message: str):
    """Send a WhatsApp notification via Twilio if credentials are set."""
    if not Client:
        return {"sent": False, "error": "twilio package is not installed"}
    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    from_num = os.getenv("TWILIO_WHATSAPP_FROM")
    if not sid or not token or not from_num:
        return {"sent": False, "error": "Twilio credentials are missing"}
    to_phone = _normalize_whatsapp_phone(phone)
    if not to_phone:
        return {"sent": False, "error": "Invalid destination phone number"}
    try:
        client = Client(sid, token)
        twilio_msg = client.messages.create(body=message, from_=from_num, to=f"whatsapp:{to_phone}")
        return {"sent": True, "sid": getattr(twilio_msg, "sid", None), "to": to_phone}
    except Exception as e:
        print(f"Failed to send notification: {e}")
        return {"sent": False, "error": str(e), "to": to_phone}

@observe(name="pricing_calculation")
def calculate_price(price, qty):
    # Ensure inputs are numbers to avoid errors
    try:
        return round(float(price) * int(qty), 2)
    except:
        return 0


class ExecutionAgent:

    def __init__(self):
        self.order_service = OrderService()
        self.product_service = ProductService()

    def _normalize_text(self, text: str) -> str:
        lowered = str(text or "").lower()
        lowered = re.sub(r"[^\w\s]", " ", lowered, flags=re.UNICODE)
        lowered = lowered.replace("_", " ")
        return re.sub(r"\s+", " ", lowered).strip()

    def _symptom_terms(self, symptom: str) -> list[str]:
        stop_words = {
            "i", "im", "i'm", "have", "having", "feel", "feeling", "got", "my",
            "the", "a", "an", "in", "on", "at", "is", "am", "pain", "ache",
        }
        normalized = self._normalize_text(symptom)
        return [term for term in normalized.split() if term and term not in stop_words and len(term) > 1]

    def _build_symptom_queries(self, symptom: str, language: str = "en", symptom_ai: dict | None = None) -> list[str]:
        queries: list[str] = []

        def add_query(value: str):
            normalized = self._normalize_text(value)
            if normalized and normalized not in queries:
                queries.append(normalized)

        add_query(symptom)

        if symptom_ai:
            add_query(symptom_ai.get("normalized_symptom", ""))
            add_query(symptom_ai.get("search_query", ""))
            for item in symptom_ai.get("keywords", []) or []:
                add_query(item)

        if language != "en":
            add_query(translate_text(symptom, target="en"))
            if symptom_ai:
                add_query(translate_text(symptom_ai.get("search_query", ""), target="en"))

        return queries

    def _detect_hard_red_flag(self, symptom: str) -> dict | None:
        normalized = self._normalize_text(symptom)
        if not normalized:
            return None

        chest_patterns = [
            "chest pain",
            "chest tightness",
            "chest pressure",
            "heart pain",
            "heart ache",
            "cardiac pain",
            "cheast pain",
            "cheast tightness",
            "pain in chest",
            "pain in heart",
        ]
        breathing_patterns = [
            "trouble breathing",
            "difficulty breathing",
            "shortness of breath",
            "breathless",
        ]

        if any(pattern in normalized for pattern in chest_patterns):
            return {
                "original_symptom": symptom,
                "normalized_symptom": "chest pain",
                "search_query": "chest pain",
                "body_part": "chest",
                "severity": "severe",
                "keywords": ["chest pain"],
                "red_flag": True,
                "red_flag_reason": "Chest pain can be serious and should not be treated with over-the-counter symptom matching.",
            }

        if any(pattern in normalized for pattern in breathing_patterns):
            return {
                "original_symptom": symptom,
                "normalized_symptom": normalized,
                "search_query": normalized,
                "body_part": None,
                "severity": "severe",
                "keywords": ["breathing problem"],
                "red_flag": True,
                "red_flag_reason": "Breathing difficulty may need urgent medical evaluation.",
            }

        return None

    def _analyze_symptom_with_ai(self, symptom: str) -> dict:
        hard_flag = self._detect_hard_red_flag(symptom)
        if hard_flag:
            return hard_flag

        normalized = self._normalize_text(symptom)
        fallback = {
            "original_symptom": symptom,
            "normalized_symptom": normalized or symptom,
            "search_query": normalized or symptom,
            "body_part": None,
            "severity": "unknown",
            "keywords": self._symptom_terms(symptom),
            "red_flag": False,
            "red_flag_reason": None,
        }

        if not symptom or len(normalized) < 3:
            return fallback

        system = (
            "You analyze pharmacy symptom messages. "
            "Return only valid JSON with this schema: "
            "{\"normalized_symptom\": string, "
            "\"search_query\": string, "
            "\"body_part\": string|null, "
            "\"severity\": \"mild\"|\"moderate\"|\"severe\"|\"unknown\", "
            "\"keywords\": [string], "
            "\"red_flag\": boolean, "
            "\"red_flag_reason\": string|null}. "
            "Normalize the user's complaint into a short symptom phrase like "
            "\"muscle pain\", \"joint pain\", \"stomach pain\", \"fever\", or \"cough\". "
            "Mark red_flag true for dangerous symptoms like chest pain, trouble breathing, stroke-like symptoms, fainting, heavy bleeding, or severe allergic reaction."
        )
        user = f"User symptom message: {symptom}"

        try:
            from app.agents.conversational_agent import llm
            from langchain_core.messages import HumanMessage, SystemMessage

            response = llm.invoke([SystemMessage(content=system), HumanMessage(content=user)])
            payload = json.loads(response.content)

            normalized_symptom = self._normalize_text(payload.get("normalized_symptom", "")) or fallback["normalized_symptom"]
            search_query = self._normalize_text(payload.get("search_query", "")) or normalized_symptom
            keywords = payload.get("keywords", [])
            if not isinstance(keywords, list):
                keywords = fallback["keywords"]

            return {
                "original_symptom": symptom,
                "normalized_symptom": normalized_symptom,
                "search_query": search_query,
                "body_part": payload.get("body_part"),
                "severity": payload.get("severity") if payload.get("severity") in {"mild", "moderate", "severe", "unknown"} else "unknown",
                "keywords": [self._normalize_text(item) for item in keywords if str(item).strip()],
                "red_flag": bool(payload.get("red_flag")),
                "red_flag_reason": payload.get("red_flag_reason"),
            }
        except Exception:
            return fallback

    def _score_catalog_candidate(self, symptom: str, candidate: dict, mapped_names: set[str]) -> float:
        normalized_symptom = self._normalize_text(symptom)
        name = self._normalize_text(candidate.get("product_name", ""))
        description = self._normalize_text(candidate.get("description", ""))
        haystack = f"{name} {description}".strip()
        score = 0.0

        if name in mapped_names:
            score += 120.0

        for term in self._symptom_terms(symptom):
            if term in haystack:
                score += 18.0
            if term in name:
                score += 12.0

        for word in {"pain", "sprain", "strain", "swelling", "muscle", "joint", "inflammation", "gel"}:
            if word in haystack:
                score += 2.0

        if normalized_symptom  in haystack:
            score += 30.0

        stock = candidate.get("stock", 0) or 0
        if stock > 0:
            score += min(stock, 20) * 0.2

        return score

    def _resolve_mapped_products(self, mapped_medicines: list[str]) -> list[dict]:
        resolved = []
        seen = set()

        for medicine_name in mapped_medicines:
            product = self.product_service.get_product_by_name(medicine_name)
            if not product:
                continue

            normalized_name = self._normalize_text(product.get("product_name", ""))
            if normalized_name in seen:
                continue
            seen.add(normalized_name)

            resolved.append({
                "name": product.get("product_name"),
                "price": product.get("price"),
                "description": product.get("description", ""),
                "product_id": product.get("product_id"),
                "stock": product.get("stock", 0),
                "prescription_required": product.get("prescription_required", False),
                "in_catalog_mapping": True,
                "_score": 1000 - len(resolved),
            })

        return resolved

    def _rank_candidates_with_ai(self, symptom: str, candidates: list[dict]) -> list[dict]:
        if len(candidates) < 2 or len(candidates) > 4:
            return candidates

        if (candidates[0].get("_score", 0) - candidates[1].get("_score", 0)) >= 8:
            return candidates

        shortlist = []
        for item in candidates[:6]:
            shortlist.append({
                "name": item.get("name"),
                "description": item.get("description", ""),
                "price": item.get("price"),
                "stock": item.get("stock", 0),
                "prescription_required": item.get("prescription_required", False),
            })

        system = (
            "You rank pharmacy products for symptom relevance. "
            "Return only JSON in this format: "
            "{\"ranking\": [{\"name\": \"medicine\", \"reason\": \"short reason\"}]}. "
            "Use only the provided candidate names and prefer the most relevant in-stock options."
        )
        user = f"Symptom: {symptom}\nCandidates: {json.dumps(shortlist, ensure_ascii=True)}"

        try:
            from app.agents.conversational_agent import llm
            from langchain_core.messages import HumanMessage, SystemMessage
            response = llm.invoke([SystemMessage(content=system), HumanMessage(content=user)])
            payload = json.loads(response.content)
            ranking = payload.get("ranking", [])
            order_map = {
                self._normalize_text(item.get("name", "")): idx
                for idx, item in enumerate(ranking)
                if item.get("name")
            }
            if not order_map:
                return candidates
            return sorted(candidates, key=lambda item: order_map.get(self._normalize_text(item.get("name", "")), 999))
        except Exception:
            return candidates

    def _collect_relevant_products(self, symptom: str | list[str], mapped_medicines: list[str]) -> list[dict]:
        queries = symptom if isinstance(symptom, list) else [symptom]
        mapped_names = {self._normalize_text(name) for name in mapped_medicines if name}
        prioritized = self._resolve_mapped_products(mapped_medicines)
        prioritized_names = {
            self._normalize_text(item.get("name", ""))
            for item in prioritized
        }
        all_products = self.product_service.get_all_products()
        scored: list[tuple[float, dict]] = []

        for product in all_products:
            normalized_name = self._normalize_text(product.get("product_name", ""))
            if normalized_name in prioritized_names:
                continue
            score = 0.0
            for query in queries:
                score = max(score, self._score_catalog_candidate(query, product, mapped_names))
            if score > 0:
                scored.append((score, product))

        vector_matches = []
        if len(mapped_names) < 2:
            for query in queries[:3]:
                try:
                    vector_matches.extend(search_product(query, n_results=5) or [])
                except Exception:
                    continue

        vector_names = {
            self._normalize_text(match.get("name", ""))
            for match in vector_matches
            if isinstance(match, dict)
        }

        boosted = []
        for score, product in scored:
            normalized_name = self._normalize_text(product.get("product_name", ""))
            if normalized_name in vector_names:
                score += 25.0
            boosted.append((score, product))

        boosted.sort(key=lambda item: item[0], reverse=True)

        selected = list(prioritized)
        seen = set(prioritized_names)
        for _, product in boosted:
            normalized_name = self._normalize_text(product.get("product_name", ""))
            if normalized_name in seen:
                continue
            seen.add(normalized_name)
            selected.append({
                "name": product.get("product_name"),
                "price": product.get("price"),
                "description": product.get("description", ""),
                "product_id": product.get("product_id"),
                "stock": product.get("stock", 0),
                "prescription_required": product.get("prescription_required", False),
                "in_catalog_mapping": normalized_name in mapped_names,
                "_score": _,
            })
            if len(selected) >= 6:
                break

        ranked = self._rank_candidates_with_ai(symptom, selected)
        for item in ranked:
            item.pop("_score", None)
        return ranked

    def _catalog_only_symptom_fallback(self, symptom: str | list[str], language: str = "en") -> dict:
        display_symptom = symptom[0] if isinstance(symptom, list) and symptom else symptom
        product_details = self._collect_relevant_products(symptom, [])
        product_details = [item for item in product_details if (item.get("stock", 0) or 0) > 0]
        if not product_details:
            return {
                "found": False,
                "symptom": display_symptom,
                "medicines": [],
                "language": language,
                "message": f"I couldn't find medicines for '{display_symptom}'. Please consult a doctor for guidance.",
                "not_available": True,
            }

        return {
            "found": True,
            "symptom": display_symptom,
            "medicines": product_details,
            "language": language,
            "not_available": False,
            "message": None,
            "catalog_fallback": True,
        }

    def _select_products_with_ai(self, symptom: str, language: str = "en") -> dict:
        products = [
            {
                "name": item.get("product_name"),
                "description": str(item.get("description", "")),
                "price": item.get("price"),
                "stock": item.get("stock", 0),
            }
            for item in self.product_service.get_all_products()
            if (item.get("stock", 0) or 0) > 0
        ]

        if not products:
            return {"found": False, "unavailable": True, "products": []}

        system = (
            "You are a pharmacy recommendation assistant. "
            "Given a symptom and an in-stock medicine database, choose only medicines from the database. "
            "Return only JSON with this schema: "
            "{\"unavailable\": boolean, "
            "\"best_match\": string|null, "
            "\"best_reason\": string|null, "
            "\"related_option\": string|null, "
            "\"related_reason\": string|null}. "
            "If nothing in the database is appropriate, set unavailable=true and the medicine fields to null. "
            "Do not invent medicine names."
        )
        user = (
            f"Symptom: {symptom}\n"
            f"Language: {language}\n"
            f"Database medicines: {json.dumps(products, ensure_ascii=False)}"
        )

        try:
            from app.agents.conversational_agent import llm
            from langchain_core.messages import HumanMessage, SystemMessage

            response = llm.invoke([SystemMessage(content=system), HumanMessage(content=user)])
            payload = json.loads(response.content)
        except Exception:
            return {"found": False, "unavailable": False, "products": []}

        unavailable = bool(payload.get("unavailable"))
        selected_names = [
            payload.get("best_match"),
            payload.get("related_option"),
        ]

        selected_products = []
        seen = set()
        for name in selected_names:
            if not name:
                continue
            product = self.product_service.get_product_by_name(name)
            if not product:
                continue
            normalized_name = self._normalize_text(product.get("product_name", ""))
            if normalized_name in seen:
                continue
            seen.add(normalized_name)
            selected_products.append({
                "name": product.get("product_name"),
                "price": product.get("price"),
                "description": product.get("description", ""),
                "product_id": product.get("product_id"),
                "stock": product.get("stock", 0),
                "prescription_required": product.get("prescription_required", False),
                "in_catalog_mapping": True,
            })

        return {
            "found": bool(selected_products) and not unavailable,
            "unavailable": unavailable,
            "products": selected_products,
            "best_reason": payload.get("best_reason"),
            "related_reason": payload.get("related_reason"),
        }

    @observe(name="order_execution")
    async def execute_order(self, patient_id: int, product_name: str, quantity: int, delivery_location: str | None = None, delivery_map_url: str | None = None):
        
        # 1ï¸âƒ£ Validation: Ensure product name isn't empty
        if not product_name or str(product_name).strip() == "":
            return {
                "approved": False,
                "error": "I couldn't identify the medicine name. Please specify which medicine you need."
            }

        # 2ï¸âƒ£ Resolve product name using vector search (Fuzzy match)
        resolved_name = search_product(product_name) or product_name
        
        # 3ï¸âƒ£ Fetch Product Details from Excel
        product = self.product_service.get_product_by_name(resolved_name)

        if not product:
            return {
                "approved": False,
                "error": f"Product '{product_name}' was not found in our inventory."
            }

        # 3a Check stock availability BEFORE creating order
        available, message = self.product_service.check_stock_availability(resolved_name, quantity)
        if not available:
            return {
                "approved": False,
                "error": f"**Insufficient Stock**: {message}"
            }
        price_per_unit = product.get("price", 0)
        product_id = product.get("product_id", "UNKNOWN")
        total_price = calculate_price(price_per_unit, quantity)


        # Create order exactly once
        order = self.order_service.create_order(
            patient_id=patient_id,
            product_id=product_id,
            quantity=quantity,
            total_price=total_price,
            product_name=product.get("product_name"),
            delivery_location=delivery_location,
            delivery_map_url=delivery_map_url,
        )

        # 6ï¸âƒ£ Trigger Warehouse Webhook (Mock Fulfillment)
        webhook_payload = {
            "order_id": order["order_id"],
            "product": product.get("product_name"),
            "quantity": quantity,
            "total_price": total_price
        }

        try:
            async with httpx.AsyncClient() as client:
                # âœ… Added timeout=1.0 to prevent infinite loading
                await client.post(
                    WAREHOUSE_WEBHOOK,
                    json=webhook_payload,
                    timeout=1.0
                )
        except Exception as e:
            # If warehouse is offline, we still finish the order logic
            print("WARNING: Webhook skipped (Warehouse offline)")

        # 7ï¸âƒ£ Reduce stock after successful order
        self.product_service.reduce_stock(resolved_name, quantity)
        # fetch remaining stock so decision agent can inform user
        updated = self.product_service.get_product_by_name(resolved_name)
        rem_stock = updated.get("stock") if updated else None

        # ðŸ“© Send notification if user has phone number
         # ðŸ“© Send notification if user has phone number
        notification_sent = False
        notification_error = None
        notification_phone = None
        try:
            # Get user from database
            user = UserService.get_user(patient_id)
            phone = user.get("phone") if user else None
            
            if phone:
                # 1. Normalize destination number (E.164)
                formatted_phone = _normalize_whatsapp_phone(phone)
                
                # 2. Get beautiful formatted Date & Time
                current_time = datetime.now().strftime("%B %d, %Y at %I:%M %p")
                
                # 3. Build the WhatsApp Message
                msg_body = (
                    f"Order Confirmed!\n\n"
                    f"Medicine: {product.get('product_name')}\n"
                    f"Quantity: {quantity}\n"
                    f"Frequency: As directed by physician\n"
                    f"Total Price: ${total_price}\n"
                    f"Date: {current_time}\n"
                    f"OTP: {order.get('otp_code')}\n\n"
                    f"Thank you for trusting Agentic Pharmacy!"
                )
                
                # 4. Send the message
                send_result = send_notification(formatted_phone, msg_body)
                notification_sent = bool(send_result.get("sent"))
                notification_error = send_result.get("error")
                notification_phone = send_result.get("to") or formatted_phone
                
        except Exception as e:
            print(f"Notification error: {e}")
            notification_error = str(e)

        # 8ï¸âƒ£ Return Response to Decision Agent
        safe_order = dict(order or {})
        safe_order.pop("otp_code", None)

        return {
            "approved": True,
            "message": f"Order placed successfully!",
            "order": safe_order,
            "remaining_stock": rem_stock,
            "notification_sent": notification_sent,
            "notification_phone": notification_phone if notification_sent else None,
            "notification_error": notification_error
        }
    @observe(name="recommend_products")
    def recommend_products(self, symptom: str, language: str = "en"):
        """
        Recommend products based on exact symptom matching.
        
        Args:
            symptom: User's symptom description
            language: 'en', 'mr', or 'hi'
        
        Returns:
            {
                'found': bool,
                'symptom': str (translated),
                'medicines': [list of product details],
                'language': str,
                'not_available': bool (if medicines exist for symptom but are not in inventory),
                'message': str (error message if not found)
            }
        """
        from app.services.symptom_mapping import SymptomMapper

        exact_match = SymptomMapper.find_matching_medicines(symptom, language=language)
        if exact_match.get("found"):
            mapped_names = exact_match.get("medicines", []) or []
            product_details = self._resolve_mapped_products(mapped_names)

            if product_details:
                exact_match["medicines"] = product_details
                exact_match["not_available"] = False
                return exact_match

            return {
                "found": False,
                "symptom": exact_match.get("symptom") or symptom,
                "medicines": [],
                "language": language,
                "message": f"No suitable medicine is currently available in stock for '{exact_match.get('symptom') or symptom}'. Please consult a doctor.",
                "not_available": True,
                "matched_key": exact_match.get("matched_key"),
            }

        symptom_ai = self._analyze_symptom_with_ai(symptom)
        interpreted_symptom = symptom_ai.get("normalized_symptom") or symptom
        search_query = symptom_ai.get("search_query") or interpreted_symptom
        search_queries = self._build_symptom_queries(symptom, language=language, symptom_ai=symptom_ai)

        if symptom_ai.get("red_flag"):
            reason = symptom_ai.get("red_flag_reason") or "This symptom may need urgent medical evaluation."
            return {
                'found': False,
                'symptom': interpreted_symptom or symptom,
                'medicines': [],
                'language': language,
                'message': f"{reason} Please consult a doctor urgently.",
                'not_available': True
            }

        ai_selection = self._select_products_with_ai(search_query or symptom, language=language)
        if ai_selection.get("found"):
            return {
                'found': True,
                'symptom': interpreted_symptom or symptom,
                'medicines': ai_selection.get("products", []),
                'language': language,
                'not_available': False,
                'message': None,
                'symptom_analysis': symptom_ai,
                'ai_selection': ai_selection,
            }

        if ai_selection.get("unavailable"):
            return {
                'found': False,
                'symptom': interpreted_symptom or symptom,
                'medicines': [],
                'language': language,
                'message': f"No suitable medicine is currently available in stock for '{interpreted_symptom or symptom}'. Please consult a doctor.",
                'not_available': True,
            }

        fallback = self._catalog_only_symptom_fallback(search_queries or [search_query or symptom], language)
        fallback['symptom_analysis'] = symptom_ai
        return fallback

    @observe(name="get_product_info")
    def get_product_details(self, product_name: str):
        # 1ï¸âƒ£ Validation
        if not product_name or str(product_name).strip() == "":
            return {"found": False, "error": "Please specify which medicine you need."}

        # 2ï¸âƒ£ Resolve product name using vector search
        resolved_name = search_product(product_name) or product_name
        
        # 3ï¸âƒ£ Fetch Product Details from Excel
        product = self.product_service.get_product_by_name(resolved_name)

        if not product:
            return {"found": False, "error": f"Product '{product_name}' was not found."}

        # Return the data safely
        return {
            "found": True,
            "product": product
        }

