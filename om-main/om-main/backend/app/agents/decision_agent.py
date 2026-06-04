import json
import os
import re
import uuid
from difflib import SequenceMatcher
from datetime import datetime, timedelta
from typing import Optional
import httpx
from langfuse import observe
from langchain_core.messages import HumanMessage, SystemMessage
# ✅ Import the LLM so we can use it to generate human-friendly explanations
from app.agents.conversational_agent import llm 
from app.agents.safety_agent import SafetyAgent
from app.agents.execution_agent import ExecutionAgent
from app.agents.guardrail import validate_llm_output
from app.services.product_service import ProductService
from app.services.symptom_mapping import SymptomMapper

# Path to store order history
ORDER_HISTORY_FILE = "order_history.json"

class DecisionAgent:

    def __init__(self):
        self.safety_agent = SafetyAgent()
        self.execution_agent = ExecutionAgent()
        self.product_service = ProductService()
        # load order history from file or start fresh
        self.order_history = self._load_order_history()
        # keep track of orders waiting for quantity clarification by session
        self.pending_orders = {}
        # remember the latest recommended medicine for quick follow-up messages like "order"
        self.latest_recommendations = {}

    def _is_generic_order_followup(self, raw_message: Optional[str]) -> bool:
        text = (raw_message or "").strip().lower()
        if not text:
            return False
        compact = re.sub(r"[^a-z0-9\s]", " ", text)
        compact = re.sub(r"\s+", " ", compact).strip()
        generic_phrases = {
            "order",
            "buy",
            "purchase",
            "book",
            "book it",
            "order it",
            "buy it",
            "purchase it",
            "reserve it",
            "order this",
            "buy this",
            "book this",
            "i want to order",
            "i want to buy",
            "i want this",
            "order medicine",
        }
        if compact in generic_phrases:
            return True

        words = compact.split()
        if not words:
            return False

        first = words[0]
        orderish = (
            first.startswith("order")
            or first.startswith("buy")
            or first.startswith("book")
            or first.startswith("purchas")
            or first.startswith("reserv")
        )
        if orderish and len(words) <= 3:
            return True

        return False

    def _is_plain_greeting(self, raw_message: Optional[str]) -> bool:
        text = self._norm_text(raw_message)
        if not text:
            return False
        greeting_phrases = {
            "hi",
            "hello",
            "hey",
            "hii",
            "hiii",
            "hy",
            "yo",
            "good morning",
            "good afternoon",
            "good evening",
            "namaste",
        }
        return text in greeting_phrases

    def _get_small_talk_response(self, raw_message: Optional[str]) -> Optional[str]:
        text = self._norm_text(raw_message)
        if not text:
            return None

        small_talk_map = {
            "thanks": "You're welcome! If you need help with medicines, orders, or symptoms, I'm here.",
            "thank you": "You're welcome! If you need help with medicines, orders, or symptoms, I'm here.",
            "thankyou": "You're welcome! If you need help with medicines, orders, or symptoms, I'm here.",
            "thx": "You're welcome! If you need help with medicines, orders, or symptoms, I'm here.",
            "ok": "Okay. Let me know what you need next.",
            "okay": "Okay. Let me know what you need next.",
            "okk": "Okay. Let me know what you need next.",
            "hmm": "I'm here. Tell me your symptom, medicine name, or what you'd like to do next.",
            "hmmm": "I'm here. Tell me your symptom, medicine name, or what you'd like to do next.",
            "bye": "Goodbye! Take care, and come back anytime if you need help.",
            "goodbye": "Goodbye! Take care, and come back anytime if you need help.",
            "see you": "See you soon! Take care.",
            "see ya": "See you soon! Take care.",
        }
        return small_talk_map.get(text)

    def _is_ambiguous_order_word(self, raw_message: Optional[str]) -> bool:
        text = self._norm_text(raw_message)
        return text in {"booked", "ordered", "booked it", "ordered it"}

    def _is_ambiguous_confirmation_word(self, raw_message: Optional[str]) -> bool:
        text = self._norm_text(raw_message)
        return text in {"done", "confirm", "confirmed", "proceed", "continue", "yes confirm"}

    def _is_pointer_followup(self, raw_message: Optional[str]) -> bool:
        text = self._norm_text(raw_message)
        return text in {"this one", "this", "same", "same one", "same medicine", "same product"}

    def _is_cancel_command(self, raw_message: Optional[str]) -> bool:
        text = self._norm_text(raw_message)
        if not text:
            return False
        cancel_terms = {
            "cancel",
            "cacel",
            "cnacel",
            "cancel it",
            "cancel order",
            "cancel that order",
            "stop",
            "stop order",
            "never mind",
            "nevermind",
        }
        return text in cancel_terms

    def _select_best_recommendation_name(self, symptom_result: dict, original_query: str = "") -> Optional[str]:
        medicines = symptom_result.get("medicines", []) or []
        if not medicines:
            return None

        normalized_symptom = SymptomMapper.normalize_symptom(original_query or symptom_result.get("symptom") or "")
        matched_key = None

        for key in getattr(SymptomMapper, "__dict__", {}):
            pass

        from app.services.symptom_mapping import SYMPTOM_ALIASES, SYMPTOM_GUIDANCE, SYMPTOM_MEDICINE_MAP, GENERIC_GUIDANCE

        for key in SYMPTOM_MEDICINE_MAP:
            normalized_key = SymptomMapper.normalize_symptom(key)
            if normalized_key == normalized_symptom or normalized_key in normalized_symptom or normalized_symptom in normalized_key:
                matched_key = key
                break

        if not matched_key:
            for alias, base_symptom in SYMPTOM_ALIASES.items():
                normalized_alias = SymptomMapper.normalize_symptom(alias)
                if normalized_alias == normalized_symptom or normalized_alias in normalized_symptom or normalized_symptom in normalized_alias:
                    matched_key = base_symptom
                    break

        guide = SYMPTOM_GUIDANCE.get(matched_key or "", GENERIC_GUIDANCE)
        best_hint = guide.get("best_option_contains", "")

        def normalized_name(item):
            return SymptomMapper.normalize_symptom(item.get("name", ""))

        best = next((item for item in medicines if best_hint and best_hint in normalized_name(item)), medicines[0])
        return best.get("name")

    def _raw_message_mentions_product(self, raw_message: Optional[str], product_name: Optional[str]) -> bool:
        text = (raw_message or "").strip().lower()
        product = (product_name or "").strip().lower()
        if not text or not product:
            return False
        normalized_text = re.sub(r"[^a-z0-9\s]", " ", text)
        normalized_product = re.sub(r"[^a-z0-9\s]", " ", product)
        normalized_text = re.sub(r"\s+", " ", normalized_text).strip()
        normalized_product = re.sub(r"\s+", " ", normalized_product).strip()
        return normalized_product in normalized_text

    def _is_order_reference_question(self, raw_message: Optional[str]) -> bool:
        text = self._norm_text(raw_message)
        if not text:
            return False
        if not ("order" in text or "book" in text):
            return False
        if "what did i order" in text or "what was ordered" in text:
            return True
        medicine_markers = ["medicine", "mediciene", "medicne", "medication", "product"]
        question_markers = ["which", "what"]
        return any(q in text for q in question_markers) and any(m in text for m in medicine_markers)

    def _extract_explicit_product_from_message(self, raw_message: Optional[str]) -> Optional[str]:
        text = self._norm_text(raw_message)
        if not text:
            return None

        best_name = None
        best_score = 0
        try:
            products = self.product_service.get_all_products()
        except Exception:
            products = []

        for product in products:
            product_name = str(product.get("product_name") or "").strip()
            normalized_name = self._norm_text(product_name)
            if not normalized_name:
                continue
            if normalized_name in text:
                score = len(normalized_name)
                if score > best_score:
                    best_name = product_name
                    best_score = score

        return best_name

    def _detect_symptom_from_raw_message(self, raw_message: Optional[str]) -> Optional[str]:
        text = (raw_message or "").strip()
        if not text:
            return None
        result = SymptomMapper.find_matching_medicines(text, language="en")
        if result.get("found"):
            return result.get("symptom") or text
        return None
    
    def _load_order_history(self):
        """Load order history from file."""
        if os.path.exists(ORDER_HISTORY_FILE):
            try:
                with open(ORDER_HISTORY_FILE, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Could not load order history: {e}")
        return[]
    
    def _save_order_history(self):
        """Save order history to file."""
        try:
            with open(ORDER_HISTORY_FILE, 'w') as f:
                json.dump(self.order_history, f, indent=2, default=str)
        except Exception as e:
            print(f"Could not save order history: {e}")

    def _format_order_history(self, orders, limit=None):
        """Format order list as readable history with dates."""
        if not orders:
            return "You haven't placed any orders yet."
        
        response = "📋 **Your Order History**\n\n"
        to_display = orders[:limit] if limit else orders
        
        for i, order in enumerate(to_display, 1):
            product_name = order.get('product_name', 'Unknown')
            quantity = order.get('quantity', 1)
            price = order.get('total_price', 0)
            created = order.get('created_at')
            
            # Format date if it exists
            date_str = ""
            if created:
                if isinstance(created, str):
                    date_str = created.split('T')[0]  # "YYYY-MM-DD"
                else:
                    date_str = created.strftime('%Y-%m-%d')
            
            response += f"{i}. **{product_name}** × {quantity} units - ${price} ({date_str})\n"
        
        if limit and len(orders) > limit:
            response += f"\n... and {len(orders) - limit} more orders."
        
        return response

    def _get_recent_orders(self, days_back=30):
        """Get orders from the last N days."""
        if not self.order_history:
            return[]
        
        cutoff = datetime.utcnow() - timedelta(days=days_back)
        recent =[]
        
        for order in self.order_history:
            created = order.get('created_at')
            if created:
                if isinstance(created, str):
                    created = datetime.fromisoformat(created.replace('Z', '+00:00'))
                if created >= cutoff:
                    recent.append(order)
        
        return recent

    def _norm_text(self, text: str) -> str:
        if not text:
            return ""
        lowered = str(text).lower()
        lowered = re.sub(r"[^a-z0-9]+", " ", lowered)
        return re.sub(r"\s+", " ", lowered).strip()

    def _extract_json_object(self, text: str) -> dict:
        if not text:
            return {}
        raw = text.strip()
        try:
            return json.loads(raw)
        except Exception:
            pass
        match = re.search(r"\{[\s\S]*\}", raw)
        if not match:
            return {}
        try:
            return json.loads(match.group(0))
        except Exception:
            return {}

    def _medicine_matches_expected(self, expected_product: str, detected_medicine: str) -> bool:
        expected_norm = self._norm_text(expected_product)
        detected_norm = self._norm_text(detected_medicine)
        if not expected_norm or not detected_norm:
            return False

        if expected_norm == detected_norm:
            return True
        if expected_norm in detected_norm or detected_norm in expected_norm:
            return True

        expected_tokens = set(expected_norm.split())
        detected_tokens = set(detected_norm.split())
        if expected_tokens and detected_tokens:
            token_overlap = len(expected_tokens & detected_tokens) / max(len(expected_tokens), len(detected_tokens))
            if token_overlap >= 0.6:
                return True

        return SequenceMatcher(None, expected_norm, detected_norm).ratio() >= 0.82

    async def _analyze_prescription_image(self, image_data: str) -> dict:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            return {"ok": False, "reason": "Vision validation unavailable (missing API key)."}

        data_url = (image_data or "").strip()
        if not data_url.startswith("data:image"):
            data_url = f"data:image/jpeg;base64,{data_url}"

        configured_model = os.getenv("GROQ_VISION_MODEL", "").strip()
        model_candidates = [m for m in [
            configured_model,
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "llama-3.2-11b-vision-preview",
            "llama-3.2-90b-vision-preview",
        ] if m]

        content = ""
        last_http_error = ""
        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                for model_name in model_candidates:
                    payload = {
                        "model": model_name,
                        "temperature": 0,
                        "max_tokens": 350,
                        "messages": [
                            {
                                "role": "system",
                                "content": (
                                    "You are a strict prescription OCR validator. "
                                    "Classify if the uploaded image is a real doctor prescription. "
                                    "Return ONLY JSON with keys is_prescription, document_type, doctor_name, clinic_name, medicine_names, reason. "
                                    "Set is_prescription=false for non-medical images, lab reports, bills, IDs, handwritten notes without prescription context, or unclear images."
                                ),
                            },
                            {
                                "role": "user",
                                "content": [
                                    {
                                        "type": "text",
                                        "text": (
                                            "Check whether this is a doctor prescription image. "
                                            "If yes, extract doctor name, clinic/hospital name, and prescribed medicine names. "
                                            "If any field is unclear keep it empty. Return JSON only."
                                        ),
                                    },
                                    {"type": "image_url", "image_url": {"url": data_url}},
                                ],
                            },
                        ],
                    }
                    response = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    )
                    if response.status_code >= 400:
                        last_http_error = response.text
                        continue
                    content = (
                        response.json()
                        .get("choices", [{}])[0]
                        .get("message", {})
                        .get("content", "")
                    )
                    if content:
                        break
        except Exception:
            return {"ok": False, "reason": "Could not read prescription image. Please upload a clearer photo."}

        if not content:
            reason = "Vision model request failed. Set GROQ_VISION_MODEL to a vision-enabled model your Groq key can access."
            if last_http_error:
                reason = f"{reason} API error: {last_http_error[:180]}"
            return {"ok": False, "reason": reason}

        parsed = self._extract_json_object(content)
        is_prescription = parsed.get("is_prescription")
        if isinstance(is_prescription, str):
            is_prescription = is_prescription.strip().lower() in {"true", "yes", "1"}
        elif isinstance(is_prescription, (int, float)):
            is_prescription = bool(is_prescription)
        elif not isinstance(is_prescription, bool):
            is_prescription = None

        document_type = str(parsed.get("document_type") or "").strip()
        doctor_name = str(parsed.get("doctor_name") or "").strip()
        clinic_name = str(parsed.get("clinic_name") or "").strip()
        raw_medicines = parsed.get("medicine_names") or []
        if isinstance(raw_medicines, str):
            raw_medicines = re.split(r"[\n,;/|]+", raw_medicines)
        medicines = [str(m).strip() for m in raw_medicines if str(m).strip()]

        document_type_norm = self._norm_text(document_type)
        inferred_prescription = "prescription" in document_type_norm or document_type_norm == "rx"
        if is_prescription is False or (is_prescription is None and not inferred_prescription):
            return {"ok": False, "reason": "Uploaded image is not a valid medical prescription."}

        if not doctor_name and not clinic_name:
            return {"ok": False, "reason": "Doctor/clinic details not found in prescription image."}
        if not medicines:
            return {"ok": False, "reason": "Medicine name not found in prescription image."}

        return {
            "ok": True,
            "document_type": document_type,
            "doctor_name": doctor_name,
            "clinic_name": clinic_name,
            "medicine_names": medicines,
        }

    async def _verify_prescription_for_order(self, image_data: str, expected_product: str, quantity: int) -> dict:
        analysis = await self._analyze_prescription_image(image_data)
        if not analysis.get("ok"):
            return {"approved": False, "reason": analysis.get("reason", "Prescription validation failed.")}

        expected_candidates = [expected_product]
        details = self.execution_agent.get_product_details(expected_product)
        if details.get("found"):
            canonical_name = str((details.get("product") or {}).get("product_name") or "").strip()
            if canonical_name and canonical_name.lower() != str(expected_product).strip().lower():
                expected_candidates.append(canonical_name)

        matched = None
        for med in analysis.get("medicine_names", []):
            if any(self._medicine_matches_expected(name, med) for name in expected_candidates if name):
                matched = med
                break
        if not matched:
            return {
                "approved": False,
                "reason": f"Prescription medicine does not match requested product '{expected_product}'.",
            }

        if not details.get("found"):
            return {
                "approved": False,
                "reason": f"Requested medicine '{expected_product}' is not available in inventory.",
            }

        available, stock_msg = self.execution_agent.product_service.check_stock_availability(expected_product, quantity or 1)
        if not available:
            return {"approved": False, "reason": stock_msg}

        return {
            "approved": True,
            "doctor_name": analysis.get("doctor_name"),
            "clinic_name": analysis.get("clinic_name"),
            "matched_medicine": matched,
        }

    @observe(name="decide_on_user_intent")
    async def decide(
        self,
        parsed_input,
        raw_message: str | None = None,
        session_id: str | None = None,
        image: str = None,
        location: dict | None = None
    ):
        # 1. ✅ Handle string input from LLM and clean JSON code blocks FIRST before checking anything else
        if isinstance(parsed_input, str):
            try:
                clean_input = parsed_input.replace("```json", "").replace("```", "").strip()
                parsed_input = json.loads(clean_input)
            except Exception as e:
                print(f"❌ JSON Parsing Error: {e}")
                # Fallback if AI output is totally broken
                parsed_input = {"intent": "general_chat", "friendly_response": "I understood your message but had trouble processing the data. Could you repeat that?"}
        
        # Extract core fields
        intent = parsed_input.get("intent")
        product_name = parsed_input.get("product_name")
        symptom = parsed_input.get("symptom") # Important for symptom check
        quantity = parsed_input.get("quantity")
        friendly_msg = parsed_input.get("friendly_response", "")
        generic_order_followup = self._is_generic_order_followup(raw_message)
        plain_greeting = self._is_plain_greeting(raw_message)
        small_talk_response = self._get_small_talk_response(raw_message)
        ambiguous_order_word = self._is_ambiguous_order_word(raw_message)
        ambiguous_confirmation_word = self._is_ambiguous_confirmation_word(raw_message)
        pointer_followup = self._is_pointer_followup(raw_message)
        cancel_command = self._is_cancel_command(raw_message)
        explicit_product_name = self._extract_explicit_product_from_message(raw_message)
        order_reference_question = self._is_order_reference_question(raw_message)
        detected_symptom = self._detect_symptom_from_raw_message(raw_message) if not explicit_product_name else None
        normalized_location = None
        if isinstance(location, dict):
            label = str(location.get("label") or location.get("address") or "").strip()
            map_url = str(location.get("map_url") or "").strip()
            location_product_name = str(location.get("product_name") or "").strip()
            location_quantity = location.get("quantity")
            location_token = str(location.get("pending_order_token") or "").strip()
            if label or map_url:
                normalized_location = {
                    "label": label or "Selected delivery location",
                    "map_url": map_url or None,
                    "product_name": location_product_name or None,
                    "quantity": int(location_quantity) if str(location_quantity or "").isdigit() else None,
                    "pending_order_token": location_token or None,
                }

        if detected_symptom and not explicit_product_name:
            symptom = detected_symptom
            intent = "symptom_check"
            product_name = None
            parsed_input["symptom"] = detected_symptom
            parsed_input["intent"] = "symptom_check"
            parsed_input["product_name"] = None
        elif symptom and not explicit_product_name:
            intent = "symptom_check"
            product_name = None
            parsed_input["intent"] = "symptom_check"
            parsed_input["product_name"] = None

        if explicit_product_name:
            product_name = explicit_product_name
            parsed_input["product_name"] = explicit_product_name
            if session_id:
                self.latest_recommendations[session_id] = explicit_product_name
                self.pending_orders.pop(session_id, None)

        if session_id and normalized_location:
            pending = self.pending_orders.get(session_id)
            if pending and pending.get("awaiting_location"):
                expected_token = str(pending.get("pending_order_token") or "").strip()
                received_token = str(normalized_location.get("pending_order_token") or "").strip()
                if expected_token and received_token != expected_token:
                    return {
                        "message": "This delivery location confirmation does not match the current pending order. Please start the order again."
                    }
                pending["delivery_location"] = normalized_location.get("label")
                pending["delivery_map_url"] = normalized_location.get("map_url")
                if normalized_location.get("product_name"):
                    pending["product_name"] = normalized_location.get("product_name")
                if normalized_location.get("quantity"):
                    pending["quantity"] = normalized_location.get("quantity")
                pending["awaiting_location"] = False
                intent = pending.get("intent", intent)
                product_name = pending.get("product_name", product_name)
                quantity = pending.get("quantity", quantity)
                parsed_input["intent"] = intent
                parsed_input["product_name"] = product_name
                parsed_input["quantity"] = quantity

        if plain_greeting:
            if session_id:
                self.pending_orders.pop(session_id, None)
            return {"message": "Hello! How can I help you today?"}

        if small_talk_response:
            if session_id and self._norm_text(raw_message) in {"bye", "goodbye", "see you", "see ya"}:
                self.pending_orders.pop(session_id, None)
            return {"message": small_talk_response}

        if cancel_command:
            pending = self.pending_orders.pop(session_id, None) if session_id else None
            if pending:
                pending_product = pending.get("product_name") or "the pending medicine order"
                return {"message": f"Okay, I cancelled the current request for **{pending_product}**. You can start a new medicine request anytime."}
            return {"message": "There is no active pending order right now."}

        if generic_order_followup and session_id:
            latest_product = self.latest_recommendations.get(session_id)
            if latest_product:
                intent = "order"
                product_name = latest_product
                parsed_input["intent"] = "order"
                parsed_input["product_name"] = latest_product

        if ambiguous_order_word:
            latest_product = self.latest_recommendations.get(session_id) if session_id else None
            if latest_product:
                return {
                    "message": (
                        f"If you want to order **{latest_product}**, please say **order 1** or **book 1**.\n\n"
                        "If you want to know what you already ordered, ask **which medicine did I order?**"
                    )
                }
            return {
                "message": (
                    "Please tell me clearly what you want to do.\n\n"
                    "Say **order 1 <medicine name>** to place an order, or ask **which medicine did I order?**"
                )
            }

        if ambiguous_confirmation_word:
            latest_product = self.latest_recommendations.get(session_id) if session_id else None
            pending = self.pending_orders.get(session_id) if session_id else None
            if pending and pending.get("awaiting_location"):
                return {
                    "message": "I still need your delivery location before I can confirm the order. Please enter it manually or use live location."
                }
            if pending and pending.get("needs_prescription") and not pending.get("prescription_uploaded"):
                return {
                    "message": "I still need the prescription image before I can confirm this medicine order."
                }
            if latest_product:
                return {
                    "message": (
                        f"To confirm **{latest_product}**, please say **order 1**, **book 1**, or mention the quantity you want."
                    )
                }
            return {
                "message": "Please tell me which medicine you want and the quantity, for example: **order 1 Paracetamol**."
            }

        if pointer_followup:
            latest_product = self.latest_recommendations.get(session_id) if session_id else None
            pending = self.pending_orders.get(session_id) if session_id else None
            target_product = latest_product or (pending or {}).get("product_name")
            target_quantity = (pending or {}).get("quantity")
            if target_product and target_quantity:
                return {
                    "message": f"I’m ready to place **{target_quantity} units** of **{target_product}**. If that’s correct, say **confirm order**."
                }
            if target_product:
                return {
                    "message": f"If you want **{target_product}**, please tell me the quantity, for example: **order 1**."
                }
            return {
                "message": "Please mention the medicine name clearly, for example: **order 1 Crocin**."
            }

        # 2. Handle prescription image upload (restored simple flow)
        if session_id and image:
            pending = self.pending_orders.get(session_id)
            if pending and pending.get("needs_prescription"):
                expected_product = pending.get("product_name")
                expected_quantity = pending.get("quantity", 1)
                verification = await self._verify_prescription_for_order(
                    image_data=image,
                    expected_product=expected_product,
                    quantity=expected_quantity,
                )
                if not verification.get("approved"):
                    pending["prescription_uploaded"] = False
                    return {
                        "message": (
                            f"Prescription declined: {verification.get('reason')} "
                            "Please upload a clear prescription for the same medicine."
                        )
                    }

                pending["prescription_uploaded"] = True
                intent = "order"
                product_name = pending.get("product_name")
                quantity = pending.get("quantity")
                parsed_input["intent"] = intent
                parsed_input["product_name"] = product_name
                parsed_input["quantity"] = quantity
            else:
                return {"message": "I received the image, but I wasn't expecting a prescription right now."}
        # ----------------------------------------------------------------
        # SPECIAL CASE: user responded with a quantity after being asked for it
        # ----------------------------------------------------------------
        if session_id and quantity:
            pending = self.pending_orders.get(session_id)
            if pending and pending.get("product_name") and not explicit_product_name:
                raw_text = (raw_message or "").strip().lower()
                quantity_only_reply = bool(re.fullmatch(r"[\d\sxa-zA-Z]+", raw_text)) and not re.search(r"[,@]", raw_text)
                # override only for quantity-style follow-ups, not for a fresh medicine request
                if quantity_only_reply and (not product_name or product_name != pending["product_name"]):
                    product_name = pending["product_name"]
                    intent = pending.get("intent", intent)
                    parsed_input["product_name"] = product_name
                    parsed_input["intent"] = intent

        # ---------------------------------------------------------
        # EARLY CHECK: Did the user ask about order history?
        # ---------------------------------------------------------
        if raw_message:
            lower = raw_message.lower()

            if order_reference_question:
                if self.order_history:
                    last_order = self.order_history[-1]
                    return {
                        "message": (
                            f"You ordered **{last_order.get('product_name', 'Unknown medicine')}** "
                            f"({last_order.get('quantity', 1)} units)."
                        )
                    }
                return {"message": "You haven't placed any orders yet."}
            
            # Check for history/orders queries (with more natural variations)
            history_keywords = ["history", "show history", "show my history", "order history"]
            if any(kw in lower for kw in history_keywords) and intent != "order":
                if self.order_history:
                    return {"message": self._format_order_history(self.order_history)}
                else:
                    return {"message": "You haven't placed any orders yet."}
            
            # Check for recent orders (7, 30 days, "this month", etc.)
            recent_keywords = {"last week": 7, "last month": 30, "this month": 30, "recent": 7, "lately": 7}
            for kw, days in recent_keywords.items():
                if kw in lower:
                    recent = self._get_recent_orders(days)
                    if recent:
                        return {"message": self._format_order_history(recent)}
                    else:
                        return {"message": f"You haven't placed any orders in the last {days} days."}
            
            # Check for single "previous" reference (most recent only)
            if "previous" in lower or "last" in lower or "earlier" in lower:
                if self.order_history and (intent == "product_info" or intent == "general_chat"):
                    last_order = self.order_history[-1]
                    return {
                        "message": f"🔁 You previously ordered **{last_order.get('product_name')}**. Would you like more details or to reorder?"
                    }

        # ---------------------------------------------------------
        # CASE 1: SYMPTOM CHECK (SMART RECOMMENDATION)
        # ---------------------------------------------------------
        if intent == "symptom_check" or (not product_name and symptom):
            search_query = symptom or product_name or friendly_msg
            
            # 1. Detect user language
            from app.services.language_detector import LanguageDetector
            detected_language, confidence = LanguageDetector.detect_language(raw_message or search_query)
            
            # 2. Get exact symptom-matched medicines
            results = self.execution_agent.recommend_products(search_query, language=detected_language)
            
            # 3. Handle "Not Available" case
            if results.get("not_available") and not results.get("medicines"):
                # Symptom recognized but no medicines available - guide to doctor
                if detected_language == "mr":
                    msg = f"आपल्या '{results.get('symptom')}' साठी आम्हाला सध्या कोणतीही औषधे उपलब्ध नाहीत. कृपया डॉक्टरांशी परामर्श घ्या."
                elif detected_language == "hi":
                    msg = f"आपके '{results.get('symptom')}' के लिए हमारे पास वर्तमान में कोई दवा उपलब्ध नहीं है. कृपया डॉक्टर से सलाह लें."
                else:
                    msg = f"No medicines are currently available to treat '{results.get('symptom')}'. Please consult a doctor."
                return {"message": msg}
            
            # 4. Handle "Not found" (symptom not recognized)
            if not results.get("found"):
                if detected_language == "mr":
                    msg = f"मला '{search_query}' साठी कोणतीही औषधे सापडली नाहीत. कृपया डॉक्टरांशी परामर्श घ्या."
                elif detected_language == "hi":
                    msg = f"मुझे '{search_query}' के लिए कोई दवा नहीं मिली. कृपया डॉक्टर से सलाह लें."
                else:
                    msg = f"I couldn't find medicines for '{search_query}'. Please consult a doctor for guidance."
                return {"message": msg}

            if session_id:
                medicines = results.get("medicines") or []
                best_name = self._select_best_recommendation_name(results, search_query)
                if best_name:
                    self.latest_recommendations[session_id] = best_name
                # a fresh recommendation replaces stale pending order context
                self.pending_orders.pop(session_id, None)

            return {
                "message": SymptomMapper.build_recommendation_response(
                    results,
                    original_query=search_query,
                    language=detected_language,
                )
            }
            
            medicines = results.get("medicines", [])
            
            # 5. Construct a prompt for the LLM to explain the suggestions in user's language
            medicines_text = ""
            for m in medicines:
                medicines_text += f"- Product: {m['name']}\n  Price: ${m['price']}\n  Description: {m['description']}\n\n"
            
            if detected_language == "mr":
                prompt = f"""
                तुम एका मदत-तयार फार्मसी असिस्टंट आहात.
                रोगी यांचा तक्रार: "{results.get('symptom')}".
                
                आमच्या डेटाबेसमध्ये हे औषधे आहेत:
                {medicines_text}
                
                कार्य:
                प्रत्येक उत्पादनाचे सहज आणि स्पष्ट मराठीत वर्णन करा.
                प्रत्येक उत्पादनासाठी "मी हे का सुचवतो" विभाग लिहा.
                मार्कडाउन फॉरमॅट वापरा (बोल्ड नावे, बुलेट पॉइंट्स).
                शेवटी विचारा की त्यांना यापैकी कोणतीही औषध ऑर्डर करायची आहे का.
                """
            elif detected_language == "hi":
                prompt = f"""
                आप एक सहायक फार्मेसी सहायक हैं.
                रोगी की शिकायत: "{results.get('symptom')}".
                
                हमारे डेटाबेस में ये दवाएं हैं:
                {medicines_text}
                
                कार्य:
                प्रत्येक उत्पाद का विवरण सरल और स्पष्ट हिंदी में दें.
                प्रत्येक उत्पाद के लिए "मैं इसकी सलाह क्यों देता हूं" अनुभाग लिखें.
                मार्कडाउन प्रारूप का उपयोग करें (बोल्ड नाम, बुलेट पॉइंट).
                अंत में पूछें कि क्या वे इनमें से कोई दवा ऑर्डर करना चाहते हैं.
                """
            else:
                prompt = f"""
                You are a helpful Pharmacy Assistant. 
                The patient's complaint: "{results.get('symptom')}".
                
                Our database found these medicines:
                {medicines_text}
                
                TASK:
                Write a friendly response recommending these products in SIMPLE, CLEAR ENGLISH.
                For each product, write a "Why I suggest this" section.
                Format the output with Markdown (bold names, bullet points).
                End by asking if they want to order any of them.
                """
            
            try:
                ai_response = llm.invoke([HumanMessage(content=prompt)])
                return {"message": ai_response.content}
            except Exception as e:
                print(f"Error generating response: {e}")
                # Fallback message in detected language
                if medicines:
                    if detected_language == "mr":
                        return {"message": f"मी हे औषधे सुचवतो: {', '.join([m['name'] for m in medicines])}"}
                    elif detected_language == "hi":
                        return {"message": f"मैं ये दवाएं सुझाता हूं: {', '.join([m['name'] for m in medicines])}"}
                    else:
                        return {"message": f"Based on your symptoms, I recommend: {', '.join([m['name'] for m in medicines])}"}
                else:
                    return {"message": f"I could not process your request. Please try again."}

        # ---------------------------------------------------------
        # CASE 2: GENERAL CHAT
        # ---------------------------------------------------------
        if intent == "general_chat":
            return {"message": friendly_msg or "Hello! How can I help you today?"}

        # ---------------------------------------------------------
        # CASE 3: MISSING PRODUCT NAME (Only for direct Orders/Info)
        # ---------------------------------------------------------
        if (intent == "order" or intent == "product_info") and not product_name:
            return {"message": friendly_msg or "Which medicine are you inquiring about? Or you can tell me your symptoms."}

        # ---------------------------------------------------------
        # CASE A: PRODUCT INFO / PRICE CHECK
        # ---------------------------------------------------------
        if intent == "product_info":
            data = self.execution_agent.get_product_details(product_name=product_name)

            if not data.get("found"):
                return {"message": f"I checked our inventory, but I couldn't find **{product_name}**. Please double-check the spelling!"}

            product = data.get("product", {})
            price = product.get("price", 0)
            description = product.get("description", "No description available.")
            
            return {
                "message": f"🔍 **Medicine Information**\n\n**Name:** {product.get('product_name')}\n**Price:** ${price} per unit\n**Description:** {description}\n\nWould you like me to place an order for you?"
            }

        # ---------------------------------------------------------
        # CASE B: PLACING AN ORDER
        # ---------------------------------------------------------
        if intent == "order":
            if session_id and generic_order_followup:
                latest_product = self.latest_recommendations.get(session_id)
                if latest_product:
                    product_name = latest_product
                    parsed_input["product_name"] = latest_product
            elif session_id and not product_name:
                latest_product = self.latest_recommendations.get(session_id)
                if latest_product:
                    product_name = latest_product
                    parsed_input["product_name"] = latest_product

            if session_id and generic_order_followup:
                latest_product = self.latest_recommendations.get(session_id)
                raw_mentions_current_product = self._raw_message_mentions_product(raw_message, product_name)
                if latest_product and product_name and product_name != latest_product and not raw_mentions_current_product:
                    product_name = latest_product
                    parsed_input["product_name"] = latest_product

            if parsed_input.get("missing") == "quantity" or not quantity:
                # remember what product they were asking about so quantity replies can be linked
                if session_id and product_name:
                    self.pending_orders[session_id] = {
                        "product_name": product_name,
                        "intent": "order",
                        "prescription_uploaded": False
                    }
                return {"message": f"I've found **{product_name}** in our system. How many units or strips would you like to order?"}

            valid, reason = validate_llm_output(parsed_input)
            if not valid:
                return {"message": f"**Order Notice**: {reason}"}

            pid = session_id or 1
            has_presc = False
            if session_id and session_id in self.pending_orders:
                has_presc = self.pending_orders[session_id].get("prescription_uploaded", False)

            safety = self.safety_agent.validate_order(patient_id=pid, product_name=product_name, quantity=quantity, has_prescription=has_presc)
            
            # ✅ FIX: Removed the duplicate execution line that was here, and properly check safety output.
            if not safety["approved"]:
                if safety.get("needs_prescription"):
                    # Pause order, save context, ask user for image
                    if session_id:
                        existing_pending = self.pending_orders.get(session_id, {})
                        self.pending_orders[session_id] = {
                            "product_name": product_name,
                            "quantity": quantity,
                            "intent": "order",
                            "needs_prescription": True,
                            "prescription_uploaded": False,
                            "delivery_location": existing_pending.get("delivery_location"),
                            "delivery_map_url": existing_pending.get("delivery_map_url"),
                        }
                    return {
                        "message": f"⚠️ **Prescription Required**\n\n**{product_name}** is a prescription medicine.\n\nPlease click the **paperclip icon (📎)** below to upload a photo of your doctor's prescription so I can complete your order for {quantity} units."
                    }
                else:
                    return {"message": f"**Safety Check Failed**: {safety['reason']}"}

            delivery_location = None
            delivery_map_url = None
            if session_id and session_id in self.pending_orders:
                delivery_location = self.pending_orders[session_id].get("delivery_location")
                delivery_map_url = self.pending_orders[session_id].get("delivery_map_url")

            if not delivery_location and session_id:
                from app.services.user_service import UserService
                user_info = UserService.get_user(str(session_id))
                if user_info and user_info.get("address"):
                    delivery_location = user_info.get("address")

            if not delivery_location:
                if session_id:
                    existing_pending = self.pending_orders.get(session_id, {})
                    pending_order_token = str(uuid.uuid4())
                    self.pending_orders[session_id] = {
                        **existing_pending,
                        "product_name": product_name,
                        "quantity": quantity,
                        "intent": "order",
                        "needs_prescription": bool(existing_pending.get("needs_prescription")),
                        "prescription_uploaded": bool(existing_pending.get("prescription_uploaded", False)),
                        "awaiting_location": True,
                        "pending_order_token": pending_order_token,
                    }
                return {
                    "message": f"Before I confirm your order for **{product_name}**, please provide your delivery location. You can enter it manually or use your live location.",
                    "needs_location": True,
                    "pending_order": {
                        "product_name": product_name,
                        "quantity": quantity,
                        "pending_order_token": pending_order_token if session_id else None,
                    },
                }

            # If Safety Passes, execute the order!
            execution_result = await self.execution_agent.execute_order(
                patient_id=pid,
                product_name=product_name,
                quantity=quantity,
                delivery_location=delivery_location,
                delivery_map_url=delivery_map_url,
            )

            if execution_result.get("approved"):
                # clear any pending order for this session since it's now complete
                if session_id:
                    self.pending_orders.pop(session_id, None)
                
                # add to order history for tracking and save to file
                self.order_history.append(execution_result['order'])
                self._save_order_history()  
                
                total = execution_result['order']['total_price']
                order_id = execution_result['order']['order_id']
                rem_stock = execution_result.get("remaining_stock")
                
                # ✅ Fetch User Details for the Receipt
                from app.services.user_service import UserService
                user_info = UserService.get_user(str(pid))
                customer_name = user_info.get("name", "Guest") if user_info else "Guest"
                customer_phone = user_info.get("phone", "N/A") if user_info else "N/A"
                notification_sent = bool(execution_result.get("notification_sent"))
                notification_error = execution_result.get("notification_error")

                confirmation_message = f"Order Confirmed for **{product_name}**! Your medicine will be prepared for delivery shortly."
                if not notification_sent:
                    confirmation_message += "\n\nWhatsApp confirmation could not be delivered. Please verify your phone number and Twilio WhatsApp setup."
                    if notification_error:
                        confirmation_message += f"\n\nReason: {notification_error}"

                return {
                    "message": confirmation_message,
                    "receipt": {
                        "order_id": order_id,
                        "name": customer_name,
                        "phone": customer_phone,
                        "medicine": product_name,
                        "quantity": quantity,
                        "total": total,
                        "delivery_location": execution_result["order"].get("delivery_location"),
                        "delivery_map_url": execution_result["order"].get("delivery_map_url"),
                    }
                }
            else:
                return {"message": f"**Fulfillment Error**: {execution_result.get('error', 'I could not process the order at this time.')}"}


