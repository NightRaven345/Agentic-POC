import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, UserSession } from '../../services/auth.service';
import { AIService } from '../../services/ai.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-pending-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pending-wrapper" *ngIf="session$ | async as session">
      
      <!-- Top Banner -->
      <div class="pending-card glass-panel">
        <div class="status-header">
          <div class="icon-wrap pulse-active">
            <span class="material-icons-round font-amber">hourglass_empty</span>
          </div>
          <div>
            <div class="top-meta">
              <h2>Registration Application Pending</h2>
              <span class="badge badge-pending">Status: {{ session.status }}</span>
            </div>
            <p class="subtitle">Registration Reference ID: <strong>{{ session.registrationId }}</strong></p>
          </div>
          <button class="btn-secondary logout-btn" (click)="onLogout()">
            <span class="material-icons-round">logout</span> Logout
          </button>
        </div>

        <!-- Metric Cards -->
        <div class="metrics-grid">
          <div class="metric-card glass-card">
            <span class="metric-label"><span class="material-icons-round">route</span> Approval Stage</span>
            <span class="metric-value color-amber">{{ session.approvalStage || 'Stage 2: Identity Audit' }}</span>
          </div>

          <div class="metric-card glass-card">
            <span class="metric-label"><span class="material-icons-round">schedule</span> Estimated Time</span>
            <span class="metric-value color-cyan">{{ session.estimatedProcessingDays || 3 }} Working Days</span>
          </div>

          <div class="metric-card glass-card">
            <span class="metric-label"><span class="material-icons-round">folder_open</span> Missing Documents</span>
            <span class="metric-value color-muted">{{ session.missingDocuments || 'Self-Attested PAN Copy' }}</span>
          </div>
        </div>

        <!-- Workflow Step Tracker -->
        <div class="workflow-stepper">
          <div class="step completed">
            <div class="step-circle">✓</div>
            <span class="step-name">1. Registration Submitted</span>
          </div>
          <div class="step-line active"></div>
          <div class="step active">
            <div class="step-circle pulse-active">2</div>
            <span class="step-name">2. Identity & Document Verification</span>
          </div>
          <div class="step-line"></div>
          <div class="step">
            <div class="step-circle">3</div>
            <span class="step-name">3. Officer Final Approval</span>
          </div>
        </div>
      </div>

      <!-- Quick AI Prompts Box for Pending Users -->
      <div class="ai-prompts-panel glass-panel">
        <div class="prompts-header">
          <span class="material-icons-round color-cyan">auto_awesome</span>
          <h3>Ask Citizen AI Assistant About Your Application</h3>
        </div>
        <p class="prompts-sub">Click any question below to immediately ask the AI Assistant in the bottom right corner:</p>
        
        <div class="prompts-chips">
          <button class="prompt-chip" (click)="askAI('What is happening with my application?')">
            <span class="material-icons-round">help_outline</span> "What is happening?"
          </button>
          <button class="prompt-chip" (click)="askAI('Why is my registration pending?')">
            <span class="material-icons-round">info</span> "Why is my registration pending?"
          </button>
          <button class="prompt-chip" (click)="askAI('What documents are missing for my registration?')">
            <span class="material-icons-round">description</span> "What documents are missing?"
          </button>
          <button class="prompt-chip" (click)="askAI('How long will approval take for my status?')">
            <span class="material-icons-round">timer</span> "How long will approval take?"
          </button>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .pending-wrapper {
      margin: 1rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
    }
    .pending-card {
      padding: 1.8rem;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .status-header {
      display: flex;
      align-items: center;
      gap: 1.2rem;
      margin-bottom: 1.8rem;
    }
    .icon-wrap {
      width: 54px;
      height: 54px;
      background: rgba(245, 158, 11, 0.15);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .font-amber { color: var(--accent-amber); font-size: 32px; }
    .top-meta {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .top-meta h2 {
      font-family: var(--font-heading);
      font-size: 1.35rem;
      font-weight: 700;
    }
    .subtitle { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem; }
    .logout-btn { margin-left: auto; }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 1.8rem;
    }
    @media (max-width: 768px) { .metrics-grid { grid-template-columns: 1fr; } }
    .metric-card {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .metric-label {
      font-size: 0.78rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    .metric-value {
      font-family: var(--font-heading);
      font-size: 1.1rem;
      font-weight: 700;
    }
    .color-amber { color: var(--accent-amber); }
    .color-cyan { color: var(--accent-cyan); }
    .color-muted { color: #d1d5db; font-size: 0.88rem; }
    .workflow-stepper {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
    .step {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .step-circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      font-weight: 700;
    }
    .step.completed .step-circle { background: var(--accent-emerald); color: black; }
    .step.active .step-circle { background: var(--accent-amber); color: black; }
    .step-line {
      flex: 1;
      height: 2px;
      background: rgba(255, 255, 255, 0.1);
      margin: 0 1rem;
    }
    .step-line.active { background: var(--accent-amber); }
    .step-name { font-size: 0.8rem; color: var(--text-muted); }
    .ai-prompts-panel {
      padding: 1.5rem;
      border: 1px solid rgba(0, 242, 254, 0.25);
    }
    .prompts-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.3rem;
    }
    .prompts-header h3 { font-family: var(--font-heading); font-size: 1.1rem; }
    .prompts-sub { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem; }
    .prompts-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .prompt-chip {
      background: rgba(0, 242, 254, 0.08);
      border: 1px solid rgba(0, 242, 254, 0.3);
      color: #7dd3fc;
      padding: 0.6rem 1.1rem;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.2s ease;
    }
    .prompt-chip:hover {
      background: rgba(0, 242, 254, 0.2);
      border-color: var(--accent-cyan);
      transform: translateY(-2px);
    }
  `]
})
export class PendingViewComponent {
  session$: Observable<UserSession> = this.authService.currentSession$;

  constructor(
    private authService: AuthService,
    private aiService: AIService
  ) {}

  onLogout() {
    this.authService.logout();
  }

  askAI(question: string) {
    this.aiService.sendMessage(question);
  }
}
