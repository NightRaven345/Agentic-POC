import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './components/navbar/navbar.component';
import { AICapabilityBarComponent } from './components/ai-capability-bar/ai-capability-bar.component';
import { PublicLandingComponent } from './components/public-landing/public-landing.component';
import { AuthModalComponent } from './components/auth-modal/auth-modal.component';
import { PendingViewComponent } from './components/pending-view/pending-view.component';
import { CitizenDashboardComponent } from './components/citizen-dashboard/citizen-dashboard.component';
import { EmployeeDashboardComponent } from './components/employee-dashboard/employee-dashboard.component';
import { ChatbotComponent } from './components/chatbot/chatbot.component';
import { AuthService, UserSession } from './services/auth.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    AICapabilityBarComponent,
    PublicLandingComponent,
    AuthModalComponent,
    PendingViewComponent,
    CitizenDashboardComponent,
    EmployeeDashboardComponent,
    ChatbotComponent
  ],
  template: `
    <div class="app-layout">
      
      <!-- Top Global Navbar -->
      <app-navbar></app-navbar>

      <!-- Dynamic AI Capabilities Banner (Shows Available vs Unavailable per Role) -->
      <app-ai-capability-bar></app-ai-capability-bar>

      <!-- Main Application Dynamic Views -->
      <main class="main-content" *ngIf="session$ | async as session">
        
        <!-- 1. PUBLIC GUEST VIEW -->
        <app-public-landing 
          *ngIf="session.role === 'PUBLIC'"
          (openSignup)="showAuthModal = true"
          (openLogin)="showAuthModal = true">
        </app-public-landing>

        <!-- 2. PENDING CITIZEN VIEW -->
        <app-pending-view 
          *ngIf="session.role === 'ROLE_USER' && session.status === 'PENDING'">
        </app-pending-view>

        <!-- 3. APPROVED CITIZEN DASHBOARD -->
        <app-citizen-dashboard 
          *ngIf="session.role === 'ROLE_USER' && session.status === 'APPROVED'">
        </app-citizen-dashboard>

        <!-- 4. EMPLOYEE OFFICER MANAGEMENT CONSOLE -->
        <app-employee-dashboard 
          *ngIf="session.role === 'ROLE_EMPLOYEE'">
        </app-employee-dashboard>

      </main>

      <!-- Login & Signup Modal Overlay -->
      <app-auth-modal *ngIf="showAuthModal" (close)="showAuthModal = false"></app-auth-modal>

      <!-- Persistent Context-Aware AI Chatbot (Always Visible) -->
      <app-chatbot></app-chatbot>

    </div>
  `,
  styles: [`
    .app-layout {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      padding-bottom: 2rem;
    }
    .main-content {
      flex: 1;
    }
  `]
})
export class AppComponent {
  showAuthModal = false;
  session$: Observable<UserSession> = this.authService.currentSession$;

  constructor(private authService: AuthService) {}
}
