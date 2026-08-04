package com.gov.portal.dto;

public class AuthResponse {
    private String token;
    private Long id;
    private String username;
    private String role;
    private String status;
    private String registrationId;
    private String fullName;
    private String approvalStage;
    private Integer estimatedProcessingDays;
    private String missingDocuments;

    public AuthResponse() {}

    public AuthResponse(String token, Long id, String username, String role, String status, String registrationId, String fullName, String approvalStage, Integer estimatedProcessingDays, String missingDocuments) {
        this.token = token;
        this.id = id;
        this.username = username;
        this.role = role;
        this.status = status;
        this.registrationId = registrationId;
        this.fullName = fullName;
        this.approvalStage = approvalStage;
        this.estimatedProcessingDays = estimatedProcessingDays;
        this.missingDocuments = missingDocuments;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getRegistrationId() { return registrationId; }
    public void setRegistrationId(String registrationId) { this.registrationId = registrationId; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getApprovalStage() { return approvalStage; }
    public void setApprovalStage(String approvalStage) { this.approvalStage = approvalStage; }

    public Integer getEstimatedProcessingDays() { return estimatedProcessingDays; }
    public void setEstimatedProcessingDays(Integer estimatedProcessingDays) { this.estimatedProcessingDays = estimatedProcessingDays; }

    public String getMissingDocuments() { return missingDocuments; }
    public void setMissingDocuments(String missingDocuments) { this.missingDocuments = missingDocuments; }
}
