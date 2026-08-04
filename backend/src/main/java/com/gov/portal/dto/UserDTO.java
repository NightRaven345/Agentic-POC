package com.gov.portal.dto;

import com.gov.portal.entity.User;

public class UserDTO {
    private Long id;
    private String username;
    private String role;
    private String status;
    private String registrationId;
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
    private String approvalStage;
    private Integer estimatedProcessingDays;
    private String missingDocuments;
    private String assignedOfficerName;
    private String assignedOfficerUsername;

    public static UserDTO fromUser(User u) {
        if (u == null) return null;
        UserDTO dto = new UserDTO();
        dto.id = u.getId();
        dto.username = u.getUsername();
        dto.role = u.getRole();
        dto.status = u.getStatus();
        dto.registrationId = u.getRegistrationId();
        dto.firstName = u.getFirstName();
        dto.middleName = u.getMiddleName();
        dto.lastName = u.getLastName();
        dto.dob = u.getDob();
        dto.gender = u.getGender();
        dto.phone = u.getPhone();
        dto.email = u.getEmail();
        dto.pan = u.getPan();
        dto.address = u.getAddress();
        dto.district = u.getDistrict();
        dto.state = u.getState();
        dto.pin = u.getPin();
        dto.qualification = u.getQualification();
        dto.organization = u.getOrganization();
        dto.experienceYears = u.getExperienceYears();
        dto.skills = u.getSkills();
        dto.emergencyContact = u.getEmergencyContact();
        dto.approvalStage = u.getApprovalStage();
        dto.estimatedProcessingDays = u.getEstimatedProcessingDays();
        dto.missingDocuments = u.getMissingDocuments();
        dto.assignedOfficerName = u.getAssignedOfficerName();
        dto.assignedOfficerUsername = u.getAssignedOfficerUsername();
        return dto;
    }

    // Getters
    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getRole() { return role; }
    public String getStatus() { return status; }
    public String getRegistrationId() { return registrationId; }
    public String getFirstName() { return firstName; }
    public String getMiddleName() { return middleName; }
    public String getLastName() { return lastName; }
    public String getDob() { return dob; }
    public String getGender() { return gender; }
    public String getPhone() { return phone; }
    public String getEmail() { return email; }
    public String getPan() { return pan; }
    public String getAddress() { return address; }
    public String getDistrict() { return district; }
    public String getState() { return state; }
    public String getPin() { return pin; }
    public String getQualification() { return qualification; }
    public String getOrganization() { return organization; }
    public Integer getExperienceYears() { return experienceYears; }
    public String getSkills() { return skills; }
    public String getEmergencyContact() { return emergencyContact; }
    public String getApprovalStage() { return approvalStage; }
    public Integer getEstimatedProcessingDays() { return estimatedProcessingDays; }
    public String getMissingDocuments() { return missingDocuments; }
    public String getAssignedOfficerName() { return assignedOfficerName; }
    public String getAssignedOfficerUsername() { return assignedOfficerUsername; }
}
