import { NextRequest, NextResponse } from 'next/server';
import { getAppointmentByKeyService } from '@/server/receptionist/appointments/appointments.service';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const appointmentKey = url.searchParams.get('appointmentKey') || '';
  const data = appointmentKey ? await getAppointmentByKeyService(appointmentKey) : null;
  return NextResponse.json({ success: true, data });
}
