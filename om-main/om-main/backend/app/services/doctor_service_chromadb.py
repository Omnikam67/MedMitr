"""
DoctorService using ChromaDB and LangChain
- Stores and manages doctors in a vector database (ChromaDB)
- Supports LLM-powered doctor search and reasoning via LangChain
"""
import uuid
from chromadb import Client as ChromaClient
from langchain.llms import OpenAI
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from app.core.security import hash_password, verify_password

class DoctorServiceChroma:
    def __init__(self, openai_api_key: str):
        self.chroma_client = ChromaClient()
        self.collection = self.chroma_client.create_collection("doctors")
        self.llm = OpenAI(openai_api_key=openai_api_key)
        self.prompt = PromptTemplate(input_variables=["query"], template="Doctor info: {query}")
        self.llm_chain = LLMChain(llm=self.llm, prompt=self.prompt)

    def create_doctor(self, doctor_id, name, email, phone, password, specialty, **kwargs):
        doc_uuid = str(uuid.uuid4())
        doctor_data = {
            "id": doc_uuid,
            "doctor_id": doctor_id,
            "name": name,
            "email": email,
            "phone": phone,
            "password_hash": hash_password(password),
            "specialty": specialty,
            **kwargs
        }
        self.collection.add(
            documents=[str(doctor_data)],
            metadatas=[doctor_data],
            ids=[doc_uuid]
        )
        return doctor_data

    def get_all_doctors(self):
        results = self.collection.get()
        return results

    def search_doctors(self, query: str, n_results: int = 3):
        results = self.collection.query(query_texts=[query], n_results=n_results)
        return results

    def ask_doctor_agent(self, query: str):
        answer = self.llm_chain.run(query=query)
        return answer

    def verify_doctor_password(self, doctor_id: str, password: str) -> bool:
        doctor = self.collection.get(ids=[doctor_id])
        if not doctor or not doctor['metadatas']:
            return False
        return verify_password(password, doctor['metadatas'][0].get('password_hash', ''))
