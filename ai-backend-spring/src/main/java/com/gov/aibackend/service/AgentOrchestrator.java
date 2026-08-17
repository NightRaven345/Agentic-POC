package com.gov.aibackend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gov.aibackend.agent.DuplicateDetectionAgent;
import com.gov.aibackend.agent.IntentClassifier;
import com.gov.aibackend.agent.KnowledgeBase;
import com.gov.aibackend.dto.ChatRequest;
import com.gov.aibackend.dto.ChatResponse;
import com.gov.aibackend.mcp.BackendToolRegistry;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Port of agents/langgraph_workflow.py
 *
 * Main Agentic Orchestrator.
 * Flow: Permission Check → Intent Classification → Tool Invocation → LLM Generation.
 */
@Service
public class AgentOrchestrator {

    private final IntentClassifier intentClassifier;
    private final DuplicateDetectionAgent duplicateAgent;
    private final KnowledgeBase knowledgeBase;
    private final BackendToolRegistry mcpTools;
    private final OllamaChatModel chatModel;
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${spring.ai.ollama.chat.model:gemma4:31b}")
    private String llmModel;

    @Value("${spring.ai.ollama.base-url:https://ollama.com/api}")
    private String ollamaBaseUrl;

    public AgentOrchestrator(IntentClassifier intentClassifier,
                              DuplicateDetectionAgent duplicateAgent,
                              KnowledgeBase knowledgeBase,
                              BackendToolRegistry mcpTools,
                              OllamaChatModel chatModel) {
        this.intentClassifier = intentClassifier;
        this.duplicateAgent = duplicateAgent;
        this.knowledgeBase = knowledgeBase;
        this.mcpTools = mcpTools;
        this.chatModel = chatModel;
    }

    // ── get_role_capabilities (port of get_role_capabilities) ─────────────────

    public Map<String, Object> getRoleCapabilities(String role) {
        String normalized = (role != null ? role : "PUBLIC").toUpperCase();

        if ("ROLE_EMPLOYEE".equals(normalized)) {
            return Map.of(
                "level", "3. Officer AI (Enterprise Intelligence)",
                "available", List.of(
                    Map.of("name", "FAQ Assistant", "desc", "Semantic FAQ search"),
                    Map.of("name", "RAG Knowledge Base", "desc", "Government policy & SRS documents"),
                    Map.of("name", "Citizen Lookup", "desc", "Search any citizen by name, PAN, phone, email, or Reg ID"),
                    Map.of("name", "SQL Stats Tool", "desc", "Live dashboard statistics from database"),
                    Map.of("name", "Duplicate Detection", "desc", "Multi-field AI similarity engine"),
                    Map.of("name", "Pending Queue Tool", "desc", "List assigned officer verification tasks"),
                    Map.of("name", "Approval Workflow", "desc", "Context-aware decision recommendations")
                ),
                "unavailable", List.of(),
                "allowed_intents", List.of("FAQ", "RAG", "SQL", "CITIZEN_LOOKUP", "DUPLICATE_DETECTION", "WORKFLOW", "GENERAL")
            );
        } else if ("ROLE_USER".equals(normalized)) {
            return Map.of(
                "level", "2. Citizen AI (Workflow Assistant)",
                "available", List.of(
                    Map.of("name", "FAQ Assistant", "desc", "Portal guidelines & FAQs"),
                    Map.of("name", "My Registration Status", "desc", "Live approval stage & estimated timeline"),
                    Map.of("name", "My Documents", "desc", "Missing document checklist"),
                    Map.of("name", "My Grievances", "desc", "Track submitted grievances")
                ),
                "unavailable", List.of(
                    Map.of("name", "Search Other Citizens", "desc", "Officer restricted feature"),
                    Map.of("name", "Duplicate Detection", "desc", "Officer restricted feature"),
                    Map.of("name", "Database SQL Queries", "desc", "Officer restricted feature")
                ),
                "allowed_intents", List.of("FAQ", "RAG", "WORKFLOW", "GENERAL")
            );
        } else {
            return Map.of(
                "level", "1. Public AI (FAQ Assistant)",
                "available", List.of(
                    Map.of("name", "FAQ Assistant", "desc", "Semantic FAQ matching"),
                    Map.of("name", "Public Policies & SRS", "desc", "RAG document search"),
                    Map.of("name", "Registration Guidelines", "desc", "Step-by-step process help")
                ),
                "unavailable", List.of(
                    Map.of("name", "Registration Status", "desc", "Requires Citizen login"),
                    Map.of("name", "Citizen Data Access", "desc", "Requires login"),
                    Map.of("name", "Workflow & SQL Tools", "desc", "Requires login")
                ),
                "allowed_intents", List.of("FAQ", "RAG", "GENERAL")
            );
        }
    }

    // ── process_agent_chat (sync) ─────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public ChatResponse processAgentChat(ChatRequest request, String authToken) {
        String role = request.getRole();
        String userMessage = request.getMessage();
        Map<String, Object> userDetails = request.getUserDetails();
        Map<String, Object> activeContext = request.getActiveAppContext();

        Map<String, Object> capabilities = getRoleCapabilities(role);
        String intent = intentClassifier.classify(userMessage, activeContext, role);

        // ── 1. PERMISSION CHECK ────────────────────────────────────────────────
        List<String> allowedIntents = (List<String>) capabilities.get("allowed_intents");
        if (!allowedIntents.contains(intent)) {
            String roleLabel = roleLabel(role);
            String level = (String) capabilities.get("level");
            return new ChatResponse(intent, role, false,
                "🔒 **Access Restricted for " + roleLabel + "**\n\n" +
                "Your current AI intelligence level **(" + level + ")** " +
                "does not permit accessing the **" + intent.replace("_", " ") + "** tool.\n\n" +
                "*Please log in with appropriate credentials to unlock higher-tier AI capabilities.*",
                List.of(), false, "ollama", llmModel);
        }

        // ── 2. TOOL INVOCATION ────────────────────────────────────────────────
        List<String> toolsUsed = new ArrayList<>();
        boolean contextUsed = false;
        String retrievedDataStr = "";
        Map<String, Object> toolMetadata = new HashMap<>();

        ToolResult toolResult = invokeTool(intent, userMessage, authToken, activeContext, userDetails,
                                            toolsUsed, contextUsed, retrievedDataStr, toolMetadata);
        toolsUsed = toolResult.toolsUsed;
        contextUsed = toolResult.contextUsed;
        retrievedDataStr = toolResult.retrievedDataStr;
        toolMetadata = toolResult.toolMetadata;

        // ── 3. BUILD SYSTEM PROMPT ─────────────────────────────────────────────
        String systemPrompt = buildSystemPrompt(role, capabilities, intent, toolsUsed,
                                                 activeContext, retrievedDataStr, userDetails);

        // ── 4. LLM CALL ────────────────────────────────────────────────────────
        int maxTokens = "PUBLIC".equalsIgnoreCase(role) ? 600 : 2500;
        String responseText;

        try {
            String llmContent = callLlm(systemPrompt, userMessage, 0.3, maxTokens);
            if (llmContent != null && !llmContent.isBlank()) {
                responseText = llmContent;
            } else {
                responseText = synthesizeFallback(intent, role, retrievedDataStr, activeContext, userDetails, toolMetadata);
            }
        } catch (Exception e) {
            System.err.println("[AgentOrchestrator] LLM call failed: " + e.getMessage());
            responseText = synthesizeFallback(intent, role, retrievedDataStr, activeContext, userDetails, toolMetadata);
        }

        return new ChatResponse(intent, role, true, responseText, toolsUsed, contextUsed, "ollama", llmModel);
    }

    // ── process_agent_chat_stream ─────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public Flux<String> processAgentChatStream(ChatRequest request, String authToken) {
        String role = request.getRole();
        String userMessage = request.getMessage();
        Map<String, Object> userDetails = request.getUserDetails();
        Map<String, Object> activeContext = request.getActiveAppContext();

        Map<String, Object> capabilities = getRoleCapabilities(role);
        String intent = intentClassifier.classify(userMessage, activeContext, role);

        List<String> allowedIntents = (List<String>) capabilities.get("allowed_intents");

        // Permission denied
        if (!allowedIntents.contains(intent)) {
            String roleLabel = roleLabel(role);
            String level = (String) capabilities.get("level");
            String restrictedMsg =
                "🔒 **Access Restricted for " + roleLabel + "**\n\n" +
                "Your current AI intelligence level **(" + level + ")** " +
                "does not permit accessing the **" + intent.replace("_", " ") + "** tool.\n\n" +
                "*Please log in with appropriate credentials to unlock higher-tier AI capabilities.*";

            Map<String, Object> metaEvent = new LinkedHashMap<>();
            metaEvent.put("type", "metadata");
            metaEvent.put("intent", intent);
            metaEvent.put("role", role);
            metaEvent.put("allowed", false);
            metaEvent.put("tools_used", List.of());
            metaEvent.put("active_context_used", false);
            metaEvent.put("llm_provider", "ollama");
            metaEvent.put("llm_model", llmModel);

            return Flux.just(toJson(metaEvent) + "\n", toJson(Map.of("type", "token", "content", restrictedMsg)) + "\n");
        }

        // Invoke tools
        List<String> toolsUsed = new ArrayList<>();
        boolean[] contextUsedRef = {false};
        String[] retrievedDataRef = {""};
        Map<String, Object>[] toolMetaRef = new Map[]{new HashMap<>()};

        ToolResult toolResult = invokeTool(intent, userMessage, authToken, activeContext, userDetails,
                                            toolsUsed, contextUsedRef[0], retrievedDataRef[0], toolMetaRef[0]);
        List<String> finalToolsUsed = toolResult.toolsUsed;
        boolean finalContextUsed = toolResult.contextUsed;
        String finalRetrievedData = toolResult.retrievedDataStr;
        Map<String, Object> finalToolMeta = toolResult.toolMetadata;

        // Build metadata event
        Map<String, Object> metaEvent = new LinkedHashMap<>();
        metaEvent.put("type", "metadata");
        metaEvent.put("intent", intent);
        metaEvent.put("role", role);
        metaEvent.put("allowed", true);
        metaEvent.put("tools_used", finalToolsUsed);
        metaEvent.put("active_context_used", finalContextUsed);
        metaEvent.put("llm_provider", "ollama");
        metaEvent.put("llm_model", llmModel);

        String metaLine = toJson(metaEvent) + "\n";
        String systemPrompt = buildSystemPrompt(role, capabilities, intent, finalToolsUsed,
                                                 activeContext, finalRetrievedData, userDetails);
        int maxTokens = "PUBLIC".equalsIgnoreCase(role) ? 600 : 2500;

        // Stream from LLM, fall back to chunked synthesis if nothing arrives
        Flux<String> llmStream = streamFromLlm(systemPrompt, userMessage, 0.3, maxTokens, intent, role,
                                                finalRetrievedData, activeContext, userDetails, finalToolMeta);

        return Flux.concat(Flux.just(metaLine), llmStream);
    }

    // ── Tool invocation dispatcher ────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private ToolResult invokeTool(String intent, String userMessage, String authToken,
                                   Map<String, Object> activeContext, Map<String, Object> userDetails,
                                   List<String> toolsUsed, boolean contextUsed,
                                   String retrievedDataStr, Map<String, Object> toolMetadata) {

        toolsUsed = new ArrayList<>(toolsUsed);

        if ("DUPLICATE_DETECTION".equals(intent)) {
            toolsUsed.add("DuplicateDetectionTool");
            Map<String, Object> targetApp = activeContext;
            if (targetApp == null) {
                List<Map<String, Object>> pendings = mcpTools.getPendingUsers(authToken);
                String retrievedData = toJson(Map.of(
                    "message", "No active application context. Please click 'Inspect Task' on a pending registration.",
                    "pending_count", pendings.size()
                ));
                return new ToolResult(toolsUsed, false, retrievedData, toolMetadata);
            }
            contextUsed = true;
            toolsUsed.add("ApprovedUsersFetchTool");
            List<Map<String, Object>> approvedUsers = mcpTools.getApprovedUsers(authToken);

            // Pass LLM caller to duplicate agent
            DuplicateDetectionAgent.LlmCaller llmCaller = (sys, usr, temp) -> {
                try { return callLlm(sys, usr, temp, 500); }
                catch (Exception e) { return null; }
            };
            Map<String, Object> dupResult = duplicateAgent.runDuplicateDetection(targetApp, approvedUsers, llmCaller);
            toolMetadata = dupResult;

            String tName = str(targetApp.get("firstName")) + " " + str(targetApp.get("lastName"));
            retrievedDataStr = toJson(Map.of(
                "target_application", Map.of(
                    "name", tName.trim(),
                    "registrationId", targetApp.getOrDefault("registrationId", "N/A"),
                    "pan", targetApp.getOrDefault("pan", "N/A"),
                    "phone", targetApp.getOrDefault("phone", "N/A"),
                    "email", targetApp.getOrDefault("email", "N/A"),
                    "organization", targetApp.getOrDefault("organization", "N/A")
                ),
                "duplicate_detection_result", dupResult,
                "total_approved_citizens_checked", approvedUsers.size()
            ));

        } else if ("CITIZEN_LOOKUP".equals(intent)) {
            CitizenLookupResult lookup = executeCitizenLookup(userMessage, authToken, activeContext);
            toolsUsed.addAll(lookup.toolsUsed);
            contextUsed = lookup.contextUsed;
            retrievedDataStr = lookup.retrievedDataStr;

        } else if ("SQL".equals(intent)) {
            toolsUsed.add("SQLStatsTool");
            Map<String, Object> stats = mcpTools.getDashboardStats(authToken);
            List<Map<String, Object>> pendings = mcpTools.getPendingUsers(authToken);
            List<Map<String, Object>> approved = mcpTools.getApprovedUsers(authToken);
            retrievedDataStr = toJson(Map.of(
                "dashboard_statistics", stats,
                "pending_applications", pendings,
                "approved_citizens_count", approved.size()
            ));

        } else if ("WORKFLOW".equals(intent)) {
            toolsUsed.add("WorkflowStatusTool");
            if (authToken != null) {
                Map<String, Object> profile = mcpTools.getMyProfile(authToken);
                if (profile != null && !profile.isEmpty()) {
                    contextUsed = true;
                    List<Map<String, Object>> grievances = mcpTools.getMyGrievances(authToken);
                    retrievedDataStr = toJson(Map.of("citizen_profile", profile, "grievances", grievances));
                } else if (userDetails != null) {
                    retrievedDataStr = toJson(Map.of("citizen_details", userDetails));
                }
            } else if (userDetails != null) {
                retrievedDataStr = toJson(Map.of("citizen_details", userDetails));
            }

        } else if ("FAQ".equals(intent)) {
            toolsUsed.add("SemanticFAQTool");
            retrievedDataStr = toJson(knowledgeBase.searchFaq(userMessage));

        } else {
            toolsUsed.add("ChromaDB_RAG_Tool");
            retrievedDataStr = toJson(knowledgeBase.searchRag(userMessage));
        }

        return new ToolResult(toolsUsed, contextUsed, retrievedDataStr, toolMetadata);
    }

    // ── Citizen Lookup logic ──────────────────────────────────────────────────

    private CitizenLookupResult executeCitizenLookup(String userMessage, String authToken,
                                                       Map<String, Object> activeContext) {
        List<String> toolsUsed = new ArrayList<>();
        toolsUsed.add("CitizenLookupTool");
        boolean contextUsed = false;

        List<Map<String, Object>> approvedList = mcpTools.getApprovedUsers(authToken);
        List<Map<String, Object>> pendingList = mcpTools.getPendingUsers(authToken);
        List<Map<String, Object>> rejectedList = mcpTools.getRejectedUsers(authToken);

        List<Map<String, Object>> allCitizens = new ArrayList<>();
        allCitizens.addAll(approvedList);
        allCitizens.addAll(pendingList);
        allCitizens.addAll(rejectedList);

        String msg = userMessage.toLowerCase();
        boolean isApprovedQuery = containsAny(msg, "approved citizen","approved user","approved list","verified citizens","show approved","list approved","all approved","approved");
        boolean isPendingQuery = containsAny(msg, "pending citizen","pending application","pending queue","pending list","show pending","list pending","unapproved","pending");
        boolean isContextRef = activeContext != null && containsAny(msg, "this guy","this applicant","this user","this person","this citizen","this record","current applicant","current user","his","her","he","she");

        List<Map<String, Object>> results = new ArrayList<>();

        if (isContextRef && activeContext != null) {
            contextUsed = true;
            toolsUsed.add("ActiveContextLookupTool");
            String targetPan = str(activeContext.get("pan"));
            String targetReg = str(activeContext.get("registrationId"));
            String targetEmail = str(activeContext.get("email"));
            for (Map<String, Object> c : allCitizens) {
                if ((!targetPan.isEmpty() && targetPan.equals(str(c.get("pan")))) ||
                    (!targetReg.isEmpty() && targetReg.equals(str(c.get("registrationId")))) ||
                    (!targetEmail.isEmpty() && targetEmail.equals(str(c.get("email"))))) {
                    results.add(c);
                }
            }
            if (results.isEmpty()) results.add(activeContext);

        } else if (isApprovedQuery && isPendingQuery) {
            toolsUsed.add("ApprovedCitizensFetchTool");
            toolsUsed.add("PendingQueueFetchTool");
            results = subList(new ArrayList<>(approvedList) {{ addAll(pendingList); }}, 10);

        } else if (isApprovedQuery) {
            toolsUsed.add("ApprovedCitizensFetchTool");
            results = approvedList;

        } else if (isPendingQuery) {
            toolsUsed.add("PendingQueueFetchTool");
            results = pendingList;

        } else {
            results = mcpTools.searchCitizen(userMessage, authToken);
            if (results.isEmpty()) {
                // Fallback: token-based search in all citizens
                String[] qTokens = userMessage.toLowerCase().split("\\s+");
                for (Map<String, Object> c : allCitizens) {
                    String cStr = toJson(c).toLowerCase();
                    for (String t : qTokens) {
                        if (t.length() > 1 && cStr.contains(t) && !results.contains(c)) {
                            results.add(c);
                        }
                    }
                }
            }
            if (results.isEmpty()) {
                results = subList(new ArrayList<>(approvedList) {{ addAll(pendingList); }}, 10);
            }
        }

        String retrievedDataStr = toJson(Map.of(
            "user_query", userMessage,
            "matching_results_count", results.size(),
            "matching_citizens", subList(results, 10),
            "approved_citizens", subList(approvedList, 5),
            "pending_applications", subList(pendingList, 5),
            "rejected_applications", subList(rejectedList, 5),
            "approved_citizens_count", approvedList.size(),
            "pending_applications_count", pendingList.size(),
            "rejected_applications_count", rejectedList.size(),
            "total_citizens_count", allCitizens.size()
        ));

        return new CitizenLookupResult(toolsUsed, contextUsed, retrievedDataStr);
    }

    // ── System prompt builder ─────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private String buildSystemPrompt(String role, Map<String, Object> capabilities, String intent,
                                      List<String> toolsUsed, Map<String, Object> activeContext,
                                      String retrievedData, Map<String, Object> userDetails) {

        Map<String, String> roleMap = Map.of(
            "ROLE_EMPLOYEE", "Government Review Officer",
            "ROLE_USER", "Registered Citizen",
            "PUBLIC", "Public Guest"
        );
        String roleName = roleMap.getOrDefault(role, role);

        List<String> parts = new ArrayList<>();
        parts.add("You are the official AI Assistant for the Government Digital Services Portal.");
        parts.add("Current User Role: " + roleName + " | Intelligence Level: " + capabilities.get("level"));
        parts.add("Query Intent Classified: " + intent);
        parts.add("Tools Invoked: " + String.join(", ", toolsUsed));

        if (activeContext != null && !activeContext.isEmpty()) {
            parts.add("\nActive Application Under Review:\n" + toJson(activeContext));
        }
        if (retrievedData != null && !retrievedData.isBlank()) {
            parts.add("\nTool Retrieved Data (from live database / knowledge base):\n" + retrievedData);
        }

        parts.add("\nResponse Instructions:");
        parts.add("1. Respond in clear, professional GitHub-style Markdown.");
        parts.add("2. Use ONLY the data provided above — do NOT invent citizen names, PAN numbers, phone numbers, or statistics.");
        parts.add("3. If no data was found by the tools, clearly state that no records were found.");
        parts.add("4. For DUPLICATE_DETECTION: Report the actual confidence score, recommendation, and evidence points. CRITICAL: If confidence_score is less than 10% or matched_user is null/None, DO NOT mention any matched existing citizen record or candidate name. Explicitly state that no duplicate record exists in the system.");
        parts.add("5. For CITIZEN_LOOKUP: List the actual matching citizens found with their full details. CRITICAL: If the user specifically asks for an attribute like address, PAN, phone, email, or DOB, state that requested attribute value directly and clearly in bold at the top of your response.");
        parts.add("6. For SQL/STATS: Present the actual statistics from the database response.");
        parts.add("7. For WORKFLOW: Explain the citizen's actual current status, assigned officer, and steps.");
        parts.add("8. For FAQ/RAG: Provide accurate portal guidance based on the knowledge base result.");
        parts.add("9. NEVER say 'Rahul Sharma', 'Priya Verma', 'Officer Vikram', 'ABCDE1234F', or any specific name/number unless it appears in the tool data above.");
        parts.add("10. FOR BROAD DATASET QUERIES (e.g. 'all approved citizens', 'all pending applications'): Provide a concise dashboard statistics overview (Total, Approved, Pending, Rejected), display the top 5 representative records, and append a token-economic notice.");

        return String.join("\n", parts);
    }

    // ── LLM call helpers ──────────────────────────────────────────────────────

    private String callLlm(String systemPrompt, String userMessage, double temperature, int maxTokens) {
        try {
            OllamaOptions options = new OllamaOptions()
                    .withTemperature((float) temperature)
                    .withNumPredict(maxTokens);
            Prompt prompt = new Prompt(
                List.of(new SystemMessage(systemPrompt), new UserMessage(userMessage)),
                options
            );
            var response = chatModel.call(prompt);
            if (response != null && response.getResult() != null) {
                return response.getResult().getOutput().getContent();
            }
        } catch (Exception e) {
            System.err.println("[AgentOrchestrator] callLlm error: " + e.getMessage());
        }
        return null;
    }

    private Flux<String> streamFromLlm(String systemPrompt, String userMessage, double temperature, int maxTokens,
                                        String intent, String role, String retrievedData,
                                        Map<String, Object> activeContext, Map<String, Object> userDetails,
                                        Map<String, Object> toolMeta) {
        try {
            OllamaOptions options = new OllamaOptions()
                    .withTemperature((float) temperature)
                    .withNumPredict(maxTokens);
            Prompt prompt = new Prompt(
                List.of(new SystemMessage(systemPrompt), new UserMessage(userMessage)),
                options
            );

            return chatModel.stream(prompt)
                .map(cr -> {
                    String content = cr.getResult() != null ? cr.getResult().getOutput().getContent() : "";
                    return toJson(Map.of("type", "token", "content", content != null ? content : "")) + "\n";
                })
                .onErrorResume(e -> {
                    System.err.println("[AgentOrchestrator] Stream error: " + e.getMessage());
                    return streamFallback(intent, role, retrievedData, activeContext, userDetails, toolMeta);
                })
                .switchIfEmpty(streamFallback(intent, role, retrievedData, activeContext, userDetails, toolMeta));
        } catch (Exception e) {
            return streamFallback(intent, role, retrievedData, activeContext, userDetails, toolMeta);
        }
    }

    private Flux<String> streamFallback(String intent, String role, String retrievedData,
                                         Map<String, Object> activeContext, Map<String, Object> userDetails,
                                         Map<String, Object> toolMeta) {
        String fallback = synthesizeFallback(intent, role, retrievedData, activeContext, userDetails, toolMeta);
        // Chunk into ~20-char pieces for natural streaming feel
        List<String> chunks = new ArrayList<>();
        int chunkSize = 20;
        for (int i = 0; i < fallback.length(); i += chunkSize) {
            String chunk = fallback.substring(i, Math.min(i + chunkSize, fallback.length()));
            chunks.add(toJson(Map.of("type", "token", "content", chunk)) + "\n");
        }
        return Flux.fromIterable(chunks)
                   .delayElements(java.time.Duration.ofMillis(15));
    }

    // ── Fallback response synthesizer (port of _synthesize_fallback_response) ─

    @SuppressWarnings("unchecked")
    private String synthesizeFallback(String intent, String role, String retrievedData,
                                       Map<String, Object> activeContext, Map<String, Object> userDetails,
                                       Map<String, Object> toolMetadata) {

        String modelLabel = "*🤖 AI Engine: OLLAMA (" + llmModel + ") — Structured Fallback Mode*\n\n";
        Map<String, Object> data;
        try {
            data = retrievedData != null && !retrievedData.isBlank()
                   ? mapper.readValue(retrievedData, Map.class) : new HashMap<>();
        } catch (Exception e) { data = new HashMap<>(); }

        switch (intent != null ? intent : "") {
            case "DUPLICATE_DETECTION":
                return fallbackDuplicate(modelLabel, data);
            case "CITIZEN_LOOKUP":
                return fallbackCitizenLookup(modelLabel, data);
            case "SQL":
                return fallbackSql(modelLabel, data);
            case "WORKFLOW":
                return fallbackWorkflow(modelLabel, data, userDetails);
            case "FAQ":
                return fallbackFaq(modelLabel, data);
            default:
                return fallbackRag(modelLabel, data);
        }
    }

    @SuppressWarnings("unchecked")
    private String fallbackDuplicate(String label, Map<String, Object> data) {
        Map<String, Object> dup = (Map<String, Object>) data.getOrDefault("duplicate_detection_result", Map.of());
        Map<String, Object> target = (Map<String, Object>) data.getOrDefault("target_application", Map.of());
        String name = str(target.get("name"));
        if (name.isBlank()) name = "the applicant";
        String regId = str(target.getOrDefault("registrationId", "N/A"));
        double score = toDouble(dup.get("confidence_score"), 0.0);
        String rec = str(dup.getOrDefault("recommendation", "Insufficient data"));
        List<String> reasons = (List<String>) dup.getOrDefault("key_evidence", dup.getOrDefault("reasons", List.of()));
        Map<String, Object> matched = score >= 10.0 ? (Map<String, Object>) dup.get("matched_user") : null;
        String reasoning = str(dup.getOrDefault("reasoning", ""));
        int checked = (int) data.getOrDefault("total_approved_citizens_checked", 0);
        String source = str(dup.getOrDefault("analysis_source", "algorithmic_fallback"));
        String sourceLabel = "llm".equals(source) ? "LLM-Powered Analysis" : "Algorithmic Pre-Screen (LLM Unavailable)";

        String resultLines = reasons.isEmpty() ? "- No significant matches found."
            : String.join("\n", reasons.stream().map(r -> "- " + r).collect(Collectors.toList()));
        String matchedBlock = "";
        if (matched != null && !str(matched.get("fullName")).isBlank()) {
            matchedBlock = "\n**Matched Existing Record:**\n" +
                "- Name: **" + matched.get("fullName") + "** (Reg ID: `" + matched.getOrDefault("registrationId","N/A") + "`)\n" +
                "- PAN: `" + matched.getOrDefault("pan","N/A") + "` | Phone: `" + matched.getOrDefault("phone","N/A") + "`\n";
        }
        String reasoningBlock = reasoning.isBlank() ? "" : "\n**AI Reasoning:** " + reasoning + "\n";

        return label +
            "### 🤖 AI Duplicate Detection Analysis\n\n" +
            "**Analysis Method:** `" + sourceLabel + "`\n" +
            "**Target Application:** " + name + " (`" + regId + "`)\n" +
            "**Database Checked Against:** " + checked + " approved citizen record(s)\n\n---\n" +
            "**AI Confidence Score:** `" + score + "%`\n" +
            "**AI Recommendation:** **" + rec + "**\n" +
            matchedBlock + reasoningBlock + "\n" +
            "**Key Evidence:**\n" + resultLines + "\n\n" +
            "*Final approval/rejection decision rests with the assigned Review Officer.*";
    }

    @SuppressWarnings("unchecked")
    private String fallbackCitizenLookup(String label, Map<String, Object> data) {
        List<Map<String, Object>> citizens = (List<Map<String, Object>>) data.getOrDefault("matching_citizens", List.of());
        String query = str(data.getOrDefault("user_query", ""));
        int approvedCnt = toInt(data.getOrDefault("approved_citizens_count", 0));
        int pendingCnt = toInt(data.getOrDefault("pending_applications_count", 0));

        if (citizens.isEmpty()) {
            return label +
                "### 🔍 Citizen Directory Lookup\n\nNo specific citizen record matched **`" + query + "`**.\n\n" +
                "**Database Summary:**\n- 🟢 **Approved Citizens Directory:** " + approvedCnt + " registered citizens\n" +
                "- ⏳ **Pending Review Queue:** " + pendingCnt + " pending applications\n\n" +
                "*Try searching by full name, PAN, phone number, email, or Registration ID (e.g. USR-1042).*";
        }

        int displayLimit = 5;
        String qLower = query.toLowerCase();
        Map<String, Object> cFirst = citizens.get(0);
        String cName = (str(cFirst.get("firstName")) + " " + str(cFirst.get("lastName"))).trim();
        if (cName.isBlank()) cName = str(cFirst.getOrDefault("username", "Applicant"));

        String attrHighlight = "";
        if (qLower.contains("address") || qLower.contains("where")) {
            String addr = str(cFirst.getOrDefault("address","N/A")) + ", " + str(cFirst.getOrDefault("district","")) + ", " + str(cFirst.getOrDefault("state","")) + " - " + str(cFirst.getOrDefault("pin",""));
            attrHighlight = "📍 **Residential Address for " + cName + ":**\n**" + addr + "**\n\n---\n\n";
        } else if (qLower.contains("pan")) {
            attrHighlight = "🪪 **PAN Card Number for " + cName + ":**\n**`" + cFirst.getOrDefault("pan","N/A") + "`**\n\n---\n\n";
        } else if (qLower.contains("phone") || qLower.contains("contact") || qLower.contains("mobile")) {
            attrHighlight = "📞 **Phone Number for " + cName + ":**\n**`" + cFirst.getOrDefault("phone","N/A") + "`**\n\n---\n\n";
        } else if (qLower.contains("email")) {
            attrHighlight = "✉️ **Email Address for " + cName + ":**\n**" + cFirst.getOrDefault("email","N/A") + "**\n\n---\n\n";
        } else if (qLower.contains("dob") || qLower.contains("birth")) {
            attrHighlight = "📅 **Date of Birth for " + cName + ":**\n**" + cFirst.getOrDefault("dob","N/A") + "**\n\n---\n\n";
        }

        List<String> lines = new ArrayList<>();
        for (Map<String, Object> c : citizens.subList(0, Math.min(displayLimit, citizens.size()))) {
            String fullName = (str(c.get("firstName")) + " " + str(c.getOrDefault("middleName","")) + " " + str(c.get("lastName"))).trim();
            if (fullName.isBlank()) fullName = str(c.getOrDefault("username","N/A"));
            String status = str(c.getOrDefault("status","APPROVED"));
            String statusIcon = "APPROVED".equals(status) ? "🟢 APPROVED" : ("PENDING".equals(status) ? "⏳ PENDING" : "🔴 " + status);
            String addr = str(c.getOrDefault("address","N/A")) + ", " + str(c.getOrDefault("district","")) + ", " + str(c.getOrDefault("state","")) + " - " + str(c.getOrDefault("pin",""));
            lines.add("#### " + fullName + " (`" + c.getOrDefault("registrationId","N/A") + "`)\n" +
                "- **Status:** `" + statusIcon + "` | **Role:** `" + c.getOrDefault("role","ROLE_USER") + "`\n" +
                "- **PAN:** `" + c.getOrDefault("pan","N/A") + "` | **Phone:** `" + c.getOrDefault("phone","N/A") + "` | **Email:** `" + c.getOrDefault("email","N/A") + "`\n" +
                "- **Address:** " + addr + "\n" +
                "- **DOB:** `" + c.getOrDefault("dob","N/A") + "` | **Gender:** `" + c.getOrDefault("gender","N/A") + "`\n" +
                "- **Organization:** " + c.getOrDefault("organization","N/A") + " | **Qualification:** " + c.getOrDefault("qualification","N/A"));
        }

        String truncation = citizens.size() > displayLimit
            ? "\n\n---\n\n⚡ **Token-Optimized Summary Notice**: Displaying top **" + displayLimit + "** of **" + citizens.size() + "** records. Search by Name, PAN, or Registration ID for specifics."
            : "";

        return label + "### 🔍 Citizen Directory Summary\n\n" + attrHighlight + String.join("\n\n", lines) + truncation;
    }

    @SuppressWarnings("unchecked")
    private String fallbackSql(String label, Map<String, Object> data) {
        Map<String, Object> stats = (Map<String, Object>) data.getOrDefault("dashboard_statistics", Map.of());
        List<Map<String, Object>> pendings = (List<Map<String, Object>>) data.getOrDefault("pending_applications", List.of());
        String pendingSummary = pendings.isEmpty() ? "No pending applications."
            : String.join("\n", pendings.subList(0, Math.min(10, pendings.size())).stream()
                .map(p -> "- `" + p.getOrDefault("registrationId","N/A") + "` — " + str(p.get("firstName")) + " " + str(p.get("lastName")) +
                    " (" + p.getOrDefault("organization","N/A") + ") | Stage: " + p.getOrDefault("approvalStage","N/A")).collect(Collectors.toList()));
        return label +
            "### 📊 Government Portal Dashboard Statistics\n\n" +
            "| Metric | Count |\n|---|---|\n" +
            "| **Total Citizens** | " + stats.getOrDefault("total","N/A") + " |\n" +
            "| **Pending Review** | " + stats.getOrDefault("pending","N/A") + " |\n" +
            "| **Approved** | " + stats.getOrDefault("approved","N/A") + " |\n" +
            "| **Rejected** | " + stats.getOrDefault("rejected","N/A") + " |\n\n" +
            "**Pending Applications in Queue:**\n" + pendingSummary;
    }

    @SuppressWarnings("unchecked")
    private String fallbackWorkflow(String label, Map<String, Object> data, Map<String, Object> userDetails) {
        Map<String, Object> profile = (Map<String, Object>) data.getOrDefault("citizen_profile", userDetails != null ? userDetails : Map.of());
        List<Map<String, Object>> grievances = (List<Map<String, Object>>) data.getOrDefault("grievances", List.of());
        String name = (str(profile.get("firstName")) + " " + str(profile.get("lastName"))).trim();
        if (name.isBlank()) name = str(profile.getOrDefault("username","N/A"));
        String grvSummary = grievances.isEmpty() ? "No grievances submitted."
            : String.join("\n", grievances.stream()
                .map(g -> "- `" + g.getOrDefault("grievanceId","N/A") + "` — " + g.getOrDefault("subject","N/A") + " | Status: **" + g.getOrDefault("status","N/A") + "**").collect(Collectors.toList()));
        return label +
            "### 📌 Your Application Status\n\n" +
            "**Name:** " + name + "\n" +
            "**Registration ID:** `" + profile.getOrDefault("registrationId","Not yet assigned") + "`\n" +
            "**Current Status:** **" + profile.getOrDefault("status","N/A") + "**\n" +
            "**Approval Stage:** " + profile.getOrDefault("approvalStage","N/A") + "\n" +
            "**Assigned Officer:** " + profile.getOrDefault("assignedOfficerName","Not yet assigned") + "\n" +
            "**Estimated Processing Time:** " + profile.getOrDefault("estimatedProcessingDays","N/A") + " working day(s)\n" +
            "**Missing Documents:** " + profile.getOrDefault("missingDocuments","None listed") + "\n\n" +
            "**Your Grievances:**\n" + grvSummary;
    }

    @SuppressWarnings("unchecked")
    private String fallbackFaq(String label, Map<String, Object> data) {
        boolean matched = Boolean.TRUE.equals(data.get("matched"));
        Map<String, Object> faq = (Map<String, Object>) data.get("faq");
        if (matched && faq != null) {
            return label +
                "### 💡 FAQ — " + faq.getOrDefault("category","Portal Information") + "\n\n" +
                "**Q: " + faq.getOrDefault("question","Your Question") + "**\n\n" +
                faq.getOrDefault("answer","Please refer to the portal guidelines.");
        }
        return label +
            "### 💡 Government Portal FAQ\n\n" +
            "Registration requires a valid **PAN Card**, **Address Proof** (Aadhaar/Passport/Utility Bill), " +
            "**Mobile Number**, **Email Address**, **Educational Certificate**, and **Organization Details**.\n\n" +
            "Standard approval takes **3–5 working days**. For specific queries, please contact the Grievance Cell.";
    }

    @SuppressWarnings("unchecked")
    private String fallbackRag(String label, Map<String, Object> data) {
        List<Map<String, Object>> docs = data instanceof List ? (List<Map<String, Object>>) data : List.of();
        if (!docs.isEmpty()) {
            Map<String, Object> top = docs.get(0);
            return label + "### 📚 Government Knowledge Base\n\n**" + top.getOrDefault("title","Government Portal Policy") + "**\n\n" + top.getOrDefault("content","");
        }
        return label +
            "### 📚 Government Portal Guidelines\n\n" +
            "Based on the **Government Digital Services SRS**, all applicants must complete a multi-attribute registration profile. " +
            "Applications undergo a 3-stage review: **Receipt → Document Verification → Officer Decision**.\n\n" +
            "For policy documents and official circulars, please check the **Public Notices** section.";
    }

    // ── Utility helpers ───────────────────────────────────────────────────────

    private String roleLabel(String role) {
        if (role == null) return "Public Guest";
        switch (role) {
            case "ROLE_USER":
                return "Citizen";
            case "ROLE_EMPLOYEE":
                return "Officer";
            default:
                return "Public Guest";
        }
    }

    private String str(Object o) { return o != null ? o.toString().trim() : ""; }
    private double toDouble(Object o, double d) {
        if (o == null) return d;
        try { return Double.parseDouble(o.toString()); } catch (Exception e) { return d; }
    }
    private int toInt(Object o) {
        if (o == null) return 0;
        try { return Integer.parseInt(o.toString()); } catch (Exception e) { return 0; }
    }

    private boolean containsAny(String msg, String... keywords) {
        for (String kw : keywords) if (msg.contains(kw)) return true;
        return false;
    }

    private <T> List<T> subList(List<T> list, int max) {
        return list.subList(0, Math.min(max, list.size()));
    }

    private String toJson(Object o) {
        try { return mapper.writeValueAsString(o); }
        catch (Exception e) { return "{}"; }
    }

    // ── Inner result holders ──────────────────────────────────────────────────

    private record ToolResult(List<String> toolsUsed, boolean contextUsed,
                               String retrievedDataStr, Map<String, Object> toolMetadata) {}

    private record CitizenLookupResult(List<String> toolsUsed, boolean contextUsed, String retrievedDataStr) {}
}
