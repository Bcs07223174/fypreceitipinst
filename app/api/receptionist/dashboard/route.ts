import { NextRequest, NextResponse } from 'next/server';
import { listAppointmentsByClinicDate } from '@/server/receptionist/appointments/appointments.repository';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get('clinicId') || '';
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const appointments = await listAppointmentsByClinicDate(clinicId, date);

  return NextResponse.json({
    success: true,
    data: {
      todayAppointments: appointments.length,
      waitingPatients: appointments.filter((item) => ['confirmed', 'checked_in', 'waiting', 'called', 'in_consultation'].includes(String(item.status || '').toLowerCase())).length,
      completedToday: appointments.filter((item) => String(item.status || '').toLowerCase() === 'completed').length,
      cancelledToday: appointments.filter((item) => ['cancelled', 'rejected', 'missed'].includes(String(item.status || '').toLowerCase())).length,
    },
  });
}
