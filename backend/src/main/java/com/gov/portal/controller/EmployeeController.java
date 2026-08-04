package com.gov.portal.controller;

import com.gov.portal.dto.UserDTO;
import com.gov.portal.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/employee")
public class EmployeeController {

    @Autowired
    private UserService userService;

    /** All pending citizen registration tasks assigned to officer dashboard. */
    @GetMapping("/pending")
    public ResponseEntity<List<UserDTO>> getPendingApplications() {
        return ResponseEntity.ok(userService.getPendingUsers());
    }

    /** All approved citizens — used by AI backend for duplicate detection. */
    @GetMapping("/approved")
    public ResponseEntity<List<UserDTO>> getApprovedApplications() {
        return ResponseEntity.ok(userService.getApprovedUsers());
    }

    /** All rejected applications. */
    @GetMapping("/rejected")
    public ResponseEntity<List<UserDTO>> getRejectedApplications() {
        return ResponseEntity.ok(userService.getRejectedUsers());
    }

    /** Get a specific application by internal ID. */
    @GetMapping("/application/{id}")
    public ResponseEntity<UserDTO> getApplicationDetails(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserDTOById(id));
    }

    /** Approve a pending registration — returns updated DTO. */
    @PostMapping("/approve/{id}")
    public ResponseEntity<?> approveApplication(@PathVariable Long id) {
        try {
            UserDTO approved = userService.approveUser(id);
            return ResponseEntity.ok(Map.of(
                    "message", "Registration approved for " + approved.getFirstName() + " " + approved.getLastName(),
                    "registrationId", approved.getRegistrationId(),
                    "status", "APPROVED"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Reject a pending registration with optional reason. */
    @PostMapping("/reject/{id}")
    public ResponseEntity<?> rejectApplication(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        try {
            String reason = body != null ? body.get("reason") : null;
            UserDTO rejected = userService.rejectUser(id, reason);
            return ResponseEntity.ok(Map.of(
                    "message", "Registration rejected for " + rejected.getFirstName() + " " + rejected.getLastName(),
                    "registrationId", rejected.getRegistrationId(),
                    "status", "REJECTED"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Search citizens by name, email, PAN, phone, or registration ID. */
    @GetMapping("/search")
    public ResponseEntity<List<UserDTO>> searchUsers(@RequestParam String query) {
        return ResponseEntity.ok(userService.searchUsers(query));
    }

    /** Dashboard statistics — total, pending, approved, rejected counts. */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        return ResponseEntity.ok(userService.getDashboardStats());
    }
}
