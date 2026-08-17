"""
LLM Client — Dedicated Ollama & Cloud LLM Connector
Supports synchronous generation and live token streaming via NDJSON & OpenAI SSE.
Allows setting role-based max output token limits.
"""
import os
import requests
import json
from typing import Dict, Any, Generator
from dotenv import load_dotenv


class LLMClient:
    """
    Client for Ollama (local/remote/cloud) and OpenAI-compatible LLM endpoints.
    Supports both non-streaming generate() and streaming generate_stream().
    """

    def _get_config(self):
        load_dotenv(override=True)
        provider = os.getenv("LLM_PROVIDER", "ollama").lower()
        raw_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
        api_key = os.getenv("OLLAMA_API_KEY", "").strip()
        model = os.getenv("LLM_MODEL", "gemma4:31b")

        return {
            "provider": provider,
            "base_url": raw_url,
            "api_key": api_key,
            "model": model
        }

    @property
    def provider(self) -> str:
        return self._get_config()["provider"]

    @property
    def model(self) -> str:
        return self._get_config()["model"]

    def generate(self, system_prompt: str, user_message: str, temperature: float = 0.3, max_tokens: int = 2500) -> Dict[str, Any]:
        """
        Generates non-streaming completion text using Ollama or OpenAI API.
        """
        cfg = self._get_config()
        base_url = cfg["base_url"]
        api_key = cfg["api_key"]
        model = cfg["model"]
        provider = cfg["provider"]

        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        candidate_urls = []
        if base_url.endswith("/api/chat") or base_url.endswith("/chat/completions"):
            candidate_urls.append(base_url)
        elif base_url.endswith("/api"):
            candidate_urls.append(f"{base_url}/chat")
            candidate_urls.append(f"{base_url}/v1/chat/completions")
        else:
            candidate_urls.append(f"{base_url}/api/chat")
            candidate_urls.append(f"{base_url}/v1/chat/completions")

        for endpoint in candidate_urls:
            if "/chat" in endpoint and "/v1/" not in endpoint:
                payload = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens
                    }
                }
            else:
                payload = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": False
                }

            try:
                print(f"[LLM Request] Endpoint: {endpoint} | Model: {model} | MaxTokens: {max_tokens}")
                response = requests.post(endpoint, headers=headers, json=payload, timeout=25)

                if response.status_code == 200:
                    data = response.json()
                    content = ""
                    if "message" in data:
                        content = data["message"].get("content", "")
                    elif "choices" in data and len(data["choices"]) > 0:
                        content = data["choices"][0].get("message", {}).get("content", "")
                    elif "response" in data:
                        content = data.get("response", "")

                    if content and content.strip():
                        print(f"[LLM Success] Received {len(content)} chars from {endpoint}")
                        return {
                            "success": True,
                            "content": content,
                            "provider": provider,
                            "model": model,
                            "endpoint": endpoint
                        }
                    else:
                        print(f"[LLM Warning] HTTP 200 from {endpoint} but empty response content.")
                else:
                    print(f"[LLM Error] {endpoint} returned HTTP {response.status_code}: {response.text[:200]}")

            except Exception as e:
                print(f"[LLM Exception] {endpoint} connection error: {e}")

        return {
            "success": False,
            "provider": provider,
            "model": model,
            "error": f"Failed to get completion from {base_url}"
        }

    def generate_stream(self, system_prompt: str, user_message: str, temperature: float = 0.3, max_tokens: int = 2500) -> Generator[str, None, None]:
        """
        Yields text tokens as they arrive from Ollama or OpenAI streaming API.
        """
        cfg = self._get_config()
        base_url = cfg["base_url"]
        api_key = cfg["api_key"]
        model = cfg["model"]

        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        candidate_urls = []
        if base_url.endswith("/api/chat") or base_url.endswith("/chat/completions"):
            candidate_urls.append(base_url)
        elif base_url.endswith("/api"):
            candidate_urls.append(f"{base_url}/chat")
            candidate_urls.append(f"{base_url}/v1/chat/completions")
        else:
            candidate_urls.append(f"{base_url}/api/chat")
            candidate_urls.append(f"{base_url}/v1/chat/completions")

        for endpoint in candidate_urls:
            is_native_ollama = "/chat" in endpoint and "/v1/" not in endpoint
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                "stream": True
            }
            if is_native_ollama:
                payload["options"] = {
                    "temperature": temperature,
                    "num_predict": max_tokens
                }
            else:
                payload["temperature"] = temperature
                payload["max_tokens"] = max_tokens

            try:
                print(f"[LLM Stream] Endpoint: {endpoint} | Model: {model} | MaxTokens: {max_tokens}")
                response = requests.post(endpoint, headers=headers, json=payload, stream=True, timeout=30)

                if response.status_code == 200:
                    for line in response.iter_lines():
                        if not line:
                            continue
                        line_str = line.decode("utf-8").strip()

                        if is_native_ollama:
                            try:
                                data = json.loads(line_str)
                                chunk = data.get("message", {}).get("content", "")
                                if chunk:
                                    yield chunk
                            except json.JSONDecodeError:
                                pass
                        else:
                            if line_str.startswith("data: "):
                                data_content = line_str[6:].strip()
                                if data_content == "[DONE]":
                                    break
                                try:
                                    data = json.loads(data_content)
                                    choices = data.get("choices", [])
                                    if choices:
                                        chunk = choices[0].get("delta", {}).get("content", "")
                                        if chunk:
                                            yield chunk
                                except json.JSONDecodeError:
                                    pass
                    return
                else:
                    print(f"[LLM Stream Error] {endpoint} HTTP {response.status_code}")

            except Exception as e:
                print(f"[LLM Stream Exception] {endpoint}: {e}")

        return


llm_client = LLMClient()
