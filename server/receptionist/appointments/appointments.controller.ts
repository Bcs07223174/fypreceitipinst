import { NextRequest, NextResponse } from 'next/server';
import { deleteAppointmentService, getAppointmentByKeyService, getAppointmentService, getAppointmentsService, updateAppointmentService } from './appointments.service';

export async function getAppointmentsController(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const clinicId = url.searchParams.get('clinicId') || undefined;
    const date = url.searchParams.get('date') || undefined;
    const appointments = await getAppointmentsService({ clinicId, date });
    return NextResponse.json({ success: true, data: appointments });
  } catch (error) {
    console.error('[receptionist/appointments] GET failed', error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Failed to fetch appointments' }, { status: 500 });
  }
}

export async function getAppointmentController(_request: NextRequest, params: { clinicId: string; date: string; appointmentId: string; }) {
  const appointment = await getAppointmentService(params.clinicId, params.date, params.appointmentId);
  return NextResponse.json({ success: true, data: appointment });
}

export async function patchAppointmentController(request: NextRequest, params: { clinicId: string; date: string; appointmentId: string; }) {
  try {
    const body = await request.json();
    const appointment = await updateAppointmentService(params.clinicId, params.date, params.appointmentId, body);
    return NextResponse.json({ success: true, data: appointment });
  } catch (error) {
    console.error('[receptionist/appointments] PATCH failed', error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Failed to update appointment' }, { status: 400 });
  }
}

export async function deleteAppointmentController(_request: NextRequest, params: { clinicId: string; date: string; appointmentId: string; }) {
  await deleteAppointmentService(params.clinicId, params.date, params.appointmentId);
  return NextResponse.json({ success: true, data: { deleted: true } });
}

export async function getAppointmentByKeyController(request: NextRequest) {
  const url = new URL(request.url);
  const appointmentKey = url.searchParams.get('appointmentKey');
  const data = appointmentKey ? await getAppointmentByKeyService(appointmentKey) : null;
  return NextResponse.json({ success: true, data });
}
