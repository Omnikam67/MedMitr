import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# 1. SETUP PATHS
# Calculate the path to the root of the project (Project Nan)
# Assuming this file is in backend/tests/
current_file = Path(__file__).resolve()
project_root = current_file.parents[2] 

# 2. LOAD ENVIRONMENT VARIABLES
# We must load .env BEFORE importing SafetyAgent so @observe finds the keys
load_dotenv(project_root / ".env")

# 3. NOW IMPORT THE AGENT
# Ensure project root is in sys.path so we can import 'backend'
sys.path.append(str(project_root))

from backend.app.agents.safety_agent import SafetyAgent

agent = SafetyAgent()

print("TEST 1: OTC medicine")
print(agent.validate_order(
    patient_id=1,
    product_name="Paracetamol",
    quantity=2,
    has_prescription=False
))

print("\nTEST 2: Prescription medicine without history")
print(agent.validate_order(
    patient_id=999,
    product_name="Amoxicillin",
    quantity=1,
    has_prescription=False
))

print("\nTEST 3: Invalid quantity")
print(agent.validate_order(
    patient_id=1,
    product_name="Paracetamol",
    quantity=5,
    has_prescription=False
))