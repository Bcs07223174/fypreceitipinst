import { isReceptionistRole } from './receptionistPermissions';

export function canAccessReceptionistArea(role?: string | null) {
  return isReceptionistRole(role);
}
