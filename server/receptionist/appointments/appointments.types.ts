import type { Appointment, AppointmentStatus } from '@/styles/types';

export type AppointmentRecord = Appointment & {
  appointmentId: string;
  notes?: string;
  walkInPatient?: boolean;
  appointmentKey?: string;
  appointmentStatus?: AppointmentStatus;
};
