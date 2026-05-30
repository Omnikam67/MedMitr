"""
ProductService using ChromaDB and LangChain
- Stores and searches products in a vector database (ChromaDB)
- Supports LLM-powered search and reasoning via LangChain
"""
import uuid
from chromadb import Client as ChromaClient
from langchain.llms import OpenAI
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate

class ProductServiceChroma:
    def __init__(self, openai_api_key: str):
        self.chroma_client = ChromaClient()
        self.collection = self.chroma_client.create_collection("products")
        self.llm = OpenAI(openai_api_key=openai_api_key)
        self.prompt = PromptTemplate(input_variables=["query"], template="Find the best product for: {query}")
        self.llm_chain = LLMChain(llm=self.llm, prompt=self.prompt)

    def add_product(self, name: str, description: str, stock: int, price: float, prescription_required: bool):
        product_id = str(uuid.uuid4())
        self.collection.add(
            documents=[description],
            metadatas=[{
                "name": name,
                "stock": stock,
                "price": price,
                "prescription_required": prescription_required
            }],
            ids=[product_id]
        )
        return product_id

    def get_all_products(self):
        # Returns all products in the collection
        results = self.collection.get()
        return results

    def search_products(self, query: str, n_results: int = 3):
        # Vector search using ChromaDB
        results = self.collection.query(query_texts=[query], n_results=n_results)
        return results

    def ask_product_agent(self, query: str):
        # Use LangChain LLM to answer product-related questions
        answer = self.llm_chain.run(query=query)
        return answer
