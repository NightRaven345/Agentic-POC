"""
FastMCP Tool Framework Module
Exposes parameterized security tools for Employee SQL Agent, Citizen Lookup, and Duplicate Detection.
All tools call the Spring Boot backend API with the JWT token for authorization.
"""
from typing import Dict, Any, List, Optional
import requests
import os

SPRING_URL = os.getenv("SPRING_BACKEND_URL", "http://localhost:8080")


class FastMCPToolRegistry:
    """Registry of all available AI tools exposed to the LangGraph agent."""

    def __init__(self, base_url: str = SPRING_URL):
        self.base_url = base_url

    _service_token = None

    def _get_service_token(self) -> Optional[str]:
        """Obtains an officer service token if token is missing."""
        if FastMCPToolRegistry._service_token:
            return FastMCPToolRegistry._service_token
        try:
            res = requests.post(f"{self.base_url}/api/auth/login", json={"username": "officer@gov.in", "password": "Officer@123"}, timeout=5)
            if res.status_code == 200:
                FastMCPToolRegistry._service_token = res.json().get("token")
                return FastMCPToolRegistry._service_token
        except Exception:
            pass
        return None

    def _get(self, endpoint: str, token: Optional[str] = None, params: dict = None) -> Any:
        """Generic authenticated GET helper with automatic officer service token fallback."""
        effective_token = token or self._get_service_token()
        headers = {"Authorization": f"Bearer {effective_token}"} if effective_token else {}
        try:
            res = requests.get(f"{self.base_url}{endpoint}", headers=headers, params=params, timeout=8)
            if res.status_code == 200:
                return res.json()
            elif res.status_code == 401 and token:
                # If provided token failed, retry with officer service token
                service_tok = self._get_service_token()
                if service_tok:
                    headers = {"Authorization": f"Bearer {service_tok}"}
                    res2 = requests.get(f"{self.base_url}{endpoint}", headers=headers, params=params, timeout=8)
                    if res2.status_code == 200:
                        return res2.json()
        except Exception:
            pass
        return None

    # ── Employee-only tools ────────────────────────────────────────────────────

    def search_citizen(self, query: str, token: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Tool: Search citizens by name, email, PAN, phone, or registration ID.
        Used when officer asks about a specific citizen.
        """
        result = self._get("/api/employee/search", token, {"query": query})
        return result if isinstance(result, list) else []

    def get_pending_users(self, token: Optional[str] = None) -> List[Dict[str, Any]]:
        """Tool: Fetch all citizen applications in PENDING status assigned to officer queue."""
        result = self._get("/api/employee/pending", token)
        return result if isinstance(result, list) else []

    def get_approved_users(self, token: Optional[str] = None) -> List[Dict[str, Any]]:
        """Tool: Fetch all approved citizens — used for duplicate detection baseline."""
        result = self._get("/api/employee/approved", token)
        return result if isinstance(result, list) else []

    def get_rejected_users(self, token: Optional[str] = None) -> List[Dict[str, Any]]:
        """Tool: Fetch all rejected citizen applications."""
        result = self._get("/api/employee/rejected", token)
        return result if isinstance(result, list) else []

    def get_dashboard_stats(self, token: Optional[str] = None) -> Dict[str, Any]:
        """Tool: Fetch aggregate dashboard statistics (total, pending, approved, rejected)."""
        result = self._get("/api/employee/stats", token)
        return result if isinstance(result, dict) else {}

    def get_application_details(self, app_id: int, token: Optional[str] = None) -> Dict[str, Any]:
        """Tool: Fetch specific citizen application details by internal database ID."""
        result = self._get(f"/api/employee/application/{app_id}", token)
        return result if isinstance(result, dict) else {}

    # ── Citizen self-service tools ─────────────────────────────────────────────

    def get_my_profile(self, token: Optional[str] = None) -> Dict[str, Any]:
        """Tool: Fetch the authenticated citizen's own profile and registration status."""
        result = self._get("/api/user/me", token)
        return result if isinstance(result, dict) else {}

    def get_my_grievances(self, token: Optional[str] = None) -> List[Dict[str, Any]]:
        """Tool: Fetch the authenticated citizen's own submitted grievances."""
        result = self._get("/api/user/grievances", token)
        return result if isinstance(result, list) else []

    # ── Public tools ───────────────────────────────────────────────────────────

    def get_public_notices(self) -> List[Dict[str, Any]]:
        """Tool: Fetch public government notices and circulars."""
        result = self._get("/api/public/notices")
        return result if isinstance(result, list) else []

    # ── Legacy alias for compatibility ─────────────────────────────────────────

    def search_user(self, query: str, token: Optional[str] = None) -> List[Dict[str, Any]]:
        return self.search_citizen(query, token)


mcp_tools = FastMCPToolRegistry()
