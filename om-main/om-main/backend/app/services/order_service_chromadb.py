"""
OrderService using ChromaDB and LangChain
- Stores and manages orders in a vector database (ChromaDB)
- Supports LLM-powered order search and reasoning via LangChain
"""
import uuid
from datetime import datetime
from chromadb import Client as ChromaClient
from langchain.llms import OpenAI
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate

class OrderServiceChroma:
    def __init__(self, openai_api_key: str):
        self.chroma_client = ChromaClient()
        self.collection = self.chroma_client.create_collection("orders")
        self.llm = OpenAI(openai_api_key=openai_api_key)
        self.prompt = PromptTemplate(input_variables=["query"], template="Order info: {query}")
        self.llm_chain = LLMChain(llm=self.llm, prompt=self.prompt)

    def create_order(self, patient_id, product_id, quantity, total_price, product_name=None, delivery_location=None, delivery_map_url=None):
        order_id = str(uuid.uuid4())
        order_data = {
            "order_id": order_id,
            "patient_id": patient_id,
            "product_id": product_id,
            "product_name": product_name,
            "quantity": quantity,
            "total_price": total_price,
            "delivery_location": delivery_location,
            "delivery_map_url": delivery_map_url,
            "order_date": datetime.utcnow().isoformat(),
            "status": "pending"
        }
        self.collection.add(
            documents=[str(order_data)],
            metadatas=[order_data],
            ids=[order_id]
        )
        return order_data

    def get_all_orders(self):
        results = self.collection.get()
        return results

    def search_orders(self, query: str, n_results: int = 3):
        results = self.collection.query(query_texts=[query], n_results=n_results)
        return results

    def ask_order_agent(self, query: str):
        answer = self.llm_chain.run(query=query)
        return answer
