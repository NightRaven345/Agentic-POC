package com.gov.aibackend.agent;

import org.springframework.stereotype.Component;
import java.util.Map;

/**
 * Port of agents/intent_agent.py — classify_intent()
 *
 * Rule-based intent classifier with role-based privilege checks.
 * Classifies incoming messages into:
 *   SQL | CITIZEN_LOOKUP | DUPLICATE_DETECTION | WORKFLOW | FAQ | RAG | GENERAL
 */
@Component
public class IntentClassifier {

    /**
     * Classifies the user message into an intent string.
     *
     * @param message         User input text
     * @param activeContext   Currently inspected application (may be null)
     * @param role            User role: ROLE_EMPLOYEE | ROLE_USER | PUBLIC
     * @return                Intent string
     */
    public String classify(String message, Map<String, Object> activeContext, String role) {
        if (message == null || message.isBlank()) return "GENERAL";

        String msg = message.toLowerCase().trim();
        String roleUpper = (role != null ? role : "PUBLIC").toUpperCase();

        // ── DUPLICATE_DETECTION (context keyword, EMPLOYEE only) ──────────────
        if ("ROLE_EMPLOYEE".equals(roleUpper) && (
            contains(msg, "duplicate", "check duplicate", "run duplicate", "duplicate detection",
                     "duplicate check", "is this a duplicate", "duplicate analysis",
                     "duplicate scan", "fraud check", "fraud detection"))) {
            return "DUPLICATE_DETECTION";
        }

        // ── CITIZEN_LOOKUP (EMPLOYEE only) — checked before SQL ──────────────
        if ("ROLE_EMPLOYEE".equals(roleUpper) && (
            contains(msg,
                "find citizen", "lookup citizen", "search citizen", "get citizen",
                "tell me about", "details for", "info on", "information about",
                "profile of", "who is", "who has", "find user", "lookup user", "search user",
                "show citizen", "citizen named", "applicant named", "applicant with",
                "approved citizen", "approved citizens", "approved users", "approved list",
                "verified citizens", "show approved", "list approved", "pending queue",
                "pending applications", "pending list", "show pending", "list pending",
                "pan number", "registration id", "reg id", "usr-", "grv-",
                "search for", "look up", "show me citizen",
                "address of", "pan of", "phone of", "email of", "dob of", "date of birth",
                "contact of", "where does", "where is", "what is the address", "what was the address",
                "what is the pan", "what was the pan", "what is the phone", "what was the phone",
                "what is the email", "what was the email", "what is the dob", "what was the dob",
                "this guy", "this applicant", "this user", "this person", "this citizen",
                "his address", "her address", "his pan", "her pan", "his phone", "her phone",
                "his email", "her email", "his dob", "her dob"
            ) || containsPattern(msg, "usr-", "grv-", "@", "pan:")
        )) {
            return "CITIZEN_LOOKUP";
        }

        // ── SQL / Dashboard Stats (EMPLOYEE only) ─────────────────────────────
        if ("ROLE_EMPLOYEE".equals(roleUpper) && contains(msg,
            "how many", "count", "stats", "statistics", "total citizens", "pending review",
            "approved count", "rejected count", "sql", "dashboard stats", "system summary")) {
            return "SQL";
        }

        // ── WORKFLOW (ROLE_USER only — own application status) ────────────────
        if ("ROLE_USER".equals(roleUpper) && contains(msg,
            "my status", "my registration", "my application", "my profile",
            "what is happening", "what's happening", "what happened", "my documents",
            "missing document", "my documents missing", "why pending", "why is my",
            "how long", "when will", "approved", "rejected my", "my verification",
            "estimated time", "processing time", "my grievance", "submitted grievance",
            "track my", "application status", "registration status")) {
            return "WORKFLOW";
        }

        // ── FAQ: Common portal process questions ──────────────────────────────
        if (contains(msg,
            "what documents", "which documents", "documents required", "required documents",
            "how to register", "how do i register", "registration process", "how to apply",
            "citizen registration", "what is citizen registration", "what is registration",
            "how long does", "approval take", "processing time", "portal faq",
            "how to submit", "what is the process", "can i apply", "eligible",
            "eligibility", "who can register", "step by step",
            "registration fee", "is it free", "cost of registration")) {
            return "FAQ";
        }

        // ── RAG: Policy / legal / guideline questions ─────────────────────────
        if (contains(msg,
            "srs", "policy", "rule", "guideline", "security directive", "anti-fraud",
            "duplicate policy", "legal", "circular", "notice", "notice board",
            "public notice", "regulation", "requirement specification")) {
            return "RAG";
        }

        return "GENERAL";
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private boolean contains(String msg, String... keywords) {
        for (String kw : keywords) {
            if (msg.contains(kw)) return true;
        }
        return false;
    }

    private boolean containsPattern(String msg, String... patterns) {
        for (String p : patterns) {
            if (msg.contains(p)) return true;
        }
        return false;
    }
}
