"""
LangGraph Agentic Workflow
Main orchestrator: permission checking → tool invocation → LLM synthesis.
No hardcoded citizen names, scores, or results. All data comes from live API calls.
"""
from typing import Dict, Any, List, Optional
import json
from .intent_agent import classify_intent
from .duplicate_agent import run_duplicate_detection
from rag.chroma_store import vector_store
from mcp.fastmcp_server import mcp_tools
from llm_client import llm_client


def get_role_capabilities(role: str) -> Dict[str, Any]:
    """Returns available and unavailable capabilities for UI visualization and agent permission checks."""
    normalized_role = (role or "PUBLIC").upper()

    if normalized_role == "ROLE_EMPLOYEE":
        return {
            "level": "3. Officer AI (Enterprise Intelligence)",
            "available": [
                {"name": "FAQ Assistant", "desc": "Semantic FAQ search"},
                {"name": "RAG Knowledge Base", "desc": "Government policy & SRS documents"},
                {"name": "Citizen Lookup", "desc": "Search any citizen by name, PAN, phone, email, or Reg ID"},
                {"name": "SQL Stats Tool", "desc": "Live dashboard statistics from database"},
                {"name": "Duplicate Detection", "desc": "Multi-field AI similarity engine"},
                {"name": "Pending Queue Tool", "desc": "List assigned officer verification tasks"},
                {"name": "Approval Workflow", "desc": "Context-aware decision recommendations"}
            ],
            "unavailable": [],
            "allowed_intents": ["FAQ", "RAG", "SQL", "CITIZEN_LOOKUP", "DUPLICATE_DETECTION", "WORKFLOW", "GENERAL"]
        }
    elif normalized_role == "ROLE_USER":
        return {
            "level": "2. Citizen AI (Workflow Assistant)",
            "available": [
                {"name": "FAQ Assistant", "desc": "Portal guidelines & FAQs"},
                {"name": "My Registration Status", "desc": "Live approval stage & estimated timeline"},
                {"name": "My Documents", "desc": "Missing document checklist"},
                {"name": "My Grievances", "desc": "Track submitted grievances"}
            ],
            "unavailable": [
                {"name": "Search Other Citizens", "desc": "Officer restricted feature"},
                {"name": "Duplicate Detection", "desc": "Officer restricted feature"},
                {"name": "Database SQL Queries", "desc": "Officer restricted feature"}
            ],
            "allowed_intents": ["FAQ", "RAG", "WORKFLOW", "GENERAL"]
        }
    else:  # PUBLIC
        return {
            "level": "1. Public AI (FAQ Assistant)",
            "available": [
                {"name": "FAQ Assistant", "desc": "Semantic FAQ matching"},
                {"name": "Public Policies & SRS", "desc": "RAG document search"},
                {"name": "Registration Guidelines", "desc": "Step-by-step process help"}
            ],
            "unavailable": [
                {"name": "Registration Status", "desc": "Requires Citizen login"},
                {"name": "Citizen Data Access", "desc": "Requires login"},
                {"name": "Workflow & SQL Tools", "desc": "Requires login"}
            ],
            "allowed_intents": ["FAQ", "RAG", "GENERAL"]
        }


def process_agent_chat(
    user_message: str,
    role: str = "PUBLIC",
    auth_token: Optional[str] = None,
    user_details: Optional[Dict[str, Any]] = None,
    active_app_context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Main LangGraph Agentic Orchestrator.
    Flow: Permission Check → Intent Classification → Tool Invocation → LLM Generation.
    """
    capabilities = get_role_capabilities(role)
    intent = classify_intent(user_message, active_app_context, role)

    # ── 1. PERMISSION CHECK ───────────────────────────────────────────────────
    if intent not in capabilities["allowed_intents"]:
        role_names = {"ROLE_USER": "Citizen", "ROLE_EMPLOYEE": "Officer", "PUBLIC": "Public Guest"}
        return {
            "intent": intent,
            "role": role,
            "allowed": False,
            "response": (
                f"🔒 **Access Restricted for {role_names.get(role, role)}**\n\n"
                f"Your current AI intelligence level **({capabilities['level']})** "
                f"does not permit accessing the **{intent.replace('_', ' ').title()}** tool.\n\n"
                f"*Please log in with appropriate credentials to unlock higher-tier AI capabilities.*"
            ),
            "tools_used": [],
            "active_context_used": False,
            "llm_provider": llm_client.provider,
            "llm_model": llm_client.model
        }

    tools_used = []
    context_used = False
    retrieved_data_str = ""
    tool_metadata = {}

    # ── 2. TOOL INVOCATION ────────────────────────────────────────────────────

    if intent == "DUPLICATE_DETECTION":
        tools_used.append("DuplicateDetectionTool")
        target_app = active_app_context
        if not target_app:
            # Try to find a pending application for context
            pendings = mcp_tools.get_pending_users(auth_token)
            return {
                "intent": intent,
                "role": role,
                "allowed": True,
                "response": (
                    "⚠️ **No Application Context Active**\n\n"
                    "To run Duplicate Detection, please click **'Inspect Task'** on a pending "
                    f"registration in your Officer Dashboard. There are currently "
                    f"**{len(pendings)} pending application(s)** in your queue."
                ),
                "tools_used": tools_used,
                "active_context_used": False,
                "llm_provider": llm_client.provider,
                "llm_model": llm_client.model
            }

        context_used = True
        tools_used.append("ApprovedUsersFetchTool")
        approved_users = mcp_tools.get_approved_users(auth_token)
        # Pass llm_client so the duplicate agent uses LLM for final scoring
        dup_result = run_duplicate_detection(target_app, approved_users, llm_client=llm_client)
        retrieved_data_str = json.dumps({
            "target_application": {
                "name": f"{target_app.get('firstName', '')} {target_app.get('lastName', '')}",
                "registrationId": target_app.get('registrationId'),
                "pan": target_app.get('pan'),
                "phone": target_app.get('phone'),
                "email": target_app.get('email'),
                "organization": target_app.get('organization')
            },
            "duplicate_detection_result": dup_result,
            "total_approved_citizens_checked": len(approved_users)
        }, indent=2)
        tool_metadata = dup_result

    elif intent == "CITIZEN_LOOKUP":
        tools_used.append("CitizenLookupTool")
        msg = user_message.lower()

        is_approved_query = any(k in msg for k in ["approved citizen", "approved user", "approved list", "verified citizens", "show approved", "list approved", "all approved"])
        is_pending_query = any(k in msg for k in ["pending citizen", "pending application", "pending queue", "pending list", "show pending", "list pending", "unapproved"])
        is_context_ref = active_app_context and any(k in msg for k in [
            "this guy", "this applicant", "this user", "this person", "this citizen",
            "this record", "current applicant", "current user", "his", "her", "he", "she"
        ])

        approved_list = mcp_tools.get_approved_users(auth_token) or []
        pending_list = mcp_tools.get_pending_users(auth_token) or []
        all_citizens = approved_list + pending_list
        results = []

        if is_context_ref and active_app_context:
            context_used = True
            tools_used.append("ActiveContextLookupTool")
            target_pan = active_app_context.get("pan")
            target_reg = active_app_context.get("registrationId")
            target_email = active_app_context.get("email")
            matched_in_db = [
                c for c in all_citizens
                if (target_pan and c.get("pan") == target_pan) or
                   (target_reg and c.get("registrationId") == target_reg) or
                   (target_email and c.get("email") == target_email)
            ]
            if matched_in_db:
                results = matched_in_db
            else:
                results = [active_app_context]
        elif is_approved_query:
            tools_used.append("ApprovedCitizensFetchTool")
            results = approved_list
        elif is_pending_query:
            tools_used.append("PendingQueueFetchTool")
            results = pending_list
        else:
            import re
            stop_phrases = [
                "what is the address of", "what was the address of", "what is the pan of", "what was the pan of",
                "what is the phone number of", "what was the phone number of", "what is the phone of", "what was the phone of",
                "what is the email of", "what was the email of", "what is the dob of", "what was the dob of",
                "what is the date of birth of", "where does", "live", "reside",
                "address of", "pan of", "phone of", "email of", "dob of", "date of birth of", "contact of",
                "find citizen", "lookup citizen", "search citizen", "get citizen",
                "show me", "tell me about", "details for", "info on", "information about",
                "profile of", "who is", "find user", "search user", "show citizen",
                "citizen named", "applicant named", "applicant with", "search for", "look up",
                "what is the", "what was the", "give me the", "show me the", "tell me the"
            ]
            query = user_message.strip()
            for phrase in stop_phrases:
                query = re.sub(re.escape(phrase), "", query, flags=re.IGNORECASE).strip()
            query = query.strip("?.,! ").strip()
            if not query:
                query = user_message

            results = mcp_tools.search_citizen(query, auth_token) or []

            # Fallback search if exact query yielded no direct results
            if not results:
                q_tokens = [t.lower() for t in re.split(r'\s+', query) if len(t) > 1]
                if q_tokens:
                    for c in all_citizens:
                        c_str = json.dumps(c).lower()
                        if any(t in c_str for t in q_tokens):
                            if c not in results:
                                results.append(c)

            if not results and active_app_context:
                results = [active_app_context]
                context_used = True

        retrieved_data_str = json.dumps({
            "user_query": user_message,
            "matching_results_count": len(results),
            "matching_citizens": results,
            "approved_citizens_count": len(approved_list),
            "pending_applications_count": len(pending_list)
        }, indent=2)

    elif intent == "SQL":
        tools_used.append("SQLStatsTool")
        stats = mcp_tools.get_dashboard_stats(auth_token)
        pendings = mcp_tools.get_pending_users(auth_token)
        approved = mcp_tools.get_approved_users(auth_token)
        retrieved_data_str = json.dumps({
            "dashboard_statistics": stats,
            "pending_applications": pendings,
            "approved_citizens_count": len(approved)
        }, indent=2)

    elif intent == "WORKFLOW":
        tools_used.append("WorkflowStatusTool")
        if auth_token:
            profile = mcp_tools.get_my_profile(auth_token)
            if profile:
                context_used = True
                grievances = mcp_tools.get_my_grievances(auth_token)
                retrieved_data_str = json.dumps({
                    "citizen_profile": profile,
                    "grievances": grievances
                }, indent=2)
            elif user_details:
                retrieved_data_str = json.dumps({"citizen_details": user_details}, indent=2)
        elif user_details:
            retrieved_data_str = json.dumps({"citizen_details": user_details}, indent=2)

    elif intent == "FAQ":
        tools_used.append("SemanticFAQTool")
        faq_res = vector_store.search_faq(user_message)
        retrieved_data_str = json.dumps(faq_res, indent=2)

    else:  # RAG / GENERAL
        tools_used.append("ChromaDB_RAG_Tool")
        rag_docs = vector_store.search_rag(user_message)
        retrieved_data_str = json.dumps(rag_docs, indent=2)

    # ── 3. BUILD SYSTEM PROMPT FOR LLM ────────────────────────────────────────
    system_prompt = _build_system_prompt(
        role, capabilities, intent, tools_used,
        active_app_context, retrieved_data_str, user_details
    )

    # ── 4. LLM CALL (Role-based Max Tokens: Public=600, Authenticated=1200) ────
    max_tok = 600 if (role or "PUBLIC").upper() == "PUBLIC" else 1200
    llm_res = llm_client.generate(system_prompt, user_message, max_tokens=max_tok)

    if llm_res.get("success"):
        response_text = llm_res["content"]
    else:
        response_text = _synthesize_fallback_response(
            intent, role, retrieved_data_str, active_app_context, user_details, tool_metadata
        )

    return {
        "intent": intent,
        "role": role,
        "allowed": True,
        "response": response_text,
        "tools_used": tools_used,
        "active_context_used": context_used,
        "llm_provider": llm_client.provider,
        "llm_model": llm_client.model
    }


def _build_system_prompt(role, capabilities, intent, tools_used,
                          active_context, retrieved_data, user_details) -> str:
    """Build a structured system prompt incorporating role, tools, and live data."""
    role_map = {"ROLE_EMPLOYEE": "Government Review Officer", "ROLE_USER": "Registered Citizen", "PUBLIC": "Public Guest"}
    role_name = role_map.get(role, role)

    parts = [
        "You are the official AI Assistant for the Government Digital Services Portal.",
        f"Current User Role: {role_name} | Intelligence Level: {capabilities['level']}",
        f"Query Intent Classified: {intent}",
        f"Tools Invoked: {', '.join(tools_used)}",
    ]

    if active_context:
        parts.append(f"\nActive Application Under Review:\n{json.dumps(active_context, indent=2)}")

    if retrieved_data:
        parts.append(f"\nTool Retrieved Data (from live database / knowledge base):\n{retrieved_data}")

    parts += [
        "\nResponse Instructions:",
        "1. Respond in clear, professional GitHub-style Markdown.",
        "2. Use ONLY the data provided above — do NOT invent citizen names, PAN numbers, phone numbers, or statistics.",
        "3. If no data was found by the tools, clearly state that no records were found.",
        "4. For DUPLICATE_DETECTION: Report the actual confidence score, recommendation, and evidence points. CRITICAL: If confidence_score is less than 10% or matched_user is null/None, DO NOT mention any matched existing citizen record or candidate name. Explicitly state that no duplicate record exists in the system.",
        "5. For CITIZEN_LOOKUP: List the actual matching citizens found with their full details. CRITICAL: If the user specifically asks for an attribute like address, PAN, phone, email, or DOB (e.g. 'what is the address of Rahul Sharma', 'what was the pan of this guy'), state that requested attribute value directly and clearly in bold at the top of your response.",
        "6. For SQL/STATS: Present the actual statistics from the database response.",
        "7. For WORKFLOW: Explain the citizen's actual current status, assigned officer, and steps.",
        "8. For FAQ/RAG: Provide accurate portal guidance based on the knowledge base result.",
        "9. NEVER say 'Rahul Sharma', 'Priya Verma', 'Officer Vikram', 'ABCDE1234F', or any specific name/number unless it appears in the tool data above.",
    ]

    return "\n".join(parts)


def _synthesize_fallback_response(intent: str, role: str, retrieved_data: str,
                                    active_context: dict, user_details: dict,
                                    tool_metadata: dict) -> str:
    """
    Fallback response generator when LLM is unavailable.
    Builds response entirely from actual tool data — no hardcoded citizen info.
    """
    model_label = f"*🤖 AI Engine: {llm_client.provider.upper()} ({llm_client.model}) — Structured Fallback Mode*\n\n"

    try:
        data = json.loads(retrieved_data) if retrieved_data else {}
    except Exception:
        data = {}

    if intent == "DUPLICATE_DETECTION":
        dup = data.get("duplicate_detection_result", {})
        target = data.get("target_application", {})
        name = target.get("name", "the applicant")
        reg_id = target.get("registrationId", "N/A")
        score = dup.get("confidence_score", 0)
        recommendation = dup.get("recommendation", "Insufficient data")
        reasons = dup.get("key_evidence") or dup.get("reasons") or []
        matched = dup.get("matched_user") if score >= 10.0 and dup.get("matched_user") else None
        reasoning = dup.get("reasoning", "")
        checked = data.get("total_approved_citizens_checked", 0)
        source = dup.get("analysis_source", "algorithmic_fallback")
        source_label = "LLM-Powered Analysis" if source == "llm" else "Algorithmic Pre-Screen (LLM Unavailable)"

        result_lines = "\n".join(f"- {r}" for r in reasons) if reasons else "- No significant matches found."
        matched_block = ""
        if matched and isinstance(matched, dict) and matched.get("fullName"):
            matched_block = (
                f"\n**Matched Existing Record:**\n"
                f"- Name: **{matched.get('fullName', 'N/A')}** (Reg ID: `{matched.get('registrationId', 'N/A')}`)\n"
                f"- PAN: `{matched.get('pan', 'N/A')}` | Phone: `{matched.get('phone', 'N/A')}`\n"
            )
        reasoning_block = f"\n**AI Reasoning:** {reasoning}\n" if reasoning else ""

        return (
            model_label +
            f"### 🤖 AI Duplicate Detection Analysis\n\n"
            f"**Analysis Method:** `{source_label}`\n"
            f"**Target Application:** {name} (`{reg_id}`)\n"
            f"**Database Checked Against:** {checked} approved citizen record(s)\n\n"
            f"---\n"
            f"**AI Confidence Score:** `{score}%`\n"
            f"**AI Recommendation:** **{recommendation}**\n"
            f"{matched_block}"
            f"{reasoning_block}\n"
            f"**Key Evidence:**\n{result_lines}\n\n"
            f"*Final approval/rejection decision rests with the assigned Review Officer.*"
        )

    elif intent == "CITIZEN_LOOKUP":
        citizens = data.get("matching_citizens") or data.get("citizens") or []
        query = data.get("user_query") or data.get("search_query", "")
        approved_cnt = data.get("approved_citizens_count", 0)
        pending_cnt = data.get("pending_applications_count", 0)

        if not citizens:
            return (
                model_label +
                f"### 🔍 Citizen Directory Lookup\n\n"
                f"No specific citizen record matched **`{query}`**.\n\n"
                f"**Database Summary:**\n"
                f"- 🟢 **Approved Citizens Directory:** {approved_cnt} registered citizens\n"
                f"- ⏳ **Pending Review Queue:** {pending_cnt} pending applications\n\n"
                f"*Try searching by full name, PAN, phone number, email, or Registration ID (e.g. USR-1042).*"
            )

        q_lower = query.lower()
        attr_highlight = ""
        c_first = citizens[0]
        c_name = f"{c_first.get('firstName', '')} {c_first.get('lastName', '')}".strip() or c_first.get("username", "Applicant")

        if "address" in q_lower or "where" in q_lower:
            addr = f"{c_first.get('address', 'N/A')}, {c_first.get('district', '')}, {c_first.get('state', '')} - {c_first.get('pin', '')}".strip(" ,-")
            attr_highlight = f"📍 **Residential Address for {c_name}:**\n**{addr}**\n\n---\n\n"
        elif "pan" in q_lower:
            attr_highlight = f"🪪 **PAN Card Number for {c_name}:**\n**`{c_first.get('pan', 'N/A')}`**\n\n---\n\n"
        elif "phone" in q_lower or "contact" in q_lower or "mobile" in q_lower:
            attr_highlight = f"📞 **Phone Number for {c_name}:**\n**`{c_first.get('phone', 'N/A')}`**\n\n---\n\n"
        elif "email" in q_lower:
            attr_highlight = f"✉️ **Email Address for {c_name}:**\n**{c_first.get('email', 'N/A')}**\n\n---\n\n"
        elif "dob" in q_lower or "birth" in q_lower:
            attr_highlight = f"📅 **Date of Birth for {c_name}:**\n**{c_first.get('dob', 'N/A')}**\n\n---\n\n"

        lines = []
        for c in citizens[:10]:
            full_name = f"{c.get('firstName', '')} {c.get('middleName', '') or ''} {c.get('lastName', '')}".strip() or c.get("username", "N/A")
            status = c.get('status', 'APPROVED')
            status_icon = "🟢 APPROVED" if status == "APPROVED" else ("⏳ PENDING" if status == "PENDING" else f"🔴 {status}")
            addr = f"{c.get('address', 'N/A')}, {c.get('district', '')}, {c.get('state', '')} - {c.get('pin', '')}".strip(" ,-")
            lines.append(
                f"#### {full_name} (`{c.get('registrationId', 'N/A')}`)\n"
                f"- **Status:** `{status_icon}` | **Role:** `{c.get('role', 'ROLE_USER')}`\n"
                f"- **PAN:** `{c.get('pan', 'N/A')}` | **Phone:** `{c.get('phone', 'N/A')}` | **Email:** `{c.get('email', 'N/A')}`\n"
                f"- **Address:** {addr}\n"
                f"- **DOB:** `{c.get('dob', 'N/A')}` | **Gender:** `{c.get('gender', 'N/A')}`\n"
                f"- **Organization:** {c.get('organization', 'N/A')} | **Qualification:** {c.get('qualification', 'N/A')}"
            )
        return (
            model_label +
            f"### 🔍 Citizen Details\n\n" +
            attr_highlight +
            "\n\n".join(lines)
        )

    elif intent == "SQL":
        stats = data.get("dashboard_statistics", {})
        pendings = data.get("pending_applications", [])
        pending_summary = "\n".join(
            f"- `{p.get('registrationId', 'N/A')}` — {p.get('firstName', '')} {p.get('lastName', '')} "
            f"({p.get('organization', 'N/A')}) | Stage: {p.get('approvalStage', 'N/A')}"
            for p in pendings[:10]
        ) or "No pending applications."
        return (
            model_label +
            f"### 📊 Government Portal Dashboard Statistics\n\n"
            f"| Metric | Count |\n|---|---|\n"
            f"| **Total Citizens** | {stats.get('total', 'N/A')} |\n"
            f"| **Pending Review** | {stats.get('pending', 'N/A')} |\n"
            f"| **Approved** | {stats.get('approved', 'N/A')} |\n"
            f"| **Rejected** | {stats.get('rejected', 'N/A')} |\n\n"
            f"**Pending Applications in Queue:**\n{pending_summary}"
        )

    elif intent == "WORKFLOW":
        profile = data.get("citizen_profile", user_details or {})
        grievances = data.get("grievances", [])
        name = f"{profile.get('firstName', '')} {profile.get('lastName', '')}".strip() or profile.get('username', 'N/A')
        grv_summary = "\n".join(
            f"- `{g.get('grievanceId', 'N/A')}` — {g.get('subject', 'N/A')} | Status: **{g.get('status', 'N/A')}**"
            for g in grievances
        ) or "No grievances submitted."
        return (
            model_label +
            f"### 📌 Your Application Status\n\n"
            f"**Name:** {name}\n"
            f"**Registration ID:** `{profile.get('registrationId', 'Not yet assigned')}`\n"
            f"**Current Status:** **{profile.get('status', 'N/A')}**\n"
            f"**Approval Stage:** {profile.get('approvalStage', 'N/A')}\n"
            f"**Assigned Officer:** {profile.get('assignedOfficerName', 'Not yet assigned')}\n"
            f"**Estimated Processing Time:** {profile.get('estimatedProcessingDays', 'N/A')} working day(s)\n"
            f"**Missing Documents:** {profile.get('missingDocuments', 'None listed')}\n\n"
            f"**Your Grievances:**\n{grv_summary}"
        )

    elif intent == "FAQ":
        faq = data.get("faq") or {}
        if data.get("matched") and faq:
            return (
                model_label +
                f"### 💡 FAQ — {faq.get('category', 'Portal Information')}\n\n"
                f"**Q: {faq.get('question', 'Your Question')}**\n\n"
                f"{faq.get('answer', 'Please refer to the portal guidelines.')}"
            )
        return (
            model_label +
            "### 💡 Government Portal FAQ\n\n"
            "Registration requires a valid **PAN Card**, **Address Proof** (Aadhaar/Passport/Utility Bill), "
            "**Mobile Number**, **Email Address**, **Educational Certificate**, and **Organization Details**.\n\n"
            "Standard approval takes **3–5 working days**. For specific queries, please contact the Grievance Cell."
        )

    else:  # RAG / GENERAL
        docs = data if isinstance(data, list) else []
        if docs:
            top_doc = docs[0]
            return (
                model_label +
                f"### 📚 Government Knowledge Base\n\n"
                f"**{top_doc.get('title', 'Government Portal Policy')}**\n\n"
                f"{top_doc.get('content', '')}"
            )
        return (
            model_label +
            "### 📚 Government Portal Guidelines\n\n"
            "Based on the **Government Digital Services SRS**, all applicants must complete a multi-attribute "
            "registration profile. Applications undergo a 3-stage review: **Receipt → Document Verification → Officer Decision**.\n\n"
            "For policy documents and official circulars, please check the **Public Notices** section."
        )


def process_agent_chat_stream(
    user_message: str,
    role: str = "PUBLIC",
    auth_token: Optional[str] = None,
    user_details: Optional[Dict[str, Any]] = None,
    active_app_context: Optional[Dict[str, Any]] = None
):
    """
    Streaming version of LangGraph Agentic Orchestrator.
    Yields NDJSON event strings:
      1. Metadata header event: {"type": "metadata", "intent": ..., "tools_used": ..., "allowed": True}
      2. Token events: {"type": "token", "content": "..."}
    """
    capabilities = get_role_capabilities(role)
    intent = classify_intent(user_message, active_app_context, role)

    # Permission check
    if intent not in capabilities["allowed_intents"]:
        role_names = {"ROLE_USER": "Citizen", "ROLE_EMPLOYEE": "Officer", "PUBLIC": "Public Guest"}
        restricted_msg = (
            f"🔒 **Access Restricted for {role_names.get(role, role)}**\n\n"
            f"Your current AI intelligence level **({capabilities['level']})** "
            f"does not permit accessing the **{intent.replace('_', ' ').title()}** tool.\n\n"
            f"*Please log in with appropriate credentials to unlock higher-tier AI capabilities.*"
        )
        yield json.dumps({
            "type": "metadata",
            "intent": intent,
            "role": role,
            "allowed": False,
            "tools_used": [],
            "active_context_used": False,
            "llm_provider": llm_client.provider,
            "llm_model": llm_client.model
        }) + "\n"
        yield json.dumps({"type": "token", "content": restricted_msg}) + "\n"
        return

    # Non-restricted flow — run full response via process_agent_chat
    res = process_agent_chat(user_message, role, auth_token, user_details, active_app_context)

    # Yield metadata first
    yield json.dumps({
        "type": "metadata",
        "intent": res.get("intent"),
        "role": res.get("role"),
        "allowed": res.get("allowed", True),
        "tools_used": res.get("tools_used", []),
        "active_context_used": res.get("active_context_used", False),
        "llm_provider": res.get("llm_provider"),
        "llm_model": res.get("llm_model")
    }) + "\n"

    # Now stream the content tokens
    full_text = res.get("response", "")
    
    # Try live LLM streaming if available
    # Yield tokens with a smooth chunk size
    chunk_size = 15
    for i in range(0, len(full_text), chunk_size):
        chunk = full_text[i:i+chunk_size]
        yield json.dumps({"type": "token", "content": chunk}) + "\n"
