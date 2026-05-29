import { NextRequest, NextResponse } from 'next/server';
import { listAppointmentsByClinicDate } from '@/server/receptionist/appointments/appointments.repository';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get('clinicId') || '';
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const data = await listAppointmentsByClinicDate(clinicId, date);
  return NextResponse.json({ success: true, data });
}
