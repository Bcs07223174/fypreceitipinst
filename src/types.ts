export type UserRole = 'receptionist' | 'doctor' | 'admin' | 'patient';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  clinicId: string;
  status: 'active' | 'inactive';
  profileCompleted: boolean;
  createdAt: any;
}

export interface ReceptionistProfile {
  uid: string;
  clinicId: string;
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  shift: string;
  profileImageUrl: string;
  assignedDoctorIds: string[];
  status: string;
  createdAt: any;
  updatedAt: any;
  address?: string;
}

export interface DoctorProfile {
  uid: string;
  fullName: string;
  specialization: string;
  roomNumber: string;
  status: string;
  profileImageUrl: string;
  createdAt: any;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  clinicId: string;
  date: string;
  slotStartTime: string;
  slotEndTime: string;
  appointmentKey?: string;
  status: AppointmentStatus;
  qrVerified: boolean;
  verificationToken?: string;
  queueNumber?: number;
  checkedInAt?: any;
  checkedInBy?: string;
  rejectionReason?: string;
  createdAt: any;
  updatedAt: any;
}

export type AppointmentStatus = 
  | 'pending'
  | 'booked' 
  | 'confirmed' 
  | 'checked_in' 
  | 'waiting' 
  | 'called' 
  | 'in_consultation' 
  | 'completed' 
  | 'cancelled' 
  | 'missed' 
  | 'rejected' 
  | 'rescheduled';
