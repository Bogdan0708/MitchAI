/**
 * Feature Flags Service
 *
 * Provides feature flag management for controlled rollout:
 * - Global feature flags with percentage-based rollout
 * - Per-tenant overrides
 * - Tier-based feature access
 * - Redis caching for performance
 */

import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { logger } from '../logger.service';

// Cache TTL in seconds
const CACHE_TTL = 60;

// Feature flag interface
export interface FeatureFlag {
  id: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  rolloutPercentage: number;
  allowedTiers: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Tenant override interface
export interface TenantFeatureOverride {
  id: string;
  tenantId: string;
  featureFlagId: string;
  isEnabled: boolean;
  expiresAt: Date | null;
  reason: string | null;
}

// Feature check context
export interface FeatureCheckContext {
  tenantId: string;
  tier?: string;
  userId?: string;
}

class FeatureFlagsService {
  private pool: Pool | null = null;
  private redis: Redis | null = null;
  private isInitialized = false;

  /**
   * Initialize the feature flags service
   */
  public initialize(pool: Pool, redis: Redis): void {
    this.pool = pool;
    this.redis = redis;
    this.isInitialized = true;
    logger.info('Feature flags service initialized');
  }

  /**
   * Check if a feature is enabled for a specific tenant
   */
  public async isEnabled(
    featureName: string,
    context: FeatureCheckContext
  ): Promise<boolean> {
    this.ensureInitialized();

    try {
      // Check cache first
      const cacheKey = `feature:${featureName}:${context.tenantId}`;
      const cached = await this.redis!.get(cacheKey);

      if (cached !== null) {
        return cached === 'true';
      }

      // Get flag from database
      const flag = await this.getFlag(featureName);

      if (!flag) {
        // Flag doesn't exist, default to disabled
        await this.cacheResult(cacheKey, false);
        return false;
      }

      // Check tenant-specific override first
      const override = await this.getTenantOverride(context.tenantId, flag.id);

      if (override) {
        // Check if override has expired
        if (override.expiresAt && new Date(override.expiresAt) < new Date()) {
          // Override expired, remove it
          await this.removeTenantOverride(context.tenantId, flag.id);
        } else {
          await this.cacheResult(cacheKey, override.isEnabled);
          return override.isEnabled;
        }
      }

      // Check if flag is globally enabled
      if (!flag.isEnabled) {
        await this.cacheResult(cacheKey, false);
        return false;
      }

      // Check tier-based access
      if (flag.allowedTiers.length > 0 && context.tier) {
        if (!flag.allowedTiers.includes(context.tier)) {
          await this.cacheResult(cacheKey, false);
          return false;
        }
      }

      // Check percentage rollout
      if (flag.rolloutPercentage < 100) {
        const isInRollout = this.isInRolloutPercentage(
          context.tenantId,
          featureName,
          flag.rolloutPercentage
        );
        await this.cacheResult(cacheKey, isInRollout);
        return isInRollout;
      }

      // Flag is fully enabled
      await this.cacheResult(cacheKey, true);
      return true;
    } catch (error) {
      logger.error('Error checking feature flag', {
        featureName,
        tenantId: context.tenantId,
        error: (error as Error).message,
      });
      // Fail closed - return false on error
      return false;
    }
  }

  /**
   * Get all flags with their status for a tenant
   */
  public async getAllFlagsForTenant(
    tenantId: string,
    tier?: string
  ): Promise<Record<string, boolean>> {
    this.ensureInitialized();

    const client = await this.pool!.connect();
    try {
      // Get all flags
      const flagsResult = await client.query<FeatureFlag>(
        `SELECT id, name, description, is_enabled, rollout_percentage,
                allowed_tiers, metadata, created_at, updated_at
         FROM feature_flags`
      );

      // Get tenant overrides
      const overridesResult = await client.query<{
        feature_flag_id: string;
        is_enabled: boolean;
        expires_at: Date | null;
      }>(
        `SELECT feature_flag_id, is_enabled, expires_at
         FROM tenant_feature_overrides
         WHERE tenant_id = $1`,
        [tenantId]
      );

      const overrides = new Map(
        overridesResult.rows.map((o) => [o.feature_flag_id, o])
      );

      const result: Record<string, boolean> = {};

      for (const flag of flagsResult.rows) {
        const override = overrides.get(flag.id);

        // Check override first
        if (override) {
          if (!override.expires_at || new Date(override.expires_at) > new Date()) {
            result[flag.name] = override.is_enabled;
            continue;
          }
        }

        // Check if globally disabled
        if (!flag.isEnabled) {
          result[flag.name] = false;
          continue;
        }

        // Check tier access
        if (flag.allowedTiers.length > 0 && tier) {
          if (!flag.allowedTiers.includes(tier)) {
            result[flag.name] = false;
            continue;
          }
        }

        // Check percentage rollout
        if (flag.rolloutPercentage < 100) {
          result[flag.name] = this.isInRolloutPercentage(
            tenantId,
            flag.name,
            flag.rolloutPercentage
          );
        } else {
          result[flag.name] = true;
        }
      }

      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Get a specific feature flag
   */
  public async getFlag(name: string): Promise<FeatureFlag | null> {
    this.ensureInitialized();

    const client = await this.pool!.connect();
    try {
      const result = await client.query(
        `SELECT id, name, description, is_enabled as "isEnabled",
                rollout_percentage as "rolloutPercentage",
                allowed_tiers as "allowedTiers", metadata,
                created_at as "createdAt", updated_at as "updatedAt"
         FROM feature_flags
         WHERE name = $1`,
        [name]
      );

      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Create a new feature flag
   */
  public async createFlag(
    name: string,
    options: {
      description?: string;
      isEnabled?: boolean;
      rolloutPercentage?: number;
      allowedTiers?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<FeatureFlag> {
    this.ensureInitialized();

    const client = await this.pool!.connect();
    try {
      const result = await client.query(
        `INSERT INTO feature_flags (name, description, is_enabled, rollout_percentage, allowed_tiers, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, description, is_enabled as "isEnabled",
                   rollout_percentage as "rolloutPercentage",
                   allowed_tiers as "allowedTiers", metadata,
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [
          name,
          options.description || null,
          options.isEnabled ?? false,
          options.rolloutPercentage ?? 0,
          JSON.stringify(options.allowedTiers || []),
          JSON.stringify(options.metadata || {}),
        ]
      );

      logger.info('Feature flag created', { name, options });
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Update a feature flag
   */
  public async updateFlag(
    name: string,
    updates: {
      description?: string;
      isEnabled?: boolean;
      rolloutPercentage?: number;
      allowedTiers?: string[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<FeatureFlag | null> {
    this.ensureInitialized();

    const client = await this.pool!.connect();
    try {
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }
      if (updates.isEnabled !== undefined) {
        setClauses.push(`is_enabled = $${paramIndex++}`);
        values.push(updates.isEnabled);
      }
      if (updates.rolloutPercentage !== undefined) {
        setClauses.push(`rollout_percentage = $${paramIndex++}`);
        values.push(updates.rolloutPercentage);
      }
      if (updates.allowedTiers !== undefined) {
        setClauses.push(`allowed_tiers = $${paramIndex++}`);
        values.push(JSON.stringify(updates.allowedTiers));
      }
      if (updates.metadata !== undefined) {
        setClauses.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(updates.metadata));
      }

      if (setClauses.length === 0) {
        return this.getFlag(name);
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(name);

      const result = await client.query(
        `UPDATE feature_flags
         SET ${setClauses.join(', ')}
         WHERE name = $${paramIndex}
         RETURNING id, name, description, is_enabled as "isEnabled",
                   rollout_percentage as "rolloutPercentage",
                   allowed_tiers as "allowedTiers", metadata,
                   created_at as "createdAt", updated_at as "updatedAt"`,
        values
      );

      // Invalidate cache for this flag
      await this.invalidateFlagCache(name);

      logger.info('Feature flag updated', { name, updates });
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Set a tenant-specific override
   */
  public async setTenantOverride(
    tenantId: string,
    featureName: string,
    isEnabled: boolean,
    options: { expiresAt?: Date; reason?: string } = {}
  ): Promise<void> {
    this.ensureInitialized();

    const flag = await this.getFlag(featureName);
    if (!flag) {
      throw new Error(`Feature flag '${featureName}' not found`);
    }

    const client = await this.pool!.connect();
    try {
      await client.query(
        `INSERT INTO tenant_feature_overrides (tenant_id, feature_flag_id, is_enabled, expires_at, reason)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, feature_flag_id)
         DO UPDATE SET is_enabled = $3, expires_at = $4, reason = $5, updated_at = NOW()`,
        [tenantId, flag.id, isEnabled, options.expiresAt || null, options.reason || null]
      );

      // Invalidate cache
      await this.redis!.del(`feature:${featureName}:${tenantId}`);

      logger.info('Tenant feature override set', {
        tenantId,
        featureName,
        isEnabled,
        expiresAt: options.expiresAt,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Remove a tenant-specific override
   */
  public async removeTenantOverride(tenantId: string, flagId: string): Promise<void> {
    this.ensureInitialized();

    const client = await this.pool!.connect();
    try {
      await client.query(
        `DELETE FROM tenant_feature_overrides
         WHERE tenant_id = $1 AND feature_flag_id = $2`,
        [tenantId, flagId]
      );

      // Get flag name for cache invalidation
      const flagResult = await client.query(
        `SELECT name FROM feature_flags WHERE id = $1`,
        [flagId]
      );

      if (flagResult.rows[0]) {
        await this.redis!.del(`feature:${flagResult.rows[0].name}:${tenantId}`);
      }

      logger.info('Tenant feature override removed', { tenantId, flagId });
    } finally {
      client.release();
    }
  }

  /**
   * Get tenant override for a specific flag
   */
  private async getTenantOverride(
    tenantId: string,
    flagId: string
  ): Promise<TenantFeatureOverride | null> {
    const client = await this.pool!.connect();
    try {
      const result = await client.query(
        `SELECT id, tenant_id as "tenantId", feature_flag_id as "featureFlagId",
                is_enabled as "isEnabled", expires_at as "expiresAt", reason
         FROM tenant_feature_overrides
         WHERE tenant_id = $1 AND feature_flag_id = $2`,
        [tenantId, flagId]
      );

      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Determine if a tenant is in the rollout percentage
   * Uses consistent hashing for stable results
   */
  private isInRolloutPercentage(
    tenantId: string,
    featureName: string,
    percentage: number
  ): boolean {
    // Create a hash of tenant ID + feature name for consistent bucketing
    const hashInput = `${tenantId}:${featureName}`;
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    // Convert to percentage (0-99)
    const bucket = Math.abs(hash) % 100;
    return bucket < percentage;
  }

  /**
   * Cache a feature flag result
   */
  private async cacheResult(key: string, value: boolean): Promise<void> {
    await this.redis!.setex(key, CACHE_TTL, value ? 'true' : 'false');
  }

  /**
   * Invalidate cache for a specific flag
   */
  private async invalidateFlagCache(featureName: string): Promise<void> {
    // Find and delete all cached entries for this flag
    const keys = await this.redis!.keys(`feature:${featureName}:*`);
    if (keys.length > 0) {
      await this.redis!.del(...keys);
    }
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Feature flags service not initialized');
    }
  }

  /**
   * List all feature flags
   */
  public async listFlags(): Promise<FeatureFlag[]> {
    this.ensureInitialized();

    const client = await this.pool!.connect();
    try {
      const result = await client.query(
        `SELECT id, name, description, is_enabled as "isEnabled",
                rollout_percentage as "rolloutPercentage",
                allowed_tiers as "allowedTiers", metadata,
                created_at as "createdAt", updated_at as "updatedAt"
         FROM feature_flags
         ORDER BY name`
      );

      return result.rows;
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
export const featureFlagsService = new FeatureFlagsService();

// Export convenience function
export const isFeatureEnabled = featureFlagsService.isEnabled.bind(featureFlagsService);
