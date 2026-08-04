package com.gov.portal.controller;

import com.gov.portal.dto.UserDTO;
import com.gov.portal.entity.Grievance;
import com.gov.portal.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/user")
public class UserController {

    @Autowired
    private UserService userService;

    /** Get the authenticated citizen's own profile — never returns password. */
    @GetMapping("/me")
    public ResponseEntity<?> getMyProfile(Authentication authentication) {
        try {
            UserDTO dto = userService.getUserByUsername(authentication.getName())
                    .orElseThrow(() -> new RuntimeException("User not found"));
            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Submit a new grievance for the authenticated citizen. */
    @PostMapping("/grievance")
    public ResponseEntity<?> submitGrievance(@RequestBody Map<String, String> body,
                                              Authentication authentication) {
        try {
            if (body.get("subject") == null || body.get("subject").isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Grievance subject is required."));
            }
            if (body.get("description") == null || body.get("description").isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Grievance description is required."));
            }
            String category = body.getOrDefault("category", "GENERAL");
            String subject = body.get("subject");
            String description = body.get("description");
            Grievance g = userService.submitGrievance(authentication.getName(), category, subject, description);
            return ResponseEntity.ok(Map.of(
                    "message", "Grievance submitted successfully.",
                    "grievanceId", g.getGrievanceId(),
                    "status", g.getStatus()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Get the authenticated citizen's own grievances. */
    @GetMapping("/grievances")
    public ResponseEntity<List<Grievance>> getMyGrievances(Authentication authentication) {
        return ResponseEntity.ok(userService.getUserGrievances(authentication.getName()));
    }
}
