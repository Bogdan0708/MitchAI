import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Category name is required'),
    description: z.string().optional(),
    display_order: z.number().int().optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    display_order: z.number().int().optional(),
    is_active: z.boolean().optional(),
  }),
});

export const createMenuItemSchema = z.object({
  body: z.object({
    category_id: z.string().uuid('Invalid category ID'),
    name: z.string().min(1, 'Item name is required'),
    description: z.string().optional(),
    price: z.number().min(0, 'Price must be positive'),
    image_url: z.string().url().optional(),
    allergens: z.array(z.string()).optional(),
    calories: z.number().int().optional(),
    is_available: z.boolean().optional(),
  }),
});

export const updateMenuItemSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    category_id: z.string().uuid().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    price: z.number().min(0).optional(),
    image_url: z.string().url().optional(),
    allergens: z.array(z.string()).optional(),
    calories: z.number().int().optional(),
    is_available: z.boolean().optional(),
  }),
});
