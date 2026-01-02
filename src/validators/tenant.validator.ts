import { z } from 'zod';

export const updateTenantSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    phone: z.string().optional(),
    timezone: z.string().optional(),
    locale: z.string().length(5).optional(), // e.g. en-GB
    settings: z.record(z.any()).optional(),
  }),
});

export const createLocationSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Location name is required'),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
  }),
});

export const updateLocationSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    is_active: z.boolean().optional(),
  }),
});
