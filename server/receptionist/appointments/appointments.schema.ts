import { z } from 'zod';

export const appointmentQuerySchema = z.object({
  clinicId: z.string().optional(),
  date: z.string().optional(),
  doctorId: z.string().optional(),
});

export const appointmentPatchSchema = z.object({
  status: z.string().optional(),
  notes: z.string().optional(),
  paymentStatus: z.enum(['pending', 'paid', 'failed']).optional(),
});
