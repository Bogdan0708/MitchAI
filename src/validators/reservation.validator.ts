import { z } from 'zod';

export const createReservationSchema = z.object({
  body: z.object({
    location_id: z.string().uuid(),
    customer_name: z.string().min(1, 'Customer name is required'),
    customer_email: z.string().email().optional(),
    customer_phone: z.string().optional(),
    party_size: z.number().int().min(1),
    reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    reservation_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
    duration_minutes: z.number().int().optional(),
    notes: z.string().optional(),
    special_requests: z.string().optional(),
  }),
});

export const updateReservationStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum(['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show']),
  }),
});
