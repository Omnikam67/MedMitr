import difflib
from langfuse import observe
from app.services.product_service import ProductService


@observe(name="index_products")
def index_products(products):
    """Placeholder index function to keep compatibility without importing chromadb."""
    print("Fuzzy-match mode: skipping chromadb indexing.")
    return None


@observe(name="search_product")
def search_product(query: str, n_results=1):
    """
    Lightweight, high-performance fuzzy match replacing SentenceTransformer/ChromaDB.
    Runs in milliseconds and consumes 0MB of extra RAM, avoiding Render OOM crashes.
    """
    query_clean = str(query or "").strip().lower()
    if not query_clean:
        return [] if n_results > 1 else None

    try:
        service = ProductService()
        all_products = service.get_all_products()
        if not all_products:
            return [] if n_results > 1 else None

        matches = []
        for p in all_products:
            name = str(p.get("product_name") or "")
            name_clean = name.strip().lower()
            desc_clean = str(p.get("description") or "").strip().lower()

            # Base similarity on name match
            ratio = difflib.SequenceMatcher(None, query_clean, name_clean).ratio()

            # Substring match boosts
            if query_clean in name_clean or name_clean in query_clean:
                ratio += 0.35
            elif query_clean in desc_clean:
                ratio += 0.15

            matches.append({
                "name": name,
                "description": p.get("description", ""),
                "price": p.get("price", 0),
                "ratio": ratio
            })

        # Sort matches by ratio descending
        matches.sort(key=lambda x: x["ratio"], reverse=True)

        if n_results == 1:
            best = matches[0] if matches else None
            # Return name if it is somewhat similar
            if best and best["ratio"] > 0.15:
                return best["name"]
            return None

        # Filter top matches with a reasonable threshold
        top = [m for m in matches if m["ratio"] > 0.15][:n_results]
        return [{"name": m["name"], "description": m["description"], "price": m["price"]} for m in top]

    except Exception as e:
        print(f"Fuzzy product search error: {e}")

    return [] if n_results > 1 else None
