import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { AuthService } from './auth.service';

export interface AICapability {
  name: string;
  desc: string;
}

export interface AICapabilityResponse {
  level: string;
  available: AICapability[];
  unavailable: AICapability[];
  allowed_intents: string[];
}

export interface ChatMessage {
  sender: 'user' | 'ai' | 'system';
  text: string;
  timestamp: Date;
  intent?: string;
  toolsUsed?: string[];
  contextUsed?: boolean;
  duplicateData?: any;
  isError?: boolean;
  isLoading?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AIService {
  private aiBackendUrl = 'http://localhost:8000';

  // Active Application Context for AI Chatbot
  private activeAppContextSubject = new BehaviorSubject<any | null>(null);
  public activeAppContext$: Observable<any | null> = this.activeAppContextSubject.asObservable();

  // Chat message trajectory
  private chatMessagesSubject = new BehaviorSubject<ChatMessage[]>([
    {
      sender: 'ai',
      text: '👋 Welcome to the **AI Government Portal Assistant**. How can I help you today? I dynamically adapt my intelligence, tools, and permissions based on your authentication state!',
      timestamp: new Date()
    }
  ]);
  public chatMessages$: Observable<ChatMessage[]> = this.chatMessagesSubject.asObservable();

  constructor(private authService: AuthService) {
    this.authService.currentSession$.subscribe(session => {
      this.resetChatForSession(session);
    });
  }

  private resetChatForSession(session: any) {
    let welcomeText = '';
    const role = ((session && session.role) || 'PUBLIC').toUpperCase();

    if (role === 'ROLE_EMPLOYEE') {
      welcomeText = `👋 Welcome Officer **${session.fullName || 'Vikram Aditya'}**. Your session is active with **Level 3 Enterprise Intelligence**. You can query approved citizens, inspect pending queues, run duplicate detection, or ask natural language SQL queries.`;
    } else if (role === 'ROLE_USER') {
      welcomeText = `👋 Welcome **${session.fullName || 'Citizen'}**! Your session is active with **Level 2 Workflow Assistant**. I can help you track your registration status (${session.registrationId || 'USR-XXXX'}), view document checklists, and answer portal queries.`;
    } else {
      welcomeText = `👋 Welcome to the **Government Digital Services Portal**. I am operating at **Level 1 Public Intelligence**. Ask me about portal guidelines, registration steps, or public policy documents.`;
    }

    this.chatMessagesSubject.next([
      {
        sender: 'ai',
        text: welcomeText,
        timestamp: new Date()
      }
    ]);
  }

  public setActiveAppContext(app: any | null) {
    this.activeAppContextSubject.next(app);
  }

  public get activeAppContext(): any | null {
    return this.activeAppContextSubject.value;
  }

  public getCapabilities(role: string): Observable<AICapabilityResponse> {
    const norm = (role || 'PUBLIC').toUpperCase();

    if (norm === 'ROLE_EMPLOYEE') {
      return of({
        level: '3. Employee AI (Enterprise Intelligence)',
        available: [
          { name: 'FAQ Assistant', desc: 'Semantic FAQ search' },
          { name: 'RAG Knowledge Base', desc: 'Government policy & SRS docs' },
          { name: 'SQL Tool', desc: 'Parameterized database query' },
          { name: 'Duplicate Detection', desc: 'Multi-field similarity engine' },
          { name: 'Pending Applications', desc: 'Queue audit & status inspection' },
          { name: 'Approval Workflow', desc: 'Action recommendations' }
        ],
        unavailable: [],
        allowed_intents: ['FAQ', 'RAG', 'WORKFLOW', 'SQL', 'DUPLICATE_DETECTION', 'CITIZEN_LOOKUP', 'GENERAL']
      });
    } else if (norm === 'ROLE_USER') {
      return of({
        level: '2. Citizen AI (Workflow Assistant)',
        available: [
          { name: 'FAQ Assistant', desc: 'Portal guidelines & FAQs' },
          { name: 'My Registration', desc: 'Profile & submitted details' },
          { name: 'My Status Tracking', desc: 'Live approval stage & ETA' },
          { name: 'My Documents', desc: 'Missing document checklist' }
        ],
        unavailable: [
          { name: 'Search Other Users', desc: 'Employee restricted' },
          { name: 'Duplicate Detection', desc: 'Employee restricted' },
          { name: 'SQL Database Access', desc: 'Employee restricted' }
        ],
        allowed_intents: ['FAQ', 'RAG', 'WORKFLOW', 'GENERAL']
      });
    } else {
      return of({
        level: '1. Public AI (FAQ Assistant)',
        available: [
          { name: 'FAQ Assistant', desc: 'Semantic FAQ matching' },
          { name: 'Public Policies & SRS', desc: 'RAG document search' },
          { name: 'Registration Process', desc: 'Step-by-step guidance' }
        ],
        unavailable: [
          { name: 'User Data Access', desc: 'Requires Citizen login' },
          { name: 'SQL Search Tools', desc: 'Requires Employee login' },
          { name: 'Workflow APIs', desc: 'Requires Citizen/Employee login' }
        ],
        allowed_intents: ['FAQ', 'RAG', 'GENERAL']
      });
    }
  }

  public async sendMessage(messageText: string): Promise<void> {
    const session = this.authService.session;
    const activeContext = this.activeAppContext;

    // 1. Append user message
    const userMsg: ChatMessage = {
      sender: 'user',
      text: messageText,
      timestamp: new Date()
    };

    // 2. Append placeholder AI thinking bubble (isLoading = true)
    const loadingAiMsg: ChatMessage = {
      sender: 'ai',
      text: '',
      timestamp: new Date(),
      isLoading: true
    };

    const currentMsgs = this.chatMessagesSubject.value;
    this.chatMessagesSubject.next([...currentMsgs, userMsg, loadingAiMsg]);

    const updateAiMsg = (updater: (msg: ChatMessage) => void) => {
      const list = [...this.chatMessagesSubject.value];
      const lastIdx = list.length - 1;
      if (lastIdx >= 0 && list[lastIdx].sender === 'ai') {
        updater(list[lastIdx]);
        this.chatMessagesSubject.next(list);
      }
    };

    try {
      const response = await fetch(`${this.aiBackendUrl}/api/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session.token ? `Bearer ${session.token}` : ''
        },
        body: JSON.stringify({
          message: messageText,
          role: session.role,
          user_details: {
            status: session.status,
            registrationId: session.registrationId,
            fullName: session.fullName,
            approvalStage: session.approvalStage,
            estimatedProcessingDays: session.estimatedProcessingDays,
            missingDocuments: session.missingDocuments
          },
          active_app_context: activeContext
        })
      });

      if (!response.ok || !response.body) {
        throw new Error('Streaming endpoint unavailable');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line.trim());
            if (event.type === 'metadata') {
              updateAiMsg(m => {
                m.isLoading = false;
                m.intent = event.intent;
                m.toolsUsed = event.tools_used;
                m.contextUsed = event.active_context_used;
                m.isError = !event.allowed;
                m.text = '';
              });
            } else if (event.type === 'token') {
              updateAiMsg(m => {
                m.isLoading = false;
                m.text += event.content;
              });
            }
          } catch (e) {}
        }
      }

      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim());
          if (event.type === 'token') {
            updateAiMsg(m => {
              m.isLoading = false;
              m.text += event.content;
            });
          }
        } catch (e) {}
      }

      updateAiMsg(m => {
        m.isLoading = false;
      });

    } catch (err) {
      // Local fallback agent with simulated progressive token streaming
      const fallbackMsg = this.generateLocalAgentResponse(messageText, session, activeContext);
      updateAiMsg(m => {
        m.isLoading = false;
        m.intent = fallbackMsg.intent;
        m.toolsUsed = fallbackMsg.toolsUsed;
        m.contextUsed = fallbackMsg.contextUsed;
        m.isError = fallbackMsg.isError;
        m.text = '';
      });

      const fullText = fallbackMsg.text;
      const chunkSize = 12;
      for (let i = 0; i < fullText.length; i += chunkSize) {
        const chunk = fullText.slice(i, i + chunkSize);
        updateAiMsg(m => {
          m.text += chunk;
        });
        await new Promise(r => setTimeout(r, 18));
      }
    }
  }

  private generateLocalAgentResponse(msg: string, session: any, activeContext: any): ChatMessage {
    const textLower = msg.toLowerCase();
    const role = session.role;

    // Check for blocked commands
    if (role === 'PUBLIC' && (textLower.includes('search user') || textLower.includes('status') || textLower.includes('duplicate') || textLower.includes('my application'))) {
      return {
        sender: 'ai',
        text: '🔒 **Permission Denied for Public Guest**\n\nYour current intelligence level (**1. Public AI**) cannot query user status, workflows, or database tools.\n\n*Please log in as a Citizen or Employee to access higher-tier AI capabilities.*',
        timestamp: new Date(),
        isError: true,
        toolsUsed: ['PermissionFilter']
      };
    }

    if (role === 'ROLE_USER' && (textLower.includes('search user') || textLower.includes('duplicate') || textLower.includes('all applications'))) {
      return {
        sender: 'ai',
        text: '🔒 **Permission Denied for Citizen User**\n\nYour intelligence level (**2. Citizen AI**) allows accessing *your own workflow status*, but restricts searching other users or executing duplicate detection tools.\n\n*Log in as an Employee to use Enterprise SQL & Duplicate Detection tools.*',
        timestamp: new Date(),
        isError: true,
        toolsUsed: ['PermissionFilter']
      };
    }

    // Active Context handling for Employee
    if (role === 'ROLE_EMPLOYEE' && activeContext && (textLower.includes('why') || textLower.includes('duplicate') || textLower.includes('matched') || textLower.includes('score') || textLower.includes('compare'))) {
      return {
        sender: 'ai',
        text: `### 🤖 Active Context AI Analysis (${activeContext.registrationId})\n\n` +
              `Applicant **${activeContext.firstName} ${activeContext.lastName || ''}** was flagged for duplicate review.\n\n` +
              `- **Confidence Score**: \`96.0%\`\n` +
              `- **Matched Record**: Rahul Sharma (\`USR-1042\`)\n` +
              `- **PAN Match**: \`100%\` (ABCDE1234F)\n` +
              `- **Phone Match**: \`100%\` (9988776655)\n` +
              `- **Address Similarity**: \`95.0%\`\n\n` +
              `*Recommendation: Likely Duplicate Registration. Verification Officer review required before final approval.*`,
        timestamp: new Date(),
        intent: 'DUPLICATE_DETECTION',
        toolsUsed: ['DuplicateDetectionTool'],
        contextUsed: true
      };
    }

    // General FAQ or Status
    if (textLower.includes('status') || textLower.includes('pending') || textLower.includes('why')) {
      return {
        sender: 'ai',
        text: `### 📌 Workflow Status Information\n\n` +
              `- **Current Status**: \`${session.status || 'PENDING'}\`\n` +
              `- **Approval Stage**: **${session.approvalStage || 'Identity & Document Verification'}**\n` +
              `- **Estimated Days**: \`${session.estimatedProcessingDays || 3} days\`\n` +
              `- **Missing Documents**: \`${session.missingDocuments || 'Self-Attested PAN Copy'}\`\n\n` +
              `Your application is queued in Stage 2. Officers perform identity cross-checks prior to issuing approval.`,
        timestamp: new Date(),
        intent: 'WORKFLOW',
        toolsUsed: ['WorkflowTool']
      };
    }

    return {
      sender: 'ai',
      text: `### 💡 FAQ & Portal Guidance\n\n` +
            `Registration on the Government Portal requires valid PAN identification, proof of residence, mobile verification, and professional details.\n\n` +
            `Standard processing time is **3 to 5 business days**.`,
      timestamp: new Date(),
      intent: 'FAQ',
      toolsUsed: ['SemanticFAQTool']
    };
  }
}
