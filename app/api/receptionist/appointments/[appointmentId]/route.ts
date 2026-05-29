import { NextRequest } from 'next/server';
import { deleteAppointmentController, getAppointmentController, patchAppointmentController } from '@/server/receptionist/appointments/appointments.controller';

export async function GET(request: NextRequest, context: { params: Promise<{ appointmentId: string; }>; }) {
  const { appointmentId } = await context.params;
  const url = new URL(request.url);
  const clinicId = url.searchParams.get('clinicId') || '';
  const date = url.searchParams.get('date') || '';
  return getAppointmentController(request, { clinicId, date, appointmentId });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ appointmentId: string; }>; }) {
  const { appointmentId } = await context.params;
  const url = new URL(request.url);
  const clinicId = url.searchParams.get('clinicId') || '';
  const date = url.searchParams.get('date') || '';
  return patchAppointmentController(request, { clinicId, date, appointmentId });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ appointmentId: string; }>; }) {
  const { appointmentId } = await context.params;
  const url = new URL(request.url);
  const clinicId = url.searchParams.get('clinicId') || '';
  const date = url.searchParams.get('date') || '';
  return deleteAppointmentController(request, { clinicId, date, appointmentId });
}
