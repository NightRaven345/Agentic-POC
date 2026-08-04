import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AIService } from '../../services/ai.service';

@Component({
  selector: 'app-public-landing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="landing-wrapper">
      
      <!-- Hero Section -->
      <div class="hero-card glass-panel">
        <div class="hero-content">
          <div class="tag-pill">
            <span class="material-icons-round color-cyan">verified</span>
            <span>Official Government Portal Assistant</span>
          </div>
          <h1>AI-Powered Citizen Services & Workflow Intelligence</h1>
          <p class="hero-desc">
            Experience the next-generation government portal. Get instant answers to public FAQs, track registration workflows, and experience permission-aware enterprise AI assistance.
          </p>

          <div class="hero-actions">
            <button class="btn-primary" (click)="onOpenSignup()">
              <span class="material-icons-round">how_to_reg</span> Register New Application
            </button>
            <button class="btn-secondary" (click)="askAI('What documents are required for registration?')">
              <span class="material-icons-round">quiz</span> Ask FAQ Assistant
            </button>
          </div>
        </div>
      </div>

      <!-- Feature Grid -->
      <div class="features-grid">
        <div class="feature-card glass-panel" (click)="askAI('What documents are required?')">
          <div class="f-icon"><span class="material-icons-round">description</span></div>
          <h3>Public FAQ Assistant</h3>
          <p>Instant semantic matching for registration requirements, SLAs, and public guidelines.</p>
          <span class="f-link">Ask FAQ "What documents are required?" →</span>
        </div>

        <div class="feature-card glass-panel" (click)="askAI('What is vendor registration?')">
          <div class="f-icon"><span class="material-icons-round">account_balance</span></div>
          <h3>Vendor & Citizen Onboarding</h3>
          <p>RAG vector search powered by official government SRS and policy documentation.</p>
          <span class="f-link">Ask RAG "What is vendor registration?" →</span>
        </div>

        <div class="feature-card glass-panel" (click)="onOpenLogin()">
          <div class="f-icon"><span class="material-icons-round">security</span></div>
          <h3>Role-Based Intelligence</h3>
          <p>AI capabilities automatically unlock as you log in as a Citizen or Reviewing Officer.</p>
          <span class="f-link">Log In to unlock workflow APIs →</span>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .landing-wrapper {
      margin: 1rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .hero-card {
      padding: 2.5rem;
      background: linear-gradient(135deg, rgba(17, 24, 39, 0.9) 0%, rgba(31, 41, 55, 0.7) 100%);
      border: 1px solid rgba(0, 242, 254, 0.25);
    }
    .tag-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(0, 242, 254, 0.1);
      color: var(--accent-cyan);
      padding: 0.3rem 0.8rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    .color-cyan { color: var(--accent-cyan); }
    .hero-content h1 {
      font-family: var(--font-heading);
      font-size: 2.2rem;
      font-weight: 800;
      line-height: 1.25;
      margin-bottom: 0.9rem;
      background: linear-gradient(135deg, #ffffff 0%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-desc {
      font-size: 1rem;
      color: var(--text-muted);
      max-width: 680px;
      line-height: 1.6;
      margin-bottom: 1.8rem;
    }
    .hero-actions {
      display: flex;
      gap: 1rem;
    }
    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.2rem;
    }
    @media (max-width: 768px) { .features-grid { grid-template-columns: 1fr; } }
    .feature-card {
      padding: 1.6rem;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      transition: all 0.25s ease;
    }
    .feature-card:hover {
      transform: translateY(-4px);
      border-color: rgba(0, 242, 254, 0.4);
    }
    .f-icon {
      width: 46px;
      height: 46px;
      border-radius: 12px;
      background: rgba(79, 172, 254, 0.12);
      color: var(--accent-cyan);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .feature-card h3 { font-family: var(--font-heading); font-size: 1.1rem; font-weight: 700; }
    .feature-card p { font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; }
    .f-link { font-size: 0.8rem; color: var(--accent-cyan); font-weight: 600; margin-top: auto; }
  `]
})
export class PublicLandingComponent {
  @Output() openSignup = new EventEmitter<void>();
  @Output() openLogin = new EventEmitter<void>();

  constructor(private aiService: AIService) {}

  onOpenSignup() { this.openSignup.emit(); }
  onOpenLogin() { this.openLogin.emit(); }

  askAI(prompt: string) {
    this.aiService.sendMessage(prompt);
  }
}
