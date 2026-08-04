package com.gov.portal.controller;

import com.gov.portal.dto.UserDTO;
import com.gov.portal.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/workflow")
public class WorkflowController {

    @Autowired
    private UserService userService;

    @GetMapping("/my-status")
    public ResponseEntity<?> getMyStatus(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        String username = authentication.getName();
        UserDTO user = userService.getUserByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        return ResponseEntity.ok(Map.of(
                "registrationId", user.getRegistrationId() != null ? user.getRegistrationId() : "N/A",
                "status", user.getStatus() != null ? user.getStatus() : "NOT_SUBMITTED",
                "approvalStage", user.getApprovalStage() != null ? user.getApprovalStage() : "Pending Initial Audit",
                "estimatedProcessingDays", user.getEstimatedProcessingDays() != null ? user.getEstimatedProcessingDays() : 3,
                "missingDocuments", user.getMissingDocuments() != null ? user.getMissingDocuments() : "None",
                "fullName", (user.getFirstName() != null ? user.getFirstName() : "") + " " + (user.getLastName() != null ? user.getLastName() : ""),
                "email", user.getEmail() != null ? user.getEmail() : "",
                "phone", user.getPhone() != null ? user.getPhone() : ""
        ));
    }

    @GetMapping("/my-profile")
    public ResponseEntity<?> getMyProfile(Authentication authentication) {
        if (authentication == null) return ResponseEntity.status(401).build();
        UserDTO user = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(user);
    }
}
