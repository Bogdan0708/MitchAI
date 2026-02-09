import { z } from 'zod';

// Strict limits
const MAX_NAME_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_ALLERGENS = 20;
const MAX_PRICE = 10000; // £10,000 max price
const MAX_CALORIES = 50000;

// Common allergens for validation hints
const COMMON_ALLERGENS = [
  'gluten', 'dairy', 'eggs', 'fish', 'shellfish', 'nuts', 
  'peanuts', 'soy', 'sesame', 'celery', 'mustard', 'lupin', 
  'molluscs', 'sulphites'
] as const;

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string()
      .min(1, 'Category name is required')
      .max(MAX_NAME_LENGTH, `Name cannot exceed ${MAX_NAME_LENGTH} characters`),
    description: z.string()
      .max(MAX_DESCRIPTION_LENGTH, `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`)
      .optional(),
    display_order: z.number().int().min(0).max(1000).optional(),
    image_url: z.string().url('Invalid image URL').max(2000).optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid category ID'),
  }),
  body: z.object({
    name: z.string()
      .min(1)
      .max(MAX_NAME_LENGTH, `Name cannot exceed ${MAX_NAME_LENGTH} characters`)
      .optional(),
    description: z.string()
      .max(MAX_DESCRIPTION_LENGTH)
      .optional(),
    display_order: z.number().int().min(0).max(1000).optional(),
    is_active: z.boolean().optional(),
    image_url: z.string().url().max(2000).nullable().optional(),
  }),
});

export const createMenuItemSchema = z.object({
  body: z.object({
    category_id: z.string().uuid('Invalid category ID'),
    name: z.string()
      .min(1, 'Item name is required')
      .max(MAX_NAME_LENGTH, `Name cannot exceed ${MAX_NAME_LENGTH} characters`),
    description: z.string()
      .max(MAX_DESCRIPTION_LENGTH, `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`)
      .optional(),
    price: z.number()
      .min(0, 'Price must be positive')
      .max(MAX_PRICE, `Price cannot exceed ${MAX_PRICE}`),
    image_url: z.string()
      .url('Invalid image URL')
      .max(2000, 'URL too long')
      .optional(),
    allergens: z.array(z.string().max(50))
      .max(MAX_ALLERGENS, `Maximum ${MAX_ALLERGENS} allergens`)
      .optional(),
    dietary_info: z.object({
      is_vegetarian: z.boolean().optional(),
      is_vegan: z.boolean().optional(),
      is_gluten_free: z.boolean().optional(),
      is_halal: z.boolean().optional(),
      is_kosher: z.boolean().optional(),
    }).optional(),
    calories: z.number()
      .int()
      .min(0)
      .max(MAX_CALORIES, `Calories cannot exceed ${MAX_CALORIES}`)
      .optional(),
    preparation_time_minutes: z.number().int().min(0).max(480).optional(),
    is_available: z.boolean().optional(),
    display_order: z.number().int().min(0).max(10000).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
  }),
});

export const updateMenuItemSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid menu item ID'),
  }),
  body: z.object({
    category_id: z.string().uuid('Invalid category ID').optional(),
    name: z.string().min(1).max(MAX_NAME_LENGTH).optional(),
    description: z.string().max(MAX_DESCRIPTION_LENGTH).nullable().optional(),
    price: z.number().min(0).max(MAX_PRICE).optional(),
    image_url: z.string().url().max(2000).nullable().optional(),
    allergens: z.array(z.string().max(50)).max(MAX_ALLERGENS).optional(),
    dietary_info: z.object({
      is_vegetarian: z.boolean().optional(),
      is_vegan: z.boolean().optional(),
      is_gluten_free: z.boolean().optional(),
      is_halal: z.boolean().optional(),
      is_kosher: z.boolean().optional(),
    }).optional(),
    calories: z.number().int().min(0).max(MAX_CALORIES).nullable().optional(),
    preparation_time_minutes: z.number().int().min(0).max(480).nullable().optional(),
    is_available: z.boolean().optional(),
    display_order: z.number().int().min(0).max(10000).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
  }),
});

// Bulk operations
export const bulkUpdateMenuItemsSchema = z.object({
  body: z.object({
    items: z.array(z.object({
      id: z.string().uuid(),
      is_available: z.boolean().optional(),
      price: z.number().min(0).max(MAX_PRICE).optional(),
    })).min(1).max(100, 'Maximum 100 items per bulk update'),
  }),
});

// Query params
export const listMenuItemsSchema = z.object({
  query: z.object({
    category_id: z.string().uuid().optional(),
    is_available: z.coerce.boolean().optional(),
    search: z.string().max(100).optional(),
  }),
});
