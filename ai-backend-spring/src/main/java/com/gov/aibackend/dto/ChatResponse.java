package com.gov.aibackend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Mirrors the dict returned by process_agent_chat():
 * {
 *   "intent": ..., "role": ..., "allowed": ..., "response": ...,
 *   "tools_used": [...], "active_context_used": ...,
 *   "llm_provider": ..., "llm_model": ...
 * }
 */
public class ChatResponse {

    private String intent;
    private String role;
    private boolean allowed;
    private String response;

    @JsonProperty("tools_used")
    private List<String> toolsUsed;

    @JsonProperty("active_context_used")
    private boolean activeContextUsed;

    @JsonProperty("llm_provider")
    private String llmProvider;

    @JsonProperty("llm_model")
    private String llmModel;

    // ── Builder-style constructor ─────────────────────────────────────────────

    public ChatResponse() {}

    public ChatResponse(String intent, String role, boolean allowed, String response,
                        List<String> toolsUsed, boolean activeContextUsed,
                        String llmProvider, String llmModel) {
        this.intent = intent;
        this.role = role;
        this.allowed = allowed;
        this.response = response;
        this.toolsUsed = toolsUsed;
        this.activeContextUsed = activeContextUsed;
        this.llmProvider = llmProvider;
        this.llmModel = llmModel;
    }

    // ── Getters & Setters ─────────────────────────────────────────────────────

    public String getIntent() { return intent; }
    public void setIntent(String intent) { this.intent = intent; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public boolean isAllowed() { return allowed; }
    public void setAllowed(boolean allowed) { this.allowed = allowed; }

    public String getResponse() { return response; }
    public void setResponse(String response) { this.response = response; }

    public List<String> getToolsUsed() { return toolsUsed; }
    public void setToolsUsed(List<String> toolsUsed) { this.toolsUsed = toolsUsed; }

    public boolean isActiveContextUsed() { return activeContextUsed; }
    public void setActiveContextUsed(boolean activeContextUsed) { this.activeContextUsed = activeContextUsed; }

    public String getLlmProvider() { return llmProvider; }
    public void setLlmProvider(String llmProvider) { this.llmProvider = llmProvider; }

    public String getLlmModel() { return llmModel; }
    public void setLlmModel(String llmModel) { this.llmModel = llmModel; }
}
