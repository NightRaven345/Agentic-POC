import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, UserSession } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="navbar glass-panel">
      <div class="nav-brand">
        <div class="logo-icon">
          <span class="material-icons-round">account_balance</span>
        </div>
        <div class="brand-text">
          <h1>GovPortal <span class="ai-badge">AI 3.0</span></h1>
          <span class="subtitle">Enterprise Portal Assistant POC</span>
        </div>
      </div>

      <!-- Quick Role Demo Switcher Bar -->
      <div class="demo-role-switcher">
        <span class="switcher-label"><span class="material-icons-round">tune</span> Switch Demo Role:</span>
        <button 
          class="role-btn" 
          [class.active]="(session$ | async)?.role === 'PUBLIC'"
          (click)="switchRole('PUBLIC')">
          <span class="material-icons-round">public</span> Public Guest
        </button>

        <button 
          class="role-btn" 
          [class.active]="(session$ | async)?.role === 'ROLE_USER' && (session$ | async)?.status === 'PENDING'"
          (click)="switchRole('CITIZEN_PENDING')">
          <span class="material-icons-round">hourglass_top</span> Citizen (Pending)
        </button>

        <button 
          class="role-btn" 
          [class.active]="(session$ | async)?.role === 'ROLE_USER' && (session$ | async)?.status === 'APPROVED'"
          (click)="switchRole('CITIZEN_APPROVED')">
          <span class="material-icons-round">verified</span> Citizen (Approved)
        </button>

        <button 
          class="role-btn employee-btn" 
          [class.active]="(session$ | async)?.role === 'ROLE_EMPLOYEE'"
          (click)="switchRole('EMPLOYEE')">
          <span class="material-icons-round">admin_panel_settings</span> Employee Officer
        </button>
      </div>

      <!-- User Profile Action -->
      <div class="nav-user">
        <ng-container *ngIf="(session$ | async) as session">
          <div class="user-chip">
            <span class="user-name">{{ session.fullName || session.username }}</span>
            <span class="badge" [ngClass]="{
              'badge-public': session.role === 'PUBLIC',
              'badge-pending': session.status === 'PENDING',
              'badge-approved': session.status === 'APPROVED',
              'badge-employee': session.role === 'ROLE_EMPLOYEE'
            }">
              {{ session.role === 'PUBLIC' ? 'Public' : (session.role === 'ROLE_EMPLOYEE' ? 'Employee' : session.status) }}
            </span>
          </div>
        </ng-container>
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.85rem 1.8rem;
      margin: 1rem 1.5rem;
      border-radius: 16px;
    }
    .nav-brand {
      display: flex;
      align-items: center;
      gap: 0.8rem;
    }
    .logo-icon {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #000;
    }
    .brand-text h1 {
      font-family: var(--font-heading);
      font-size: 1.25rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .ai-badge {
      font-size: 0.65rem;
      background: rgba(0, 242, 254, 0.2);
      color: var(--accent-cyan);
      border: 1px solid var(--accent-cyan);
      padding: 0.15rem 0.4rem;
      border-radius: 6px;
    }
    .subtitle {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .demo-role-switcher {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(0, 0, 0, 0.3);
      padding: 0.35rem 0.6rem;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .switcher-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 0.2rem;
      margin-right: 0.2rem;
    }
    .role-btn {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      padding: 0.35rem 0.75rem;
      border-radius: 8px;
      font-size: 0.78rem;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.3rem;
      transition: all 0.2s ease;
    }
    .role-btn:hover {
      color: white;
      background: rgba(255, 255, 255, 0.08);
    }
    .role-btn.active {
      background: rgba(79, 172, 254, 0.2);
      color: var(--accent-cyan);
      border-color: rgba(0, 242, 254, 0.4);
    }
    .role-btn.employee-btn.active {
      background: rgba(139, 92, 246, 0.25);
      color: #c084fc;
      border-color: rgba(192, 132, 252, 0.5);
    }
    .user-chip {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .user-name {
      font-size: 0.85rem;
      font-weight: 500;
    }
  `]
})
export class NavbarComponent {
  session$ = this.authService.currentSession$;

  constructor(private authService: AuthService) {}

  switchRole(role: 'PUBLIC' | 'CITIZEN_PENDING' | 'CITIZEN_APPROVED' | 'EMPLOYEE') {
    this.authService.switchDemoRole(role);
  }
}
