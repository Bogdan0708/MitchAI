/**
 * Demo Data Seeder
 *
 * This script seeds the database with 50+ demo reviews and sample data
 * for demonstration purposes.
 *
 * Usage: npx ts-node database/seeds/seed-demo-data.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hospitality_saas',
});

// Review platforms with their characteristics
const platforms = ['google', 'yelp', 'tripadvisor', 'facebook'];

// Realistic reviewer names
const reviewerNames = [
  'Sarah M.', 'James Wilson', 'Emily Chen', 'Robert Brown', 'Lisa Anderson',
  'Michael Davis', 'Jennifer Taylor', 'David Martinez', 'Amanda White', 'Christopher Lee',
  'Stephanie Moore', 'Daniel Jackson', 'Rachel Thompson', 'Matthew Garcia', 'Ashley Robinson',
  'Brandon Clark', 'Nicole Walker', 'Kevin Hall', 'Laura Young', 'Jason King',
  'Patricia Wright', 'Richard Lopez', 'Susan Hill', 'Mark Scott', 'Elizabeth Green',
  'Thomas Adams', 'Margaret Baker', 'Steven Nelson', 'Dorothy Carter', 'Paul Mitchell',
  'Karen Roberts', 'Ronald Turner', 'Betty Phillips', 'Edward Campbell', 'Helen Parker',
  'Frank Evans', 'Virginia Edwards', 'George Collins', 'Martha Stewart', 'Raymond Morris',
  'Marie Rogers', 'Jerry Reed', 'Catherine Cook', 'Henry Morgan', 'Ann Bell',
  'Walter Murphy', 'Jean Bailey', 'Carl Cooper', 'Ruth Richardson', 'Jack Cox',
  'Willie Howard', 'Harold Ward', 'Shirley Torres', 'Eugene Peterson', 'Gloria Gray',
];

// Positive review templates (5 stars)
const positiveReviews = [
  { text: 'Absolutely phenomenal dining experience! The truffle mushroom bruschetta was heavenly, and the grilled salmon melted in my mouth. Our server was attentive without being intrusive. Will definitely be back!', keywords: ['truffle mushroom bruschetta', 'grilled salmon', 'attentive service'] },
  { text: 'Best restaurant in the area! The menu has such variety, and everything is made fresh. The chocolate lava cake is a must-try dessert. Prices are reasonable for the quality.', keywords: ['best restaurant', 'fresh ingredients', 'chocolate lava cake'] },
  { text: 'My new favorite spot! The ambiance is perfect for date night. We tried the duck breast and it was cooked to perfection. The wine selection is impressive too.', keywords: ['date night', 'duck breast', 'wine selection'] },
  { text: 'Outstanding food and service! We celebrated our anniversary here and the staff made it extra special. The lobster bisque was the best I have ever had.', keywords: ['anniversary', 'lobster bisque', 'outstanding service'] },
  { text: 'Hidden gem! We stumbled upon this place and were blown away. The Caesar salad had the perfect dressing, and the portions are generous. Highly recommend!', keywords: ['hidden gem', 'Caesar salad', 'generous portions'] },
  { text: 'Took my family here for Sunday brunch - everyone loved it! Kids menu is fantastic and the staff were so patient with our little ones. Great family restaurant.', keywords: ['family friendly', 'Sunday brunch', 'kids menu'] },
  { text: 'The attention to detail here is incredible. Every dish is presented beautifully. Had the pan-seared duck and it was restaurant-quality at its finest!', keywords: ['attention to detail', 'beautiful presentation', 'pan-seared duck'] },
  { text: 'I have been coming here for years and the quality never drops. The salmon is always fresh and perfectly seasoned. This is my go-to recommendation for visitors.', keywords: ['consistent quality', 'fresh salmon', 'go-to recommendation'] },
  { text: 'Celebrated my birthday here and they made it so special with a complimentary dessert and candle! The steak was perfect medium-rare. Five stars all around!', keywords: ['birthday celebration', 'complimentary dessert', 'perfect steak'] },
  { text: 'As a foodie, I have high standards - and this place exceeded them all. The creative menu items and impeccable execution make this a must-visit destination.', keywords: ['foodie approved', 'creative menu', 'impeccable execution'] },
];

// Good review templates (4 stars)
const goodReviews = [
  { text: 'Great food, excellent service. Only reason for 4 stars instead of 5 is the parking situation - can be tricky on weekends. But definitely worth the effort!', keywords: ['great food', 'excellent service', 'parking issues'] },
  { text: 'Solid restaurant with consistent quality. The menu could use a few more options for pescatarians, but what they do have is excellent.', keywords: ['consistent quality', 'limited options', 'excellent dishes'] },
  { text: 'Lovely meal overall. The appetizers were the stars of the show - could have eaten three orders of the bruschetta! Main course was good but not quite as memorable.', keywords: ['lovely meal', 'great appetizers', 'good main course'] },
  { text: 'Really enjoyed our dinner. The noise level was a bit high on Saturday night which made conversation difficult, but the food more than made up for it.', keywords: ['enjoyed dinner', 'noise level', 'great food'] },
  { text: 'Food was fantastic, service was friendly but a bit slow during the rush. Would still recommend, just maybe not when you are in a hurry.', keywords: ['fantastic food', 'slow service', 'recommend'] },
  { text: 'Very good restaurant with high-quality ingredients. Portions are on the smaller side for the price, but the taste is undeniable. Fine dining without the pretense.', keywords: ['high-quality', 'smaller portions', 'fine dining'] },
  { text: 'Delicious meal and beautiful presentation. Would have been 5 stars but our reservation was pushed back 15 minutes. Still a wonderful experience overall.', keywords: ['delicious', 'beautiful presentation', 'reservation delay'] },
  { text: 'Great spot for a nice dinner. The sommelier gave excellent wine recommendations. Dessert menu is a bit limited but what they offer is superb.', keywords: ['nice dinner', 'wine recommendations', 'limited desserts'] },
];

// Neutral review templates (3 stars)
const neutralReviews = [
  { text: 'Decent food but nothing extraordinary. The prices seem a bit high for what you get. Service was okay, not particularly memorable in either direction.', keywords: ['decent food', 'high prices', 'okay service'] },
  { text: 'Mixed experience. Some dishes were great (loved the appetizers), others were underwhelming (the pasta was overcooked). Hit or miss depending on what you order.', keywords: ['mixed experience', 'great appetizers', 'overcooked pasta'] },
  { text: 'Average restaurant experience. Nothing wrong per se, but nothing that would make me rush back either. Plenty of other options in the area.', keywords: ['average experience', 'nothing special', 'other options'] },
  { text: 'The food was fine, portions are generous. However, we waited 45 minutes for our entrees which put a damper on the evening. When it arrived, it was lukewarm.', keywords: ['fine food', 'generous portions', 'long wait'] },
  { text: 'Good location and nice decor. The food quality varied - some items excellent, others needed work. With some consistency, this could be a great spot.', keywords: ['good location', 'nice decor', 'inconsistent quality'] },
];

// Negative review templates (2 stars)
const negativeReviews = [
  { text: 'Disappointed with our experience. Made a reservation but still waited 30 minutes for a table. Food was average when it finally arrived. Not worth the hassle.', keywords: ['disappointed', 'long wait', 'reservation issues'] },
  { text: 'Overpriced and underwhelming. The steak I ordered medium came out well-done. When I mentioned it, the server seemed indifferent. Will not be returning.', keywords: ['overpriced', 'overcooked steak', 'indifferent service'] },
  { text: 'Had higher hopes based on reviews. The fish was clearly not fresh, and the vegetables were overcooked. Presentation was nice but can not eat presentation.', keywords: ['not fresh fish', 'overcooked vegetables', 'disappointing'] },
  { text: 'Service was our main issue. Our server forgot our appetizer order entirely, then brought the wrong entrees. Manager apologized but the damage was done.', keywords: ['poor service', 'forgotten order', 'wrong entrees'] },
];

// Very negative review templates (1 star)
const veryNegativeReviews = [
  { text: 'Terrible experience. Found a hair in my soup and when I complained, the manager was dismissive. No apology, no discount, nothing. Avoid this place.', keywords: ['hair in food', 'dismissive manager', 'avoid'] },
  { text: 'Waited over an hour for food that never came. Server kept saying 5 more minutes for 40 minutes straight. Finally left and went elsewhere. Unacceptable.', keywords: ['hour wait', 'food never came', 'walked out'] },
  { text: 'Rudest staff I have ever encountered. Asked a simple question about allergens and was treated like a nuisance. Will never give them my money again.', keywords: ['rude staff', 'allergen concerns ignored', 'never again'] },
];

// AI Response templates
const aiResponses = {
  positive: [
    'Thank you so much for your wonderful review! We\'re thrilled to hear you enjoyed your experience with us. Your kind words mean the world to our team, and we can\'t wait to welcome you back soon!',
    'What a lovely review! Thank you for taking the time to share your experience. We\'re delighted that everything exceeded your expectations. We look forward to serving you again!',
  ],
  neutral: [
    'Thank you for your honest feedback. We appreciate you taking the time to share your experience with us. We\'re always looking to improve and will take your comments to heart. We hope to have the opportunity to provide you with a better experience next time.',
  ],
  negative: [
    'We sincerely apologize for your disappointing experience. This does not reflect our standards, and we take your feedback very seriously. We would love the opportunity to make things right. Please reach out to us directly so we can address your concerns personally.',
  ],
};

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDate(daysBack: number): Date {
  const now = new Date();
  const randomDays = Math.floor(Math.random() * daysBack);
  return new Date(now.getTime() - randomDays * 24 * 60 * 60 * 1000);
}

function getSentimentScore(rating: number): number {
  const base = (rating - 3) / 2; // -1 to 1 range
  const variance = (Math.random() - 0.5) * 0.3;
  return Math.max(-1, Math.min(1, base + variance));
}

function getSentiment(rating: number): string {
  if (rating >= 4) return 'positive';
  if (rating === 3) return 'neutral';
  return 'negative';
}

async function seedDemoReviews() {
  const client = await pool.connect();

  try {
    // Get the most recent tenant
    const tenantResult = await client.query(
      'SELECT id, name FROM tenants ORDER BY created_at DESC LIMIT 1'
    );

    if (tenantResult.rows.length === 0) {
      console.error('No tenant found. Please create a tenant first.');
      return;
    }

    const tenant = tenantResult.rows[0];
    console.log(`Seeding demo reviews for tenant: ${tenant.name} (${tenant.id})`);

    // Check if reviews already exist for this tenant
    const existingReviews = await client.query(
      'SELECT COUNT(*) FROM reviews WHERE tenant_id = $1',
      [tenant.id]
    );

    if (parseInt(existingReviews.rows[0].count) > 0) {
      console.log(`Tenant already has ${existingReviews.rows[0].count} reviews. Skipping seed.`);
      console.log('To re-seed, first delete existing reviews: DELETE FROM reviews WHERE tenant_id = $1', [tenant.id]);
      return;
    }

    const reviews = [];

    // Generate 5-star reviews (20)
    for (let i = 0; i < 20; i++) {
      const template = getRandomElement(positiveReviews);
      const shouldHaveResponse = Math.random() > 0.7;
      reviews.push({
        tenant_id: tenant.id,
        platform: getRandomElement(platforms),
        reviewer_name: reviewerNames[i],
        rating: 5,
        review_text: template.text,
        review_date: getRandomDate(60),
        sentiment: 'positive',
        sentiment_score: getSentimentScore(5),
        keywords: JSON.stringify(template.keywords),
        response_text: shouldHaveResponse ? getRandomElement(aiResponses.positive) : null,
        response_generated_by: shouldHaveResponse ? 'ai' : null,
        response_ai_provider: shouldHaveResponse ? getRandomElement(['claude', 'openai']) : null,
        response_date: shouldHaveResponse ? getRandomDate(30) : null,
      });
    }

    // Generate 4-star reviews (15)
    for (let i = 0; i < 15; i++) {
      const template = getRandomElement(goodReviews);
      const shouldHaveResponse = Math.random() > 0.75;
      reviews.push({
        tenant_id: tenant.id,
        platform: getRandomElement(platforms),
        reviewer_name: reviewerNames[20 + i],
        rating: 4,
        review_text: template.text,
        review_date: getRandomDate(60),
        sentiment: 'positive',
        sentiment_score: getSentimentScore(4),
        keywords: JSON.stringify(template.keywords),
        response_text: shouldHaveResponse ? getRandomElement(aiResponses.positive) : null,
        response_generated_by: shouldHaveResponse ? 'ai' : null,
        response_ai_provider: shouldHaveResponse ? getRandomElement(['claude', 'openai']) : null,
        response_date: shouldHaveResponse ? getRandomDate(30) : null,
      });
    }

    // Generate 3-star reviews (10)
    for (let i = 0; i < 10; i++) {
      const template = getRandomElement(neutralReviews);
      const shouldHaveResponse = Math.random() > 0.5;
      reviews.push({
        tenant_id: tenant.id,
        platform: getRandomElement(platforms),
        reviewer_name: reviewerNames[35 + i],
        rating: 3,
        review_text: template.text,
        review_date: getRandomDate(60),
        sentiment: 'neutral',
        sentiment_score: getSentimentScore(3),
        keywords: JSON.stringify(template.keywords),
        response_text: shouldHaveResponse ? getRandomElement(aiResponses.neutral) : null,
        response_generated_by: shouldHaveResponse ? 'ai' : null,
        response_ai_provider: shouldHaveResponse ? getRandomElement(['claude', 'openai']) : null,
        response_date: shouldHaveResponse ? getRandomDate(30) : null,
      });
    }

    // Generate 2-star reviews (5)
    for (let i = 0; i < 5; i++) {
      const template = getRandomElement(negativeReviews);
      reviews.push({
        tenant_id: tenant.id,
        platform: getRandomElement(platforms),
        reviewer_name: reviewerNames[45 + i],
        rating: 2,
        review_text: template.text,
        review_date: getRandomDate(60),
        sentiment: 'negative',
        sentiment_score: getSentimentScore(2),
        keywords: JSON.stringify(template.keywords),
        response_text: getRandomElement(aiResponses.negative),
        response_generated_by: 'ai',
        response_ai_provider: getRandomElement(['claude', 'openai']),
        response_date: getRandomDate(30),
      });
    }

    // Generate 1-star reviews (5)
    for (let i = 0; i < 5; i++) {
      const template = getRandomElement(veryNegativeReviews);
      reviews.push({
        tenant_id: tenant.id,
        platform: getRandomElement(platforms),
        reviewer_name: reviewerNames[50 + i] || `Customer ${i + 1}`,
        rating: 1,
        review_text: template.text,
        review_date: getRandomDate(60),
        sentiment: 'negative',
        sentiment_score: getSentimentScore(1),
        keywords: JSON.stringify(template.keywords),
        response_text: getRandomElement(aiResponses.negative),
        response_generated_by: 'ai',
        response_ai_provider: getRandomElement(['claude', 'openai']),
        response_date: getRandomDate(30),
      });
    }

    // Insert all reviews
    for (const review of reviews) {
      await client.query(
        `INSERT INTO reviews (
          tenant_id, platform, reviewer_name, rating, review_text,
          review_date, sentiment, sentiment_score, keywords,
          response_text, response_generated_by, response_ai_provider, response_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          review.tenant_id,
          review.platform,
          review.reviewer_name,
          review.rating,
          review.review_text,
          review.review_date,
          review.sentiment,
          review.sentiment_score,
          review.keywords,
          review.response_text,
          review.response_generated_by,
          review.response_ai_provider,
          review.response_date,
        ]
      );
    }

    console.log(`Successfully seeded ${reviews.length} demo reviews!`);
    console.log('\nBreakdown:');
    console.log('- 5-star reviews: 20');
    console.log('- 4-star reviews: 15');
    console.log('- 3-star reviews: 10');
    console.log('- 2-star reviews: 5');
    console.log('- 1-star reviews: 5');
    console.log('- Total: 55 reviews');

    // Print platform distribution
    const platformCounts = reviews.reduce((acc, r) => {
      acc[r.platform] = (acc[r.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('\nPlatform distribution:');
    Object.entries(platformCounts).forEach(([platform, count]) => {
      console.log(`- ${platform}: ${count}`);
    });

  } catch (error) {
    console.error('Error seeding demo reviews:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeder
seedDemoReviews().catch(console.error);
