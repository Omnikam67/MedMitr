from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from socketio import AsyncServer
from fastapi.staticfiles import StaticFiles
import os

from app.core.database import init_db
from app.core import models  # Import to register core tables before init_db
from app.core import doctor_models  # Import to create tables on startup
from app.api import products, patients, orders, chat, refill, auth, nearby, report, doctor, delivery
from app.services.product_service import ProductService

init_db()


def _allowed_origins() -> list[str]:
    configured = os.getenv("ALLOWED_ORIGINS", "").strip()
    if configured:
        return [item.strip() for item in configured.split(",") if item.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


def _should_index_products_on_startup() -> bool:
    configured = os.getenv("STARTUP_INDEX_PRODUCTS")
    if configured is not None:
        return configured.strip().lower() in {"1", "true", "yes", "on"}

    # Render free instances are memory-constrained, so skip heavy vector indexing
    # unless it is explicitly enabled.
    return not bool(os.getenv("RENDER"))

# ✅ LIFESPAN EVENT: Runs when server starts
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Server starting... Loading products...")
    try:
        init_db()
        # 1. Load products from Excel
        service = ProductService()
        all_products = service.get_all_products()
        
        # 2. Index them into Vector Store (ChromaDB) only when explicitly enabled
        if _should_index_products_on_startup():
            if all_products:
                from app.services.vector_store import index_products

                index_products(all_products)
            else:
                print("No products found in Excel to index.")
        else:
            print("Skipping startup vector indexing on this environment.")
            
    except Exception as e:
        print(f"Error during startup indexing: {e}")
        
    yield
    print("Server shutting down...")

app = FastAPI(title="Agentic Pharmacy Backend", lifespan=lifespan)

# ✅ CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Socket.IO Setup
from socketio import ASGIApp
sio = AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=_allowed_origins(),
    ping_timeout=60,
    ping_interval=25,
)

# ✅ Include Routers on the FastAPI app
app.include_router(auth.router)
app.include_router(doctor.router)
app.include_router(delivery.router)
app.include_router(refill.router)
app.include_router(products.router)
app.include_router(patients.router)
app.include_router(orders.router)
app.include_router(chat.router)
app.include_router(nearby.router)
app.include_router(report.router)

@app.get("/")
def root():
    return {"message": "Agentic Pharmacy Backend Running"}

# ✅ Wrap the FastAPI app with Socket.IO ASGI for export to Uvicorn
app = ASGIApp(sio, app)

# ✅ Socket.IO Event Handlers
@sio.event
async def connect(sid, environ):
    print(f"Client {sid} connected")
    return True

@sio.event
async def disconnect(sid):
    print(f"Client {sid} disconnected")

# Broadcast order updates
@sio.event
async def order_update(sid, data):
    await sio.emit('order_update', data, skip_sid=sid)
