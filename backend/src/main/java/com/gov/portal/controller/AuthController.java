package com.gov.portal.controller;

import com.gov.portal.dto.AuthRequest;
import com.gov.portal.dto.AuthResponse;
import com.gov.portal.dto.RegisterRequest;
import com.gov.portal.entity.User;
import com.gov.portal.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserService userService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest request) {
        try {
            return ResponseEntity.ok(userService.login(request));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Lightweight external citizen signup — email, password, fullName, dob only. */
    @PostMapping("/signup")
    public ResponseEntity<?> citizenSignup(@RequestBody Map<String, String> body) {
        try {
            String email = body.get("email");
            String password = body.get("password");
            String fullName = body.getOrDefault("fullName", "");
            String dob = body.getOrDefault("dob", "");
            if (email == null || email.isBlank() || password == null || password.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Email and password are required."));
            }
            return ResponseEntity.ok(userService.registerCitizen(email, password, fullName, dob));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Multi-field registration form submission — requires authenticated citizen session. */
    @PostMapping("/submit-registration")
    public ResponseEntity<?> submitRegistration(@RequestBody RegisterRequest request,
                                                 Authentication authentication) {
        try {
            if (authentication == null || !authentication.isAuthenticated()) {
                return ResponseEntity.status(401).body(Map.of("error", "Authentication required to submit registration."));
            }
            User user = userService.submitOfficialRegistration(authentication.getName(), request);
            return ResponseEntity.ok(Map.of(
                    "message", "Registration submitted and assigned to Officer " + user.getAssignedOfficerName() + " for review.",
                    "registrationId", user.getRegistrationId(),
                    "status", user.getStatus(),
                    "assignedOfficer", user.getAssignedOfficerName(),
                    "approvalStage", user.getApprovalStage(),
                    "estimatedDays", user.getEstimatedProcessingDays()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
