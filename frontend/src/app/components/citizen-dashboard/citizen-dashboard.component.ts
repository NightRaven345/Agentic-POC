import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, UserSession } from '../../services/auth.service';
import { AIService } from '../../services/ai.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-citizen-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="citizen-wrapper" *ngIf="session$ | async as session">
      
      <!-- Top Welcome Card -->
      <div class="citizen-card glass-panel">
        <div class="welcome-header">
          <div class="avatar-box">
            <span class="material-icons-round">person_outline</span>
          </div>
          <div>
            <div class="title-row">
              <h2>Welcome, {{ session.fullName || 'Citizen User' }}</h2>
              <span class="badge badge-approved">Status: Approved</span>
            </div>
            <p class="subtitle">Registration ID: <strong>{{ session.registrationId }}</strong> | Ministry Portal Account Active</p>
          </div>
          <button class="btn-secondary logout-btn" (click)="onLogout()">
            <span class="material-icons-round">logout</span> Logout
          </button>
        </div>

        <!-- Quick Profile Details -->
        <div class="details-grid">
          <div class="detail-item glass-card">
            <span class="detail-label">Email Address</span>
            <span class="detail-val">{{ session.username }}</span>
          </div>
          <div class="detail-item glass-card">
            <span class="detail-label">Approval Stage</span>
            <span class="detail-val color-emerald">Approved & Active</span>
          </div>
          <div class="detail-item glass-card">
            <span class="detail-label">Security Tier</span>
            <span class="detail-val color-cyan">Tier 2 Verified Citizen</span>
          </div>
        </div>
      </div>

      <!-- Quick AI Assistance Shortcuts -->
      <div class="ai-shortcuts glass-panel">
        <div class="sc-header">
          <span class="material-icons-round color-cyan">smart_toy</span>
          <h3>Citizen AI Workflow Assistant Shortcuts</h3>
        </div>
        <div class="sc-buttons">
          <button class="btn-secondary" (click)="askAI('What is my registration status?')">
            <span class="material-icons-round">check_circle</span> "What is my registration status?"
          </button>
          <button class="btn-secondary" (click)="askAI('Show my profile information')">
            <span class="material-icons-round">account_box</span> "Show my profile information"
          </button>
          <button class="btn-secondary" (click)="askAI('What documents are on file for me?')">
            <span class="material-icons-round">folder_special</span> "What documents are on file?"
          </button>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .citizen-wrapper {
      margin: 1rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
    }
    .citizen-card { padding: 1.8rem; border: 1px solid rgba(16, 185, 129, 0.3); }
    .welcome-header { display: flex; align-items: center; gap: 1.2rem; margin-bottom: 1.5rem; }
    .avatar-box {
      width: 54px;
      height: 54px;
      background: rgba(16, 185, 129, 0.15);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--accent-emerald);
    }
    .title-row { display: flex; align-items: center; gap: 1rem; }
    .title-row h2 { font-family: var(--font-heading); font-size: 1.35rem; }
    .subtitle { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem; }
    .logout-btn { margin-left: auto; }
    .details-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    @media (max-width: 768px) { .details-grid { grid-template-columns: 1fr; } }
    .detail-item { display: flex; flex-direction: column; gap: 0.3rem; }
    .detail-label { font-size: 0.75rem; color: var(--text-muted); }
    .detail-val { font-weight: 600; font-size: 0.95rem; }
    .color-emerald { color: var(--accent-emerald); }
    .color-cyan { color: var(--accent-cyan); }
    .ai-shortcuts { padding: 1.5rem; }
    .sc-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
    .sc-buttons { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  `]
})
export class CitizenDashboardComponent {
  session$: Observable<UserSession> = this.authService.currentSession$;

  constructor(
    private authService: AuthService,
    private aiService: AIService
  ) {}

  onLogout() {
    this.authService.logout();
  }

  askAI(query: string) {
    this.aiService.sendMessage(query);
  }
}
