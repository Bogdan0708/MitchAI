/**
 * DEMO SEED DATA SCRIPT
 *
 * Creates sample data for the demo environment:
 * - Demo tenant (Mitch's Kitchen)
 * - Menu items with AI descriptions
 * - Sample orders and reservations
 * - Customer data
 * - Reviews with varied sentiments
 * - Chat conversations
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '../.env') });

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://hospitality_admin:secure_password_change_me@localhost:5433/hospitality_db';

const pool = new Pool({ connectionString: DATABASE_URL });

// Demo configuration
const DEMO_CONFIG = {
  tenant: {
    name: "Mitch's Kitchen",
    slug: 'mitchs-kitchen',
    email: 'hello@mitchs-kitchen.com',
  },
  user: {
    email: 'demo@mitch-ai.com',
    password: 'demo123456',
    firstName: 'Demo',
    lastName: 'User',
    role: 'owner',
  },
  location: {
    name: 'Downtown Location',
    address: '123 Main Street',
    city: 'San Francisco',
    country: 'United States',
  },
};

const MENU_CATEGORIES = [
  { name: 'Appetizers', order: 1 },
  { name: 'Salads', order: 2 },
  { name: 'Main Courses', order: 3 },
  { name: 'Seafood', order: 4 },
  { name: 'Desserts', order: 5 },
  { name: 'Beverages', order: 6 },
];

const MENU_ITEMS = [
  { category: 'Appetizers', name: 'Truffle Mushroom Bruschetta', description: 'Crispy sourdough topped with sautéed wild mushrooms, drizzled with white truffle oil and fresh herbs.', price: 14.50 },
  { category: 'Appetizers', name: 'Calamari Fritti', description: 'Tender calamari rings lightly dusted and fried to golden perfection, served with marinara and lemon aioli.', price: 16.00 },
  { category: 'Appetizers', name: 'Beef Carpaccio', description: 'Paper-thin slices of prime beef tenderloin with arugula, shaved parmesan, and caper-lemon dressing.', price: 18.00 },
  { category: 'Salads', name: 'Classic Caesar Salad', description: 'Crisp romaine hearts with house-made Caesar dressing, aged parmesan, and garlic croutons.', price: 12.00 },
  { category: 'Salads', name: 'Mediterranean Quinoa Bowl', description: 'Fluffy quinoa with cherry tomatoes, cucumber, kalamata olives, feta cheese, and herb vinaigrette.', price: 15.00 },
  { category: 'Main Courses', name: 'Grilled Ribeye Steak', description: '14oz USDA Prime ribeye, dry-aged 28 days, served with truffle mashed potatoes and seasonal vegetables.', price: 48.00 },
  { category: 'Main Courses', name: 'Free-Range Chicken', description: 'Half roasted chicken with lemon-herb jus, roasted fingerling potatoes, and grilled broccolini.', price: 28.00 },
  { category: 'Main Courses', name: 'Wild Mushroom Risotto', description: 'Creamy arborio rice with porcini, shiitake, and oyster mushrooms, finished with aged parmesan.', price: 24.00 },
  { category: 'Seafood', name: 'Pan-Seared Salmon', description: 'Fresh Atlantic salmon with citrus beurre blanc, asparagus, and wild rice pilaf.', price: 32.00 },
  { category: 'Seafood', name: 'Lobster Tail', description: 'Twin Maine lobster tails with drawn butter, garlic mashed potatoes, and grilled corn.', price: 58.00 },
  { category: 'Desserts', name: 'Chocolate Lava Cake', description: 'Warm chocolate cake with molten center, vanilla bean ice cream, and raspberry coulis.', price: 12.00 },
  { category: 'Desserts', name: 'Tiramisu', description: 'Classic Italian dessert with espresso-soaked ladyfingers, mascarpone cream, and cocoa.', price: 10.00 },
  { category: 'Desserts', name: 'Crème Brûlée', description: 'Silky vanilla custard with caramelized sugar crust and fresh berries.', price: 10.00 },
  { category: 'Beverages', name: 'House Red Wine', description: 'California Cabernet Sauvignon with notes of dark cherry and oak.', price: 12.00 },
  { category: 'Beverages', name: 'House White Wine', description: 'Sonoma Chardonnay with hints of apple and vanilla.', price: 11.00 },
  { category: 'Beverages', name: 'Craft Cocktail', description: "Bartender's daily special creation.", price: 14.00 },
];

const SAMPLE_CUSTOMERS = [
  { firstName: 'John', lastName: 'Smith', email: 'john.smith@example.com', phone: '+1-555-0101' },
  { firstName: 'Sarah', lastName: 'Wilson', email: 'sarah.wilson@example.com', phone: '+1-555-0102' },
  { firstName: 'Mike', lastName: 'Johnson', email: 'mike.johnson@example.com', phone: '+1-555-0103' },
  { firstName: 'Emma', lastName: 'Davis', email: 'emma.davis@example.com', phone: '+1-555-0104' },
  { firstName: 'Chris', lastName: 'Brown', email: 'chris.brown@example.com', phone: '+1-555-0105' },
  { firstName: 'Lisa', lastName: 'Anderson', email: 'lisa.anderson@example.com', phone: '+1-555-0106' },
  { firstName: 'David', lastName: 'Martinez', email: 'david.martinez@example.com', phone: '+1-555-0107' },
  { firstName: 'Jennifer', lastName: 'Taylor', email: 'jennifer.taylor@example.com', phone: '+1-555-0108' },
];

const SAMPLE_REVIEWS = [
  { rating: 5, reviewerName: 'John D.', reviewText: 'Amazing food and excellent service! The truffle pasta was to die for. Will definitely be coming back.', sentiment: 'positive', platform: 'google' },
  { rating: 5, reviewerName: 'Sarah M.', reviewText: 'Best restaurant in town! The ribeye steak was cooked perfectly and the staff was incredibly attentive.', sentiment: 'positive', platform: 'yelp' },
  { rating: 4, reviewerName: 'Mike R.', reviewText: 'Great food and atmosphere. Only minor complaint is the wait time on busy nights, but worth it!', sentiment: 'positive', platform: 'tripadvisor' },
  { rating: 3, reviewerName: 'Emma L.', reviewText: 'Food was okay, nothing special. Service was a bit slow during the dinner rush. Might give it another try.', sentiment: 'neutral', platform: 'google' },
  { rating: 2, reviewerName: 'Chris B.', reviewText: 'Disappointed with my experience. The steak was overcooked and the wait staff seemed overwhelmed.', sentiment: 'negative', platform: 'yelp' },
  { rating: 5, reviewerName: 'Lisa A.', reviewText: 'Celebrated our anniversary here and it was perfect! The lobster tail was incredible.', sentiment: 'positive', platform: 'google' },
  { rating: 4, reviewerName: 'David M.', reviewText: 'Really enjoyed the atmosphere and cocktails. The appetizers were delicious. Will return!', sentiment: 'positive', platform: 'tripadvisor' },
  { rating: 1, reviewerName: 'Karen T.', reviewText: 'Terrible experience. Waited 45 minutes for our food and it was cold when it arrived. Manager was unhelpful.', sentiment: 'negative', platform: 'yelp' },
];

const SAMPLE_CHAT_CONVERSATIONS = [
  {
    customerName: 'Alex Thompson',
    messages: [
      { role: 'user', content: 'Hi, do you have any vegan options?' },
      { role: 'assistant', content: "Hello Alex! Yes, we have several vegan options. Our Mediterranean Quinoa Bowl is completely vegan and very popular. We can also make our Wild Mushroom Risotto vegan by request. Would you like more details on any of these?" },
      { role: 'user', content: 'The quinoa bowl sounds great. What time do you close tonight?' },
      { role: 'assistant', content: "Great choice! Tonight we're open until 10 PM. Would you like to make a reservation? We can ensure a table is ready for you." },
    ],
  },
  {
    customerName: 'Rachel Green',
    messages: [
      { role: 'user', content: 'Can I make a reservation for 4 people this Saturday?' },
      { role: 'assistant', content: "Hi! I'd be happy to help with your reservation. What time would you prefer for Saturday? We have availability from 5 PM onwards." },
      { role: 'user', content: '7pm would be perfect' },
      { role: 'assistant', content: "Perfect! I've noted a reservation request for 4 guests at 7 PM this Saturday. Could you please provide your phone number so we can confirm the booking?" },
    ],
  },
  {
    customerName: 'Tom Wilson',
    messages: [
      { role: 'user', content: 'What are your most popular dishes?' },
      { role: 'assistant', content: "Our most popular dishes are the Grilled Ribeye Steak - it's dry-aged for 28 days and absolutely delicious. For seafood lovers, the Pan-Seared Salmon is a favorite. And don't miss our Chocolate Lava Cake for dessert - it's legendary! Would you like to know more about any of these?" },
    ],
  },
];

async function seedDemo() {
  console.log('🌱 Starting demo seed...\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get or verify pricing tier exists
    console.log('📦 Checking pricing tier...');
    const tierResult = await client.query(
      `SELECT id FROM pricing_tiers WHERE name = 'professional'`
    );
    let tierId: number;
    if (tierResult.rows.length === 0) {
      console.log('   Creating professional tier...');
      const insertTier = await client.query(
        `INSERT INTO pricing_tiers (name, display_name, price_monthly, max_locations, max_users, max_menu_items, max_api_calls_monthly, rate_limit_per_minute, features)
         VALUES ('professional', 'Professional', 149.00, 5, 20, 500, 50000, 500, '{"menu_ai": true, "social_media": true, "voice_ai": false, "blockchain": true}')
         RETURNING id`
      );
      tierId = insertTier.rows[0].id;
    } else {
      tierId = tierResult.rows[0].id;
    }
    console.log(`   Tier ID: ${tierId}`);

    // 2. Check if tenant already exists
    const existingTenant = await client.query(
      `SELECT id FROM tenants WHERE slug = $1`,
      [DEMO_CONFIG.tenant.slug]
    );

    let tenantId: string;
    if (existingTenant.rows.length > 0) {
      tenantId = existingTenant.rows[0].id;
      console.log(`🏢 Using existing tenant: ${tenantId}`);
    } else {
      // Create demo tenant
      console.log('🏢 Creating demo tenant...');
      tenantId = randomUUID();
      await client.query(
        `INSERT INTO tenants (id, name, slug, email, tier_id, status)
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [tenantId, DEMO_CONFIG.tenant.name, DEMO_CONFIG.tenant.slug, DEMO_CONFIG.tenant.email, tierId]
      );
    }

    // 3. Create or update demo user
    console.log('👤 Setting up demo user...');
    const passwordHash = await bcrypt.hash(DEMO_CONFIG.user.password, 10);

    const existingUser = await client.query(
      `SELECT id FROM tenant_users WHERE tenant_id = $1 AND email = $2`,
      [tenantId, DEMO_CONFIG.user.email]
    );

    let userId: string;
    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      await client.query(
        `UPDATE tenant_users SET password_hash = $1 WHERE id = $2`,
        [passwordHash, userId]
      );
      console.log(`   Updated existing user: ${userId}`);
    } else {
      userId = randomUUID();
      await client.query(
        `INSERT INTO tenant_users (id, tenant_id, email, password_hash, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, tenantId, DEMO_CONFIG.user.email, passwordHash, DEMO_CONFIG.user.firstName, DEMO_CONFIG.user.lastName, DEMO_CONFIG.user.role]
      );
      console.log(`   Created new user: ${userId}`);
    }

    // 4. Create location if needed
    console.log('📍 Setting up location...');
    const existingLocation = await client.query(
      `SELECT id FROM locations WHERE tenant_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [tenantId]
    );

    let locationId: string;
    if (existingLocation.rows.length > 0) {
      locationId = existingLocation.rows[0].id;
      console.log(`   Using existing location: ${locationId}`);
    } else {
      locationId = randomUUID();
      await client.query(
        `INSERT INTO locations (id, tenant_id, name, address, city, country)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [locationId, tenantId, DEMO_CONFIG.location.name, DEMO_CONFIG.location.address, DEMO_CONFIG.location.city, DEMO_CONFIG.location.country]
      );
      console.log(`   Created location: ${locationId}`);
    }

    // 5. Create menu categories
    console.log('📋 Creating menu categories...');
    const categoryIds: Record<string, string> = {};
    for (const category of MENU_CATEGORIES) {
      const existing = await client.query(
        `SELECT id FROM menu_categories WHERE tenant_id = $1 AND name = $2 AND deleted_at IS NULL`,
        [tenantId, category.name]
      );
      if (existing.rows.length > 0) {
        categoryIds[category.name] = existing.rows[0].id;
      } else {
        const catId = randomUUID();
        await client.query(
          `INSERT INTO menu_categories (id, tenant_id, name, display_order)
           VALUES ($1, $2, $3, $4)`,
          [catId, tenantId, category.name, category.order]
        );
        categoryIds[category.name] = catId;
      }
    }
    console.log(`   Created/found ${Object.keys(categoryIds).length} categories`);

    // 6. Create menu items
    console.log('🍽️ Creating menu items...');
    let menuItemCount = 0;
    const menuItemIds: string[] = [];
    for (const item of MENU_ITEMS) {
      const existing = await client.query(
        `SELECT id FROM menu_items WHERE tenant_id = $1 AND name = $2 AND deleted_at IS NULL`,
        [tenantId, item.name]
      );
      if (existing.rows.length > 0) {
        menuItemIds.push(existing.rows[0].id);
      } else {
        const itemId = randomUUID();
        menuItemIds.push(itemId);
        await client.query(
          `INSERT INTO menu_items (id, tenant_id, category_id, name, description, price, ai_description)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [itemId, tenantId, categoryIds[item.category], item.name, item.description, item.price, item.description]
        );
        menuItemCount++;
      }
    }
    console.log(`   Created ${menuItemCount} new menu items`);

    // 7. Create customers
    console.log('👥 Creating sample customers...');
    const customerIds: string[] = [];
    let customerCount = 0;
    for (const customer of SAMPLE_CUSTOMERS) {
      const existing = await client.query(
        `SELECT id FROM customers WHERE tenant_id = $1 AND email = $2 AND deleted_at IS NULL`,
        [tenantId, customer.email]
      );
      if (existing.rows.length > 0) {
        customerIds.push(existing.rows[0].id);
      } else {
        const custId = randomUUID();
        customerIds.push(custId);
        await client.query(
          `INSERT INTO customers (id, tenant_id, email, phone, first_name, last_name)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [custId, tenantId, customer.email, customer.phone, customer.firstName, customer.lastName]
        );
        customerCount++;
      }
    }
    console.log(`   Created ${customerCount} new customers`);

    // 8. Create sample orders
    console.log('🛒 Creating sample orders...');
    const orderStatuses = ['completed', 'completed', 'completed', 'preparing', 'pending', 'ready'];
    const paymentStatuses = ['paid', 'paid', 'paid', 'pending', 'pending', 'paid'];
    let orderCount = 0;

    for (let i = 0; i < 25; i++) {
      const orderId = randomUUID();
      const customer = SAMPLE_CUSTOMERS[Math.floor(Math.random() * SAMPLE_CUSTOMERS.length)];
      const customerId = customerIds[SAMPLE_CUSTOMERS.indexOf(customer)];
      const statusIdx = Math.floor(Math.random() * orderStatuses.length);
      const daysAgo = Math.floor(Math.random() * 30);
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${i}`;

      // Calculate items and total
      const numItems = Math.floor(Math.random() * 4) + 1;
      let subtotal = 0;
      const orderItems: { menuItemId: string; name: string; quantity: number; price: number }[] = [];

      for (let j = 0; j < numItems; j++) {
        const menuIdx = Math.floor(Math.random() * MENU_ITEMS.length);
        const menuItem = MENU_ITEMS[menuIdx];
        const quantity = Math.floor(Math.random() * 2) + 1;
        subtotal += menuItem.price * quantity;
        orderItems.push({
          menuItemId: menuItemIds[menuIdx],
          name: menuItem.name,
          quantity,
          price: menuItem.price,
        });
      }

      const tax = subtotal * 0.0875; // 8.75% tax
      const total = subtotal + tax;

      // Create order
      await client.query(
        `INSERT INTO orders (id, tenant_id, location_id, customer_id, order_number, status, payment_status,
         customer_name, customer_email, subtotal, tax_amount, total_amount, source, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW() - INTERVAL '${daysAgo} days')`,
        [orderId, tenantId, locationId, customerId, orderNumber, orderStatuses[statusIdx], paymentStatuses[statusIdx],
         `${customer.firstName} ${customer.lastName}`, customer.email, subtotal, tax, total, 'website']
      );

      // Create order items
      for (const item of orderItems) {
        await client.query(
          `INSERT INTO order_items (tenant_id, order_id, menu_item_id, name, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [tenantId, orderId, item.menuItemId, item.name, item.quantity, item.price, item.price * item.quantity]
        );
      }
      orderCount++;
    }
    console.log(`   Created ${orderCount} orders`);

    // 9. Create sample reservations
    console.log('📅 Creating sample reservations...');
    const reservationStatuses = ['confirmed', 'confirmed', 'pending', 'completed', 'completed', 'no_show'];
    let reservationCount = 0;

    for (let i = 0; i < 12; i++) {
      const customer = SAMPLE_CUSTOMERS[Math.floor(Math.random() * SAMPLE_CUSTOMERS.length)];
      const customerId = customerIds[SAMPLE_CUSTOMERS.indexOf(customer)];
      const daysFromNow = Math.floor(Math.random() * 14) - 7;
      const hour = Math.floor(Math.random() * 4) + 17; // 5pm - 9pm
      const status = reservationStatuses[Math.floor(Math.random() * reservationStatuses.length)];

      await client.query(
        `INSERT INTO reservations (tenant_id, location_id, customer_id, customer_name, customer_email, customer_phone,
         party_size, reservation_date, reservation_time, status, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE + INTERVAL '${daysFromNow} days', $8, $9, 'website')`,
        [tenantId, locationId, customerId, `${customer.firstName} ${customer.lastName}`, customer.email, customer.phone,
         Math.floor(Math.random() * 6) + 2, `${hour}:00:00`, status]
      );
      reservationCount++;
    }
    console.log(`   Created ${reservationCount} reservations`);

    // 10. Create sample reviews
    console.log('⭐ Creating sample reviews...');
    let reviewCount = 0;
    for (const review of SAMPLE_REVIEWS) {
      const daysAgo = Math.floor(Math.random() * 60) + 1;
      const existing = await client.query(
        `SELECT id FROM reviews WHERE tenant_id = $1 AND reviewer_name = $2`,
        [tenantId, review.reviewerName]
      );
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO reviews (tenant_id, location_id, platform, rating, reviewer_name, review_text, sentiment, review_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '${daysAgo} days')`,
          [tenantId, locationId, review.platform, review.rating, review.reviewerName, review.reviewText, review.sentiment]
        );
        reviewCount++;
      }
    }
    console.log(`   Created ${reviewCount} reviews`);

    // 11. Create sample chat conversations
    console.log('💬 Creating sample chat conversations...');
    let chatCount = 0;
    for (const conv of SAMPLE_CHAT_CONVERSATIONS) {
      const sessionId = randomUUID();
      const convId = randomUUID();
      const daysAgo = Math.floor(Math.random() * 14);

      await client.query(
        `INSERT INTO chat_conversations (id, tenant_id, session_id, channel, status, customer_name, language, resolved_by_ai, created_at, updated_at)
         VALUES ($1, $2, $3, 'web', 'closed', $4, 'en', true, NOW() - INTERVAL '${daysAgo} days', NOW() - INTERVAL '${daysAgo} days')`,
        [convId, tenantId, sessionId, conv.customerName]
      );

      for (let i = 0; i < conv.messages.length; i++) {
        const msg = conv.messages[i];
        await client.query(
          `INSERT INTO chat_messages (tenant_id, conversation_id, role, content, ai_provider, ai_model, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '${daysAgo} days' + INTERVAL '${i} minutes')`,
          [tenantId, convId, msg.role, msg.content, msg.role === 'assistant' ? 'openai' : null, msg.role === 'assistant' ? 'gpt-4o-mini' : null]
        );
      }
      chatCount++;
    }
    console.log(`   Created ${chatCount} chat conversations`);

    // 12. Create sample AI usage records
    console.log('🤖 Creating AI usage records...');
    const providers = ['openai', 'openai', 'claude'];
    const models = ['gpt-4o-mini', 'gpt-4o', 'claude-3-5-sonnet-20241022'];
    const requestTypes = ['chat', 'menu_enhance', 'review_response', 'recommendations'];

    for (let i = 0; i < 50; i++) {
      const providerIdx = Math.floor(Math.random() * providers.length);
      const daysAgo = Math.floor(Math.random() * 30);
      const inputTokens = Math.floor(Math.random() * 500) + 100;
      const outputTokens = Math.floor(Math.random() * 300) + 50;
      const cost = (inputTokens * 0.00001 + outputTokens * 0.00003).toFixed(6);

      await client.query(
        `INSERT INTO ai_usage (tenant_id, provider, model, input_tokens, output_tokens, cost_usd, request_type, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '${daysAgo} days')`,
        [tenantId, providers[providerIdx], models[providerIdx], inputTokens, outputTokens, cost,
         requestTypes[Math.floor(Math.random() * requestTypes.length)]]
      );
    }
    console.log('   Created 50 AI usage records');

    await client.query('COMMIT');

    console.log('\n✅ Demo seed completed successfully!\n');
    console.log('📝 Demo credentials:');
    console.log(`   Email: ${DEMO_CONFIG.user.email}`);
    console.log(`   Password: ${DEMO_CONFIG.user.password}`);
    console.log(`   Tenant: ${DEMO_CONFIG.tenant.name}`);
    console.log(`   Slug: ${DEMO_CONFIG.tenant.slug}\n`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
seedDemo().catch(console.error);

export { seedDemo };
