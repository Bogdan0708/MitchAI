import { z } from 'zod';

const orderItemSchema = z.object({
  menu_item_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  modifiers: z.array(z.any()).optional(),
  notes: z.string().optional(),
});

export const createOrderSchema = z.object({
  body: z.object({
    location_id: z.string().uuid(),
    table_id: z.string().uuid().optional(),
    order_type: z.enum(['dine_in', 'takeaway', 'delivery']),
    items: z.array(orderItemSchema).min(1, 'Order must contain at least one item'),
    customer_id: z.string().uuid().optional(),
    customer_name: z.string().optional(),
    customer_email: z.string().email().optional(),
    customer_phone: z.string().optional(),
    notes: z.string().optional(),
    source: z.string().optional(),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']),
  }),
});
