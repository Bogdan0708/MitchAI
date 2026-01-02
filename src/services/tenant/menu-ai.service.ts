/**
 * Menu AI Service
 *
 * AI-powered menu enhancements:
 * - Generate appetizing descriptions
 * - Translate menu items
 * - Suggest pricing
 * - Detect allergens
 * - Create upsell recommendations
 */

import { Pool } from 'pg';
import { AIRouter, AIMessage, SYSTEM_PROMPTS } from './ai';

export interface MenuItemInput {
  name: string;
  description?: string;
  price?: number;
  category?: string;
  ingredients?: string[];
}

export interface MenuItemEnhancement {
  aiDescription: string;
  suggestedPrice?: number;
  detectedAllergens: string[];
  keywords: string[];
  upsellSuggestions: string[];
}

export interface TranslationResult {
  name: string;
  description: string;
  language: string;
}

export class MenuAIService {
  private aiRouter: AIRouter;
  private pool: Pool;

  constructor(aiRouter: AIRouter, pool: Pool) {
    this.aiRouter = aiRouter;
    this.pool = pool;
  }

  /**
   * Generate an appetizing AI description for a menu item
   */
  async generateDescription(
    tenantId: string,
    item: MenuItemInput,
    style?: 'casual' | 'fine_dining' | 'street_food' | 'family'
  ): Promise<string> {
    const styleGuide = this.getStyleGuide(style || 'casual');

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `${SYSTEM_PROMPTS.menuAi}\n\n${styleGuide}`
      },
      {
        role: 'user',
        content: `Generate an appetizing menu description for:

Name: ${item.name}
${item.description ? `Current Description: ${item.description}` : ''}
${item.category ? `Category: ${item.category}` : ''}
${item.ingredients?.length ? `Key Ingredients: ${item.ingredients.join(', ')}` : ''}
${item.price ? `Price: ${item.price}` : ''}

Write a compelling 2-3 sentence description that makes customers want to order this item.`
      }
    ];

    const response = await this.aiRouter.complete({
      messages,
      tenantId,
      requestType: 'menu_ai',
      maxTokens: 200,
      temperature: 0.8
    });

    return response.content.trim();
  }

  /**
   * Enhance a menu item with AI-generated content
   */
  async enhanceMenuItem(
    tenantId: string,
    item: MenuItemInput,
    options?: {
      style?: 'casual' | 'fine_dining' | 'street_food' | 'family';
      includePrice?: boolean;
      includeAllergens?: boolean;
      includeUpsells?: boolean;
    }
  ): Promise<MenuItemEnhancement> {
    const tasks: Promise<unknown>[] = [];

    // Generate description
    const descriptionPromise = this.generateDescription(tenantId, item, options?.style);
    tasks.push(descriptionPromise);

    // Detect allergens if requested
    let allergensPromise: Promise<string[]> | null = null;
    if (options?.includeAllergens !== false) {
      allergensPromise = this.detectAllergens(tenantId, item);
      tasks.push(allergensPromise);
    }

    // Generate upsell suggestions if requested
    let upsellPromise: Promise<string[]> | null = null;
    if (options?.includeUpsells !== false) {
      upsellPromise = this.generateUpsellSuggestions(tenantId, item);
      tasks.push(upsellPromise);
    }

    // Wait for all tasks
    await Promise.all(tasks);

    const aiDescription = await descriptionPromise;
    const detectedAllergens = allergensPromise ? await allergensPromise : [];
    const upsellSuggestions = upsellPromise ? await upsellPromise : [];

    // Extract keywords from description
    const keywords = this.extractKeywords(aiDescription);

    return {
      aiDescription,
      detectedAllergens,
      keywords,
      upsellSuggestions
    };
  }

  /**
   * Detect potential allergens in a menu item
   */
  async detectAllergens(tenantId: string, item: MenuItemInput): Promise<string[]> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a food safety expert. Analyze menu items and identify potential allergens from this list:
- Gluten (wheat, barley, rye)
- Dairy (milk, cheese, butter)
- Eggs
- Nuts (tree nuts, peanuts)
- Soy
- Fish
- Shellfish
- Sesame

Return ONLY a JSON array of detected allergens. If none detected, return an empty array.`
      },
      {
        role: 'user',
        content: `Analyze this menu item for allergens:

Name: ${item.name}
${item.description ? `Description: ${item.description}` : ''}
${item.ingredients?.length ? `Ingredients: ${item.ingredients.join(', ')}` : ''}

Return a JSON array of allergens found.`
      }
    ];

    const response = await this.aiRouter.complete({
      messages,
      tenantId,
      requestType: 'menu_ai',
      maxTokens: 100,
      temperature: 0.3 // Lower temperature for factual analysis
    });

    try {
      const allergens = JSON.parse(response.content);
      return Array.isArray(allergens) ? allergens : [];
    } catch {
      // Try to extract allergens from text
      const commonAllergens = [
        'gluten',
        'dairy',
        'eggs',
        'nuts',
        'soy',
        'fish',
        'shellfish',
        'sesame'
      ];
      return commonAllergens.filter((a) =>
        response.content.toLowerCase().includes(a)
      );
    }
  }

  /**
   * Generate upsell suggestions for a menu item
   */
  async generateUpsellSuggestions(
    tenantId: string,
    item: MenuItemInput
  ): Promise<string[]> {
    // Get other menu items for context
    const menuResult = await this.pool.query(
      `SELECT name, category_id FROM menu_items
       WHERE tenant_id = $1 AND is_available = true
       LIMIT 30`,
      [tenantId]
    );

    const otherItems = menuResult.rows.map((r) => r.name).join(', ');

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `${SYSTEM_PROMPTS.upselling}

Available items to suggest from: ${otherItems}`
      },
      {
        role: 'user',
        content: `A customer is ordering: ${item.name}
${item.description ? `(${item.description})` : ''}

Suggest 2-3 complementary items from the available menu that would pair well with this order.
Return ONLY a JSON array of item names.`
      }
    ];

    const response = await this.aiRouter.complete({
      messages,
      tenantId,
      requestType: 'menu_ai',
      maxTokens: 150,
      temperature: 0.7
    });

    try {
      const suggestions = JSON.parse(response.content);
      return Array.isArray(suggestions) ? suggestions.slice(0, 3) : [];
    } catch {
      // Try to extract from text
      return response.content
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length < 50)
        .slice(0, 3);
    }
  }

  /**
   * Translate a menu item to another language
   */
  async translateMenuItem(
    tenantId: string,
    item: MenuItemInput,
    targetLanguage: string
  ): Promise<TranslationResult> {
    const languageName = this.getLanguageName(targetLanguage);

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `${SYSTEM_PROMPTS.translation}

Target language: ${languageName}`
      },
      {
        role: 'user',
        content: `Translate this menu item to ${languageName}:

Name: ${item.name}
Description: ${item.description || 'No description'}

Return a JSON object with:
{
  "name": "translated name",
  "description": "translated description"
}`
      }
    ];

    const response = await this.aiRouter.complete({
      messages,
      tenantId,
      requestType: 'menu_ai',
      maxTokens: 300,
      temperature: 0.5
    });

    try {
      const translation = JSON.parse(response.content);
      return {
        name: translation.name || item.name,
        description: translation.description || item.description || '',
        language: targetLanguage
      };
    } catch {
      // Return original if parsing fails
      return {
        name: item.name,
        description: item.description || '',
        language: targetLanguage
      };
    }
  }

  /**
   * Batch enhance multiple menu items
   */
  async batchEnhanceMenu(
    tenantId: string,
    items: MenuItemInput[],
    style?: 'casual' | 'fine_dining' | 'street_food' | 'family'
  ): Promise<Map<string, MenuItemEnhancement>> {
    const results = new Map<string, MenuItemEnhancement>();

    // Process in batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      const promises = batch.map(async (item) => {
        const enhancement = await this.enhanceMenuItem(tenantId, item, { style });
        results.set(item.name, enhancement);
      });

      await Promise.all(promises);

      // Small delay between batches
      if (i + batchSize < items.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  /**
   * Update menu item in database with AI enhancements
   */
  async updateMenuItemWithAI(
    tenantId: string,
    menuItemId: string,
    style?: 'casual' | 'fine_dining' | 'street_food' | 'family'
  ): Promise<MenuItemEnhancement> {
    // Get current menu item
    const result = await this.pool.query(
      `SELECT name, description, price, category_id FROM menu_items
       WHERE id = $1 AND tenant_id = $2`,
      [menuItemId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error('Menu item not found');
    }

    const item = result.rows[0];
    const enhancement = await this.enhanceMenuItem(
      tenantId,
      {
        name: item.name,
        description: item.description,
        price: parseFloat(item.price)
      },
      { style }
    );

    // Update in database
    await this.pool.query(
      `UPDATE menu_items
       SET ai_description = $1,
           allergens = $2,
           updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4`,
      [
        enhancement.aiDescription,
        JSON.stringify(enhancement.detectedAllergens),
        menuItemId,
        tenantId
      ]
    );

    return enhancement;
  }

  /**
   * Get style guide based on restaurant type
   */
  private getStyleGuide(style: string): string {
    const guides: Record<string, string> = {
      casual: `Style: Casual and friendly
- Use everyday language
- Be warm and inviting
- Focus on comfort and satisfaction`,

      fine_dining: `Style: Elegant and sophisticated
- Use refined culinary terminology
- Emphasize technique and presentation
- Highlight premium ingredients and origins`,

      street_food: `Style: Vibrant and exciting
- Use energetic, punchy language
- Emphasize bold flavors and authenticity
- Keep it real and unpretentious`,

      family: `Style: Warm and welcoming
- Use inclusive, family-friendly language
- Emphasize portions and value
- Highlight kid-friendly options`
    };

    return guides[style] || guides.casual;
  }

  /**
   * Extract keywords from description
   */
  private extractKeywords(description: string): string[] {
    const foodKeywords = [
      'crispy',
      'tender',
      'fresh',
      'grilled',
      'roasted',
      'savory',
      'sweet',
      'spicy',
      'creamy',
      'tangy',
      'smoky',
      'rich',
      'light',
      'zesty',
      'aromatic',
      'homemade',
      'organic',
      'local',
      'seasonal',
      'signature'
    ];

    const lowerDesc = description.toLowerCase();
    return foodKeywords.filter((kw) => lowerDesc.includes(kw));
  }

  /**
   * Get language name from code
   */
  private getLanguageName(code: string): string {
    const languages: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      zh: 'Chinese',
      ja: 'Japanese',
      ko: 'Korean',
      ar: 'Arabic',
      nl: 'Dutch',
      pl: 'Polish',
      ru: 'Russian',
      tr: 'Turkish'
    };
    return languages[code] || code;
  }
}
