/**
 * QR CODE SERVICE
 *
 * QR-based ordering and table management:
 * - Generate unique QR codes per table/location
 * - Mobile-optimized ordering flow
 * - Session tracking and management
 * - Payment processing integration
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import QRCode from 'qrcode';
import { runInTenantContext } from '../../lib/db-context';

export interface QRCodeData {
  id: string;
  tenantId: string;
  locationId: string;
  tableNumber?: string;
  type: 'table' | 'takeout' | 'menu_only';
  url: string;
  qrImageUrl: string;
  createdAt: Date;
  lastScannedAt?: Date;
  scanCount: number;
}

export interface OrderSession {
  id: string;
  tenantId: string;
  qrCodeId: string;
  tableNumber?: string;
  status: 'browsing' | 'ordering' | 'payment' | 'completed';
  items: OrderSessionItem[];
  subtotal: number;
  tax: number;
  total: number;
  customerName?: string;
  customerPhone?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface OrderSessionItem {
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  modifiers?: string[];
  notes?: string;
}

export interface PaymentIntent {
  id: string;
  sessionId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  stripePaymentIntentId?: string;
  createdAt: Date;
}

export class QRService {
  private pool: Pool;
  private redis: Redis;
  private baseUrl: string;
  private stripeSecretKey: string;

  constructor(pool: Pool, redis: Redis) {
    this.pool = pool;
    this.redis = redis;
    this.baseUrl = process.env.APP_BASE_URL || 'https://app.mitch-ai.com';
    this.stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
  }

  /**
   * Generate QR code for a table/location
   */
  async generateQRCode(
    tenantId: string,
    locationId: string,
    options: {
      tableNumber?: string;
      type?: 'table' | 'takeout' | 'menu_only';
    } = {}
  ): Promise<QRCodeData> {
    const { tableNumber, type = 'table' } = options;
    const id = randomUUID();

    // Create URL for the QR code
    const params = new URLSearchParams({
      t: tenantId,
      l: locationId,
      q: id,
    });
    if (tableNumber) {
      params.set('table', tableNumber);
    }

    const url = `${this.baseUrl}/order?${params.toString()}`;

    // Generate QR code image
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });

    // Store in database
    const result = await runInTenantContext(this.pool, tenantId, async (client) => {
      return client.query(
        `INSERT INTO qr_codes (id, tenant_id, location_id, table_number, type, url)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, tenantId, locationId, tableNumber, type, url]
      );
    });

    return {
      id,
      tenantId,
      locationId,
      tableNumber,
      type,
      url,
      qrImageUrl: qrDataUrl,
      createdAt: result.rows[0].created_at,
      scanCount: 0,
    };
  }

  /**
   * Generate QR codes for all tables at a location
   */
  async generateBulkQRCodes(
    tenantId: string,
    locationId: string,
    tableCount: number,
    prefix: string = 'Table'
  ): Promise<QRCodeData[]> {
    const codes: QRCodeData[] = [];

    for (let i = 1; i <= tableCount; i++) {
      const tableNumber = `${prefix} ${i}`;
      const code = await this.generateQRCode(tenantId, locationId, {
        tableNumber,
        type: 'table',
      });
      codes.push(code);
    }

    return codes;
  }

  /**
   * Record QR code scan and create session
   */
  async handleQRScan(qrCodeId: string): Promise<OrderSession> {
    // Get QR code details - first fetch to get tenantId
    const qrLookup = await this.pool.query(
      `SELECT tenant_id FROM qr_codes WHERE id = $1`,
      [qrCodeId]
    );

    if (qrLookup.rows.length === 0) {
      throw new Error('Invalid QR code');
    }

    const tenantId = qrLookup.rows[0].tenant_id;

    // Update scan count with RLS protection
    const qrResult = await runInTenantContext(this.pool, tenantId, async (client) => {
      return client.query(
        `UPDATE qr_codes
         SET scan_count = scan_count + 1, last_scanned_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [qrCodeId]
      );
    });

    if (qrResult.rows.length === 0) {
      throw new Error('Invalid QR code');
    }

    const qrCode = qrResult.rows[0];

    // Create new ordering session
    const sessionId = randomUUID();
    const session: OrderSession = {
      id: sessionId,
      tenantId: qrCode.tenant_id,
      qrCodeId,
      tableNumber: qrCode.table_number,
      status: 'browsing',
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
    };

    // Store session in Redis
    await this.redis.setex(
      `qr:session:${sessionId}`,
      7200, // 2 hours
      JSON.stringify(session)
    );

    return session;
  }

  /**
   * Get current session
   */
  async getSession(sessionId: string): Promise<OrderSession | null> {
    const data = await this.redis.get(`qr:session:${sessionId}`);
    if (!data) return null;
    return JSON.parse(data);
  }

  /**
   * Add item to session cart
   */
  async addToCart(
    sessionId: string,
    item: {
      menuItemId: string;
      quantity: number;
      modifiers?: string[];
      notes?: string;
    }
  ): Promise<OrderSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found or expired');
    }

    // Get menu item details
    const menuResult = await runInTenantContext(this.pool, session.tenantId, async (client) => {
      return client.query(
        `SELECT id, name, price FROM menu_items WHERE id = $1 AND tenant_id = $2`,
        [item.menuItemId, session.tenantId]
      );
    });

    if (menuResult.rows.length === 0) {
      throw new Error('Menu item not found');
    }

    const menuItem = menuResult.rows[0];

    // Check if item already in cart
    const existingIndex = session.items.findIndex(
      i => i.menuItemId === item.menuItemId &&
           JSON.stringify(i.modifiers) === JSON.stringify(item.modifiers)
    );

    if (existingIndex >= 0) {
      session.items[existingIndex].quantity += item.quantity;
    } else {
      session.items.push({
        menuItemId: item.menuItemId,
        menuItemName: menuItem.name,
        quantity: item.quantity,
        unitPrice: parseFloat(menuItem.price),
        modifiers: item.modifiers,
        notes: item.notes,
      });
    }

    // Recalculate totals
    this.calculateTotals(session);

    session.status = 'ordering';

    // Save session
    await this.redis.setex(
      `qr:session:${sessionId}`,
      7200,
      JSON.stringify(session)
    );

    return session;
  }

  /**
   * Update item quantity in cart
   */
  async updateCartItem(
    sessionId: string,
    menuItemId: string,
    quantity: number
  ): Promise<OrderSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found or expired');
    }

    const itemIndex = session.items.findIndex(i => i.menuItemId === menuItemId);
    if (itemIndex < 0) {
      throw new Error('Item not in cart');
    }

    if (quantity <= 0) {
      session.items.splice(itemIndex, 1);
    } else {
      session.items[itemIndex].quantity = quantity;
    }

    this.calculateTotals(session);

    if (session.items.length === 0) {
      session.status = 'browsing';
    }

    await this.redis.setex(
      `qr:session:${sessionId}`,
      7200,
      JSON.stringify(session)
    );

    return session;
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(sessionId: string, menuItemId: string): Promise<OrderSession> {
    return this.updateCartItem(sessionId, menuItemId, 0);
  }

  /**
   * Calculate session totals
   */
  private calculateTotals(session: OrderSession): void {
    session.subtotal = session.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );
    session.tax = session.subtotal * 0.0875; // 8.75% tax (configurable)
    session.total = session.subtotal + session.tax;
  }

  /**
   * Create Stripe payment intent
   */
  async createPaymentIntent(
    sessionId: string,
    customerInfo?: { name?: string; phone?: string }
  ): Promise<PaymentIntent> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found or expired');
    }

    if (session.items.length === 0) {
      throw new Error('Cart is empty');
    }

    // Update customer info
    if (customerInfo) {
      session.customerName = customerInfo.name;
      session.customerPhone = customerInfo.phone;
    }

    session.status = 'payment';

    // Create Stripe payment intent
    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: Math.round(session.total * 100).toString(),
        currency: 'usd',
        'metadata[session_id]': sessionId,
        'metadata[tenant_id]': session.tenantId,
        'metadata[table_number]': session.tableNumber || '',
      }).toString(),
    });

    if (!response.ok) {
      throw new Error('Failed to create payment intent');
    }

    const stripeIntent = await response.json() as { id: string; client_secret: string };

    const paymentIntent: PaymentIntent = {
      id: randomUUID(),
      sessionId,
      amount: session.total,
      currency: 'usd',
      status: 'pending',
      stripePaymentIntentId: stripeIntent.id,
      createdAt: new Date(),
    };

    // Store payment intent
    await this.redis.setex(
      `qr:payment:${sessionId}`,
      3600,
      JSON.stringify(paymentIntent)
    );

    // Update session
    await this.redis.setex(
      `qr:session:${sessionId}`,
      7200,
      JSON.stringify(session)
    );

    return paymentIntent;
  }

  /**
   * Handle successful payment and create order
   */
  async handlePaymentSuccess(
    sessionId: string,
    stripePaymentIntentId: string
  ): Promise<{ orderId: string }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const orderId = await runInTenantContext(this.pool, session.tenantId, async (client) => {
      // Create order
      const orderResult = await client.query(
        `INSERT INTO orders (
          tenant_id, location_id, table_number, status, total_amount,
          tax_amount, order_type, customer_name, customer_phone,
          payment_status, payment_intent_id
        ) VALUES ($1, $2, $3, 'confirmed', $4, $5, 'dine_in', $6, $7, 'paid', $8)
        RETURNING id`,
        [
          session.tenantId,
          null, // location_id from QR code
          session.tableNumber,
          session.total,
          session.tax,
          session.customerName,
          session.customerPhone,
          stripePaymentIntentId,
        ]
      );

      const orderId = orderResult.rows[0].id;

      // Create order items
      for (const item of session.items) {
        await client.query(
          `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [orderId, item.menuItemId, item.quantity, item.unitPrice, item.notes]
        );
      }

      return orderId;
    });

    // Update session status
    session.status = 'completed';
    await this.redis.setex(
      `qr:session:${sessionId}`,
      3600,
      JSON.stringify(session)
    );

    return { orderId };
  }

  /**
   * Get QR codes for a location
   */
  async getLocationQRCodes(
    tenantId: string,
    locationId: string
  ): Promise<QRCodeData[]> {
    const result = await runInTenantContext(this.pool, tenantId, async (client) => {
      return client.query(
        `SELECT * FROM qr_codes
         WHERE tenant_id = $1 AND location_id = $2
         ORDER BY table_number`,
        [tenantId, locationId]
      );
    });

    return Promise.all(result.rows.map(async row => {
      const qrDataUrl = await QRCode.toDataURL(row.url, {
        width: 300,
        margin: 2,
      });

      return {
        id: row.id,
        tenantId: row.tenant_id,
        locationId: row.location_id,
        tableNumber: row.table_number,
        type: row.type,
        url: row.url,
        qrImageUrl: qrDataUrl,
        createdAt: row.created_at,
        lastScannedAt: row.last_scanned_at,
        scanCount: row.scan_count,
      };
    }));
  }

  /**
   * Delete QR code
   */
  async deleteQRCode(tenantId: string, qrCodeId: string): Promise<void> {
    await runInTenantContext(this.pool, tenantId, async (client) => {
      return client.query(
        'DELETE FROM qr_codes WHERE id = $1 AND tenant_id = $2',
        [qrCodeId, tenantId]
      );
    });
  }

  /**
   * Get menu for mobile ordering
   */
  async getMobileMenu(tenantId: string, locationId?: string): Promise<{
    categories: Array<{
      id: string;
      name: string;
      items: Array<{
        id: string;
        name: string;
        description: string;
        price: number;
        imageUrl?: string;
        allergens?: string[];
        isAvailable: boolean;
      }>;
    }>;
  }> {
    let query = `
      SELECT
        mc.id as category_id,
        mc.name as category_name,
        mc.sort_order,
        mi.id as item_id,
        mi.name as item_name,
        mi.description,
        mi.price,
        mi.image_url,
        mi.allergens,
        mi.is_available
      FROM menu_categories mc
      LEFT JOIN menu_items mi ON mi.category_id = mc.id AND mi.is_available = true
      WHERE mc.tenant_id = $1
    `;

    const params: string[] = [tenantId];

    if (locationId) {
      query += ` AND (mi.location_id = $2 OR mi.location_id IS NULL)`;
      params.push(locationId);
    }

    query += ` ORDER BY mc.sort_order, mi.name`;

    const result = await runInTenantContext(this.pool, tenantId, async (client) => {
      return client.query(query, params);
    });

    // Group by category
    const categoriesMap = new Map<string, {
      id: string;
      name: string;
      sortOrder: number;
      items: Array<{
        id: string;
        name: string;
        description: string;
        price: number;
        imageUrl?: string;
        allergens?: string[];
        isAvailable: boolean;
      }>;
    }>();

    for (const row of result.rows) {
      if (!categoriesMap.has(row.category_id)) {
        categoriesMap.set(row.category_id, {
          id: row.category_id,
          name: row.category_name,
          sortOrder: row.sort_order,
          items: [],
        });
      }

      if (row.item_id) {
        categoriesMap.get(row.category_id)!.items.push({
          id: row.item_id,
          name: row.item_name,
          description: row.description,
          price: parseFloat(row.price),
          imageUrl: row.image_url,
          allergens: row.allergens,
          isAvailable: row.is_available,
        });
      }
    }

    return {
      categories: Array.from(categoriesMap.values())
        .sort((a, b) => a.sortOrder - b.sortOrder),
    };
  }
}
