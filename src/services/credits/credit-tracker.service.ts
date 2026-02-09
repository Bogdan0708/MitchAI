/**
 * Credit Tracking Service
 * 
 * Tracks AI credit usage per tenant and calculates overages.
 */

import { Pool } from 'pg';
import { getCreditCost, getTierCredits, getOverageRate, calculateOverage } from '../../config/credits.config';

export interface CreditUsage {
  tenantId: string;
  period: string; // YYYY-MM
  creditsUsed: number;
  creditsIncluded: number;
  creditsRemaining: number;
  overageCredits: number;
  overageCharge: number;
  percentUsed: number;
  breakdown: Record<string, number>;
}

export interface CreditTransaction {
  id: string;
  tenantId: string;
  taskType: string;
  credits: number;
  createdAt: Date;
}

export class CreditTrackerService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Record credit usage for an AI task
   */
  async recordUsage(
    tenantId: string,
    taskType: string,
    metadata?: Record<string, any>
  ): Promise<number> {
    const credits = getCreditCost(taskType);
    
    await this.pool.query(
      `INSERT INTO ai_credit_usage (tenant_id, task_type, credits, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [tenantId, taskType, credits, metadata ? JSON.stringify(metadata) : null]
    );
    
    return credits;
  }

  /**
   * Get current month's credit usage for a tenant
   */
  async getCurrentUsage(tenantId: string): Promise<CreditUsage> {
    const period = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    // Get tenant's tier
    const tierResult = await this.pool.query(
      `SELECT pt.name as tier 
       FROM tenants t 
       JOIN pricing_tiers pt ON t.tier_id = pt.id 
       WHERE t.id = $1`,
      [tenantId]
    );
    
    const tier = tierResult.rows[0]?.tier || 'starter';
    const creditsIncluded = getTierCredits(tier);
    
    // Get usage for current month
    const usageResult = await this.pool.query(
      `SELECT 
         COALESCE(SUM(credits), 0) as total_credits,
         task_type,
         COALESCE(SUM(credits), 0) as type_credits
       FROM ai_credit_usage
       WHERE tenant_id = $1 
         AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
       GROUP BY task_type`,
      [tenantId]
    );
    
    // Calculate totals and breakdown
    const breakdown: Record<string, number> = {};
    let creditsUsed = 0;
    
    for (const row of usageResult.rows) {
      const typeCredits = parseInt(row.type_credits) || 0;
      breakdown[row.task_type] = typeCredits;
      creditsUsed += typeCredits;
    }
    
    const { overage, charge } = calculateOverage(creditsUsed, tier);
    const creditsRemaining = Math.max(0, creditsIncluded - creditsUsed);
    const percentUsed = creditsIncluded > 0 ? (creditsUsed / creditsIncluded) * 100 : 0;
    
    return {
      tenantId,
      period,
      creditsUsed,
      creditsIncluded,
      creditsRemaining,
      overageCredits: overage,
      overageCharge: charge,
      percentUsed: Math.min(percentUsed, 100),
      breakdown,
    };
  }

  /**
   * Check if tenant has credits remaining (or if overage is allowed)
   */
  async hasCreditsAvailable(tenantId: string): Promise<{ available: boolean; usage: CreditUsage }> {
    const usage = await this.getCurrentUsage(tenantId);
    
    // Always allow - we just charge overage
    // Could add a hard limit here if needed
    return {
      available: true,
      usage,
    };
  }

  /**
   * Get historical usage
   */
  async getHistoricalUsage(
    tenantId: string,
    months: number = 6
  ): Promise<Array<{ period: string; credits: number; charge: number }>> {
    const result = await this.pool.query(
      `SELECT 
         TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as period,
         COALESCE(SUM(credits), 0) as credits
       FROM ai_credit_usage
       WHERE tenant_id = $1
         AND created_at > NOW() - INTERVAL '${months} months'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY period DESC`,
      [tenantId]
    );
    
    // Get tenant tier for overage calculation
    const tierResult = await this.pool.query(
      `SELECT pt.name as tier FROM tenants t JOIN pricing_tiers pt ON t.tier_id = pt.id WHERE t.id = $1`,
      [tenantId]
    );
    const tier = tierResult.rows[0]?.tier || 'starter';
    
    return result.rows.map(row => {
      const credits = parseInt(row.credits) || 0;
      const { charge } = calculateOverage(credits, tier);
      return {
        period: row.period,
        credits,
        charge,
      };
    });
  }

  /**
   * Get all tenants' usage for admin view
   */
  async getAllTenantsUsage(): Promise<Array<CreditUsage & { tenantName: string; tier: string }>> {
    const result = await this.pool.query(
      `SELECT 
         t.id as tenant_id,
         t.name as tenant_name,
         pt.name as tier,
         COALESCE(SUM(acu.credits), 0) as credits_used
       FROM tenants t
       JOIN pricing_tiers pt ON t.tier_id = pt.id
       LEFT JOIN ai_credit_usage acu ON t.id = acu.tenant_id 
         AND DATE_TRUNC('month', acu.created_at) = DATE_TRUNC('month', NOW())
       GROUP BY t.id, t.name, pt.name
       ORDER BY credits_used DESC`
    );
    
    return result.rows.map(row => {
      const tier = row.tier || 'starter';
      const creditsUsed = parseInt(row.credits_used) || 0;
      const creditsIncluded = getTierCredits(tier);
      const { overage, charge } = calculateOverage(creditsUsed, tier);
      
      return {
        tenantId: row.tenant_id,
        tenantName: row.tenant_name,
        tier,
        period: new Date().toISOString().slice(0, 7),
        creditsUsed,
        creditsIncluded,
        creditsRemaining: Math.max(0, creditsIncluded - creditsUsed),
        overageCredits: overage,
        overageCharge: charge,
        percentUsed: creditsIncluded > 0 ? (creditsUsed / creditsIncluded) * 100 : 0,
        breakdown: {},
      };
    });
  }
}
