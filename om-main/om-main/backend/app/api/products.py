from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from langfuse import observe
from pydantic import BaseModel

from app.core.auth import require_roles
from app.services.product_service import ProductService
from app.services.translation_service import simplify_english, translate_texts

router = APIRouter()
service = ProductService()


@router.get("/products")
@observe(name="get_all_products")
def get_products(english: bool = True):
    service.reload()
    products = service.get_all_products()

    if english:
        descriptions = [str(p.get("description", "") or "") for p in products]
        translated = translate_texts(descriptions, target="en")
        for p, desc_en in zip(products, translated):
            p["description_en"] = desc_en
            p["description_simple_en"] = simplify_english(desc_en)

    return products


@router.get("/products/{product_name}")
@observe(name="get_product_by_name")
def get_product(product_name: str):
    product = service.get_product_by_name(product_name)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/admin/products")
@observe(name="get_admin_products")
def get_admin_products(_: dict = Depends(require_roles("admin", "system_manager"))):
    service.reload()
    df = service.df
    products = []
    descriptions: list[str] = []
    for _, row in df.iterrows():
        item = {col: row.get(col) for col in df.columns}
        desc = str(row.get("descriptions", ""))
        descriptions.append(desc)
        item["_raw_description"] = desc
        products.append(item)

    if products:
        translated = translate_texts(descriptions, target="en")
        for item, desc_en in zip(products, translated):
            item["description_en"] = desc_en
            item["description_simple_en"] = simplify_english(desc_en)
            item.pop("_raw_description", None)

    analysis = {
        "total_products": len(df),
        "average_price": float(df.get("price rec").mean()) if "price rec" in df.columns else 0,
        "min_price": float(df.get("price rec").min()) if "price rec" in df.columns else 0,
        "max_price": float(df.get("price rec").max()) if "price rec" in df.columns else 0,
        "by_package_size": df.get("package size").value_counts().to_dict() if "package size" in df.columns else {},
    }
    return {"products": products, "analysis": analysis}


@router.post("/admin/products/upload")
async def upload_products(
    file: UploadFile = File(...),
    _: dict = Depends(require_roles("admin", "system_manager")),
):
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")

    try:
        content = await file.read()
        message = service.update_inventory_from_excel(content)
        success = message.lower().startswith("success")
        return {"success": success, "message": message}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(exc)}") from exc


class ProductUpdate(BaseModel):
    product_name: str | None = None
    stock: int | None = None
    price: float | None = None
    prescription_required: bool | None = None


class ProductCreate(BaseModel):
    product_id: str | None = None
    product_name: str
    description: str | None = ""
    stock: int = 0
    price: float = 0
    prescription_required: bool = False


@router.post("/admin/products")
@observe(name="create_admin_product")
def create_product(data: ProductCreate, _: dict = Depends(require_roles("admin", "system_manager"))):
    success, message = service.create_product(data.model_dump())
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message}


@router.put("/admin/products/{product_id}")
@observe(name="update_admin_product")
def update_product(
    product_id: str,
    data: ProductUpdate,
    _: dict = Depends(require_roles("admin", "system_manager")),
):
    success, message = service.update_product_details(product_id, data.model_dump(exclude_unset=True))
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message}
