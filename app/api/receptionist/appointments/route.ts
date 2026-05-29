import { NextRequest } from 'next/server';
import { getAppointmentsController } from '@/server/receptionist/appointments/appointments.controller';

export async function GET(request: NextRequest) {
  return getAppointmentsController(request);
}
