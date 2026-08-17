package com.gov.aibackend.agent;

import org.springframework.stereotype.Component;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Port of rag/knowledge_base.py + rag/chroma_store.py
 *
 * Stores all FAQ and RAG documents and provides keyword/Jaccard similarity
 * search without requiring an external vector database.
 */
@Component
public class KnowledgeBase {

    // ── FAQ Documents (port of FAQ_DOCUMENTS in knowledge_base.py) ────────────

    private static final List<Map<String, Object>> FAQ_DOCUMENTS = List.of(
        doc("faq_001", "Registration",
            List.of("documents","required","needed","upload","proof","pan","aadhaar","address","certificates"),
            "What documents and details are required for citizen registration?",
            "To complete citizen registration on the Government Digital Services Portal, you need: " +
            "1) Valid 10-character PAN Card (e.g., ABCDE1234F), 2) Proof of Address (Aadhaar, Passport, or Utility Bill), " +
            "3) Active Mobile Number & Email Address, 4) Date of Birth (DOB), 5) Educational Qualification degree, " +
            "and 6) Current Organization/Employment details."),

        doc("faq_002", "Registration",
            List.of("register","registration","how to register","how do i register","apply","sign up","create account","process","steps","new citizen"),
            "How do I register on the Government Portal?",
            "Citizen registration is the official digital onboarding process. You can register in 3 simple steps: " +
            "1) Click 'Register' or navigate to #/signup to set up your account. " +
            "2) Fill out the official Registration Form with your PAN, address, mobile number, and personal background. " +
            "3) Submit the form to queue your application into Stage 2 (Officer Review & Document Audit)."),

        doc("faq_003", "Fees & Cost",
            List.of("fee","cost","charge","free","payment","money","price"),
            "Is there any fee for citizen registration?",
            "No. Registration on the Government Digital Services Portal is 100% FREE OF COST for all citizens. " +
            "Beware of fraudulent third-party websites requesting payment for portal registration."),

        doc("faq_004", "Timelines",
            List.of("how long","time","days","timeline","duration","wait","approval time","processing time"),
            "How long does citizen registration approval take?",
            "Standard citizen registration approval takes 3 to 5 working days. During this period, an assigned " +
            "Government Review Officer conducts identity verification, document validation, and AI duplicate checks."),

        doc("faq_005", "Application Status",
            List.of("status","pending","stage","audit","review","why pending","under review"),
            "What does a 'PENDING' registration status mean?",
            "A 'PENDING' status means your registration form has been successfully submitted and is currently queued " +
            "in Stage 2 (Identity & Document Audit). An assigned Officer is reviewing your uploaded records."),

        doc("faq_006", "Application Status",
            List.of("not submitted","draft","complete form","incomplete"),
            "What does 'NOT_SUBMITTED' status mean?",
            "'NOT_SUBMITTED' means you have created a basic citizen account but have not yet filled out and submitted " +
            "the official registration form. Click 'Submit Official Registration Form' on your citizen dashboard to proceed."),

        doc("faq_007", "Application Status",
            List.of("approved","active","verified","passed"),
            "What happens after my citizen registration is APPROVED?",
            "Once APPROVED, your citizen profile becomes fully active. You receive a permanent Registration ID " +
            "(e.g., USR-1042), full access to digital government services, Public Notices & Circulars, " +
            "and the Citizen Grievance Portal."),

        doc("faq_008", "Application Status",
            List.of("rejected","declined","discrepancy","failed","re-apply"),
            "What should I do if my citizen registration is REJECTED?",
            "If your application is REJECTED, the exact reason (e.g., missing address proof, PAN mismatch) will be " +
            "displayed on your citizen dashboard. You can file a grievance via the Citizen Grievance Portal or " +
            "submit an updated application with corrected documents."),

        doc("faq_009", "Security & Fraud",
            List.of("duplicate","multi account","flagged","anti-fraud","policy","similarity"),
            "What is the policy on duplicate registrations?",
            "Holding duplicate active citizen accounts is strictly prohibited under Government Identity Security Regulations. " +
            "The portal runs real-time AI Duplicate Detection across PAN, phone number, email, DOB, and address. " +
            "Applications with high matching scores (>70%) are flagged for officer audit."),

        doc("faq_010", "Grievance",
            List.of("grievance","complaint","issue","problem","ticket","help","support"),
            "How do I file and track a citizen grievance?",
            "Approved and registered citizens can open the 'Grievance Portal' card on their dashboard, choose a category " +
            "(e.g. Document Verification, Technical Issue, Status Delay), and submit their ticket. " +
            "You can track resolution status under 'My Grievances'."),

        doc("faq_011", "Notices",
            List.of("notice","circular","announcement","guideline","updates","government order"),
            "Where can I view official government circulars and public notices?",
            "Official notifications, guidelines, and circulars are available on the 'Public Notices & Circulars' card " +
            "on your citizen dashboard or via the public portal announcements section."),

        doc("faq_012", "Account Security",
            List.of("password","forgot password","reset","login issue","security"),
            "What are the password requirements and security guidelines?",
            "Passwords must be secure and kept strictly confidential. Never share your credentials or authorization " +
            "tokens with third parties. Government officers will never ask for your password."),

        doc("faq_013", "Officer Portal",
            List.of("officer","employee","admin","dashboard","inspect","audit task"),
            "What is the Officer Review Portal?",
            "The Officer Portal (#/officer/dashboard) is a secure, role-restricted dashboard for authorized government " +
            "officers. Officers inspect pending citizen applications, run AI duplicate analysis, review key evidence, " +
            "and issue official approval or rejection decisions."),

        doc("faq_014", "AI Assistant",
            List.of("ai","chatbot","assistant","capabilities","what can ai do","tools"),
            "What can the AI Assistant do?",
            "The AI Assistant provides role-based intelligence: 1) Public Guests: Answer citizen portal FAQs and policy guidelines. " +
            "2) Citizens: Track personal application status, check missing document lists, and monitor grievances. " +
            "3) Officers: Execute citizen lookups, query live SQL dashboard statistics, and explain AI duplicate detection analysis."),

        doc("faq_015", "General",
            List.of("site","portal","about","what is this site","overview","purpose"),
            "What is the Government Digital Services Portal?",
            "It is an official digital identity and public service delivery portal designed by the Ministry of Public " +
            "Services & Administration to streamline citizen registration, identity verification, grievance redressal, " +
            "and policy dissemination.")
    );

    // ── RAG Documents (port of RAG_DOCUMENTS in knowledge_base.py) ────────────

    private static final List<Map<String, Object>> RAG_DOCUMENTS = List.of(
        ragDoc("rag_srs_01",
            "Government Digital Portal System Requirement Specification (SRS) v2.4",
            List.of("srs","requirements","specification","workflow","stages"),
            "Section 3.1: Citizen Onboarding Standards. Every citizen applicant must complete a multi-attribute registration " +
            "profile covering Tax Identification (PAN), contact details, residential address, educational qualifications, " +
            "and employment background. Applications follow a strict 3-tier lifecycle: " +
            "1. Draft Receipt (NOT_SUBMITTED) -> 2. Identity & Document Audit (PENDING) -> 3. Final Decision (APPROVED / REJECTED)."),

        ragDoc("rag_policy_02",
            "Government Identity & Anti-Fraud Security Directive 2026",
            List.of("anti-fraud","duplicate policy","security directive","legal rule"),
            "Rule 14-B: Multi-Attribute Duplicate Prevention. No individual citizen is permitted to maintain multiple active " +
            "portal accounts. The AI microservice must cross-examine PAN Card, Phone Number, Date of Birth, Name, and Address " +
            "against all approved database records. High confidence duplicate matches (>=70%) mandate designated officer " +
            "manual inspection before approval."),

        ragDoc("rag_guide_03",
            "Citizen Document Audit & Compliance Code 2026",
            List.of("document compliance","verification rules","audit code"),
            "Chapter 4: Verification Rules. All uploaded PAN card copies must match central Income Tax database records. " +
            "Address proofs must correspond to the district and state specified in the digital registration form. " +
            "Applications with missing or unreadable documents will be placed on status hold."),

        ragDoc("rag_grievance_04",
            "Public Grievance Redressal Mechanism Directive",
            List.of("grievance policy","redressal","timeline","resolution"),
            "Directive 8: Citizens are entitled to file digital grievances for any registration delay, document verification " +
            "dispute, or portal service issue. All grievances are logged with a unique tracking ID (e.g. GRV-8041) and " +
            "must be reviewed and resolved by an authorized officer within 7 working days.")
    );

    // ── Static stop words (mirrors Python set) ────────────────────────────────
    private static final Set<String> STOP_WORDS = Set.of(
        "the","a","an","is","are","was","were","to","for","of","in","on","at","by",
        "with","and","or","do","does","did","can","could","what","which","where",
        "when","why","who","i","my","your","me","this"
    );

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Searches FAQ knowledge base for best matching Q&A.
     * Returns: {"matched": bool, "score": float, "faq": Map or null}
     */
    public Map<String, Object> searchFaq(String query) {
        double threshold = 0.10;
        Map<String, Object> bestMatch = null;
        double highestScore = 0.0;

        for (Map<String, Object> faq : FAQ_DOCUMENTS) {
            double score = computeScore(query, faq);
            if (score > highestScore) {
                highestScore = score;
                bestMatch = faq;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        if (bestMatch != null && highestScore >= threshold) {
            result.put("matched", true);
            result.put("score", Math.round(highestScore * 100.0) / 100.0);
            result.put("faq", bestMatch);
        } else {
            result.put("matched", false);
            result.put("score", Math.round(highestScore * 100.0) / 100.0);
            result.put("faq", null);
        }
        return result;
    }

    /**
     * Searches all RAG and policy documents for top relevant contexts.
     * Returns top-k results sorted by score.
     */
    public List<Map<String, Object>> searchRag(String query) {
        int topK = 2;
        List<Map<String, Object>> allDocs = new ArrayList<>();
        allDocs.addAll(FAQ_DOCUMENTS);
        allDocs.addAll(RAG_DOCUMENTS);

        List<Map<String, Object>> results = new ArrayList<>();
        for (Map<String, Object> doc : allDocs) {
            String content = (String) doc.getOrDefault("content", doc.getOrDefault("answer", ""));
            String title = (String) doc.getOrDefault("title", doc.getOrDefault("question", ""));
            double score = computeScore(query, doc);
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("id", doc.getOrDefault("id", "doc"));
            r.put("title", title);
            r.put("content", content);
            r.put("score", Math.round(score * 100.0) / 100.0);
            results.add(r);
        }

        results.sort((a, b) -> Double.compare((Double) b.get("score"), (Double) a.get("score")));
        return results.subList(0, Math.min(topK, results.size()));
    }

    // ── Scoring Engine (port of VectorStore._compute_score) ──────────────────

    @SuppressWarnings("unchecked")
    private double computeScore(String query, Map<String, Object> doc) {
        String qRaw = query.toLowerCase().trim();
        Set<String> qTokens = tokenize(query);
        if (qTokens.isEmpty()) return 0.0;

        String question = ((String) doc.getOrDefault("question", doc.getOrDefault("title", ""))).toLowerCase();
        String answer = ((String) doc.getOrDefault("answer", doc.getOrDefault("content", ""))).toLowerCase();
        String category = ((String) doc.getOrDefault("category", "")).toLowerCase();
        List<String> keywords = ((List<String>) doc.getOrDefault("keywords", Collections.emptyList()))
                .stream().map(String::toLowerCase).collect(Collectors.toList());

        // 1. Exact phrase / keyword match bonus (weight 0.5)
        double phraseScore = 0.0;
        for (String kw : keywords) {
            if (qRaw.contains(kw) || kw.contains(qRaw)) {
                phraseScore = 1.0;
                break;
            }
        }

        // 2. Token overlap (Jaccard)
        String docText = question + " " + answer + " " + category + " " + String.join(" ", keywords);
        Set<String> docTokens = tokenize(docText);
        Set<String> intersection = new HashSet<>(qTokens);
        intersection.retainAll(docTokens);
        Set<String> union = new HashSet<>(qTokens);
        union.addAll(docTokens);
        double jaccard = union.isEmpty() ? 0.0 : (double) intersection.size() / union.size();

        // Token match ratio in question/keywords
        Set<String> targetTokens = tokenize(question + " " + String.join(" ", keywords));
        long matchCount = qTokens.stream().filter(targetTokens::contains).count();
        double qRatio = (double) matchCount / qTokens.size();

        return (phraseScore * 0.5) + (qRatio * 0.35) + (jaccard * 0.15);
    }

    private Set<String> tokenize(String text) {
        Set<String> tokens = new HashSet<>();
        String[] words = text.toLowerCase().split("[^a-z0-9]+");
        for (String w : words) {
            if (w.length() > 1 && !STOP_WORDS.contains(w)) {
                tokens.add(w);
            }
        }
        return tokens;
    }

    // ── Document factory helpers ──────────────────────────────────────────────

    private static Map<String, Object> doc(String id, String category, List<String> keywords,
                                            String question, String answer) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("category", category);
        m.put("keywords", keywords);
        m.put("question", question);
        m.put("answer", answer);
        return m;
    }

    private static Map<String, Object> ragDoc(String id, String title, List<String> keywords, String content) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("title", title);
        m.put("keywords", keywords);
        m.put("content", content);
        return m;
    }
}
