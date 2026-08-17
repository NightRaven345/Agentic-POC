package com.gov.aibackend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

/**
 * Mirrors Python ChatRequest(BaseModel):
 *   message: str
 *   role: Optional[str] = "PUBLIC"
 *   user_details: Optional[Dict[str, Any]] = None
 *   active_app_context: Optional[Dict[str, Any]] = None
 */
public class ChatRequest {

    private String message;
    private String role = "PUBLIC";

    @JsonProperty("user_details")
    private Map<String, Object> userDetails;

    @JsonProperty("active_app_context")
    private Map<String, Object> activeAppContext;

    // ── Getters & Setters ─────────────────────────────────────────────────────

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getRole() { return role != null ? role : "PUBLIC"; }
    public void setRole(String role) { this.role = role; }

    public Map<String, Object> getUserDetails() { return userDetails; }
    public void setUserDetails(Map<String, Object> userDetails) { this.userDetails = userDetails; }

    public Map<String, Object> getActiveAppContext() { return activeAppContext; }
    public void setActiveAppContext(Map<String, Object> activeAppContext) { this.activeAppContext = activeAppContext; }
}
