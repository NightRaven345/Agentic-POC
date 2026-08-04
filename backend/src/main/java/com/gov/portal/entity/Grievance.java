package com.gov.portal.entity;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "grievances")
public class Grievance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String grievanceId; // GRV-XXXX

    @Column(nullable = false)
    private String citizenUsername;

    @Column(nullable = false)
    private String citizenName;

    @Column(nullable = false)
    private String subject;

    @Column(nullable = false, length = 2000)
    private String description;

    private String category; // REGISTRATION, DOCUMENTS, PAYMENT, GENERAL, TECHNICAL

    private String status; // SUBMITTED, UNDER_REVIEW, RESOLVED, CLOSED

    private String resolution;

    private LocalDateTime submittedAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() { this.submittedAt = LocalDateTime.now(); this.updatedAt = LocalDateTime.now(); }

    @PreUpdate
    protected void onUpdate() { this.updatedAt = LocalDateTime.now(); }

    public Grievance() {}

    public Long getId() { return id; }
    public String getGrievanceId() { return grievanceId; }
    public String getCitizenUsername() { return citizenUsername; }
    public String getCitizenName() { return citizenName; }
    public String getSubject() { return subject; }
    public String getDescription() { return description; }
    public String getCategory() { return category; }
    public String getStatus() { return status; }
    public String getResolution() { return resolution; }
    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public void setId(Long id) { this.id = id; }
    public void setGrievanceId(String grievanceId) { this.grievanceId = grievanceId; }
    public void setCitizenUsername(String citizenUsername) { this.citizenUsername = citizenUsername; }
    public void setCitizenName(String citizenName) { this.citizenName = citizenName; }
    public void setSubject(String subject) { this.subject = subject; }
    public void setDescription(String description) { this.description = description; }
    public void setCategory(String category) { this.category = category; }
    public void setStatus(String status) { this.status = status; }
    public void setResolution(String resolution) { this.resolution = resolution; }
    public void setSubmittedAt(LocalDateTime submittedAt) { this.submittedAt = submittedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
