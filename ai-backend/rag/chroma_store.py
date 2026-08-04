import re
from typing import List, Dict, Any
from .knowledge_base import FAQ_DOCUMENTS, RAG_DOCUMENTS


class VectorStore:
    """
    RAG & FAQ Vector Retrieval Engine
    Uses phrase matching, keyword boosting, and token Jaccard similarity
    over official government portal documentation.
    """
    def __init__(self):
        self.faqs = FAQ_DOCUMENTS
        self.rag_docs = RAG_DOCUMENTS

    def _tokenize(self, text: str) -> set:
        words = re.findall(r'\w+', text.lower())
        stop_words = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'for', 'of', 'in', 'on', 'at', 'by', 'with', 'and', 'or', 'do', 'does', 'did', 'can', 'could', 'what', 'which', 'where', 'when', 'why', 'who', 'i', 'my', 'your', 'me', 'this'}
        return {w for w in words if w not in stop_words and len(w) > 1}

    def _compute_score(self, query: str, doc: Dict[str, Any]) -> float:
        q_raw = query.lower().strip()
        q_tokens = self._tokenize(query)
        if not q_tokens:
            return 0.0

        question = doc.get("question", doc.get("title", "")).lower()
        answer = doc.get("answer", doc.get("content", "")).lower()
        category = doc.get("category", "").lower()
        keywords = [k.lower() for k in doc.get("keywords", [])]

        # 1. Exact phrase / keyword match bonus (highest weight: 0.7)
        phrase_score = 0.0
        for kw in keywords:
            if kw in q_raw or q_raw in kw:
                phrase_score = 1.0
                break

        # 2. Token overlap score
        doc_tokens = self._tokenize(f"{question} {answer} {category} {' '.join(keywords)}")
        intersection = q_tokens.intersection(doc_tokens)
        union = q_tokens.union(doc_tokens)
        jaccard = len(intersection) / len(union) if union else 0.0

        # Token match ratio in question / keywords
        target_tokens = self._tokenize(f"{question} {' '.join(keywords)}")
        q_match_count = sum(1.0 for qt in q_tokens if qt in target_tokens)
        q_ratio = q_match_count / len(q_tokens) if q_tokens else 0.0

        # Total score computation
        score = (phrase_score * 0.5) + (q_ratio * 0.35) + (jaccard * 0.15)
        return score

    def search_faq(self, query: str, threshold: float = 0.10) -> Dict[str, Any]:
        """
        Searches FAQ knowledge base for best matching question & answer.
        """
        best_match = None
        highest_score = 0.0

        for faq in self.faqs:
            score = self._compute_score(query, faq)
            if score > highest_score:
                highest_score = score
                best_match = faq

        if best_match and highest_score >= threshold:
            return {
                "matched": True,
                "score": round(highest_score, 2),
                "faq": best_match
            }
        return {"matched": False, "score": round(highest_score, 2), "faq": None}

    def search_rag(self, query: str, top_k: int = 2) -> List[Dict[str, Any]]:
        """
        Searches all RAG and policy documents for top relevant contexts.
        """
        results = []
        all_docs = self.faqs + self.rag_docs

        for doc in all_docs:
            content = doc.get("content", doc.get("answer", ""))
            title = doc.get("title", doc.get("question", ""))
            score = self._compute_score(query, doc)
            results.append({
                "id": doc.get("id", "doc"),
                "title": title,
                "content": content,
                "score": round(score, 2)
            })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]


# Global Instance
vector_store = VectorStore()
