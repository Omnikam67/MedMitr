"""
DeliveryService using ChromaDB and LangChain
- Stores and manages delivery boys in a vector database (ChromaDB)
- Supports LLM-powered delivery search and reasoning via LangChain
"""
import uuid
from chromadb import Client as ChromaClient
from langchain.llms import OpenAI
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from app.core.security import hash_password, verify_password

class DeliveryServiceChroma:
    def __init__(self, openai_api_key: str):
        self.chroma_client = ChromaClient()
        self.collection = self.chroma_client.create_collection("delivery_boys")
        self.llm = OpenAI(openai_api_key=openai_api_key)
        self.prompt = PromptTemplate(input_variables=["query"], template="Delivery info: {query}")
        self.llm_chain = LLMChain(llm=self.llm, prompt=self.prompt)

    def register_delivery_boy(self, name, phone, age, gender, password):
        delivery_boy_id = str(uuid.uuid4())
        delivery_boy_data = {
            "id": delivery_boy_id,
            "name": name,
            "phone": phone,
            "age": age,
            "gender": gender,
            "password_hash": hash_password(password),
            "status": "pending"
        }
        self.collection.add(
            documents=[str(delivery_boy_data)],
            metadatas=[delivery_boy_data],
            ids=[delivery_boy_id]
        )
        return delivery_boy_data

    def get_all_delivery_boys(self):
        results = self.collection.get()
        return results

    def search_delivery_boys(self, query: str, n_results: int = 3):
        results = self.collection.query(query_texts=[query], n_results=n_results)
        return results

    def ask_delivery_agent(self, query: str):
        answer = self.llm_chain.run(query=query)
        return answer

    def verify_delivery_boy_password(self, delivery_boy_id: str, password: str) -> bool:
        delivery_boy = self.collection.get(ids=[delivery_boy_id])
        if not delivery_boy or not delivery_boy['metadatas']:
            return False
        return verify_password(password, delivery_boy['metadatas'][0].get('password_hash', ''))
