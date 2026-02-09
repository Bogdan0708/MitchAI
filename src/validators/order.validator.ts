import { z } from 'zod';

// Strict limits to prevent abuse
const MAX_ORDER_ITEMS = 50;
const MAX_ITEM_QUANTITY = 100;
const MAX_NOTES_LENGTH = 500;
const MAX_NAME_LENGTH = 100;
const MAX_MODIFIERS = 10;

const orderItemSchema = z.object({
  menu_item_id: z.string().uuid('Invalid menu item ID'),
  quantity: z.number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(MAX_ITEM_QUANTITY, `Maximum quantity is ${MAX_ITEM_QUANTITY}`),
  modifiers: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().max(100).optional(),
  })).max(MAX_MODIFIERS, `Maximum ${MAX_MODIFIERS} modifiers per item`).optional(),
  notes: z.string()
    .max(MAX_NOTES_LENGTH, `Notes cannot exceed ${MAX_NOTES_LENGTH} characters`)
    .optional(),
});

export const createOrderSchema = z.object({
  body: z.object({
    location_id: z.string().uuid('Invalid location ID'),
    table_id: z.string().uuid('Invalid table ID').optional(),
    order_type: z.enum(['dine_in', 'takeaway', 'delivery'], {
      errorMap: () => ({ message: 'Order type must be dine_in, takeaway, or delivery' }),
    }),
    items: z.array(orderItemSchema)
      .min(1, 'Order must contain at least one item')
      .max(MAX_ORDER_ITEMS, `Maximum ${MAX_ORDER_ITEMS} items per order`),
    customer_id: z.string().uuid('Invalid customer ID').optional(),
    customer_name: z.string()
      .max(MAX_NAME_LENGTH, `Name cannot exceed ${MAX_NAME_LENGTH} characters`)
      .optional(),
    customer_email: z.string()
      .email('Invalid email address')
      .max(254, 'Email too long')
      .optional(),
    customer_phone: z.string()
      .regex(/^[\d\s+\-()]{7,20}$/, 'Invalid phone number format')
      .optional(),
    notes: z.string()
      .max(MAX_NOTES_LENGTH, `Notes cannot exceed ${MAX_NOTES_LENGTH} characters`)
      .optional(),
    source: z.enum(['web', 'mobile', 'pos', 'qr', 'phone', 'third_party']).optional(),
    delivery_address: z.object({
      line1: z.string().max(200),
      line2: z.string().max(200).optional(),
      city: z.string().max(100),
      postcode: z.string().max(20),
      country: z.string().max(100).optional(),
      instructions: z.string().max(500).optional(),
    }).optional(),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid order ID'),
  }),
  body: z.object({
    status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'], {
      errorMap: () => ({ message: 'Invalid order status' }),
    }),
    reason: z.string().max(500).optional(), // For cancellation reasons
  }),
});

// Query params for listing orders
export const listOrdersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).max(1000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']).optional(),
    location_id: z.string().uuid().optional(),
    from_date: z.string().datetime().optional(),
    to_date: z.string().datetime().optional(),
  }),
});
