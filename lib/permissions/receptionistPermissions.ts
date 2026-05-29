import type { UserRole } from '@/styles/types';

export const receptionistPermissions = {
  canViewAppointments: true,
  canCreateAppointment: true,
  canUpdateAppointmentStatus: true,
  canViewQueue: true,
  canUpdateQueue: true,
  canScanQr: true,
  canViewProfile: true,
  canUpdateProfile: true,
  canDeleteDoctor: false,
  canDeletePatient: false,
  canDeleteClinic: false,
  canAccessAdminSettings: false,
} as const;

export function isReceptionistRole(role?: UserRole | string | null) {
  return role === 'receptionist';
}
