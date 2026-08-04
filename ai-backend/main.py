import os
from fastapi import FastAPI, Header, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

load_dotenv()

from agents.langgraph_workflow import process_agent_chat, get_role_capabilities
from agents.duplicate_agent import run_duplicate_detection
from mcp.fastmcp_server import mcp_tools
from llm_client import llm_client

app = FastAPI(
    title="Government Portal AI Microservice",
    version="2.0.0",
    description="FastAPI service hosting LangGraph agents, FastMCP tool framework, and LLM-powered duplicate detection"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    role: Optional[str] = "PUBLIC"
    user_details: Optional[Dict[str, Any]] = None
    active_app_context: Optional[Dict[str, Any]] = None


class DuplicateCheckRequest(BaseModel):
    target_user: Dict[str, Any]


@app.get("/health")
def health_check():
    return {
        "status": "UP",
        "service": "AI Microservice",
        "llm_provider": os.getenv("LLM_PROVIDER", "ollama"),
        "llm_model": os.getenv("LLM_MODEL", "gemma4:12b"),
        "version": "2.0.0"
    }


@app.get("/api/ai/capabilities")
def get_capabilities(role: Optional[str] = "PUBLIC"):
    return get_role_capabilities(role)


from fastapi.responses import StreamingResponse
from agents.langgraph_workflow import process_agent_chat, process_agent_chat_stream, get_role_capabilities

@app.post("/api/ai/chat")
def chat_endpoint(
    request: ChatRequest,
    authorization: Optional[str] = Header(None)
):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]

    response_data = process_agent_chat(
        user_message=request.message,
        role=request.role or "PUBLIC",
        auth_token=token,
        user_details=request.user_details,
        active_app_context=request.active_app_context
    )
    return response_data


@app.post("/api/ai/chat/stream")
def chat_stream_endpoint(
    request: ChatRequest,
    authorization: Optional[str] = Header(None)
):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]

    generator = process_agent_chat_stream(
        user_message=request.message,
        role=request.role or "PUBLIC",
        auth_token=token,
        user_details=request.user_details,
        active_app_context=request.active_app_context
    )

    return StreamingResponse(generator, media_type="application/x-ndjson")


@app.post("/api/ai/duplicate-check")
def duplicate_check_endpoint(
    request: DuplicateCheckRequest,
    authorization: Optional[str] = Header(None)
):
    """
    LLM-powered duplicate detection endpoint.
    
    Pipeline:
      1. Fetch all approved citizens from the Spring Boot backend (via FastMCP tool).
      2. Run algorithmic pre-screening to identify the best candidate match.
      3. Pass field comparison data to LLM to produce a final confidence score.
      4. Return LLM's analysis (falls back to algorithmic score if LLM is unavailable).
    """
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]

    # Fetch approved users via FastMCP tool
    approved_users = mcp_tools.get_approved_users(token)

    # Run full LLM-powered duplicate detection (llm_client passed for LLM scoring)
    result = run_duplicate_detection(
        target_user=request.target_user,
        approved_users=approved_users,
        llm_client=llm_client
    )
    return result
