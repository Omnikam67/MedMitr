"""
UserService using ChromaDB and LangChain
- Stores and manages users in a vector database (ChromaDB)
- Supports LLM-powered user search and reasoning via LangChain
"""
import uuid
from chromadb import Client as ChromaClient
from langchain.llms import OpenAI
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from app.core.security import hash_password, verify_password

class UserServiceChroma:
    def __init__(self, openai_api_key: str):
        self.chroma_client = ChromaClient()
        self.collection = self.chroma_client.create_collection("users")
        self.llm = OpenAI(openai_api_key=openai_api_key)
        self.prompt = PromptTemplate(input_variables=["query"], template="User info: {query}")
        self.llm_chain = LLMChain(llm=self.llm, prompt=self.prompt)

    def create_user(self, name, phone, email, password, role, **kwargs):
        user_id = str(uuid.uuid4())
        user_data = {
            "id": user_id,
            "name": name,
            "phone": phone,
            "email": email,
            "password_hash": hash_password(password),
            "role": role,
            **kwargs
        }
        self.collection.add(
            documents=[str(user_data)],
            metadatas=[user_data],
            ids=[user_id]
        )
        return user_data

    def get_all_users(self):
        results = self.collection.get()
        return results

    def search_users(self, query: str, n_results: int = 3):
        results = self.collection.query(query_texts=[query], n_results=n_results)
        return results

    def ask_user_agent(self, query: str):
        answer = self.llm_chain.run(query=query)
        return answer

    def verify_user_password(self, user_id: str, password: str) -> bool:
        user = self.collection.get(ids=[user_id])
        if not user or not user['metadatas']:
            return False
        return verify_password(password, user['metadatas'][0].get('password_hash', ''))
