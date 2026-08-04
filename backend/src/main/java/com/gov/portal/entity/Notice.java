package com.gov.portal.entity;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "notices")
public class Notice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, length = 2000)
    private String content;

    private String category; // CIRCULAR, TENDER, ANNOUNCEMENT, GUIDELINE

    private String issuedBy; // Ministry or department name

    private String referenceNumber;

    private String effectiveDate;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() { this.createdAt = LocalDateTime.now(); }

    public Notice() {}

    public Notice(String title, String content, String category, String issuedBy, String referenceNumber, String effectiveDate) {
        this.title = title;
        this.content = content;
        this.category = category;
        this.issuedBy = issuedBy;
        this.referenceNumber = referenceNumber;
        this.effectiveDate = effectiveDate;
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getContent() { return content; }
    public String getCategory() { return category; }
    public String getIssuedBy() { return issuedBy; }
    public String getReferenceNumber() { return referenceNumber; }
    public String getEffectiveDate() { return effectiveDate; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setId(Long id) { this.id = id; }
    public void setTitle(String title) { this.title = title; }
    public void setContent(String content) { this.content = content; }
    public void setCategory(String category) { this.category = category; }
    public void setIssuedBy(String issuedBy) { this.issuedBy = issuedBy; }
    public void setReferenceNumber(String referenceNumber) { this.referenceNumber = referenceNumber; }
    public void setEffectiveDate(String effectiveDate) { this.effectiveDate = effectiveDate; }
}
