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
  firebaseUid?: string;
  clinicId: string;
  fullName: string;
  email: string;
  photoUrl?: string;
  linked_doctor_ids?: string[];
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
  firebaseUid?: string;
  doctorId?: string;
  fullName: string;
  name?: string;
  doctorName?: string;
  specialization: string;
  roomNumber: string;
  status: string;
  email?: string;
  photoUrl?: string;
  profileImageUrl: string;
  createdAt: any;
}

export interface DoctorScheduleDay {
  dateOfWeek: string;
  dayOfWeek: string;
  morningSlots: string[];
  eveningSlots: string[];
  isOffDay: boolean;
  slotDuration?: string;
}

export interface DoctorSchedule {
  id: string;
  doctorId: string;
  doctor_id?: string;
  clinicId?: string;
  weekStart?: string;
  weekEnd?: string;
  totalSlots?: number;
  createdAt: any;
  updatedAt?: any;
  days: DoctorScheduleDay[];
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
  appointmentDate?: string;
  appointmentTime?: string;
  slotStartTime: string;
  slotEndTime: string;
  appointmentKey?: string;
  status: AppointmentStatus;
  paymentStatus?: 'pending' | 'paid' | 'failed';
  createdBy?: string;
  createdById?: string;
  qrVerified: boolean;
  verificationToken?: string;
  queueNumber?: number;
  checkedInAt?: any;
  checkedInBy?: string;
  rejectionReason?: string;
  createdAt: any;
  updatedAt: any;
}

export interface DashboardDailySummary {
  todayAppointments: number;
  waitingPatients: number;
  completed: number;
  cancelled: number;
  updatedAt?: any;
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
