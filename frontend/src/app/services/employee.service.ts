import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface PendingApplication {
  id: number;
  registrationId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dob: string;
  gender: string;
  phone: string;
  email: string;
  pan: string;
  address: string;
  district: string;
  state: string;
  pin: string;
  qualification: string;
  organization: string;
  experienceYears: number;
  skills: string;
  emergencyContact: string;
  missingDocuments?: string;
  approvalStage?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt?: string;
  assignedOfficerName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {
  private backendUrl = 'http://localhost:8080';

  private applicationsSubject = new BehaviorSubject<PendingApplication[]>([]);
  public applications$: Observable<PendingApplication[]> = this.applicationsSubject.asObservable();

  constructor(private authService: AuthService) {
    this.loadApplicationsFromBackend();
  }

  public async loadApplicationsFromBackend(): Promise<void> {
    const token = this.authService.session.token;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        fetch(`${this.backendUrl}/api/employee/pending`, { headers }),
        fetch(`${this.backendUrl}/api/employee/approved`, { headers }),
        fetch(`${this.backendUrl}/api/employee/rejected`, { headers })
      ]);

      let all: PendingApplication[] = [];

      if (pendingRes.ok) {
        const pending: PendingApplication[] = await pendingRes.json();
        all = all.concat(pending.map(p => ({ ...p, status: 'PENDING' as const })));
      }
      if (approvedRes.ok) {
        const approved: PendingApplication[] = await approvedRes.json();
        all = all.concat(approved.map(a => ({ ...a, status: 'APPROVED' as const })));
      }
      if (rejectedRes.ok) {
        const rejected: PendingApplication[] = await rejectedRes.json();
        all = all.concat(rejected.map(r => ({ ...r, status: 'REJECTED' as const })));
      }

      if (all.length > 0) {
        this.applicationsSubject.next(all);
      }
    } catch (err) {
      console.warn('Backend unavailable, using cached local data', err);
    }
  }

  public getApplications(): PendingApplication[] {
    return this.applicationsSubject.value;
  }

  public async approveApplication(id: number): Promise<void> {
    const token = this.authService.session.token;
    try {
      await fetch(`${this.backendUrl}/api/employee/approve/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
    } catch (e) {}

    const list = this.applicationsSubject.value.map(app => {
      if (app.id === id) {
        return { ...app, status: 'APPROVED' as const, approvalStage: 'Approved & Active' };
      }
      return app;
    });
    this.applicationsSubject.next(list);
    this.loadApplicationsFromBackend();
  }

  public async rejectApplication(id: number, reason?: string): Promise<void> {
    const token = this.authService.session.token;
    try {
      await fetch(`${this.backendUrl}/api/employee/reject/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ reason: reason || 'Document Audit Discrepancy' })
      });
    } catch (e) {}

    const list = this.applicationsSubject.value.map(app => {
      if (app.id === id) {
        return { ...app, status: 'REJECTED' as const, approvalStage: 'Initial Review' };
      }
      return app;
    });
    this.applicationsSubject.next(list);
    this.loadApplicationsFromBackend();
  }

  public addApplication(newApp: PendingApplication) {
    this.applicationsSubject.next([newApp, ...this.applicationsSubject.value]);
  }
}
