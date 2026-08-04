import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmployeeService, PendingApplication } from '../../services/employee.service';
import { DuplicatePanelComponent } from '../duplicate-panel/duplicate-panel.component';
import { AIService } from '../../services/ai.service';
import { Observable, map } from 'rxjs';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DuplicatePanelComponent],
  template: `
    <div class="employee-wrapper">
      
      <!-- If an application is selected for review, show the Registration Review Page with Duplicate Detection -->
      <div *ngIf="selectedApplication">
        <app-duplicate-panel [application]="selectedApplication" (back)="selectedApplication = null"></app-duplicate-panel>
      </div>

      <!-- Main Queue View -->
      <div class="queue-container glass-panel" *ngIf="!selectedApplication">
        
        <!-- Header -->
        <div class="dash-header">
          <div class="title-wrap">
            <div class="officer-badge">
              <span class="material-icons-round color-purple">admin_panel_settings</span>
            </div>
            <div>
              <h2>Government Officer Management Console</h2>
              <p class="subtitle">Review pending registrations, evaluate AI duplicate analysis, and manage workflow approvals.</p>
            </div>
          </div>

          <div class="search-bar">
            <span class="material-icons-round color-muted">search</span>
            <input type="text" [(ngModel)]="searchQuery" placeholder="Search applicant by name, PAN, phone..." class="search-input">
            <button class="btn-primary sm" (click)="askAISearch()">
              <span class="material-icons-round">psychology</span> Ask AI SQL Tool
            </button>
          </div>
        </div>

        <!-- Filter Tabs -->
        <div class="tab-bar">
          <button class="t-btn" [class.active]="activeTab === 'PENDING'" (click)="activeTab = 'PENDING'">
            <span class="material-icons-round font-amber">hourglass_top</span> Pending Applications
            <span class="count-pill amber-pill">{{ (pendingApps$ | async)?.length }}</span>
          </button>

          <button class="t-btn" [class.active]="activeTab === 'APPROVED'" (click)="activeTab = 'APPROVED'">
            <span class="material-icons-round font-emerald">check_circle</span> Approved Users
            <span class="count-pill emerald-pill">{{ (approvedApps$ | async)?.length }}</span>
          </button>

          <button class="t-btn" [class.active]="activeTab === 'REJECTED'" (click)="activeTab = 'REJECTED'">
            <span class="material-icons-round font-rose">cancel</span> Rejected Applications
            <span class="count-pill rose-pill">{{ (rejectedApps$ | async)?.length }}</span>
          </button>
        </div>

        <!-- Applications Table -->
        <div class="table-responsive">
          <table class="app-table">
            <thead>
              <tr>
                <th>Registration ID</th>
                <th>Applicant Name</th>
                <th>PAN Number</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let app of getFilteredApps(activeTab)" class="table-row">
                <td><code class="reg-code">{{ app.registrationId }}</code></td>
                <td class="name-cell">
                  <strong>{{ app.firstName }} {{ app.lastName }}</strong>
                  <span class="sub-org">{{ app.organization }}</span>
                </td>
                <td><code class="pan-code">{{ app.pan }}</code></td>
                <td>{{ app.phone }}</td>
                <td>{{ app.email }}</td>
                <td>{{ app.createdAt || 'Recently' }}</td>
                <td>
                  <span class="badge" [ngClass]="{
                    'badge-pending': app.status === 'PENDING',
                    'badge-approved': app.status === 'APPROVED',
                    'badge-rejected': app.status === 'REJECTED'
                  }">{{ app.status }}</span>
                </td>
                <td>
                  <button class="btn-primary sm review-btn" *ngIf="app.status === 'PENDING'" (click)="openReview(app)">
                    <span class="material-icons-round">folder_shared</span> Inspect Details & AI Check
                  </button>
                  <button class="btn-secondary sm" *ngIf="app.status !== 'PENDING'" (click)="openReview(app)">
                    <span class="material-icons-round">visibility</span> Inspect Details
                  </button>
                </td>
              </tr>

              <tr *ngIf="getFilteredApps(activeTab).length === 0">
                <td colspan="8" class="empty-state">
                  No {{ activeTab.toLowerCase() }} applications found in database queue.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>
  `,
  styles: [`
    .employee-wrapper { margin: 1rem 1.5rem; }
    .queue-container { padding: 1.8rem; border: 1px solid rgba(139, 92, 246, 0.3); }
    .dash-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
      gap: 1rem;
    }
    @media (max-width: 900px) { .dash-header { flex-direction: column; align-items: flex-start; } }
    .title-wrap { display: flex; align-items: center; gap: 1rem; }
    .officer-badge {
      width: 50px;
      height: 50px;
      background: rgba(139, 92, 246, 0.15);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .color-purple { color: #c084fc; font-size: 28px; }
    .title-wrap h2 { font-family: var(--font-heading); font-size: 1.25rem; font-weight: 700; }
    .subtitle { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem; }
    .search-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.12);
      padding: 0.35rem 0.6rem;
      border-radius: 10px;
    }
    .search-input {
      background: transparent;
      border: none;
      color: white;
      font-size: 0.85rem;
      width: 240px;
    }
    .search-input:focus { outline: none; }
    .color-muted { color: var(--text-muted); }
    .sm { font-size: 0.78rem; padding: 0.4rem 0.8rem; }
    .tab-bar {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.2rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 0.6rem;
    }
    .t-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 0.88rem;
      font-weight: 600;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .t-btn.active {
      background: rgba(139, 92, 246, 0.2);
      color: #c084fc;
    }
    .font-amber { color: var(--accent-amber); }
    .font-emerald { color: var(--accent-emerald); }
    .font-rose { color: var(--accent-rose); }
    .count-pill {
      font-size: 0.72rem;
      padding: 0.1rem 0.45rem;
      border-radius: 10px;
      font-weight: 700;
    }
    .amber-pill { background: rgba(245, 158, 11, 0.2); color: var(--accent-amber); }
    .emerald-pill { background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald); }
    .rose-pill { background: rgba(239, 68, 68, 0.2); color: var(--accent-rose); }
    .table-responsive { overflow-x: auto; }
    .app-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    .app-table th {
      text-align: left;
      padding: 0.8rem;
      color: var(--text-muted);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .app-table td {
      padding: 0.9rem 0.8rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .table-row:hover { background: rgba(255, 255, 255, 0.03); }
    .reg-code { background: rgba(0, 242, 254, 0.1); color: var(--accent-cyan); padding: 0.2rem 0.4rem; border-radius: 4px; }
    .pan-code { font-family: monospace; font-weight: 600; color: #fcd34d; }
    .name-cell { display: flex; flex-direction: column; }
    .sub-org { font-size: 0.72rem; color: var(--text-muted); }
    .review-btn { background: linear-gradient(135deg, #8b5cf6 0%, #00f2fe 100%); color: black; }
    .empty-state { text-align: center; color: var(--text-muted); padding: 2rem; }
  `]
})
export class EmployeeDashboardComponent implements OnInit {
  activeTab: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING';
  searchQuery = '';
  selectedApplication: PendingApplication | null = null;

  pendingApps$!: Observable<PendingApplication[]>;
  approvedApps$!: Observable<PendingApplication[]>;
  rejectedApps$!: Observable<PendingApplication[]>;

  private allApps: PendingApplication[] = [];

  constructor(
    private employeeService: EmployeeService,
    private aiService: AIService
  ) {}

  ngOnInit() {
    this.employeeService.loadApplicationsFromBackend();

    this.pendingApps$ = this.employeeService.applications$.pipe(
      map(apps => apps.filter(a => a.status === 'PENDING'))
    );
    this.approvedApps$ = this.employeeService.applications$.pipe(
      map(apps => apps.filter(a => a.status === 'APPROVED'))
    );
    this.rejectedApps$ = this.employeeService.applications$.pipe(
      map(apps => apps.filter(a => a.status === 'REJECTED'))
    );

    this.employeeService.applications$.subscribe(apps => {
      this.allApps = apps;
    });
  }

  getFilteredApps(tab: 'PENDING' | 'APPROVED' | 'REJECTED'): PendingApplication[] {
    let filtered = this.allApps.filter(a => a.status === tab);
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.firstName.toLowerCase().includes(q) ||
        a.lastName.toLowerCase().includes(q) ||
        a.pan.toLowerCase().includes(q) ||
        a.phone.includes(q) ||
        a.registrationId.toLowerCase().includes(q)
      );
    }
    return filtered;
  }

  openReview(app: PendingApplication) {
    this.selectedApplication = app;
    this.aiService.setActiveAppContext(app);
  }

  askAISearch() {
    if (this.searchQuery.trim()) {
      this.aiService.sendMessage(`Search user ${this.searchQuery}`);
    } else {
      this.aiService.sendMessage('Show pending users');
    }
  }
}
