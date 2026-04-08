from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
import os
from dotenv import load_dotenv
from pathlib import Path
from urllib.parse import quote

# Load local backend .env without overriding host-provided env vars such as Render secrets.
env_file = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_file, override=False)

# MySQL Database Configuration
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "password")
MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = os.getenv("MYSQL_PORT", "3306")
MYSQL_DB = os.getenv("MYSQL_DB", "pharmacy_db")

# URL-encode the password for special characters like @
ENCODED_PASSWORD = quote(MYSQL_PASSWORD, safe="")

DEFAULT_DATABASE_URL = (
    f"mysql+pymysql://{MYSQL_USER}:{ENCODED_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}"
)

# Prefer a single DATABASE_URL in hosted environments like Render.
RENDER_ENV = bool(os.getenv("RENDER"))
DATABASE_URL_ENV = (os.getenv("DATABASE_URL") or "").strip()
SQLITE_DB_PATH = Path(__file__).parent.parent.parent / "local_dev.db"
SQLITE_DATABASE_URL = f"sqlite:///{SQLITE_DB_PATH.as_posix()}"

if DATABASE_URL_ENV:
    CONFIGURED_DATABASE_URL = DATABASE_URL_ENV
elif RENDER_ENV:
    # On Render, avoid blocking startup by trying localhost MySQL unless it is
    # explicitly configured. Falling back to SQLite lets the web process bind
    # to PORT quickly and serve traffic.
    CONFIGURED_DATABASE_URL = SQLITE_DATABASE_URL
else:
    CONFIGURED_DATABASE_URL = DEFAULT_DATABASE_URL


def _build_engine(database_url: str):
    if database_url.startswith("sqlite"):
        return create_engine(
            database_url,
            echo=False,
            connect_args={"check_same_thread": False},
        )

    return create_engine(
        database_url,
        echo=False,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=3600,
        connect_args={"connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT", "5"))},
    )


def _initialize_engine():
    primary_engine = _build_engine(CONFIGURED_DATABASE_URL)
    try:
        with primary_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print(f"Using database: {CONFIGURED_DATABASE_URL}")
        return primary_engine, CONFIGURED_DATABASE_URL
    except SQLAlchemyError as exc:
        print(f"Primary database unavailable: {exc}")
        print(f"Falling back to local SQLite database at {SQLITE_DB_PATH}")
        fallback_engine = _build_engine(SQLITE_DATABASE_URL)
        return fallback_engine, SQLITE_DATABASE_URL


engine, DATABASE_URL = _initialize_engine()

# Session Factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

def get_db():
    """Dependency for getting database session in FastAPI routes"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
    try:
        if engine.dialect.name != "mysql":
            print("Skipping MySQL-specific schema sync for local SQLite mode.")
            print("Database tables created successfully.")
            return

        with engine.begin() as conn:
            def ensure_column(table_name: str, column_name: str, ddl: str):
                col = conn.execute(
                    text(
                        "SELECT COUNT(*) FROM information_schema.columns "
                        "WHERE table_schema = :db "
                        "AND table_name = :table_name "
                        "AND column_name = :column_name"
                    ),
                    {"db": MYSQL_DB, "table_name": table_name, "column_name": column_name},
                ).scalar() or 0
                if col == 0:
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {ddl}"))

            ensure_column("users", "preferred_language", "preferred_language VARCHAR(10) NOT NULL DEFAULT 'en'")
            ensure_column("users", "owner_name", "owner_name VARCHAR(255) NULL")
            ensure_column("users", "store_name", "store_name VARCHAR(255) NULL")
            ensure_column("users", "email", "email VARCHAR(255) NULL")
            ensure_column("users", "pharma_id", "pharma_id VARCHAR(255) NULL")
            ensure_column("users", "address", "address TEXT NULL")
            ensure_column("users", "store_address", "store_address TEXT NULL")
            ensure_column("users", "pharmacy_address", "pharmacy_address TEXT NULL")
            ensure_column("users", "pharmacy_license_number", "pharmacy_license_number VARCHAR(255) NULL")
            ensure_column("users", "password_reset_otp", "password_reset_otp VARCHAR(6) NULL")
            ensure_column("users", "password_reset_expires_at", "password_reset_expires_at DATETIME NULL")
            ensure_column("orders", "otp_code", "otp_code VARCHAR(6) NULL")
            ensure_column("orders", "otp_verified_at", "otp_verified_at DATETIME NULL")
            ensure_column("orders", "delivery_location", "delivery_location TEXT NULL")
            ensure_column("orders", "delivery_map_url", "delivery_map_url TEXT NULL")
            ensure_column("orders", "delivery_boy_id", "delivery_boy_id VARCHAR(255) NULL")
            ensure_column("orders", "delivery_cancel_reason", "delivery_cancel_reason TEXT NULL")
            ensure_column("orders", "delivery_completed_at", "delivery_completed_at DATETIME NULL")
            ensure_column("orders", "delivery_cancelled_at", "delivery_cancelled_at DATETIME NULL")
            ensure_column("doctors", "doctor_id", "doctor_id VARCHAR(100) NULL")
            ensure_column("doctors", "gender", "gender VARCHAR(20) NOT NULL DEFAULT 'Other'")
            ensure_column("doctors", "hospital_name", "hospital_name VARCHAR(255) NULL")
            ensure_column("doctors", "address", "address TEXT NULL")
            ensure_column("doctors", "profile_image", "profile_image LONGTEXT NULL")
            ensure_column("doctors", "degree_certificate_image", "degree_certificate_image LONGTEXT NULL")
            ensure_column("appointment_requests", "prescription_text", "prescription_text LONGTEXT NULL")
            ensure_column("appointment_requests", "prescription_notes", "prescription_notes LONGTEXT NULL")
            ensure_column("appointment_requests", "prescription_image", "prescription_image LONGTEXT NULL")
            ensure_column("appointment_requests", "completed_at", "completed_at DATETIME NULL")
            ensure_column("appointment_requests", "referral_id", "referral_id VARCHAR(36) NULL")

            conn.execute(text("UPDATE doctors SET doctor_id = id WHERE doctor_id IS NULL OR doctor_id = ''"))
            conn.execute(text("UPDATE users SET pharma_id = shop_id WHERE (pharma_id IS NULL OR pharma_id = '') AND shop_id IS NOT NULL"))
    except Exception:
        pass
    print("Database tables created successfully.")
