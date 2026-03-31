import io
import re
import unicodedata
import uuid

import pandas as pd
from langfuse import observe
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.core.models import Product


class ProductService:
    def __init__(self):
        self.df = pd.DataFrame()
        self.reload()

    def _normalize(self, text):
        if not text:
            return ""
        raw = str(text)
        raw = unicodedata.normalize("NFKD", raw)
        raw = "".join(ch for ch in raw if not unicodedata.combining(ch))
        raw = raw.lower()
        raw = re.sub(r"[^a-z0-9\s]", " ", raw)
        raw = re.sub(r"\s+", " ", raw).strip()
        return raw

    def _product_to_row(self, product: Product) -> dict:
        return {
            "product id": product.product_id,
            "product name": product.product_name,
            "description": product.description or "",
            "descriptions": product.description or "",
            "stock": int(product.stock or 0),
            "price rec": float(product.price or 0),
            "prescription_required": bool(product.prescription_required),
        }

    def reload(self):
        db = SessionLocal()
        try:
            products = db.query(Product).order_by(Product.product_name.asc()).all()
            rows = [self._product_to_row(product) for product in products]
            self.df = pd.DataFrame(rows)
        except SQLAlchemyError:
            self.df = pd.DataFrame()
        finally:
            db.close()

    def _sync_vector_index(self):
        try:
            from app.services.vector_store import index_products
            index_products(self.get_all_products())
            return True, None
        except Exception as exc:
            return False, str(exc)

    def _find_product(self, db, product_id: str | None = None, product_name: str | None = None):
        product = None
        if product_id:
            product = db.query(Product).filter(Product.product_id == str(product_id)).first()
        if not product and product_name:
            exact = str(product_name).strip()
            product = db.query(Product).filter(Product.product_name == exact).first()
        if not product and product_name:
            normalized = self._normalize(product_name)
            for candidate in db.query(Product).all():
                candidate_name = self._normalize(candidate.product_name)
                if candidate_name == normalized or normalized in candidate_name:
                    return candidate
        return product

    def update_inventory_from_excel(self, file_content: bytes):
        try:
            new_df = pd.read_excel(io.BytesIO(file_content))
            new_df.columns = [str(col).strip().lower() for col in new_df.columns]

            if "product name" not in new_df.columns:
                return "Error: Uploaded file must contain a 'product name' column."

            db = SessionLocal()
            try:
                updated_count = 0
                added_count = 0

                for _, row in new_df.iterrows():
                    product_name = str(row.get("product name") or "").strip()
                    if not product_name or product_name.lower() == "nan":
                        continue

                    product_id = str(row.get("product id") or "").strip() or None
                    product = self._find_product(db, product_id=product_id, product_name=product_name)

                    description = row.get("descriptions", row.get("description", ""))
                    stock = row.get("stock", 0)
                    price = row.get("price rec", row.get("price", 0))
                    prescription_value = row.get(
                        "prescription_required",
                        row.get("prescription record", row.get("prescription", False)),
                    )

                    if isinstance(prescription_value, str):
                        prescription_required = prescription_value.strip().upper() == "TRUE"
                    else:
                        prescription_required = bool(prescription_value)

                    stock = 0 if pd.isna(stock) else int(stock)
                    price = 0 if pd.isna(price) else float(price)
                    description = "" if pd.isna(description) else str(description)

                    if product:
                        product.product_name = product_name
                        product.description = description
                        product.stock = stock
                        product.price = price
                        product.prescription_required = prescription_required
                        updated_count += 1
                    else:
                        db.add(
                            Product(
                                product_id=product_id or str(uuid.uuid4()),
                                product_name=product_name,
                                description=description,
                                stock=stock,
                                price=price,
                                prescription_required=prescription_required,
                            )
                        )
                        added_count += 1

                db.commit()
            finally:
                db.close()

            self.reload()
            indexed, index_error = self._sync_vector_index()
            if indexed:
                return f"Success! Updated {updated_count} existing products and added {added_count} new products."
            return (
                f"Success! Updated {updated_count} existing products and added {added_count} new products. "
                f"Search indexing skipped: {index_error}"
            )
        except Exception as e:
            return f"Failed to process file: {str(e)}"

    def update_product_details(self, product_id: str, updated_data: dict):
        db = SessionLocal()
        try:
            product = db.query(Product).filter(Product.product_id == str(product_id)).first()
            if not product:
                return False, f"Product ID {product_id} not found."

            if "product_name" in updated_data:
                product.product_name = str(updated_data["product_name"]).strip()
            if "stock" in updated_data:
                product.stock = int(updated_data["stock"])
            if "price" in updated_data:
                product.price = float(updated_data["price"])
            if "prescription_required" in updated_data:
                product.prescription_required = bool(updated_data["prescription_required"])

            db.commit()
            self.reload()
            indexed, index_error = self._sync_vector_index()
            if indexed:
                return True, "Product updated successfully."
            return True, f"Product updated successfully. Search indexing skipped: {index_error}"
        except Exception as e:
            db.rollback()
            return False, f"Error saving: {str(e)}"
        finally:
            db.close()

    def create_product(self, product_data: dict):
        db = SessionLocal()
        try:
            product_name = str(product_data.get("product_name") or "").strip()
            if not product_name:
                return False, "Product name is required."

            product_id = str(product_data.get("product_id") or "").strip() or str(uuid.uuid4())
            existing = self._find_product(db, product_id=product_id, product_name=product_name)
            if existing:
                return False, "A product with this ID or name already exists."

            description = str(product_data.get("description") or "").strip()
            stock = int(product_data.get("stock") or 0)
            price = float(product_data.get("price") or 0)
            prescription_required = bool(product_data.get("prescription_required", False))

            db.add(
                Product(
                    product_id=product_id,
                    product_name=product_name,
                    description=description,
                    stock=stock,
                    price=price,
                    prescription_required=prescription_required,
                )
            )
            db.commit()
            self.reload()
            indexed, index_error = self._sync_vector_index()
            if indexed:
                return True, "Product created successfully."
            return True, f"Product created successfully. Search indexing skipped: {index_error}"
        except Exception as e:
            db.rollback()
            return False, f"Error creating product: {str(e)}"
        finally:
            db.close()

    @observe(name="get_product_by_name")
    def get_product_by_name(self, name: str):
        if not name:
            return None

        db = SessionLocal()
        try:
            product = self._find_product(db, product_name=name)
            if not product:
                return None
            return {
                "product_id": product.product_id,
                "product_name": product.product_name,
                "price": float(product.price or 0),
                "description": str(product.description or ""),
                "stock": int(product.stock or 0),
                "prescription_required": bool(product.prescription_required),
            }
        finally:
            db.close()

    def check_stock_availability(self, product_name: str, quantity: int):
        product = self.get_product_by_name(product_name)
        if not product:
            return False, "Product not found"

        available = int(product.get("stock", 0))
        requested = int(quantity or 0)
        if available < requested:
            return False, f"Only {available} units available (requested {requested})"

        return True, "Stock available"

    def reduce_stock(self, product_name: str, quantity: int):
        db = SessionLocal()
        try:
            product = self._find_product(db, product_name=product_name)
            if not product:
                return False
            product.stock = max(0, int(product.stock or 0) - int(quantity))
            db.commit()
            self.reload()
            return True
        except Exception:
            db.rollback()
            return False
        finally:
            db.close()

    def add_stock(self, product_name: str, quantity: int):
        db = SessionLocal()
        try:
            product = self._find_product(db, product_name=product_name)
            if not product:
                return False
            product.stock = int(product.stock or 0) + int(quantity)
            db.commit()
            self.reload()
            return True
        except Exception:
            db.rollback()
            return False
        finally:
            db.close()

    @observe(name="get_all_products")
    def get_all_products(self):
        self.reload()
        if self.df.empty:
            return []

        products = []
        for _, row in self.df.iterrows():
            products.append(
                {
                    "product_id": row.get("product id", "N/A"),
                    "product_name": row.get("product name"),
                    "price": float(row.get("price rec", 0) or 0),
                    "stock": int(row.get("stock", 0) or 0),
                    "description": str(row.get("descriptions", row.get("description", "")) or ""),
                    "prescription_required": bool(row.get("prescription_required", False)),
                }
            )
        return products
