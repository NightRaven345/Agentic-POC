"""
AI Microservice Agent — Intent Classification Engine
Classifies incoming user queries into one of five structured intent types:
1. SQL (Dashboard statistics, high-level counts, system totals)
2. CITIZEN_LOOKUP (Searching specific citizens, approved citizens directory, pending queue)
3. WORKFLOW (Authenticated citizen's own application status, missing docs, grievances)
4. FAQ (Standard portal guidance, registration process, requirements, fees)
5. RAG / GENERAL (Legal circulars, SRS policies, anti-fraud rules, general AI assistant)
"""

import re
from typing import Dict, Any, Optional


def classify_intent(message: str, active_context: Optional[dict] = None, role: str = "PUBLIC") -> str:
    """
    Rule-based intent classifier with role-based privilege checks.
    """
    if not message:
        return "GENERAL"

    msg = message.lower().strip()
    role_upper = (role or "PUBLIC").upper()

    # ── EMPLOYEE ONLY: Specific Citizen Lookup & Directory Access ────────────────
    # Check CITIZEN_LOOKUP first so queries like "show approved citizens in database" route to directory search
    if role_upper == "ROLE_EMPLOYEE" and any(kw in msg for kw in [
        "find citizen", "lookup citizen", "search citizen", "get citizen",
        "tell me about", "details for", "info on", "information about",
        "profile of", "who is", "who has", "find user", "lookup user", "search user",
        "show citizen", "citizen named", "applicant named", "applicant with",
        "approved citizen", "approved citizens", "approved users", "approved list",
        "verified citizens", "show approved", "list approved", "pending queue",
        "pending applications", "pending list", "show pending", "list pending",
        "pan number", "registration id", "reg id", "usr-", "grv-",
        "search for", "look up", "show me citizen",
        "address of", "pan of", "phone of", "email of", "dob of", "date of birth",
        "contact of", "where does", "where is", "what is the address", "what was the address",
        "what is the pan", "what was the pan", "what is the phone", "what was the phone",
        "what is the email", "what was the email", "what is the dob", "what was the dob",
        "this guy", "this applicant", "this user", "this person", "this citizen",
        "his address", "her address", "his pan", "her pan", "his phone", "her phone",
        "his email", "her email", "his dob", "her dob"
    ]):
        return "CITIZEN_LOOKUP"

    # Secondary check: specific identifiers (like USR-xxx, PAN format, or email @)
    if role_upper == "ROLE_EMPLOYEE" and any(pattern in msg for pattern in ["usr-", "grv-", "@", "pan:"]):
        return "CITIZEN_LOOKUP"

    # ── EMPLOYEE ONLY: SQL / System Stats ──────────────────────────────────────
    if role_upper == "ROLE_EMPLOYEE" and any(kw in msg for kw in [
        "how many", "count", "stats", "statistics", "total citizens", "pending review",
        "approved count", "rejected count", "sql", "dashboard stats", "system summary"
    ]):
        return "SQL"

    # ── CITIZEN ONLY: Own workflow / registration status ──────────────────────
    if role_upper in ("ROLE_USER",) and any(kw in msg for kw in [
        "my status", "my registration", "my application", "my profile",
        "what is happening", "what's happening", "what happened", "my documents",
        "missing document", "my documents missing", "why pending", "why is my",
        "how long", "when will", "approved", "rejected my", "my verification",
        "estimated time", "processing time", "my grievance", "submitted grievance",
        "track my", "application status", "registration status"
    ]):
        return "WORKFLOW"

    # ── FAQ: Common portal process questions ──────────────────────────────────
    if any(kw in msg for kw in [
        "what documents", "which documents", "documents required", "required documents",
        "how to register", "how do i register", "registration process", "how to apply",
        "citizen registration", "what is citizen registration", "what is registration", "how long does", "approval take",
        "processing time", "portal faq", "how to submit", "what is the process",
        "can i apply", "eligible", "eligibility", "who can register", "step by step",
        "registration fee", "is it free", "cost of registration"
    ]):
        return "FAQ"

    # ── RAG: Policy, legal, guideline questions ────────────────────────────────
    if any(kw in msg for kw in [
        "srs", "policy", "rule", "guideline", "security directive", "anti-fraud",
        "duplicate policy", "legal", "circular", "notice", "notice board",
        "public notice", "regulation", "requirement specification"
    ]):
        return "RAG"

    return "GENERAL"
