# Government Digital Services Portal — Comprehensive Citizen Knowledge Base
# Strictly focused on Citizen Registration, Citizen Profile Verification, and Government Portal Services.

FAQ_DOCUMENTS = [
    {
        "id": "faq_001",
        "category": "Registration",
        "keywords": ["documents", "required", "needed", "upload", "proof", "pan", "aadhaar", "address", "certificates"],
        "question": "What documents and details are required for citizen registration?",
        "answer": "To complete citizen registration on the Government Digital Services Portal, you need: 1) Valid 10-character PAN Card (e.g., ABCDE1234F), 2) Proof of Address (Aadhaar, Passport, or Utility Bill), 3) Active Mobile Number & Email Address, 4) Date of Birth (DOB), 5) Educational Qualification degree, and 6) Current Organization/Employment details."
    },
    {
        "id": "faq_002",
        "category": "Registration",
        "keywords": ["register", "registration", "how to register", "how do i register", "register on this portal", "apply", "sign up", "create account", "process", "steps", "new citizen"],
        "question": "How do I register on the Government Portal?",
        "answer": "Citizen registration is the official digital onboarding process allowing citizens to create a verified government profile. You can register in 3 simple steps: 1) Click 'Register' or navigate to #/signup to set up your account with your email and password. 2) Fill out the official Registration Form with your PAN, address, mobile number, and personal background. 3) Submit the form to queue your application into Stage 2 (Officer Review & Document Audit)."
    },
    {
        "id": "faq_003",
        "category": "Fees & Cost",
        "keywords": ["fee", "cost", "charge", "free", "payment", "money", "price"],
        "question": "Is there any fee for citizen registration?",
        "answer": "No. Registration on the Government Digital Services Portal is 100% FREE OF COST for all citizens. Beware of fraudulent third-party websites requesting payment for portal registration."
    },
    {
        "id": "faq_004",
        "category": "Timelines",
        "keywords": ["how long", "time", "days", "timeline", "duration", "wait", "approval time", "processing time"],
        "question": "How long does citizen registration approval take?",
        "answer": "Standard citizen registration approval takes 3 to 5 working days. During this period, an assigned Government Review Officer conducts identity verification, document validation, and AI duplicate checks."
    },
    {
        "id": "faq_005",
        "category": "Application Status",
        "keywords": ["status", "pending", "stage", "audit", "review", "why pending", "under review"],
        "question": "What does a 'PENDING' registration status mean?",
        "answer": "A 'PENDING' status means your registration form has been successfully submitted and is currently queued in Stage 2 (Identity & Document Audit). Assigned Officer Vikram Aditya is reviewing your uploaded records."
    },
    {
        "id": "faq_006",
        "category": "Application Status",
        "keywords": ["not submitted", "draft", "complete form", "incomplete"],
        "question": "What does 'NOT_SUBMITTED' status mean?",
        "answer": "'NOT_SUBMITTED' means you have created a basic citizen account (email & password), but have not yet filled out and submitted the official registration form. Click 'Submit Official Registration Form' on your citizen dashboard to proceed."
    },
    {
        "id": "faq_007",
        "category": "Application Status",
        "keywords": ["approved", "active", "verified", "passed"],
        "question": "What happens after my citizen registration is APPROVED?",
        "answer": "Once APPROVED, your citizen profile becomes fully active. You receive a permanent Registration ID (e.g., USR-1042), full access to digital government services, Public Notices & Circulars, and the Citizen Grievance Portal."
    },
    {
        "id": "faq_008",
        "category": "Application Status",
        "keywords": ["rejected", "declined", "discrepancy", "failed", "re-apply"],
        "question": "What should I do if my citizen registration is REJECTED?",
        "answer": "If your application is REJECTED, the exact reason (e.g., missing address proof, PAN mismatch) will be displayed on your citizen dashboard. You can file a grievance via the Citizen Grievance Portal or submit an updated application with corrected documents."
    },
    {
        "id": "faq_009",
        "category": "Security & Fraud",
        "keywords": ["duplicate", "multi account", "flagged", "anti-fraud", "policy", "similarity"],
        "question": "What is the policy on duplicate registrations?",
        "answer": "Holding duplicate active citizen accounts is strictly prohibited under Government Identity Security Regulations. The portal runs real-time AI Duplicate Detection across PAN, phone number, email, DOB, and address. Applications with high matching scores (>70%) are flagged for officer audit."
    },
    {
        "id": "faq_010",
        "category": "Grievance",
        "keywords": ["grievance", "complaint", "issue", "problem", "ticket", "help", "support"],
        "question": "How do I file and track a citizen grievance?",
        "answer": "Approved and registered citizens can open the 'Grievance Portal' card on their dashboard, choose a category (e.g. Document Verification, Technical Issue, Status Delay), and submit their ticket. You can track resolution status under 'My Grievances'."
    },
    {
        "id": "faq_011",
        "category": "Notices",
        "keywords": ["notice", "circular", "announcement", "guideline", "updates", "government order"],
        "question": "Where can I view official government circulars and public notices?",
        "answer": "Official notifications, guidelines, and circulars are available on the 'Public Notices & Circulars' card on your citizen dashboard or via the public portal announcements section."
    },
    {
        "id": "faq_012",
        "category": "Account Security",
        "keywords": ["password", "forgot password", "reset", "login issue", "security"],
        "question": "What are the password requirements and security guidelines?",
        "answer": "Passwords must be secure and kept strictly confidential. Never share your credentials or authorization tokens with third parties. Government officers will never ask for your password."
    },
    {
        "id": "faq_013",
        "category": "Officer Portal",
        "keywords": ["officer", "employee", "admin", "dashboard", "inspect", "audit task"],
        "question": "What is the Officer Review Portal?",
        "answer": "The Officer Portal (#/officer/dashboard) is a secure, role-restricted dashboard for authorized government officers (e.g. officer@gov.in). Officers inspect pending citizen applications, run AI duplicate analysis, review key evidence, and issue official approval or rejection decisions."
    },
    {
        "id": "faq_014",
        "category": "AI Assistant",
        "keywords": ["ai", "chatbot", "assistant", "capabilities", "what can ai do", "tools"],
        "question": "What can the AI Assistant do?",
        "answer": "The AI Assistant provides role-based intelligence: 1) Public Guests: Answer citizen portal FAQs and policy guidelines. 2) Citizens: Track personal application status, check missing document lists, and monitor grievances. 3) Officers: Execute citizen lookups, query live SQL dashboard statistics, and explain AI duplicate detection analysis."
    },
    {
        "id": "faq_015",
        "category": "General",
        "keywords": ["site", "portal", "about", "what is this site", "overview", "purpose"],
        "question": "What is the Government Digital Services Portal?",
        "answer": "It is an official digital identity and public service delivery portal designed by the Ministry of Public Services & Administration to streamline citizen registration, identity verification, grievance redressal, and policy dissemination."
    }
]

RAG_DOCUMENTS = [
    {
        "id": "rag_srs_01",
        "title": "Government Digital Portal System Requirement Specification (SRS) v2.4",
        "keywords": ["srs", "requirements", "specification", "workflow", "stages"],
        "content": "Section 3.1: Citizen Onboarding Standards. Every citizen applicant must complete a multi-attribute registration profile covering Tax Identification (PAN), contact details, residential address, educational qualifications, and employment background. Applications follow a strict 3-tier lifecycle: 1. Draft Receipt (NOT_SUBMITTED) -> 2. Identity & Document Audit (PENDING) -> 3. Final Decision (APPROVED / REJECTED)."
    },
    {
        "id": "rag_policy_02",
        "title": "Government Identity & Anti-Fraud Security Directive 2026",
        "keywords": ["anti-fraud", "duplicate policy", "security directive", "legal rule"],
        "content": "Rule 14-B: Multi-Attribute Duplicate Prevention. No individual citizen is permitted to maintain multiple active portal accounts. The AI microservice must cross-examine PAN Card, Phone Number, Date of Birth, Name, and Address against all approved database records. High confidence duplicate matches (>=70%) mandate designated officer manual inspection before approval."
    },
    {
        "id": "rag_guide_03",
        "title": "Citizen Document Audit & Compliance Code 2026",
        "keywords": ["document compliance", "verification rules", "audit code"],
        "content": "Chapter 4: Verification Rules. All uploaded PAN card copies must match central Income Tax database records. Address proofs must correspond to the district and state specified in the digital registration form. Applications with missing or unreadable documents will be placed on status hold with explicit document requests sent to the applicant."
    },
    {
        "id": "rag_grievance_04",
        "title": "Public Grievance Redressal Mechanism Directive",
        "keywords": ["grievance policy", "redressal", "timeline", "resolution"],
        "content": "Directive 8: Citizens are entitled to file digital grievances for any registration delay, document verification dispute, or portal service issue. All grievances are logged with a unique tracking ID (e.g. GRV-8041) and must be reviewed and resolved by an authorized officer within 7 working days."
    }
]
