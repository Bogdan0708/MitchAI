/**
 * SQUARE POS INTEGRATION SERVICE
 * 
 * Syncs menu items, orders, and customers from Square to the Mitch platform.
 * 
 * API Docs: https://developer.squareup.com/reference/square
 */

import { Pool } from 'pg';

// ============================================================================
// TYPES
// ============================================================================

export interface SquareConfig {
  accessToken: string;
  applicationId: string;
  locationId?: string;
  environment: 'sandbox' | 'production';
}

export interface SquareMerchant {
  id: string;
  businessName: string;
  country: string;
  currency: string;
  mainLocationId: string;
}

export interface SquareLocation {
  id: string;
  name: string;
  address: {
    addressLine1?: string;
    locality?: string;
    postalCode?: string;
    country?: string;
  };
  timezone: string;
  currency: string;
  phoneNumber?: string;
  businessHours?: {
    periods: Array<{
      dayOfWeek: string;
      startLocalTime: string;
      endLocalTime: string;
    }>;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface SquareCatalogItem {
  id: string;
  name: string;
  description?: string;
  price: number; // in smallest currency unit (pence for GBP)
  currency: string;
  categoryId?: string;
  categoryName?: string;
  imageUrl?: string;
  isAvailable: boolean;
  variations?: Array<{
    id: string;
    name: string;
    price: number;
  }>;
}

export interface SquareCategory {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface SquareOrder {
  id: string;
  locationId: string;
  createdAt: Date;
  totalMoney: number;
  taxMoney?: number;
  currency: string;
  state: string;
  lineItems: Array<{
    name: string;
    quantity: number;
    totalMoney: number;
    basePriceMoney?: number;
    variationName?: string;
  }>;
}

export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  categoriesSynced: number;
  errors: string[];
}

// ============================================================================
// SQUARE SERVICE CLASS
// ============================================================================

export class SquareService {
  private baseUrl: string;
  private accessToken: string;
  private applicationId: string;
  private locationId?: string;

  constructor(config: SquareConfig) {
    this.baseUrl = config.environment === 'production' 
      ? 'https://connect.squareup.com/v2'
      : 'https://connect.squareupsandbox.com/v2';
    this.accessToken = config.accessToken;
    this.applicationId = config.applicationId;
    this.locationId = config.locationId;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Square API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    return response.json() as Promise<T>;
  }

  // ============================================================================
  // MERCHANT & LOCATION
  // ============================================================================

  async getMerchant(): Promise<SquareMerchant> {
    const data = await this.request<any>('/merchants/me');
    return {
      id: data.merchant.id,
      businessName: data.merchant.business_name,
      country: data.merchant.country,
      currency: data.merchant.currency,
      mainLocationId: data.merchant.main_location_id,
    };
  }

  async getLocations(): Promise<SquareLocation[]> {
    const data = await this.request<any>('/locations');
    return data.locations.map((loc: any) => ({
      id: loc.id,
      name: loc.name,
      address: {
        addressLine1: loc.address?.address_line_1,
        locality: loc.address?.locality,
        postalCode: loc.address?.postal_code,
        country: loc.address?.country,
      },
      timezone: loc.timezone,
      currency: loc.currency,
      phoneNumber: loc.phone_number,
      businessHours: loc.business_hours,
      coordinates: loc.coordinates,
    }));
  }

  // ============================================================================
  // CATALOG (MENU ITEMS)
  // ============================================================================

  async getCatalog(): Promise<{ items: SquareCatalogItem[]; categories: SquareCategory[] }> {
    const data = await this.request<any>('/catalog/list?types=ITEM,CATEGORY,IMAGE');
    
    const categories: SquareCategory[] = [];
    const items: SquareCatalogItem[] = [];
    const images: Map<string, string> = new Map();
    const categoryMap: Map<string, string> = new Map();

    // First pass: collect images and categories
    for (const obj of data.objects || []) {
      if (obj.type === 'IMAGE' && obj.image_data?.url) {
        images.set(obj.id, obj.image_data.url);
      }
      if (obj.type === 'CATEGORY' && obj.category_data) {
        const cat: SquareCategory = {
          id: obj.id,
          name: obj.category_data.name,
          imageUrl: obj.category_data.image_ids?.[0] ? images.get(obj.category_data.image_ids[0]) : undefined,
        };
        categories.push(cat);
        categoryMap.set(obj.id, obj.category_data.name);
      }
    }

    // Second pass: collect items
    for (const obj of data.objects || []) {
      if (obj.type === 'ITEM' && obj.item_data && !obj.is_deleted) {
        const variation = obj.item_data.variations?.[0];
        const price = variation?.item_variation_data?.price_money?.amount || 0;
        const currency = variation?.item_variation_data?.price_money?.currency || 'GBP';
        
        // Get category name
        const catId = obj.item_data.categories?.[0]?.id;
        const categoryName = catId ? categoryMap.get(catId) : undefined;

        // Get image URL
        const imageId = obj.item_data.image_ids?.[0];
        const imageUrl = imageId ? images.get(imageId) : obj.item_data.ecom_image_uris?.[0];

        items.push({
          id: obj.id,
          name: obj.item_data.name,
          description: obj.item_data.description_plaintext || obj.item_data.description,
          price,
          currency,
          categoryId: catId,
          categoryName,
          imageUrl,
          isAvailable: obj.item_data.ecom_available !== false,
          variations: obj.item_data.variations?.map((v: any) => ({
            id: v.id,
            name: v.item_variation_data?.name || 'Regular',
            price: v.item_variation_data?.price_money?.amount || 0,
          })),
        });
      }
    }

    return { items, categories };
  }

  // ============================================================================
  // ORDERS
  // ============================================================================

  async getOrders(startDate?: Date, endDate?: Date): Promise<SquareOrder[]> {
    const locationIds = this.locationId ? [this.locationId] : (await this.getLocations()).map(l => l.id);
    
    const body: any = {
      location_ids: locationIds,
      query: {
        filter: {
          state_filter: {
            states: ['COMPLETED'],
          },
        },
        sort: {
          sort_field: 'CREATED_AT',
          sort_order: 'DESC',
        },
      },
      limit: 100,
    };

    if (startDate) {
      body.query.filter.date_time_filter = {
        created_at: {
          start_at: startDate.toISOString(),
          end_at: endDate?.toISOString() || new Date().toISOString(),
        },
      };
    }

    const data = await this.request<any>('/orders/search', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return (data.orders || []).map((order: any) => ({
      id: order.id,
      locationId: order.location_id,
      createdAt: new Date(order.created_at),
      totalMoney: order.total_money?.amount || 0,
      taxMoney: order.total_tax_money?.amount || 0,
      currency: order.total_money?.currency || 'GBP',
      state: order.state,
      lineItems: (order.line_items || []).map((item: any) => ({
        name: item.name,
        quantity: parseInt(item.quantity) || 1,
        totalMoney: item.total_money?.amount || 0,
        basePriceMoney: item.base_price_money?.amount || item.total_money?.amount || 0,
        variationName: item.variation_name || null,
      })),
    }));
  }

  // ============================================================================
  // SYNC TO DATABASE
  // ============================================================================

  async syncToDatabase(pool: Pool, tenantId: string): Promise<SyncResult> {
    const errors: string[] = [];
    let itemsSynced = 0;
    let categoriesSynced = 0;

    try {
      // Get catalog from Square
      const { items, categories } = await this.getCatalog();
      const locations = await this.getLocations();
      const mainLocation = locations[0];

      // Start transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Set tenant context for RLS
        await client.query(`SET app.current_tenant_id = '${tenantId}'`);

        // Sync location
        if (mainLocation) {
          await client.query(`
            INSERT INTO locations (id, tenant_id, name, address, city, country, is_active)
            VALUES (
              COALESCE(
                (SELECT id FROM locations WHERE tenant_id = $1 AND name = $2 LIMIT 1),
                uuid_generate_v4()
              ),
              $1, $2, $3, $4, $5, true
            )
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              address = EXCLUDED.address,
              city = EXCLUDED.city,
              country = EXCLUDED.country
          `, [
            tenantId,
            mainLocation.name,
            mainLocation.address.addressLine1 || '',
            mainLocation.address.locality || 'London',
            mainLocation.address.country || 'GB',
          ]);
        }

        // Sync categories
        for (const category of categories) {
          // Only sync top-level categories
          if (['Grill', 'Drinks', 'Sides', 'Bundles'].includes(category.name)) {
            await client.query(`
              INSERT INTO menu_categories (id, tenant_id, name, is_active, display_order)
              VALUES (
                COALESCE(
                  (SELECT id FROM menu_categories WHERE tenant_id = $1 AND name = $2 LIMIT 1),
                  uuid_generate_v4()
                ),
                $1, $2, true, $3
              )
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                display_order = EXCLUDED.display_order
            `, [
              tenantId,
              category.name,
              categoriesSynced,
            ]);
            categoriesSynced++;
          }
        }

        // Sync menu items
        for (const item of items) {
          try {
            // Convert price from pence to pounds
            const priceInPounds = item.price / 100;

            await client.query(`
              INSERT INTO menu_items (id, tenant_id, name, description, price, image_url, is_available)
              VALUES (
                COALESCE(
                  (SELECT id FROM menu_items WHERE tenant_id = $1 AND name = $2 LIMIT 1),
                  uuid_generate_v4()
                ),
                $1, $2, $3, $4, $5, $6
              )
              ON CONFLICT (id) DO UPDATE SET
                description = EXCLUDED.description,
                price = EXCLUDED.price,
                image_url = EXCLUDED.image_url,
                is_available = EXCLUDED.is_available
            `, [
              tenantId,
              item.name,
              item.description || '',
              priceInPounds,
              item.imageUrl || null,
              item.isAvailable,
            ]);
            itemsSynced++;
          } catch (err: any) {
            errors.push(`Failed to sync item ${item.name}: ${err.message}`);
          }
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      return {
        success: errors.length === 0,
        itemsSynced,
        categoriesSynced,
        errors,
      };
    } catch (err: any) {
      return {
        success: false,
        itemsSynced,
        categoriesSynced,
        errors: [err.message],
      };
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createSquareService(config: SquareConfig): SquareService {
  return new SquareService(config);
}

// ============================================================================
// CLI SYNC SCRIPT (for manual testing)
// ============================================================================

export async function runSquareSync(pool: Pool, tenantId: string, config: SquareConfig) {
  console.log('Starting Square sync...');
  const service = createSquareService(config);
  
  // Get merchant info
  const merchant = await service.getMerchant();
  console.log(`Connected to: ${merchant.businessName}`);
  
  // Sync to database
  const result = await service.syncToDatabase(pool, tenantId);
  
  console.log(`Sync complete: ${result.itemsSynced} items, ${result.categoriesSynced} categories`);
  if (result.errors.length > 0) {
    console.error('Errors:', result.errors);
  }
  
  return result;
}
