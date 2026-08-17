package com.gov.aibackend.mcp;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;

import java.util.*;

/**
 * Port of mcp/fastmcp_server.py — FastMCPToolRegistry
 *
 * Calls the Spring Boot backend at :8080 to fetch live data.
 * All tools pass the user's JWT token for authorization, with
 * automatic officer service token fallback (same as Python).
 */
@Component
public class BackendToolRegistry {

    @Value("${app.spring-backend-url:http://localhost:8080}")
    private String backendUrl;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    // Cached officer service token (mirrors Python class-level _service_token)
    private static volatile String serviceToken = null;

    // ── Officer service token ─────────────────────────────────────────────────

    private String getServiceToken() {
        if (serviceToken != null) return serviceToken;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            Map<String, String> body = Map.of("username", "officer@gov.in", "password", "Officer@123");
            ResponseEntity<Map> resp = restTemplate.exchange(
                backendUrl + "/api/auth/login",
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                Map.class
            );
            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                serviceToken = (String) resp.getBody().get("token");
                return serviceToken;
            }
        } catch (Exception e) {
            System.err.println("[BackendToolRegistry] Failed to obtain service token: " + e.getMessage());
        }
        return null;
    }

    // ── Generic GET helper ────────────────────────────────────────────────────

    private <T> T get(String endpoint, String token, Class<T> type) {
        String effectiveToken = (token != null && !token.isBlank()) ? token : getServiceToken();
        try {
            HttpHeaders headers = new HttpHeaders();
            if (effectiveToken != null) headers.setBearerAuth(effectiveToken);
            ResponseEntity<T> resp = restTemplate.exchange(
                backendUrl + endpoint, HttpMethod.GET,
                new HttpEntity<>(headers), type
            );
            if (resp.getStatusCode().is2xxSuccessful()) return resp.getBody();

            // 401 retry with service token
            if (resp.getStatusCode() == HttpStatus.UNAUTHORIZED && token != null) {
                String svcTok = getServiceToken();
                if (svcTok != null) {
                    HttpHeaders h2 = new HttpHeaders();
                    h2.setBearerAuth(svcTok);
                    ResponseEntity<T> resp2 = restTemplate.exchange(
                        backendUrl + endpoint, HttpMethod.GET,
                        new HttpEntity<>(h2), type
                    );
                    if (resp2.getStatusCode().is2xxSuccessful()) return resp2.getBody();
                }
            }
        } catch (Exception e) {
            System.err.println("[BackendToolRegistry] GET " + endpoint + " failed: " + e.getMessage());
        }
        return null;
    }

    // ── Employee-only tools ───────────────────────────────────────────────────

    /** Search citizens by name, email, PAN, phone, or registration ID. */
    public List<Map<String, Object>> searchCitizen(String query, String token) {
        try {
            String url = backendUrl + "/api/employee/search?query=" + encode(query);
            String effectiveToken = (token != null && !token.isBlank()) ? token : getServiceToken();
            HttpHeaders headers = new HttpHeaders();
            if (effectiveToken != null) headers.setBearerAuth(effectiveToken);
            ResponseEntity<List> resp = restTemplate.exchange(
                url, HttpMethod.GET, new HttpEntity<>(headers), List.class
            );
            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                return toListOfMaps(resp.getBody());
            }
        } catch (Exception e) {
            System.err.println("[BackendToolRegistry] searchCitizen failed: " + e.getMessage());
        }
        return Collections.emptyList();
    }

    /** Fetch all PENDING citizen applications. */
    public List<Map<String, Object>> getPendingUsers(String token) {
        List raw = get("/api/employee/pending", token, List.class);
        return raw != null ? toListOfMaps(raw) : Collections.emptyList();
    }

    /** Fetch all APPROVED citizens (used as duplicate detection baseline). */
    public List<Map<String, Object>> getApprovedUsers(String token) {
        List raw = get("/api/employee/approved", token, List.class);
        return raw != null ? toListOfMaps(raw) : Collections.emptyList();
    }

    /** Fetch all REJECTED citizen applications. */
    public List<Map<String, Object>> getRejectedUsers(String token) {
        List raw = get("/api/employee/rejected", token, List.class);
        return raw != null ? toListOfMaps(raw) : Collections.emptyList();
    }

    /** Fetch dashboard aggregate statistics. */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getDashboardStats(String token) {
        Map raw = get("/api/employee/stats", token, Map.class);
        return raw != null ? (Map<String, Object>) raw : Collections.emptyMap();
    }

    // ── Citizen self-service tools ────────────────────────────────────────────

    /** Fetch the authenticated citizen's own profile. */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getMyProfile(String token) {
        Map raw = get("/api/user/me", token, Map.class);
        return raw != null ? (Map<String, Object>) raw : Collections.emptyMap();
    }

    /** Fetch the authenticated citizen's own grievances. */
    public List<Map<String, Object>> getMyGrievances(String token) {
        List raw = get("/api/user/grievances", token, List.class);
        return raw != null ? toListOfMaps(raw) : Collections.emptyList();
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> toListOfMaps(List raw) {
        try {
            String json = mapper.writeValueAsString(raw);
            return mapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private String encode(String s) {
        try { return java.net.URLEncoder.encode(s, "UTF-8"); }
        catch (Exception e) { return s; }
    }
}
