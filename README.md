# AI-Powered Government Portal Assistant (POC)

An enterprise Proof of Concept demonstrating a **single AI Assistant that dynamically evolves its intelligence, permissions, available tools, responses, and active context** depending on the user's authentication state and role (**Public Guest -> Citizen User -> Employee Review Officer**).

---

## 🏛️ System Architecture

```
 ┌─────────────────────────────────────────────────────────────┐
 │                      Angular Frontend                       │
 │  - Dynamic Role Capability Indicator                        │
 │  - Responsive Layouts: Public, Pending, Citizen, Employee   │
 │  - Automatic AI Context Switcher (Application Review)       │
 │  - Floating/Sidebar AI Chatbot Component                    │
 └──────────────┬──────────────────────────────┬───────────────┘
                │ REST (Auth/Workflow)         │ REST / Chat WS
                ▼                              ▼
 ┌─────────────────────────────┐  ┌────────────────────────────┐
 │  Spring Boot 3 Backend API  │  │  Python FastAPI AI Service │
 │  - Spring Security & JWT    │  │  - LangGraph Agent Graph   │
 │  - User & Role Persistence  │  │  - FastMCP Tool Registry   │
 │  - Workflow State Engine    │◄─┼──- ChromaDB (bge-small-en) │
 │  - User & Approval Service  │  │  - Field Duplicate Engine  │
 └──────────────┬──────────────┘  └──────────────┬─────────────┘
                │                                │
                ▼                                ▼
       H2 / PostgreSQL DB                 Ollama / LLM API
```

---

## 🔐 AI Intelligence Evolution Matrix

| User Role | AI Intelligence Level | Available Capabilities (✓) | Unavailable / Blocked (✗) |
|---|---|---|---|
| **Public User** (Not Logged In) | **1. Public AI** | ✓ FAQ Assistant<br>✓ Public Policies & SRS<br>✓ Registration Process | ✗ User Search<br>✗ Approval Status<br>✗ SQL Database Tools<br>✗ Workflow APIs |
| **Citizen User** (Logged In) | **2. Citizen AI** | ✓ FAQ Assistant<br>✓ My Registration Profile<br>✓ My Status Tracking<br>✓ My Missing Documents | ✗ Search Other Users<br>✗ Duplicate Detection<br>✗ SQL Search Tools<br>✗ Employee Console |
| **Employee Officer** (Logged In) | **3. Employee AI** | ✓ FAQ Assistant<br>✓ RAG Knowledge Base<br>✓ SQL Tool (Parameterized)<br>✓ Duplicate Detection<br>✓ Pending Applications<br>✓ Approval Workflow | *(Full Enterprise AI Access)* |

---

## ⚡ Quick Start Instructions

### Prerequisites
- Node.js (v18+)
- Java JDK 11 or 17 & Maven
- Python 3.10+

### Option A: Launch All Tiers via Script (Windows)
Run `start-all.bat` from the root directory:
```bash
.\start-all.bat
```

### Option B: Run Tiers Separately

1. **Spring Boot Backend (Port 8080)**:
   ```bash
   cd backend
   mvn spring-boot:run
   ```

2. **Python FastAPI AI Service (Port 8000)**:
   ```bash
   cd ai-backend
   pip install -r requirements.txt
   python -m uvicorn main:app --port 8000 --reload
   ```

3. **Angular Frontend (Port 4200)**:
   ```bash
   cd frontend
   npm install
   npm start
   ```

---

## 🧪 Demonstration Test Scenarios

### Scenario 1: Public Guest Experience
1. Open `http://localhost:4200` without logging in.
2. Observe the **AI Capabilities Bar**: Only Public FAQ & RAG are marked **Available (✓)**.
3. Open the floating **AI Assistant** in the bottom-right corner.
4. Ask: `"What documents are required?"` -> AI returns semantic FAQ answer.
5. Ask: `"Search user Rahul Sharma"` -> AI returns **🔒 Permission Denied** notice because Public users cannot call SQL tools.

### Scenario 2: Rich 15+ Field Registration & Pending User Experience
1. Click **"Register New Application"** or **"New Applicant Signup"**.
2. Complete the rich 15+ field form (PAN: `ABCDE1234F`, Phone: `9988776655`, Name: `Rahul Sharma`).
3. Upon registration, you are immediately placed into the **Pending Registration View**:
   - Status: `PENDING`
   - Approval Stage: `Identity & Document Audit`
   - Estimated Time: `3 Working Days`
   - Quick Prompts: Click `"Why is my registration pending?"` -> Citizen AI explains current approval stage.

### Scenario 3: Employee Console & Automatic AI Duplicate Detection
1. Click **"Employee Officer"** in the top navigation bar (or log in as `officer@gov.in` / `Officer@123`).
2. Observe the **AI Capabilities Bar** dynamically upgrade to **3. Employee AI (Enterprise Intelligence)**.
3. Click **"Review & AI Check"** on a pending registration.
4. **Registration Review Page Opens**:
   - The **AI Duplicate Detection Panel** automatically executes on page load!
   - Calculates **96% Confidence Score** (Likely Duplicate Registration).
   - Breakdown shows green checks for:
     - `✓ PAN matches existing approved user (ABCDE1234F)`
     - `✓ Phone number matches existing record (9988776655)`
     - `✓ Address similarity 95%`
     - `✓ Name similarity 90%`
   - Matched Record: `Rahul Sharma (USR-1042)`
5. **AI Active Context Absorption**:
   - Notice the AI Chatbot context chip updates to `Active Review Context: Rahul Sharma (USR-1045)`.
   - Ask the AI Assistant: `"Why was this flagged as a duplicate?"` or `"Explain confidence score"`.
   - The AI answers **directly in the context of the currently open application** without asking you to re-specify the applicant!
6. Click **Approve** or **Reject** to complete officer action.

---

## 📂 Directory Structure

```text
project23/
├── ai-backend/       # Python FastAPI, LangGraph Agent, ChromaDB
├── backend/          # Java Spring Boot 3 API, Spring Security, H2/PostgreSQL
├── frontend/         # Angular UI, Responsive Layouts
└── start-all.bat     # Windows startup script
```

## 🛠️ Environment Configuration

### AI Backend (`ai-backend/.env`)
Ensure your `.env` file is configured with the necessary LLM and database credentials. See `.env.example` for required keys.

### Spring Boot Backend
Configured to use an in-memory H2 database for testing by default. For production, you can switch the data source to PostgreSQL via `application.properties`.

---

## 🤝 Troubleshooting & Tips
- **Ports already in use?** Ensure ports `4200` (Angular), `8080` (Spring Boot), and `8000` (FastAPI) are free before running the startup script.
- **AI RAG Reset:** You can run `python cleanup_db.py` in the `ai-backend` directory to reset the local RAG collections if you experience vector search issues.
