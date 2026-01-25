/**
 * Social Publisher Service
 *
 * Manages social media account connections and publishes
 * content to various platforms (TikTok, Instagram, Facebook, etc.)
 */

import { Pool } from 'pg';
import { runInTenantContext } from '../../../lib/db-context';
import { logger } from '../../logger.service';
import { encrypt, decrypt } from '../../encryption';
import { addJob } from '../../queue';
import { ContentEntry, ContentCalendarService } from './content-calendar.service';

// Types
export interface SocialAccount {
  id: string;
  tenantId: string;
  locationId: string | null;
  platform: 'tiktok' | 'instagram' | 'facebook' | 'twitter' | 'youtube';
  accountId: string;
  accountName: string | null;
  accountHandle: string | null;
  followerCount: number | null;
  profileUrl: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  lastSyncAt: Date | null;
  tokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectAccountDTO {
  locationId?: string;
  platform: SocialAccount['platform'];
  accountId: string;
  accountName?: string;
  accountHandle?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  profileUrl?: string;
  avatarUrl?: string;
}

export interface PublishResult {
  platform: string;
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  publishedAt?: Date;
}

export interface AccountStats {
  platform: string;
  accountHandle: string;
  followerCount: number;
  followingCount?: number;
  totalPosts?: number;
  engagementRate?: number;
  recentPostsPerformance?: {
    avgViews: number;
    avgLikes: number;
    avgComments: number;
  };
}

// Platform API configurations (would be environment variables in production)
// Note: These will be used when actual API integration is implemented
export const PLATFORM_CONFIGS: Record<string, { apiUrl: string; version: string }> = {
  tiktok: { apiUrl: 'https://open.tiktokapis.com', version: 'v2' },
  instagram: { apiUrl: 'https://graph.instagram.com', version: 'v18.0' },
  facebook: { apiUrl: 'https://graph.facebook.com', version: 'v18.0' },
  twitter: { apiUrl: 'https://api.twitter.com', version: '2' },
  youtube: { apiUrl: 'https://www.googleapis.com/youtube', version: 'v3' },
};

export class SocialPublisherService {
  private contentCalendar: ContentCalendarService;

  constructor(private pool: Pool) {
    this.contentCalendar = new ContentCalendarService(pool);
  }

  /**
   * Get connected social accounts
   */
  public async getAccounts(
    tenantId: string,
    locationId?: string
  ): Promise<SocialAccount[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      let query = `
        SELECT id, tenant_id as "tenantId", location_id as "locationId",
               platform, account_id as "accountId", account_name as "accountName",
               account_handle as "accountHandle", follower_count as "followerCount",
               profile_url as "profileUrl", avatar_url as "avatarUrl",
               is_active as "isActive", last_sync_at as "lastSyncAt",
               token_expires_at as "tokenExpiresAt",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM social_accounts
        WHERE tenant_id = $1 AND deleted_at IS NULL`;

      const params: unknown[] = [tenantId];

      if (locationId) {
        query += ' AND (location_id = $2 OR location_id IS NULL)';
        params.push(locationId);
      }

      query += ' ORDER BY platform, account_name';

      const result = await client.query(query, params);
      return result.rows;
    });
  }

  /**
   * Get a specific account
   */
  public async getAccountById(
    tenantId: string,
    accountId: string
  ): Promise<SocialAccount | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT id, tenant_id as "tenantId", location_id as "locationId",
                platform, account_id as "accountId", account_name as "accountName",
                account_handle as "accountHandle", follower_count as "followerCount",
                profile_url as "profileUrl", avatar_url as "avatarUrl",
                is_active as "isActive", last_sync_at as "lastSyncAt",
                token_expires_at as "tokenExpiresAt",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM social_accounts
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [tenantId, accountId]
      );
      return result.rows[0] || null;
    });
  }

  /**
   * Connect a social account (OAuth callback handler)
   */
  public async connectAccount(
    tenantId: string,
    data: ConnectAccountDTO
  ): Promise<SocialAccount> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Encrypt tokens
      const encryptedAccessToken = encrypt(data.accessToken);
      const encryptedRefreshToken = data.refreshToken ? encrypt(data.refreshToken) : null;

      const result = await client.query(
        `INSERT INTO social_accounts
         (tenant_id, location_id, platform, account_id, account_name, account_handle,
          access_token, refresh_token, token_expires_at, profile_url, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (tenant_id, platform, account_id)
         DO UPDATE SET
           access_token = EXCLUDED.access_token,
           refresh_token = EXCLUDED.refresh_token,
           token_expires_at = EXCLUDED.token_expires_at,
           account_name = COALESCE(EXCLUDED.account_name, social_accounts.account_name),
           account_handle = COALESCE(EXCLUDED.account_handle, social_accounts.account_handle),
           profile_url = COALESCE(EXCLUDED.profile_url, social_accounts.profile_url),
           avatar_url = COALESCE(EXCLUDED.avatar_url, social_accounts.avatar_url),
           is_active = true,
           deleted_at = NULL,
           updated_at = NOW()
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   platform, account_id as "accountId", account_name as "accountName",
                   account_handle as "accountHandle", follower_count as "followerCount",
                   profile_url as "profileUrl", avatar_url as "avatarUrl",
                   is_active as "isActive", last_sync_at as "lastSyncAt",
                   token_expires_at as "tokenExpiresAt",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [
          tenantId,
          data.locationId || null,
          data.platform,
          data.accountId,
          data.accountName || null,
          data.accountHandle || null,
          encryptedAccessToken,
          encryptedRefreshToken,
          data.tokenExpiresAt || null,
          data.profileUrl || null,
          data.avatarUrl || null,
        ]
      );

      logger.info('Social account connected', {
        tenantId,
        platform: data.platform,
        accountHandle: data.accountHandle,
      });

      // Queue account stats sync
      await addJob('content.sync.account', {
        tenantId,
        accountId: result.rows[0].id,
      });

      return result.rows[0];
    });
  }

  /**
   * Disconnect a social account
   */
  public async disconnectAccount(
    tenantId: string,
    accountId: string
  ): Promise<boolean> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE social_accounts
         SET deleted_at = NOW(), is_active = false
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [tenantId, accountId]
      );

      if ((result.rowCount || 0) > 0) {
        logger.info('Social account disconnected', { tenantId, accountId });
      }

      return (result.rowCount || 0) > 0;
    });
  }

  /**
   * Refresh OAuth token
   */
  public async refreshToken(
    tenantId: string,
    accountId: string
  ): Promise<boolean> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Get current token
      const accountResult = await client.query(
        `SELECT platform, refresh_token FROM social_accounts
         WHERE tenant_id = $1 AND id = $2`,
        [tenantId, accountId]
      );

      if (!accountResult.rows[0]?.refresh_token) {
        logger.warn('No refresh token available', { tenantId, accountId });
        return false;
      }

      const { platform, refresh_token } = accountResult.rows[0];

      try {
        const decryptedRefreshToken = await decrypt(refresh_token);

        // Platform-specific token refresh
        // In production, this would call the actual platform OAuth endpoints
        const newTokens = await this.performTokenRefresh(platform, decryptedRefreshToken);

        if (newTokens) {
          const encryptedAccessToken = await encrypt(newTokens.accessToken);
          const encryptedRefreshToken = newTokens.refreshToken
            ? await encrypt(newTokens.refreshToken)
            : null;

          await client.query(
            `UPDATE social_accounts
             SET access_token = $3,
                 refresh_token = COALESCE($4, refresh_token),
                 token_expires_at = $5,
                 updated_at = NOW()
             WHERE tenant_id = $1 AND id = $2`,
            [
              tenantId,
              accountId,
              encryptedAccessToken,
              encryptedRefreshToken,
              newTokens.expiresAt,
            ]
          );

          logger.info('Token refreshed', { tenantId, accountId, platform });
          return true;
        }
      } catch (error) {
        logger.error('Token refresh failed', {
          tenantId,
          accountId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      return false;
    });
  }

  /**
   * Perform token refresh (platform-specific)
   */
  private async performTokenRefresh(
    platform: string,
    _refreshToken: string
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt: Date } | null> {
    // In production, this would make actual API calls to platform OAuth endpoints
    // For now, return null to indicate refresh not implemented
    logger.info('Token refresh would happen here', { platform });
    return null;
  }

  /**
   * Publish content to platforms
   */
  public async publishContent(
    tenantId: string,
    contentId: string
  ): Promise<PublishResult[]> {
    const content = await this.contentCalendar.getContentById(tenantId, contentId);

    if (!content) {
      throw new Error(`Content not found: ${contentId}`);
    }

    if (content.status === 'published') {
      throw new Error('Content already published');
    }

    if (!content.platforms || content.platforms.length === 0) {
      throw new Error('No platforms specified for publishing');
    }

    const results: PublishResult[] = [];

    // Get accounts for the platforms
    const accounts = await this.getAccounts(tenantId, content.locationId || undefined);

    for (const platform of content.platforms) {
      const account = accounts.find((a) => a.platform === platform && a.isActive);

      if (!account) {
        results.push({
          platform,
          success: false,
          error: `No connected ${platform} account found`,
        });
        continue;
      }

      try {
        const result = await this.publishToPlatform(tenantId, account, content);
        results.push(result);
      } catch (error) {
        results.push({
          platform,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update content status based on results
    const allSuccessful = results.every((r) => r.success);
    const anySuccessful = results.some((r) => r.success);

    if (allSuccessful) {
      await this.contentCalendar.markPublished(tenantId, contentId,
        Object.fromEntries(results.map((r) => [r.platform, { success: r.success, postId: r.postId, error: r.error }]))
      );
    } else if (!anySuccessful) {
      await this.contentCalendar.markFailed(
        tenantId,
        contentId,
        results.map((r) => `${r.platform}: ${r.error}`).join('; ')
      );
    } else {
      // Partial success - mark as published but log failures
      await this.contentCalendar.markPublished(tenantId, contentId,
        Object.fromEntries(results.map((r) => [r.platform, { success: r.success, postId: r.postId, error: r.error }]))
      );
      logger.warn('Partial publish success', {
        tenantId,
        contentId,
        results,
      });
    }

    return results;
  }

  /**
   * Publish to a specific platform
   */
  private async publishToPlatform(
    tenantId: string,
    account: SocialAccount,
    content: ContentEntry
  ): Promise<PublishResult> {
    // Check token expiration
    if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()) {
      const refreshed = await this.refreshToken(tenantId, account.id);
      if (!refreshed) {
        return {
          platform: account.platform,
          success: false,
          error: 'Token expired and refresh failed',
        };
      }
    }

    // Get access token
    const accessToken = await this.getAccessToken(tenantId, account.id);
    if (!accessToken) {
      return {
        platform: account.platform,
        success: false,
        error: 'Could not retrieve access token',
      };
    }

    // Get platform-specific caption
    const caption = this.getPlatformCaption(content, account.platform);

    // Platform-specific publishing
    // In production, these would make actual API calls
    switch (account.platform) {
      case 'tiktok':
        return this.publishToTikTok(account, content, caption, accessToken);
      case 'instagram':
        return this.publishToInstagram(account, content, caption, accessToken);
      case 'facebook':
        return this.publishToFacebook(account, content, caption, accessToken);
      case 'twitter':
        return this.publishToTwitter(account, content, caption, accessToken);
      case 'youtube':
        return this.publishToYouTube(account, content, caption, accessToken);
      default:
        return {
          platform: account.platform,
          success: false,
          error: `Unsupported platform: ${account.platform}`,
        };
    }
  }

  /**
   * Get platform-specific caption
   */
  private getPlatformCaption(content: ContentEntry, platform: string): string {
    // Check for platform-specific AI-generated caption
    if (content.aiGeneratedCaptions) {
      const platformCaption = content.aiGeneratedCaptions.find((c) => c.platform === platform);
      if (platformCaption) {
        const hashtags = platformCaption.hashtags.map((h) => h.startsWith('#') ? h : '#' + h).join(' ');
        return `${platformCaption.caption}\n\n${hashtags}`;
      }
    }

    // Fall back to default caption
    let caption = content.caption || content.title;
    if (content.hashtags && content.hashtags.length > 0) {
      const hashtags = content.hashtags.map((h) => h.startsWith('#') ? h : '#' + h).join(' ');
      caption += `\n\n${hashtags}`;
    }

    return caption;
  }

  /**
   * Get access token for account
   */
  private async getAccessToken(
    tenantId: string,
    accountId: string
  ): Promise<string | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT access_token FROM social_accounts WHERE tenant_id = $1 AND id = $2`,
        [tenantId, accountId]
      );

      if (result.rows[0]?.access_token) {
        return decrypt(result.rows[0].access_token);
      }
      return null;
    });
  }

  // Platform-specific publish methods
  // In production, these would make actual API calls

  private async publishToTikTok(
    account: SocialAccount,
    content: ContentEntry,
    _caption: string,
    _accessToken: string
  ): Promise<PublishResult> {
    // TikTok Content Posting API integration would go here
    logger.info('TikTok publish would happen here', {
      accountId: account.accountId,
      contentType: content.contentType,
    });

    // Simulate success for now
    return {
      platform: 'tiktok',
      success: true,
      postId: `tiktok_${Date.now()}`,
      postUrl: `https://tiktok.com/@${account.accountHandle}/video/${Date.now()}`,
      publishedAt: new Date(),
    };
  }

  private async publishToInstagram(
    account: SocialAccount,
    content: ContentEntry,
    _caption: string,
    _accessToken: string
  ): Promise<PublishResult> {
    // Instagram Graph API integration would go here
    logger.info('Instagram publish would happen here', {
      accountId: account.accountId,
      contentType: content.contentType,
    });

    return {
      platform: 'instagram',
      success: true,
      postId: `ig_${Date.now()}`,
      postUrl: `https://instagram.com/p/${Date.now()}`,
      publishedAt: new Date(),
    };
  }

  private async publishToFacebook(
    account: SocialAccount,
    content: ContentEntry,
    _caption: string,
    _accessToken: string
  ): Promise<PublishResult> {
    // Facebook Graph API integration would go here
    logger.info('Facebook publish would happen here', {
      accountId: account.accountId,
      contentType: content.contentType,
    });

    return {
      platform: 'facebook',
      success: true,
      postId: `fb_${Date.now()}`,
      postUrl: `https://facebook.com/${account.accountId}/posts/${Date.now()}`,
      publishedAt: new Date(),
    };
  }

  private async publishToTwitter(
    account: SocialAccount,
    content: ContentEntry,
    _caption: string,
    _accessToken: string
  ): Promise<PublishResult> {
    // Twitter API v2 integration would go here
    logger.info('Twitter publish would happen here', {
      accountId: account.accountId,
      contentType: content.contentType,
    });

    return {
      platform: 'twitter',
      success: true,
      postId: `tw_${Date.now()}`,
      postUrl: `https://twitter.com/${account.accountHandle}/status/${Date.now()}`,
      publishedAt: new Date(),
    };
  }

  private async publishToYouTube(
    account: SocialAccount,
    content: ContentEntry,
    _caption: string,
    _accessToken: string
  ): Promise<PublishResult> {
    // YouTube Data API integration would go here
    logger.info('YouTube publish would happen here', {
      accountId: account.accountId,
      contentType: content.contentType,
    });

    return {
      platform: 'youtube',
      success: true,
      postId: `yt_${Date.now()}`,
      postUrl: `https://youtube.com/watch?v=${Date.now()}`,
      publishedAt: new Date(),
    };
  }

  /**
   * Update account stats (follower count, etc.)
   */
  public async syncAccountStats(
    tenantId: string,
    accountId: string
  ): Promise<void> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const account = await this.getAccountById(tenantId, accountId);
      if (!account) return;

      // In production, this would fetch real stats from platform APIs
      // For now, just update the last sync time
      await client.query(
        `UPDATE social_accounts
         SET last_sync_at = NOW(), updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2`,
        [tenantId, accountId]
      );

      logger.info('Account stats synced', {
        tenantId,
        accountId,
        platform: account.platform,
      });
    });
  }

  /**
   * Get account statistics
   */
  public async getAccountStats(
    tenantId: string,
    accountId: string
  ): Promise<AccountStats | null> {
    const account = await this.getAccountById(tenantId, accountId);
    if (!account) return null;

    // In production, this would fetch real stats from platform APIs
    return {
      platform: account.platform,
      accountHandle: account.accountHandle || account.accountId,
      followerCount: account.followerCount || 0,
    };
  }
}
