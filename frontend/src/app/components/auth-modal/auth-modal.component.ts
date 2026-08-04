import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { EmployeeService } from '../../services/employee.service';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="closeModal()">
      <div class="modal-card glass-panel" (click)="$event.stopPropagation()">
        
        <!-- Header Tabs -->
        <div class="modal-header">
          <div class="tab-group">
            <button class="tab-btn" [class.active]="isLogin" (click)="isLogin = true">
              <span class="material-icons-round">login</span> Citizen Login
            </button>
            <button class="tab-btn" [class.active]="!isLogin" (click)="isLogin = false">
              <span class="material-icons-round">how_to_reg</span> New Applicant Signup
            </button>
          </div>
          <button class="close-btn" (click)="closeModal()"><span class="material-icons-round">close</span></button>
        </div>

        <!-- LOGIN FORM -->
        <div class="form-body" *ngIf="isLogin">
          <h2>Welcome Back</h2>
          <p class="subtitle">Access your citizen workflow dashboard or employee console.</p>

          <div class="form-group">
            <label>Username / Email</label>
            <input type="text" [(ngModel)]="loginUsername" placeholder="e.g. rahul.sharma@gmail.com" class="input-field">
          </div>

          <div class="form-group">
            <label>Password</label>
            <input type="password" [(ngModel)]="loginPassword" placeholder="••••••••" class="input-field">
          </div>

          <div class="form-actions">
            <button class="btn-primary w-full" (click)="onLogin()">
              <span class="material-icons-round">login</span> Log In
            </button>
          </div>

          <div class="demo-quick-login">
            <p class="quick-title">Or click to login with pre-configured accounts:</p>
            <div class="quick-btns">
              <button class="btn-secondary sm" (click)="quickLogin('PENDING')">Priya Verma (Pending User)</button>
              <button class="btn-secondary sm" (click)="quickLogin('APPROVED')">Rahul Sharma (Approved User)</button>
              <button class="btn-secondary sm" (click)="quickLogin('EMPLOYEE')">Officer Vikram (Employee)</button>
            </div>
          </div>
        </div>

        <!-- RICH 15+ FIELD SIGNUP FORM FOR DUPLICATE DETECTION DEMO -->
        <div class="form-body signup-body" *ngIf="!isLogin">
          <div class="signup-banner">
            <span class="material-icons-round color-cyan">verified_user</span>
            <div>
              <h3>Government Identity Onboarding</h3>
              <p class="subtitle">Enter complete details. Information will be cross-checked by AI Duplicate Detection.</p>
            </div>
          </div>

          <form (ngSubmit)="onRegister()" class="signup-grid">
            <!-- Row 1: Name -->
            <div class="form-group">
              <label>First Name *</label>
              <input type="text" [(ngModel)]="reg.firstName" name="firstName" required placeholder="Rahul" class="input-field">
            </div>
            <div class="form-group">
              <label>Middle Name</label>
              <input type="text" [(ngModel)]="reg.middleName" name="middleName" placeholder="Kumar" class="input-field">
            </div>
            <div class="form-group">
              <label>Last Name *</label>
              <input type="text" [(ngModel)]="reg.lastName" name="lastName" required placeholder="Sharma" class="input-field">
            </div>

            <!-- Row 2: Personal Identifiers -->
            <div class="form-group">
              <label>PAN Card Number *</label>
              <input type="text" [(ngModel)]="reg.pan" name="pan" required placeholder="ABCDE1234F" class="input-field font-mono">
            </div>
            <div class="form-group">
              <label>Date of Birth *</label>
              <input type="date" [(ngModel)]="reg.dob" name="dob" required class="input-field">
            </div>
            <div class="form-group">
              <label>Gender *</label>
              <select [(ngModel)]="reg.gender" name="gender" class="input-field">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <!-- Row 3: Contact Info -->
            <div class="form-group">
              <label>Phone Number *</label>
              <input type="tel" [(ngModel)]="reg.phone" name="phone" required placeholder="9988776655" class="input-field">
            </div>
            <div class="form-group col-span-2">
              <label>Email Address *</label>
              <input type="email" [(ngModel)]="reg.email" name="email" required placeholder="rahul.sharma@gmail.com" class="input-field">
            </div>

            <!-- Row 4: Address Details -->
            <div class="form-group col-span-3">
              <label>Full Residential Address *</label>
              <input type="text" [(ngModel)]="reg.address" name="address" required placeholder="Flat 402, Green Valley Apartments, MG Road" class="input-field">
            </div>

            <div class="form-group">
              <label>District *</label>
              <input type="text" [(ngModel)]="reg.district" name="district" required placeholder="Bengaluru Urban" class="input-field">
            </div>
            <div class="form-group">
              <label>State *</label>
              <input type="text" [(ngModel)]="reg.state" name="state" required placeholder="Karnataka" class="input-field">
            </div>
            <div class="form-group">
              <label>PIN Code *</label>
              <input type="text" [(ngModel)]="reg.pin" name="pin" required placeholder="560001" class="input-field">
            </div>

            <!-- Row 5: Professional & Skills -->
            <div class="form-group">
              <label>Qualification *</label>
              <input type="text" [(ngModel)]="reg.qualification" name="qualification" required placeholder="B.Tech Computer Science" class="input-field">
            </div>
            <div class="form-group">
              <label>Current Organization *</label>
              <input type="text" [(ngModel)]="reg.organization" name="organization" required placeholder="TechCorp Solutions" class="input-field">
            </div>
            <div class="form-group">
              <label>Experience (Years)</label>
              <input type="number" [(ngModel)]="reg.experienceYears" name="experienceYears" placeholder="5" class="input-field">
            </div>

            <div class="form-group col-span-2">
              <label>Key Skills</label>
              <input type="text" [(ngModel)]="reg.skills" name="skills" placeholder="Software Engineering, Cloud" class="input-field">
            </div>
            <div class="form-group">
              <label>Emergency Contact *</label>
              <input type="tel" [(ngModel)]="reg.emergencyContact" name="emergencyContact" required placeholder="9988776600" class="input-field">
            </div>

            <!-- Submit Buttons -->
            <div class="form-actions col-span-3">
              <button type="submit" class="btn-primary w-full">
                <span class="material-icons-round">send</span> Submit Registration Application
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }
    .modal-card {
      width: 100%;
      max-width: 820px;
      max-height: 90vh;
      overflow-y: auto;
      background: rgba(17, 24, 39, 0.95);
      border: 1px solid rgba(0, 242, 254, 0.3);
      padding: 1.5rem 2rem;
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 1rem;
      margin-bottom: 1.2rem;
    }
    .tab-group {
      display: flex;
      gap: 0.5rem;
    }
    .tab-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 0.95rem;
      font-weight: 600;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .tab-btn.active {
      background: rgba(0, 242, 254, 0.15);
      color: var(--accent-cyan);
    }
    .close-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
    }
    .signup-banner {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      background: rgba(0, 242, 254, 0.08);
      border: 1px solid rgba(0, 242, 254, 0.2);
      padding: 0.8rem 1.2rem;
      border-radius: 12px;
      margin-bottom: 1.2rem;
    }
    .color-cyan { color: var(--accent-cyan); }
    .signup-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.85rem;
    }
    @media (max-width: 768px) {
      .signup-grid { grid-template-columns: 1fr; }
      .col-span-2, .col-span-3 { grid-column: span 1 !important; }
    }
    .col-span-2 { grid-column: span 2; }
    .col-span-3 { grid-column: span 3; }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .form-group label {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--text-muted);
    }
    .input-field {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: white;
      padding: 0.55rem 0.8rem;
      border-radius: 8px;
      font-size: 0.85rem;
    }
    .input-field:focus {
      outline: none;
      border-color: var(--accent-cyan);
    }
    .font-mono { font-family: monospace; text-transform: uppercase; }
    .w-full { width: 100%; justify-content: center; margin-top: 0.5rem; }
    .subtitle { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem; }
    .demo-quick-login {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px dashed rgba(255, 255, 255, 0.1);
    }
    .quick-title { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem; }
    .quick-btns { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .sm { font-size: 0.75rem; padding: 0.4rem 0.75rem; }
  `]
})
export class AuthModalComponent {
  @Output() close = new EventEmitter<void>();

  isLogin = false;
  loginUsername = '';
  loginPassword = '';

  reg = {
    firstName: 'Rahul',
    middleName: 'Kumar',
    lastName: 'Sharma',
    dob: '1992-05-15',
    gender: 'Male',
    phone: '9988776655',
    email: 'rahul.s.duplicate@gmail.com',
    pan: 'ABCDE1234F',
    address: 'Flat 402, Green Valley Apartments, MG Road',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    pin: '560001',
    qualification: 'B.Tech Computer Science',
    organization: 'TechCorp Solutions',
    experienceYears: 5,
    skills: 'Fullstack Engineering, Distributed Systems',
    emergencyContact: '9988776600'
  };

  constructor(
    private authService: AuthService,
    private employeeService: EmployeeService
  ) {}

  closeModal() {
    this.close.emit();
  }

  onLogin() {
    this.authService.switchDemoRole('CITIZEN_PENDING');
    this.closeModal();
  }

  quickLogin(role: 'PENDING' | 'APPROVED' | 'EMPLOYEE') {
    if (role === 'PENDING') this.authService.switchDemoRole('CITIZEN_PENDING');
    if (role === 'APPROVED') this.authService.switchDemoRole('CITIZEN_APPROVED');
    if (role === 'EMPLOYEE') this.authService.switchDemoRole('EMPLOYEE');
    this.closeModal();
  }

  onRegister() {
    const newId = Math.floor(1000 + Math.random() * 9000);
    this.employeeService.addApplication({
      id: newId,
      registrationId: `USR-${newId}`,
      firstName: this.reg.firstName,
      middleName: this.reg.middleName,
      lastName: this.reg.lastName,
      dob: this.reg.dob,
      gender: this.reg.gender,
      phone: this.reg.phone,
      email: this.reg.email,
      pan: this.reg.pan.toUpperCase(),
      address: this.reg.address,
      district: this.reg.district,
      state: this.reg.state,
      pin: this.reg.pin,
      qualification: this.reg.qualification,
      organization: this.reg.organization,
      experienceYears: this.reg.experienceYears,
      skills: this.reg.skills,
      emergencyContact: this.reg.emergencyContact,
      missingDocuments: 'Proof of Residence, PAN Copy',
      approvalStage: 'Identity & Document Verification',
      status: 'PENDING',
      createdAt: 'Just now'
    });

    this.authService.setSession({
      token: 'demo_jwt_new',
      id: newId,
      username: this.reg.email,
      role: 'ROLE_USER',
      status: 'PENDING',
      registrationId: `USR-${newId}`,
      fullName: `${this.reg.firstName} ${this.reg.lastName}`,
      approvalStage: 'Identity & Document Audit',
      estimatedProcessingDays: 3,
      missingDocuments: 'Proof of Residence, Self-Attested PAN Copy'
    });

    this.closeModal();
  }
}
