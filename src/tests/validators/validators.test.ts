/**
 * Validator Tests
 */

import {
  loginSchema,
  registerSchema,
} from '../../validators/auth.validator';
import {
  createMenuItemSchema,
} from '../../validators/menu.validator';
import {
  createOrderSchema,
} from '../../validators/order.validator';
import {
  chatMessageSchema,
  menuEnhanceSchema,
  recommendationsSchema,
} from '../../validators/ai.validator';

describe('Auth Validators', () => {
  describe('loginSchema', () => {
    it('should accept valid login data', () => {
      const validData = {
        body: {
          email: 'test@example.com',
          password: 'SecurePass123!',
        },
      };

      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        body: {
          email: 'not-an-email',
          password: 'SecurePass123!',
        },
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const invalidData = {
        body: {
          email: 'test@example.com',
          password: '',
        },
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const validData = {
        body: {
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          firstName: 'John',
          lastName: 'Doe',
          businessName: 'Test Restaurant',
          businessType: 'restaurant',
        },
      };

      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const invalidData = {
        body: {
          email: 'newuser@example.com',
          password: 'SecurePass123!',
        },
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

describe('Menu Validators', () => {
  describe('createMenuItemSchema', () => {
    it('should accept valid menu item', () => {
      const validData = {
        body: {
          name: 'Truffle Pasta',
          description: 'Delicious pasta with truffle',
          price: 24.99,
          category_id: '550e8400-e29b-41d4-a716-446655440000',
          is_available: true,
        },
      };

      const result = createMenuItemSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject negative price', () => {
      const invalidData = {
        body: {
          name: 'Bad Item',
          description: 'Should fail',
          price: -10,
          category_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      };

      const result = createMenuItemSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const invalidData = {
        body: {
          name: '',
          price: 10,
          category_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      };

      const result = createMenuItemSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

describe('Order Validators', () => {
  describe('createOrderSchema', () => {
    it('should accept valid order', () => {
      const validData = {
        body: {
          location_id: '550e8400-e29b-41d4-a716-446655440000',
          items: [
            {
              menu_item_id: '550e8400-e29b-41d4-a716-446655440001',
              quantity: 2,
            },
          ],
          order_type: 'dine_in',
        },
      };

      const result = createOrderSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject order with no items', () => {
      const invalidData = {
        body: {
          location_id: '550e8400-e29b-41d4-a716-446655440000',
          items: [],
          order_type: 'dine_in',
        },
      };

      const result = createOrderSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid quantity', () => {
      const invalidData = {
        body: {
          location_id: '550e8400-e29b-41d4-a716-446655440000',
          items: [
            {
              menu_item_id: '550e8400-e29b-41d4-a716-446655440001',
              quantity: 0,
            },
          ],
          order_type: 'dine_in',
        },
      };

      const result = createOrderSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

describe('AI Validators', () => {
  describe('chatMessageSchema', () => {
    it('should accept valid chat message', () => {
      const validData = {
        body: {
          message: 'What are your hours?',
          channel: 'web',
        },
      };

      const result = chatMessageSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty message', () => {
      const invalidData = {
        body: {
          message: '',
          channel: 'web',
        },
      };

      const result = chatMessageSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid channel', () => {
      const invalidData = {
        body: {
          message: 'Hello',
          channel: 'invalid_channel',
        },
      };

      const result = chatMessageSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept optional session ID', () => {
      const validData = {
        body: {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          message: 'Hello!',
        },
      };

      const result = chatMessageSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('menuEnhanceSchema', () => {
    it('should accept valid enhance request', () => {
      const validData = {
        params: { id: '550e8400-e29b-41d4-a716-446655440000' },
        body: {
          style: 'fine_dining',
          generateDescription: true,
          detectAllergens: true,
        },
      };

      const result = menuEnhanceSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('recommendationsSchema', () => {
    it('should accept valid recommendations query', () => {
      const validData = {
        query: {
          context: 'dinner',
          limit: '5',
          includeReasons: 'true',
        },
      };

      const result = recommendationsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});
