package com.gov.portal.service;

import com.gov.portal.config.JwtUtils;
import com.gov.portal.dto.AuthRequest;
import com.gov.portal.dto.AuthResponse;
import com.gov.portal.dto.RegisterRequest;
import com.gov.portal.dto.UserDTO;
import com.gov.portal.entity.Grievance;
import com.gov.portal.entity.Notice;
import com.gov.portal.entity.User;
import com.gov.portal.repository.GrievanceRepository;
import com.gov.portal.repository.NoticeRepository;
import com.gov.portal.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.stream.Collectors;

/**
 * UserService — pure business logic for authentication, registration,
 * citizen management, grievances, and notices.
 *
 * Seed / bootstrap data is handled entirely by {@link DataSeeder}.
 */
@Service
public class UserService {

    @Autowired private UserRepository userRepository;
    @Autowired private NoticeRepository noticeRepository;
    @Autowired private GrievanceRepository grievanceRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtUtils jwtUtils;

    // ── Authentication ────────────────────────────────────────────────────────

    public AuthResponse login(AuthRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
            .orElseThrow(() -> new RuntimeException("Invalid credentials"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Invalid credentials");
        }

        String token = jwtUtils.generateToken(user.getUsername(), user.getRole());

        AuthResponse resp = new AuthResponse();
        resp.setToken(token);
        resp.setUsername(user.getUsername());
        resp.setRole(user.getRole());
        resp.setStatus(user.getStatus());
        resp.setRegistrationId(user.getRegistrationId());
        resp.setFullName(buildFullName(user));
        return resp;
    }

    // ── Citizen Self-Registration ─────────────────────────────────────────────

    /**
     * Simple sign-up: creates a NOT_SUBMITTED account from email + password + name + DOB.
     * Returns a JWT so the citizen is immediately logged in.
     */
    public AuthResponse registerCitizen(String email, String password, String fullName, String dob) {
        if (userRepository.findByUsername(email).isPresent()) {
            throw new RuntimeException("Email address is already registered.");
        }

        User user = new User();
        user.setUsername(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole("ROLE_USER");
        user.setStatus("NOT_SUBMITTED");
        user.setHasSubmittedRegistration(false);

        if (fullName != null && !fullName.isBlank()) {
            String[] parts = fullName.trim().split("\\s+");
            user.setFirstName(parts[0]);
            if (parts.length > 1) user.setLastName(parts[parts.length - 1]);
        }
        user.setDob(dob);
        user.setEmail(email);

        user = userRepository.save(user);

        String token = jwtUtils.generateToken(user.getUsername(), user.getRole());

        AuthResponse resp = new AuthResponse();
        resp.setToken(token);
        resp.setUsername(user.getUsername());
        resp.setRole(user.getRole());
        resp.setStatus(user.getStatus());
        resp.setRegistrationId(user.getRegistrationId());
        resp.setFullName(buildFullName(user));
        return resp;
    }

    /**
     * Alternate simple-signup path: returns the saved User entity directly (used by AuthController).
     */
    public User registerInitialUser(String email, String password, String fullName, String dob) {
        if (userRepository.findByUsername(email).isPresent()) {
            throw new RuntimeException("Email address is already registered.");
        }

        User user = new User();
        user.setUsername(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole("ROLE_USER");
        user.setStatus("NOT_SUBMITTED");
        user.setHasSubmittedRegistration(false);

        if (fullName != null && !fullName.isBlank()) {
            String[] parts = fullName.trim().split("\\s+");
            user.setFirstName(parts[0]);
            if (parts.length > 1) user.setLastName(parts[parts.length - 1]);
        }
        user.setDob(dob);
        user.setEmail(email);

        return userRepository.save(user);
    }

    // ── Official Registration Submission ──────────────────────────────────────

    /**
     * Full registration form submission: promotes the citizen to PENDING status
     * and assigns them to the officer queue.
     */
    public User submitOfficialRegistration(String username, RegisterRequest req) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new RuntimeException("User profile not found."));

        user.setFirstName(req.getFirstName());
        user.setMiddleName(req.getMiddleName());
        user.setLastName(req.getLastName());
        user.setDob(req.getDob());
        user.setGender(req.getGender());
        user.setPhone(req.getPhone());
        user.setEmail(req.getEmail());
        user.setEmergencyContact(req.getEmergencyContact());

        user.setPan(req.getPan());
        user.setAddress(req.getAddress());
        user.setDistrict(req.getDistrict());
        user.setState(req.getState());
        user.setPin(req.getPin());

        user.setQualification(req.getQualification());
        user.setOrganization(req.getOrganization());
        user.setExperienceYears(req.getExperienceYears());
        user.setSkills(req.getSkills());

        user.setStatus("PENDING");
        user.setHasSubmittedRegistration(true);
        user.setApprovalStage("Initial Review");
        user.setEstimatedProcessingDays(5);
        user.setRegistrationId("USR-" + (1000 + new Random().nextInt(9000)));
        user.setAssignedOfficerUsername("officer@gov.in");
        user.setAssignedOfficerName("Officer Vikram Aditya");
        user.setMissingDocuments("Address Verification Copy, PAN Verification Pending");

        return userRepository.save(user);
    }

    public Map<String, Object> submitRegistration(String username, RegisterRequest req) {
        User user = submitOfficialRegistration(username, req);
        return Map.of(
            "status", "PENDING",
            "registrationId", user.getRegistrationId(),
            "assignedOfficer", user.getAssignedOfficerName(),
            "approvalStage", user.getApprovalStage(),
            "estimatedDays", 5
        );
    }

    // ── Officer — Citizen Queries ─────────────────────────────────────────────

    public List<UserDTO> getPendingUsers() {
        return userRepository.findByStatus("PENDING").stream()
            .map(this::toDTO)
            .collect(Collectors.toList());
    }

    public List<UserDTO> getApprovedUsers() {
        return userRepository.findByStatus("APPROVED").stream()
            .filter(u -> "ROLE_USER".equals(u.getRole()))
            .map(this::toDTO)
            .collect(Collectors.toList());
    }

    public List<UserDTO> getRejectedUsers() {
        return userRepository.findByStatus("REJECTED").stream()
            .map(this::toDTO)
            .collect(Collectors.toList());
    }

    public List<UserDTO> searchUsers(String query) {
        if (query == null || query.trim().isEmpty()) {
            return getApprovedUsers();
        }
        String q = query.toLowerCase().trim();
        return userRepository.findAll().stream()
            .filter(u -> "ROLE_USER".equals(u.getRole()))
            .filter(u ->
                (u.getUsername() != null && u.getUsername().toLowerCase().contains(q)) ||
                (u.getFirstName() != null && u.getFirstName().toLowerCase().contains(q)) ||
                (u.getLastName() != null && u.getLastName().toLowerCase().contains(q)) ||
                (u.getPan() != null && u.getPan().toLowerCase().contains(q)) ||
                (u.getPhone() != null && u.getPhone().contains(q)) ||
                (u.getRegistrationId() != null && u.getRegistrationId().toLowerCase().contains(q))
            )
            .map(this::toDTO)
            .collect(Collectors.toList());
    }

    // ── Officer — Application Actions ─────────────────────────────────────────

    public UserDTO approveUser(Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("User not found"));
        user.setStatus("APPROVED");
        user.setApprovalStage("Approved & Active");
        user.setEstimatedProcessingDays(0);
        user.setMissingDocuments("None");
        return toDTO(userRepository.save(user));
    }

    public UserDTO rejectUser(Long id, String reason) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("User not found"));
        user.setStatus("REJECTED");
        user.setApprovalStage("Rejected: " + (reason != null ? reason : "Document Audit Discrepancy"));
        user.setMissingDocuments(reason != null ? reason : "Rejected by Officer");
        return toDTO(userRepository.save(user));
    }

    public Map<String, Object> getDashboardStats() {
        long total    = userRepository.count() - 1; // exclude officer account
        long pending  = userRepository.findByStatus("PENDING").size();
        long approved = userRepository.findByStatus("APPROVED").stream()
                            .filter(u -> "ROLE_USER".equals(u.getRole())).count();
        long rejected = userRepository.findByStatus("REJECTED").size();
        return Map.of(
            "total",    Math.max(0, total),
            "pending",  pending,
            "approved", approved,
            "rejected", rejected
        );
    }

    // ── Lookups ───────────────────────────────────────────────────────────────

    public Optional<UserDTO> getUserById(Long id) {
        return userRepository.findById(id).map(this::toDTO);
    }

    public UserDTO getUserDTOById(Long id) {
        return userRepository.findById(id).map(this::toDTO).orElse(null);
    }

    /** Returns Optional&lt;UserDTO&gt; — never exposes the raw entity or password. */
    public Optional<UserDTO> getUserByUsername(String username) {
        return userRepository.findByUsername(username).map(this::toDTO);
    }

    // ── Grievances ────────────────────────────────────────────────────────────

    public Grievance submitGrievance(String username, String category, String subject, String description) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new RuntimeException("User not found"));

        Grievance g = new Grievance();
        g.setGrievanceId("GRV-" + (1000 + new Random().nextInt(9000)));
        g.setCitizenUsername(username);
        g.setCitizenName(buildFullName(user));
        g.setCategory(category);
        g.setSubject(subject);
        g.setDescription(description);
        g.setStatus("SUBMITTED");
        return grievanceRepository.save(g);
    }

    public List<Grievance> getUserGrievances(String username) {
        return grievanceRepository.findByCitizenUsernameOrderBySubmittedAtDesc(username);
    }

    // ── Notices ───────────────────────────────────────────────────────────────

    public List<Notice> getAllNotices() {
        return noticeRepository.findAll();
    }

    // ── DTO Conversion ────────────────────────────────────────────────────────

    public UserDTO toDTO(User u) {
        return UserDTO.fromUser(u);
    }

    private String buildFullName(User u) {
        StringBuilder sb = new StringBuilder();
        if (u.getFirstName() != null) sb.append(u.getFirstName());
        if (u.getMiddleName() != null && !u.getMiddleName().isBlank())
            sb.append(" ").append(u.getMiddleName());
        if (u.getLastName() != null) sb.append(" ").append(u.getLastName());
        return sb.toString().trim();
    }
}
