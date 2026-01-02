/**
 * GOOGLE BUSINESS PROFILE INTEGRATION SERVICE
 *
 * Mock integration for demo purposes - simulates Google Business Profile API
 * In production, this would use the actual Google My Business API
 */

import { Pool } from 'pg';

// ============================================================================
// TYPES
// ============================================================================

export interface GoogleBusinessProfile {
  id: string;
  name: string;
  address: string;
  rating: number;
  totalReviews: number;
  placeId: string;
  connected: boolean;
  lastSyncAt: Date | null;
}

export interface GoogleReview {
  reviewId: string;
  authorName: string;
  rating: number;
  text: string;
  publishTime: Date;
  profilePhotoUrl?: string;
  reply?: {
    text: string;
    updateTime: Date;
  };
}

export interface SyncResult {
  success: boolean;
  reviewsImported: number;
  newReviews: number;
  errors: string[];
}

// ============================================================================
// MOCK DATA FOR DEMO
// ============================================================================

const MOCK_REVIEWS: GoogleReview[] = [
  {
    reviewId: 'goog_rev_001',
    authorName: 'Sarah M.',
    rating: 5,
    text: 'Absolutely fantastic! The lamb shank was cooked to perfection and the service was impeccable. This is now our go-to spot for special occasions.',
    publishTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    profilePhotoUrl: 'https://ui-avatars.com/api/?name=Sarah+M&background=random',
  },
  {
    reviewId: 'goog_rev_002',
    authorName: 'James W.',
    rating: 4,
    text: 'Great food and atmosphere. The truffle risotto was amazing. Only giving 4 stars because the wait was a bit long on a Friday evening.',
    publishTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    profilePhotoUrl: 'https://ui-avatars.com/api/?name=James+W&background=random',
  },
  {
    reviewId: 'goog_rev_003',
    authorName: 'Emily R.',
    rating: 5,
    text: 'Best brunch in town! The avocado toast with poached eggs is divine. Will definitely be back.',
    publishTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    profilePhotoUrl: 'https://ui-avatars.com/api/?name=Emily+R&background=random',
  },
  {
    reviewId: 'goog_rev_004',
    authorName: 'Michael T.',
    rating: 3,
    text: 'Food was good but nothing special. The pasta was slightly overcooked. Service was friendly though.',
    publishTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    profilePhotoUrl: 'https://ui-avatars.com/api/?name=Michael+T&background=random',
  },
  {
    reviewId: 'goog_rev_005',
    authorName: 'Lisa K.',
    rating: 5,
    text: 'Our anniversary dinner was perfect! The chef even sent out a complimentary dessert. The wine pairing recommendations were spot on.',
    publishTime: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
    profilePhotoUrl: 'https://ui-avatars.com/api/?name=Lisa+K&background=random',
  },
  {
    reviewId: 'goog_rev_006',
    authorName: 'David P.',
    rating: 2,
    text: 'Disappointed with my visit. The steak was overcooked despite asking for medium-rare, and the server seemed overwhelmed.',
    publishTime: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000), // 18 days ago
    profilePhotoUrl: 'https://ui-avatars.com/api/?name=David+P&background=random',
  },
  {
    reviewId: 'goog_rev_007',
    authorName: 'Amanda H.',
    rating: 5,
    text: 'Hidden gem! The seafood platter was incredibly fresh. The outdoor seating area is beautiful.',
    publishTime: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), // 21 days ago
    profilePhotoUrl: 'https://ui-avatars.com/api/?name=Amanda+H&background=random',
  },
  {
    reviewId: 'goog_rev_008',
    authorName: 'Robert C.',
    rating: 4,
    text: 'Solid dining experience. The cocktails were creative and the appetizers were delicious. Will return to try their main courses.',
    publishTime: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
    profilePhotoUrl: 'https://ui-avatars.com/api/?name=Robert+C&background=random',
  },
];

// ============================================================================
// SERVICE
// ============================================================================

export class GoogleBusinessService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get connection status for a tenant
   */
  async getConnectionStatus(tenantId: string): Promise<{
    connected: boolean;
    profile: GoogleBusinessProfile | null;
  }> {
    const result = await this.pool.query(
      `SELECT settings->'integrations'->'google_business' as google_config
       FROM tenants WHERE id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return { connected: false, profile: null };
    }

    const config = result.rows[0].google_config;
    if (!config?.connected) {
      return { connected: false, profile: null };
    }

    // Get tenant name for mock profile
    const tenantResult = await this.pool.query(
      'SELECT name, slug FROM tenants WHERE id = $1',
      [tenantId]
    );
    const tenant = tenantResult.rows[0];

    return {
      connected: true,
      profile: {
        id: config.profileId || 'gbp_' + tenantId.slice(0, 8),
        name: tenant.name,
        address: config.address || '123 Main Street, New York, NY',
        rating: config.rating || 4.5,
        totalReviews: config.totalReviews || MOCK_REVIEWS.length,
        placeId: config.placeId || 'ChIJ_mock_place_id_' + tenantId.slice(0, 8),
        connected: true,
        lastSyncAt: config.lastSyncAt ? new Date(config.lastSyncAt) : null,
      },
    };
  }

  /**
   * Connect to Google Business Profile (mock OAuth flow)
   */
  async connect(
    tenantId: string,
    businessName: string,
    address?: string
  ): Promise<{ success: boolean; profile: GoogleBusinessProfile }> {
    const profileId = 'gbp_' + tenantId.slice(0, 8) + '_' + Date.now();
    const placeId = 'ChIJ_' + Math.random().toString(36).substring(2, 15);

    const config = {
      connected: true,
      profileId,
      placeId,
      address: address || '123 Main Street, New York, NY 10001',
      rating: 4.5,
      totalReviews: MOCK_REVIEWS.length,
      connectedAt: new Date().toISOString(),
      lastSyncAt: null,
    };

    await this.pool.query(
      `UPDATE tenants
       SET settings = settings || jsonb_build_object(
         'integrations', COALESCE(settings->'integrations', '{}'::jsonb) || jsonb_build_object(
           'google_business', $1::jsonb
         )
       ),
       updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(config), tenantId]
    );

    return {
      success: true,
      profile: {
        id: profileId,
        name: businessName,
        address: config.address,
        rating: config.rating,
        totalReviews: config.totalReviews,
        placeId,
        connected: true,
        lastSyncAt: null,
      },
    };
  }

  /**
   * Disconnect from Google Business Profile
   */
  async disconnect(tenantId: string): Promise<{ success: boolean }> {
    await this.pool.query(
      `UPDATE tenants
       SET settings = settings #- '{integrations,google_business}',
       updated_at = NOW()
       WHERE id = $1`,
      [tenantId]
    );

    return { success: true };
  }

  /**
   * Fetch reviews from Google (mock implementation)
   */
  async fetchReviews(_tenantId: string): Promise<GoogleReview[]> {
    // In production, this would call the actual Google My Business API
    // For demo, return mock reviews with some randomization
    const reviews = MOCK_REVIEWS.map(review => ({
      ...review,
      // Add some variation to make it feel more real
      publishTime: new Date(
        Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
      ),
    }));

    return reviews.sort(
      (a, b) => b.publishTime.getTime() - a.publishTime.getTime()
    );
  }

  /**
   * Sync reviews from Google to local database
   */
  async syncReviews(tenantId: string, locationId?: string): Promise<SyncResult> {
    const errors: string[] = [];
    let reviewsImported = 0;
    let newReviews = 0;

    try {
      const googleReviews = await this.fetchReviews(tenantId);

      // Get default location if not specified
      let targetLocationId = locationId;
      if (!targetLocationId) {
        const locResult = await this.pool.query(
          `SELECT id FROM locations WHERE tenant_id = $1 AND is_active = true ORDER BY is_primary DESC, created_at ASC LIMIT 1`,
          [tenantId]
        );
        if (locResult.rows.length > 0) {
          targetLocationId = locResult.rows[0].id;
        }
      }

      for (const googleReview of googleReviews) {
        try {
          // Check if review already exists
          const existingResult = await this.pool.query(
            `SELECT id FROM reviews WHERE tenant_id = $1 AND external_review_id = $2`,
            [tenantId, googleReview.reviewId]
          );

          if (existingResult.rows.length === 0) {
            // Calculate sentiment from rating
            let sentiment: 'positive' | 'neutral' | 'negative';
            let sentimentScore: number;
            if (googleReview.rating >= 4) {
              sentiment = 'positive';
              sentimentScore = 0.7 + (googleReview.rating - 4) * 0.15;
            } else if (googleReview.rating >= 3) {
              sentiment = 'neutral';
              sentimentScore = 0.4 + (googleReview.rating - 3) * 0.2;
            } else {
              sentiment = 'negative';
              sentimentScore = googleReview.rating * 0.15;
            }

            // Insert new review
            await this.pool.query(
              `INSERT INTO reviews (
                tenant_id, location_id, platform, external_review_id,
                reviewer_name, rating, review_text, review_date,
                sentiment, sentiment_score, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
              [
                tenantId,
                targetLocationId,
                'google',
                googleReview.reviewId,
                googleReview.authorName,
                googleReview.rating,
                googleReview.text,
                googleReview.publishTime,
                sentiment,
                sentimentScore,
              ]
            );
            newReviews++;
          }
          reviewsImported++;
        } catch (error) {
          errors.push(
            `Failed to import review ${googleReview.reviewId}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      }

      // Update last sync time
      await this.pool.query(
        `UPDATE tenants
         SET settings = jsonb_set(
           settings,
           '{integrations,google_business,lastSyncAt}',
           to_jsonb($1::text)
         ),
         updated_at = NOW()
         WHERE id = $2`,
        [new Date().toISOString(), tenantId]
      );

      return {
        success: errors.length === 0,
        reviewsImported,
        newReviews,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        reviewsImported,
        newReviews,
        errors: [error instanceof Error ? error.message : 'Sync failed'],
      };
    }
  }

  /**
   * Search for Google Business Profile by name (mock)
   */
  async searchProfiles(
    query: string
  ): Promise<Array<{ placeId: string; name: string; address: string }>> {
    // Mock search results
    return [
      {
        placeId: 'ChIJ_mock_' + query.replace(/\s+/g, '_').toLowerCase(),
        name: query,
        address: '123 Main Street, New York, NY 10001',
      },
      {
        placeId: 'ChIJ_mock_' + query.replace(/\s+/g, '_').toLowerCase() + '_2',
        name: query + ' - Downtown',
        address: '456 Broadway, New York, NY 10012',
      },
    ];
  }
}

export default GoogleBusinessService;
