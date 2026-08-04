import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';

export interface UserSession {
  token: string | null;
  id: number | null;
  username: string;
  role: 'PUBLIC' | 'ROLE_USER' | 'ROLE_EMPLOYEE';
  status: 'PUBLIC' | 'PENDING' | 'APPROVED' | 'REJECTED';
  registrationId?: string;
  fullName?: string;
  approvalStage?: string;
  estimatedProcessingDays?: number;
  missingDocuments?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private initialSession: UserSession = {
    token: null,
    id: null,
    username: 'Public Guest',
    role: 'PUBLIC',
    status: 'PUBLIC'
  };

  private currentSessionSubject = new BehaviorSubject<UserSession>(this.initialSession);
  public currentSession$: Observable<UserSession> = this.currentSessionSubject.asObservable();

  constructor() {
    const saved = localStorage.getItem('gov_user_session');
    if (saved) {
      try {
        this.currentSessionSubject.next(JSON.parse(saved));
      } catch (e) {}
    }
  }

  public get session(): UserSession {
    return this.currentSessionSubject.value;
  }

  public setSession(session: UserSession) {
    localStorage.setItem('gov_user_session', JSON.stringify(session));
    this.currentSessionSubject.next(session);
  }

  public logout() {
    localStorage.removeItem('gov_user_session');
    this.currentSessionSubject.next(this.initialSession);
  }

  // Quick Demo Role Switcher for seamless proof of concept demonstration!
  public switchDemoRole(targetRole: 'PUBLIC' | 'CITIZEN_PENDING' | 'CITIZEN_APPROVED' | 'EMPLOYEE') {
    if (targetRole === 'PUBLIC') {
      this.logout();
    } else if (targetRole === 'CITIZEN_PENDING') {
      const session: UserSession = {
        token: 'demo_jwt_pending',
        id: 1043,
        username: 'priya.v@gmail.com',
        role: 'ROLE_USER',
        status: 'PENDING',
        registrationId: 'USR-1043',
        fullName: 'Priya Verma',
        approvalStage: 'Identity & Document Audit',
        estimatedProcessingDays: 3,
        missingDocuments: 'Self-Attested Residence Certificate, Qualification Marksheet'
      };
      this.setSession(session);
    } else if (targetRole === 'CITIZEN_APPROVED') {
      const session: UserSession = {
        token: 'demo_jwt_approved',
        id: 1042,
        username: 'rahul.sharma@gmail.com',
        role: 'ROLE_USER',
        status: 'APPROVED',
        registrationId: 'USR-1042',
        fullName: 'Rahul Sharma',
        approvalStage: 'Approved & Active',
        estimatedProcessingDays: 0,
        missingDocuments: 'None'
      };
      this.setSession(session);
    } else if (targetRole === 'EMPLOYEE') {
      const session: UserSession = {
        token: 'demo_jwt_employee',
        id: 9001,
        username: 'officer@gov.in',
        role: 'ROLE_EMPLOYEE',
        status: 'APPROVED',
        registrationId: 'EMP-9001',
        fullName: 'Vikram Aditya (Review Officer)',
        approvalStage: 'N/A'
      };
      this.setSession(session);
    }
  }
}
