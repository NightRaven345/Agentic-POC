package com.gov.aibackend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

/**
 * Mirrors Python DuplicateCheckRequest(BaseModel):
 *   target_user: Dict[str, Any]
 */
public class DuplicateCheckRequest {

    @JsonProperty("target_user")
    private Map<String, Object> targetUser;

    public Map<String, Object> getTargetUser() { return targetUser; }
    public void setTargetUser(Map<String, Object> targetUser) { this.targetUser = targetUser; }
}
