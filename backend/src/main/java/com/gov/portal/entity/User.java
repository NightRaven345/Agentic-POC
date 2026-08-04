package com.gov.portal.entity;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String password;

    private String role; // ROLE_USER, ROLE_EMPLOYEE

    private String status; // NOT_SUBMITTED, PENDING, APPROVED, REJECTED

    private Boolean hasSubmittedRegistration = false;

    private String approvalStage; // "Identity & Document Verification Audit", "Officer Finalizing"

    private Integer estimatedProcessingDays;

    private String registrationId; // USR-1042

    private String assignedOfficerUsername; // officer@gov.in
    private String assignedOfficerName;     // Officer Vikram Aditya

    private String firstName;
    private String middleName;
    private String lastName;
    private String dob;
    private String gender;

    private String phone;
    private String email;
    private String pan;

    private String address;
    private String district;
    private String state;
    private String pin;

    private String qualification;
    private String organization;
    private Integer experienceYears;
    private String skills;
    private String emergencyContact;

    private String missingDocuments;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public User() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Boolean getHasSubmittedRegistration() { return hasSubmittedRegistration; }
    public void setHasSubmittedRegistration(Boolean hasSubmittedRegistration) { this.hasSubmittedRegistration = hasSubmittedRegistration; }

    public String getApprovalStage() { return approvalStage; }
    public void setApprovalStage(String approvalStage) { this.approvalStage = approvalStage; }

    public Integer getEstimatedProcessingDays() { return estimatedProcessingDays; }
    public void setEstimatedProcessingDays(Integer estimatedProcessingDays) { this.estimatedProcessingDays = estimatedProcessingDays; }

    public String getRegistrationId() { return registrationId; }
    public void setRegistrationId(String registrationId) { this.registrationId = registrationId; }

    public String getAssignedOfficerUsername() { return assignedOfficerUsername; }
    public void setAssignedOfficerUsername(String assignedOfficerUsername) { this.assignedOfficerUsername = assignedOfficerUsername; }

    public String getAssignedOfficerName() { return assignedOfficerName; }
    public void setAssignedOfficerName(String assignedOfficerName) { this.assignedOfficerName = assignedOfficerName; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getMiddleName() { return middleName; }
    public void setMiddleName(String middleName) { this.middleName = middleName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getDob() { return dob; }
    public void setDob(String dob) { this.dob = dob; }

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPan() { return pan; }
    public void setPan(String pan) { this.pan = pan; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getPin() { return pin; }
    public void setPin(String pin) { this.pin = pin; }

    public String getQualification() { return qualification; }
    public void setQualification(String qualification) { this.qualification = qualification; }

    public String getOrganization() { return organization; }
    public void setOrganization(String organization) { this.organization = organization; }

    public Integer getExperienceYears() { return experienceYears; }
    public void setExperienceYears(Integer experienceYears) { this.experienceYears = experienceYears; }

    public String getSkills() { return skills; }
    public void setSkills(String skills) { this.skills = skills; }

    public String getEmergencyContact() { return emergencyContact; }
    public void setEmergencyContact(String emergencyContact) { this.emergencyContact = emergencyContact; }

    public String getMissingDocuments() { return missingDocuments; }
    public void setMissingDocuments(String missingDocuments) { this.missingDocuments = missingDocuments; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
