import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

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
}

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {
  private initialApplications: PendingApplication[] = [
    {
      id: 1045,
      registrationId: 'USR-1045',
      firstName: 'Rahul',
      middleName: 'K',
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
      qualification: 'B.Tech IT',
      organization: 'TechCorp Solutions',
      experienceYears: 5,
      skills: 'Web Apps, Cloud',
      emergencyContact: '9988776600',
      missingDocuments: 'Proof of Address',
      approvalStage: 'Identity & Document Verification',
      status: 'PENDING',
      createdAt: '2026-07-30 14:20'
    },
    {
      id: 1043,
      registrationId: 'USR-1043',
      firstName: 'Priya',
      middleName: 'Rani',
      lastName: 'Verma',
      dob: '1995-08-20',
      gender: 'Female',
      phone: '9123456789',
      email: 'priya.v@gmail.com',
      pan: 'XYZPS9876Q',
      address: 'House 12, Park Street',
      district: 'Kolkata',
      state: 'West Bengal',
      pin: '700016',
      qualification: 'M.Sc Biotechnology',
      organization: 'BioInnovate Labs',
      experienceYears: 3,
      skills: 'Lab Research',
      emergencyContact: '9123456700',
      missingDocuments: 'Self-Attested Residence Certificate',
      approvalStage: 'Document Audit',
      status: 'PENDING',
      createdAt: '2026-07-30 11:15'
    }
  ];

  private applicationsSubject = new BehaviorSubject<PendingApplication[]>(this.initialApplications);
  public applications$: Observable<PendingApplication[]> = this.applicationsSubject.asObservable();

  constructor() {}

  public getApplications(): PendingApplication[] {
    return this.applicationsSubject.value;
  }

  public approveApplication(id: number) {
    const list = this.applicationsSubject.value.map(app => {
      if (app.id === id) {
        return { ...app, status: 'APPROVED' as const, approvalStage: 'Approved & Active' };
      }
      return app;
    });
    this.applicationsSubject.next(list);
  }

  public rejectApplication(id: number) {
    const list = this.applicationsSubject.value.map(app => {
      if (app.id === id) {
        return { ...app, status: 'REJECTED' as const, approvalStage: 'Registration Rejected' };
      }
      return app;
    });
    this.applicationsSubject.next(list);
  }

  public addApplication(newApp: PendingApplication) {
    this.applicationsSubject.next([newApp, ...this.applicationsSubject.value]);
  }
}
