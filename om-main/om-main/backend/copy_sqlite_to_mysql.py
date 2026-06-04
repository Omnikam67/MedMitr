import os
import sqlite3
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, SQLITE_DB_PATH, CONFIGURED_DATABASE_URL
from app.core.models import (
    User, Product, DeliveryBoy, Doctor, AppointmentRequest,
    PatientReferral, Order, OrderItem, Reminder, ChatHistory,
    UserTrustedContact, DoctorRegistrationRequest, DoctorFeedback, Revenue
)

def copy_table(sqlite_conn, mysql_session, model_class, table_name):
    # Fetch all records from sqlite table
    sqlite_conn.row_factory = sqlite3.Row
    cursor = sqlite_conn.cursor()
    try:
        cursor.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
    except sqlite3.OperationalError:
        print(f"Table {table_name} does not exist in SQLite, skipping.")
        return

    print(f"Migrating {len(rows)} records for table '{table_name}'...")
    
    # Insert each record into MySQL
    for row in rows:
        row_dict = dict(row)
        
        # Check if record already exists in MySQL to avoid duplicate key errors
        primary_key_attr = model_class.__mapper__.primary_key[0].name
        pk_value = row_dict.get(primary_key_attr)
        
        existing = mysql_session.query(model_class).filter(
            getattr(model_class, primary_key_attr) == pk_value
        ).first()
        
        if existing:
            continue
            
        # Create instance of SQLAlchemy model
        instance = model_class(**row_dict)
        mysql_session.add(instance)
    
    mysql_session.commit()

def main():
    if not SQLITE_DB_PATH.exists():
        print(f"SQLite database file not found at: {SQLITE_DB_PATH}")
        return

    print(f"Target Database URL: {CONFIGURED_DATABASE_URL}")
    if CONFIGURED_DATABASE_URL.startswith("sqlite"):
        print("Error: Target database is SQLite. Please set the environment variables (or DATABASE_URL) to point to MySQL first.")
        return

    # Create MySQL connection engine & tables
    mysql_engine = create_engine(CONFIGURED_DATABASE_URL)
    print("Creating tables in MySQL database...")
    Base.metadata.create_all(bind=mysql_engine)
    
    # Initialize session
    MySQLSession = sessionmaker(bind=mysql_engine)
    mysql_session = MySQLSession()

    # Open SQLite connection
    sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)

    # Table mappings (Model Class, SQLite Table Name)
    table_mappings = [
        (User, "users"),
        (Product, "products"),
        (DeliveryBoy, "delivery_boys"),
        (Doctor, "doctors"),
        (AppointmentRequest, "appointment_requests"),
        (PatientReferral, "patient_referrals"),
        (Order, "orders"),
        (OrderItem, "order_items"),
        (Reminder, "reminders"),
        (ChatHistory, "chat_history"),
        (UserTrustedContact, "user_trusted_contacts"),
        (DoctorRegistrationRequest, "doctor_registration_requests"),
        (DoctorFeedback, "doctor_feedback"),
        (Revenue, "revenues"),
    ]

    try:
        for model_class, table_name in table_mappings:
            copy_table(sqlite_conn, mysql_session, model_class, table_name)
        print("Migration to MySQL completed successfully!")
    except Exception as e:
        print(f"Migration failed: {e}")
        mysql_session.rollback()
    finally:
        sqlite_conn.close()
        mysql_session.close()

if __name__ == "__main__":
    main()
