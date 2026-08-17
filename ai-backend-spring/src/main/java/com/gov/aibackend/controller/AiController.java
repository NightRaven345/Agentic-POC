package com.gov.aibackend.controller;

import com.gov.aibackend.dto.ChatRequest;
import com.gov.aibackend.dto.ChatResponse;
import com.gov.aibackend.dto.DuplicateCheckRequest;
import com.gov.aibackend.mcp.BackendToolRegistry;
import com.gov.aibackend.agent.DuplicateDetectionAgent;
import com.gov.aibackend.service.AgentOrchestrator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.*;

/**
 * REST Controller — exposes all 5 AI API endpoints.
 *
 * Mirrors the Python FastAPI routes in main.py exactly:
 *   GET  /health
 *   GET  /api/ai/capabilities
 *   POST /api/ai/chat
 *   POST /api/ai/chat/stream
 *   POST /api/ai/duplicate-check
 */
@RestController
@CrossOrigin(origins = "*")
public class AiController {

    private final AgentOrchestrator orchestrator;
    private final BackendToolRegistry mcpTools;
    private final DuplicateDetectionAgent duplicateAgent;

    @Value("${spring.ai.ollama.chat.model:gemma4:31b}")
    private String llmModel;

    public AiController(AgentOrchestrator orchestrator,
                        BackendToolRegistry mcpTools,
                        DuplicateDetectionAgent duplicateAgent) {
        this.orchestrator = orchestrator;
        this.mcpTools = mcpTools;
        this.duplicateAgent = duplicateAgent;
    }

    // ── GET /health ───────────────────────────────────────────────────────────

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "UP");
        response.put("service", "AI Microservice (Spring AI)");
        response.put("llm_provider", "ollama");
        response.put("llm_model", llmModel);
        response.put("version", "2.0.0");
        return response;
    }

    // ── GET /api/ai/capabilities ──────────────────────────────────────────────

    @GetMapping("/api/ai/capabilities")
    public Map<String, Object> getCapabilities(
            @RequestParam(value = "role", defaultValue = "PUBLIC") String role) {
        return orchestrator.getRoleCapabilities(role);
    }

    // ── POST /api/ai/chat ─────────────────────────────────────────────────────

    @PostMapping("/api/ai/chat")
    public ChatResponse chat(
            @RequestBody ChatRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        String token = extractToken(authorization);
        return orchestrator.processAgentChat(request, token);
    }

    // ── POST /api/ai/chat/stream ──────────────────────────────────────────────
    // Returns NDJSON: each line is a JSON object {"type":"metadata"|"token", ...}

    @PostMapping(value = "/api/ai/chat/stream", produces = MediaType.APPLICATION_NDJSON_VALUE)
    public Flux<String> chatStream(
            @RequestBody ChatRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        String token = extractToken(authorization);
        return orchestrator.processAgentChatStream(request, token);
    }

    // ── POST /api/ai/duplicate-check ──────────────────────────────────────────

    @PostMapping("/api/ai/duplicate-check")
    public Map<String, Object> duplicateCheck(
            @RequestBody DuplicateCheckRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        String token = extractToken(authorization);
        List<Map<String, Object>> approvedUsers = mcpTools.getApprovedUsers(token);

        DuplicateDetectionAgent.LlmCaller llmCaller = null; // standalone endpoint: no LLM caller wired here
        // (LLM scoring handled inside orchestrator when called via /chat)

        return duplicateAgent.runDuplicateDetection(
            request.getTargetUser(), approvedUsers, llmCaller
        );
    }

    // ── Utility ───────────────────────────────────────────────────────────────

    private String extractToken(String authorization) {
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authorization.substring(7);
        }
        return null;
    }
}
