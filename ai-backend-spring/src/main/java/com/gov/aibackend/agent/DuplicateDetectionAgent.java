package com.gov.aibackend.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Port of agents/duplicate_agent.py
 *
 * Multi-Attribute Duplicate Detection Engine.
 * Scoring weights (exact same as Python):
 *   PAN exact match   = 45 pts
 *   Phone exact match = 25 pts
 *   Email exact match = 15 pts
 *   Name fuzzy match  = up to 15 pts (>=85% sim → 15, >=65% → 8)
 *   DOB exact match   = 10 pts
 *   Address fuzzy     = up to 10 pts (>=75% sim → 10)
 *   Max capped at 99.0
 */
@Component
public class DuplicateDetectionAgent {

    private final ObjectMapper mapper = new ObjectMapper();

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Full duplicate detection pipeline.
     * Returns a result map matching the Python return dict exactly.
     */
    public Map<String, Object> runDuplicateDetection(
            Map<String, Object> targetUser,
            List<Map<String, Object>> approvedUsers,
            LlmCaller llmCaller) {

        if (approvedUsers == null || approvedUsers.isEmpty()) {
            return noDataResult();
        }

        Map<String, Object> candidate = findBestCandidate(targetUser, approvedUsers);

        if (candidate == null) {
            return cleanResult();
        }

        double algoScore = (double) candidate.get("algorithmic_pre_score");

        // LLM scoring (only when algo_score >= 5.0)
        Map<String, Object> llmResult = null;
        if (llmCaller != null && algoScore >= 5.0) {
            try {
                String userPrompt = buildLlmDuplicatePrompt(targetUser, candidate);
                String systemPrompt = "You are an AI duplicate detection analyst for a government portal. Respond ONLY with valid JSON.";
                String llmContent = llmCaller.call(systemPrompt, userPrompt, 0.1);
                if (llmContent != null && !llmContent.isBlank()) {
                    llmResult = parseLlmDuplicateResponse(llmContent);
                }
            } catch (Exception e) {
                System.err.println("[DuplicateAgent] LLM call failed: " + e.getMessage());
            }
        }

        // ── Determine final score ─────────────────────────────────────────────
        double score;
        List<String> evidence;
        String rec;
        String reasoning;
        String source;

        @SuppressWarnings("unchecked")
        List<String> candidateEvidence = (List<String>) candidate.get("evidence_points");

        if (llmResult != null) {
            double rawScore = toDouble(llmResult.get("confidence_score"), algoScore);

            // Sanity check: fix inverted score (LLM returned "confidence of uniqueness")
            String llmRec = (String) llmResult.getOrDefault("recommendation", "");
            boolean isUniqueRec = llmRec.toLowerCase().contains("unique") ||
                                   !Boolean.TRUE.equals(llmResult.get("has_duplicate"));
            if (isUniqueRec && rawScore > 50.0) {
                rawScore = Math.max(0.0, 100.0 - rawScore);
            }

            // Calibrate: 85% algo + 15% LLM
            score = Math.round(((algoScore * 0.85) + (rawScore * 0.15)) * 10.0) / 10.0;

            @SuppressWarnings("unchecked")
            List<String> llmEvidence = (List<String>) llmResult.getOrDefault("key_evidence", candidateEvidence);
            evidence = llmEvidence;
            rec = llmRec.isBlank()
                  ? "Unique Application — Standard Processing Recommended"
                  : llmRec;
            reasoning = (String) llmResult.getOrDefault("reasoning", "");
            source = "llm";
        } else {
            score = algoScore;
            evidence = candidateEvidence != null && !candidateEvidence.isEmpty()
                       ? candidateEvidence
                       : List.of("✓ No significant matching fields detected.");
            reasoning = "Algorithmic field comparison against " + approvedUsers.size() + " approved record(s).";
            source = "algorithmic_fallback";

            if (score >= 70) rec = "Likely Duplicate Registration";
            else if (score >= 40) rec = "Potential Partial Duplicate — Manual Review Advised";
            else rec = "Unique Application — Standard Processing Recommended";
        }

        // CRITICAL: Only attach matched_user if confidence >= 10%
        boolean isValidMatch = score >= 10.0;
        @SuppressWarnings("unchecked")
        Map<String, Object> matchedUser = isValidMatch ? (Map<String, Object>) candidate.get("matched_user") : null;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("has_duplicate", score >= 70.0);
        result.put("confidence_score", score);
        result.put("recommendation", isValidMatch ? rec : "Unique Application — Clear for Approval");
        result.put("reasoning", reasoning.isBlank()
            ? String.format("Low similarity detected (%.1f%% match, below 10%% threshold). Application is considered unique.", score)
            : reasoning);
        result.put("key_evidence", evidence);
        result.put("reasons", evidence);
        result.put("matched_user", matchedUser);
        result.put("algorithmic_pre_score", algoScore);
        result.put("analysis_source", source);
        return result;
    }

    // ── find_best_candidate ───────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> findBestCandidate(
            Map<String, Object> target, List<Map<String, Object>> approvedList) {

        String targetPan   = str(target.get("pan")).toUpperCase();
        String targetPhone = digits(str(target.get("phone")));
        String targetEmail = str(target.get("email")).toLowerCase();
        String targetDob   = str(target.get("dob"));
        String targetName  = (str(target.get("firstName")) + " " + str(target.get("lastName"))).trim();
        String targetAddr  = str(target.get("address"));

        Map<String, Object> bestMatch = null;
        double bestScore = 0.0;
        List<String> bestEvidence = new ArrayList<>();
        List<String> bestFieldTable = new ArrayList<>();

        for (Map<String, Object> app : approvedList) {
            String appPan   = str(app.get("pan")).toUpperCase();
            String appPhone = digits(str(app.get("phone")));
            String appEmail = str(app.get("email")).toLowerCase();
            String appDob   = str(app.get("dob"));
            String appFirst = str(app.get("firstName"));
            String appLast  = str(app.get("lastName"));
            String appName  = (appFirst + " " + appLast).trim();
            if (appName.isBlank() && app.get("fullName") != null) {
                appName = str(app.get("fullName"));
            }
            String appAddr = str(app.get("address"));

            double score = 0.0;
            List<String> evidence = new ArrayList<>();
            List<String> fieldTable = new ArrayList<>();

            // 1. PAN (45 pts)
            if (!targetPan.isEmpty() && !appPan.isEmpty() && targetPan.equals(appPan)) {
                score += 45.0;
                evidence.add("EXACT PAN Card Match: '" + targetPan + "'");
                fieldTable.add("PAN Card: MATCH (" + targetPan + ")");
            } else {
                fieldTable.add("PAN Card: Different (" + targetPan + " vs " + appPan + ")");
            }

            // 2. Phone (25 pts)
            if (!targetPhone.isEmpty() && !appPhone.isEmpty() && targetPhone.equals(appPhone)) {
                score += 25.0;
                evidence.add("EXACT Mobile Phone Match: '" + targetPhone + "'");
                fieldTable.add("Phone Number: MATCH (" + targetPhone + ")");
            } else {
                fieldTable.add("Phone Number: Different (" + targetPhone + " vs " + appPhone + ")");
            }

            // 3. Email (15 pts)
            if (!targetEmail.isEmpty() && !appEmail.isEmpty() && targetEmail.equals(appEmail)) {
                score += 15.0;
                evidence.add("EXACT Email Match: '" + targetEmail + "'");
                fieldTable.add("Email: MATCH (" + targetEmail + ")");
            }

            // 4. Name fuzzy (up to 15 pts)
            double nameSim = stringSimilarity(targetName, appName);
            if (nameSim >= 0.85) {
                score += 15.0;
                evidence.add(String.format("High Name Similarity (%d%%): '%s' vs '%s'", (int)(nameSim*100), targetName, appName));
                fieldTable.add(String.format("Full Name: Highly Similar (%d%%)", (int)(nameSim*100)));
            } else if (nameSim >= 0.65) {
                score += 8.0;
                evidence.add(String.format("Moderate Name Similarity (%d%%): '%s' vs '%s'", (int)(nameSim*100), targetName, appName));
                fieldTable.add(String.format("Full Name: Moderately Similar (%d%%)", (int)(nameSim*100)));
            }

            // 5. DOB (10 pts)
            if (!targetDob.isEmpty() && !appDob.isEmpty() && targetDob.equals(appDob)) {
                score += 10.0;
                evidence.add("EXACT Date of Birth Match: '" + targetDob + "'");
                fieldTable.add("Date of Birth: MATCH (" + targetDob + ")");
            }

            // 6. Address fuzzy (up to 10 pts)
            double addrSim = stringSimilarity(targetAddr, appAddr);
            if (addrSim >= 0.75) {
                score += 10.0;
                evidence.add(String.format("Address Match (%d%%): '%s' vs '%s'", (int)(addrSim*100), targetAddr, appAddr));
                fieldTable.add(String.format("Address: Similar (%d%%)", (int)(addrSim*100)));
            }

            // Cap at 99.0
            score = Math.min(99.0, score);

            if (score > bestScore) {
                bestScore = score;
                bestMatch = app;
                bestEvidence = evidence;
                bestFieldTable = fieldTable;
            }
        }

        if (bestMatch == null) return null;

        Map<String, Object> matchedUser = new LinkedHashMap<>();
        matchedUser.put("id", bestMatch.get("id"));
        String fullName = (str(bestMatch.get("firstName")) + " " + str(bestMatch.get("lastName"))).trim();
        if (fullName.isBlank()) fullName = str(bestMatch.get("username"));
        matchedUser.put("fullName", fullName);
        matchedUser.put("registrationId", bestMatch.getOrDefault("registrationId", "N/A"));
        matchedUser.put("pan", bestMatch.getOrDefault("pan", "N/A"));
        matchedUser.put("phone", bestMatch.getOrDefault("phone", "N/A"));
        matchedUser.put("email", bestMatch.getOrDefault("email", "N/A"));
        matchedUser.put("dob", bestMatch.getOrDefault("dob", "N/A"));
        matchedUser.put("address", bestMatch.getOrDefault("address", "N/A"));
        matchedUser.put("organization", bestMatch.getOrDefault("organization", "N/A"));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("matched_user", matchedUser);
        result.put("algorithmic_pre_score", Math.round(bestScore * 10.0) / 10.0);
        result.put("evidence_points", bestEvidence);
        result.put("field_table", bestFieldTable);
        return result;
    }

    // ── LLM prompt + response parsing ────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private String buildLlmDuplicatePrompt(Map<String, Object> target, Map<String, Object> candidate) {
        Map<String, Object> matched = (Map<String, Object>) candidate.get("matched_user");
        List<String> fieldTable = (List<String>) candidate.get("field_table");
        List<String> evidence = (List<String>) candidate.get("evidence_points");
        double algoScore = toDouble(candidate.get("algorithmic_pre_score"), 0.0);

        String tName = (str(target.get("firstName")) + " " + str(target.get("lastName"))).trim();
        if (tName.isBlank()) tName = str(target.get("name"));
        if (tName.isBlank()) tName = "Applicant";

        StringBuilder sb = new StringBuilder();
        sb.append("Analyze potential duplicate registration between the NEW PENDING APPLICATION and an APPROVED CITIZEN RECORD.\n\n");
        sb.append("=== NEW PENDING APPLICATION ===\n");
        sb.append("Name: ").append(tName).append("\n");
        sb.append("Registration ID: ").append(target.getOrDefault("registrationId", "N/A")).append("\n");
        sb.append("PAN Card: ").append(target.getOrDefault("pan", "N/A")).append("\n");
        sb.append("Phone: ").append(target.getOrDefault("phone", "N/A")).append("\n");
        sb.append("Email: ").append(target.getOrDefault("email", "N/A")).append("\n");
        sb.append("DOB: ").append(target.getOrDefault("dob", "N/A")).append("\n");
        sb.append("Address: ").append(target.getOrDefault("address", "N/A")).append("\n");
        sb.append("Organization: ").append(target.getOrDefault("organization", "N/A")).append("\n\n");

        sb.append("=== CANDIDATE APPROVED CITIZEN RECORD ===\n");
        sb.append("Name: ").append(matched.getOrDefault("fullName", "N/A")).append("\n");
        sb.append("Registration ID: ").append(matched.getOrDefault("registrationId", "N/A")).append("\n");
        sb.append("PAN: ").append(matched.getOrDefault("pan", "N/A")).append("\n");
        sb.append("Phone: ").append(matched.getOrDefault("phone", "N/A")).append("\n");
        sb.append("Email: ").append(matched.getOrDefault("email", "N/A")).append("\n");
        sb.append("DOB: ").append(matched.getOrDefault("dob", "N/A")).append("\n");
        sb.append("Address: ").append(matched.getOrDefault("address", "N/A")).append("\n");
        sb.append("Organization: ").append(matched.getOrDefault("organization", "N/A")).append("\n\n");

        sb.append("=== FIELD-BY-FIELD COMPARISON ===\n");
        if (fieldTable != null) fieldTable.forEach(f -> sb.append(f).append("\n"));

        sb.append("\n=== EVIDENCE POINTS ===\n");
        if (evidence != null && !evidence.isEmpty()) {
            evidence.forEach(e -> sb.append("- ").append(e).append("\n"));
        } else {
            sb.append("- No strong matches found\n");
        }

        sb.append("\nAlgorithmic pre-screening score: ").append(algoScore).append("%\n\n");
        sb.append("=== YOUR TASK ===\n");
        sb.append("As an AI fraud analyst, evaluate all evidence and return ONLY valid JSON:\n");
        sb.append("{\n");
        sb.append("  \"confidence_score\": <number 0-100 representing DUPLICATE RISK>,\n");
        sb.append("  \"recommendation\": \"<'Likely Duplicate Registration' | 'Potential Partial Duplicate — Manual Review Advised' | 'Unique Application — Standard Processing Recommended'>\",\n");
        sb.append("  \"reasoning\": \"<2-3 sentence explanation>\",\n");
        sb.append("  \"key_evidence\": [\"<evidence 1>\", \"<evidence 2>\"],\n");
        sb.append("  \"has_duplicate\": <true if confidence_score >= 70 else false>\n");
        sb.append("}");

        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseLlmDuplicateResponse(String content) {
        try {
            // Strip code fences
            String cleaned = content.replaceAll("```(?:json)?\\s*", "").replaceAll("```\\s*$", "").trim();
            // Find first JSON object
            Pattern p = Pattern.compile("\\{[\\s\\S]*\\}");
            Matcher m = p.matcher(cleaned);
            if (m.find()) {
                Map<String, Object> parsed = mapper.readValue(m.group(), Map.class);
                if (parsed.containsKey("confidence_score") && parsed.containsKey("recommendation")) {
                    return parsed;
                }
            }
        } catch (Exception e) {
            System.err.println("[DuplicateAgent] Failed to parse LLM JSON: " + e.getMessage());
        }
        return null;
    }

    // ── Static results ────────────────────────────────────────────────────────

    private Map<String, Object> noDataResult() {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("has_duplicate", false);
        r.put("confidence_score", 0.0);
        r.put("recommendation", "Unique Registration — Clear for Approval");
        r.put("reasoning", "The system has no approved citizen records to compare this application against. Standard processing recommended.");
        r.put("key_evidence", List.of("No approved citizens found in database for comparison"));
        r.put("matched_user", null);
        r.put("analysis_source", "no_data");
        return r;
    }

    private Map<String, Object> cleanResult() {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("has_duplicate", false);
        r.put("confidence_score", 0.0);
        r.put("recommendation", "Unique Application — Clear for Approval");
        r.put("reasoning", "No matching records found in database.");
        r.put("key_evidence", List.of("✓ PAN card is unique in database", "✓ Phone number has no matches", "✓ No address or name similarity detected"));
        r.put("matched_user", null);
        r.put("analysis_source", "algorithmic_clean");
        return r;
    }

    // ── String similarity (Dice coefficient — approximates Python SequenceMatcher) ──

    private double stringSimilarity(String s1, String s2) {
        if (s1 == null || s2 == null || s1.isBlank() || s2.isBlank()) return 0.0;
        s1 = s1.toLowerCase().trim();
        s2 = s2.toLowerCase().trim();
        if (s1.equals(s2)) return 1.0;

        Set<String> bigrams1 = bigrams(s1);
        Set<String> bigrams2 = bigrams(s2);
        if (bigrams1.isEmpty() || bigrams2.isEmpty()) return 0.0;

        long intersection = bigrams1.stream().filter(bigrams2::contains).count();
        return (2.0 * intersection) / (bigrams1.size() + bigrams2.size());
    }

    private Set<String> bigrams(String s) {
        Set<String> b = new LinkedHashSet<>();
        for (int i = 0; i < s.length() - 1; i++) {
            b.add(s.substring(i, i + 2));
        }
        return b;
    }

    // ── Utility helpers ───────────────────────────────────────────────────────

    private String str(Object o) {
        return o != null ? o.toString().trim() : "";
    }

    private String digits(String s) {
        return s.replaceAll("\\D", "");
    }

    private double toDouble(Object val, double fallback) {
        if (val == null) return fallback;
        try { return Double.parseDouble(val.toString()); }
        catch (NumberFormatException e) { return fallback; }
    }

    // ── Functional interface for LLM calls ───────────────────────────────────

    @FunctionalInterface
    public interface LlmCaller {
        String call(String systemPrompt, String userMessage, double temperature);
    }
}
