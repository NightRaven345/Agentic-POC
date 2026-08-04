import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { AIService, AICapabilityResponse } from '../../services/ai.service';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-ai-capability-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="capability-container glass-panel" *ngIf="capabilities$ | async as cap">
      <div class="level-header">
        <div class="level-badge pulse-active">
          <span class="material-icons-round">psychology</span>
          <span class="level-title">{{ cap.level }}</span>
        </div>
        <span class="evolution-tag">
          <span class="material-icons-round">bolt</span> Dynamic Permissions Active
        </span>
      </div>

      <div class="capabilities-grid">
        <!-- Available Capabilities -->
        <div class="cap-column available">
          <div class="col-title"><span class="check-icon">✓</span> Available AI Capabilities</div>
          <div class="tags-wrapper">
            <div class="cap-tag av-tag" *ngFor="let item of cap.available">
              <span class="tag-name">✓ {{ item.name }}</span>
              <span class="tag-desc">{{ item.desc }}</span>
            </div>
          </div>
        </div>

        <!-- Unavailable Capabilities -->
        <div class="cap-column unavailable" *ngIf="cap.unavailable.length > 0">
          <div class="col-title"><span class="cross-icon">✗</span> Restricted Capabilities</div>
          <div class="tags-wrapper">
            <div class="cap-tag unav-tag" *ngFor="let item of cap.unavailable">
              <span class="tag-name">✗ {{ item.name }}</span>
              <span class="tag-desc">{{ item.desc }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .capability-container {
      margin: 0 1.5rem 1rem 1.5rem;
      padding: 1.2rem 1.6rem;
      border-radius: 16px;
      background: linear-gradient(135deg, rgba(17, 24, 39, 0.85) 0%, rgba(31, 41, 55, 0.7) 100%);
      border: 1px solid rgba(0, 242, 254, 0.2);
    }
    .level-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.9rem;
    }
    .level-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(0, 242, 254, 0.1);
      color: var(--accent-cyan);
      border: 1px solid rgba(0, 242, 254, 0.3);
      padding: 0.35rem 0.9rem;
      border-radius: 20px;
      font-family: var(--font-heading);
      font-weight: 700;
      font-size: 0.95rem;
    }
    .evolution-tag {
      font-size: 0.78rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    .capabilities-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.2rem;
    }
    @media (max-width: 768px) {
      .capabilities-grid { grid-template-columns: 1fr; }
    }
    .col-title {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.6rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .check-icon { color: var(--accent-emerald); font-weight: bold; }
    .cross-icon { color: var(--accent-rose); font-weight: bold; }
    .tags-wrapper {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .cap-tag {
      padding: 0.4rem 0.75rem;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      font-size: 0.8rem;
    }
    .av-tag {
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #a7f3d0;
    }
    .unav-tag {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.25);
      color: #fca5a5;
      opacity: 0.75;
    }
    .tag-name {
      font-weight: 600;
    }
    .tag-desc {
      font-size: 0.68rem;
      opacity: 0.8;
    }
  `]
})
export class AICapabilityBarComponent implements OnInit {
  capabilities$!: Observable<AICapabilityResponse>;

  constructor(
    private authService: AuthService,
    private aiService: AIService
  ) {}

  ngOnInit() {
    this.capabilities$ = this.authService.currentSession$.pipe(
      switchMap(session => this.aiService.getCapabilities(session.role))
    );
  }
}
