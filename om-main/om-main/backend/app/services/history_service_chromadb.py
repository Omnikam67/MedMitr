"""
HistoryService using ChromaDB and LangChain
- Stores and manages patient order history in a vector database (ChromaDB)
- Supports LLM-powered history search and reasoning via LangChain
"""
import uuid
from chromadb import Client as ChromaClient
from langchain.llms import OpenAI
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate

class HistoryServiceChroma:
    def __init__(self, openai_api_key: str):
        self.chroma_client = ChromaClient()
        self.collection = self.chroma_client.create_collection("order_history")
        self.llm = OpenAI(openai_api_key=openai_api_key)
        self.prompt = PromptTemplate(input_variables=["query"], template="Order history info: {query}")
        self.llm_chain = LLMChain(llm=self.llm, prompt=self.prompt)

    def add_history(self, patient_id, product_name, quantity, purchase_date, status):
        history_id = str(uuid.uuid4())
        history_data = {
            "id": history_id,
            "patient_id": patient_id,
            "product_name": product_name,
            "quantity": quantity,
            "purchase_date": purchase_date,
            "status": status
        }
        self.collection.add(
            documents=[str(history_data)],
            metadatas=[history_data],
            ids=[history_id]
        )
        return history_data

    def get_patient_history(self, patient_id: str):
        results = self.collection.get()
        return [meta for meta in results['metadatas'] if meta['patient_id'] == patient_id]

    def get_all_history(self):
        results = self.collection.get()
        return results

    def search_history(self, query: str, n_results: int = 3):
        results = self.collection.query(query_texts=[query], n_results=n_results)
        return results

    def ask_history_agent(self, query: str):
        answer = self.llm_chain.run(query=query)
        return answer
