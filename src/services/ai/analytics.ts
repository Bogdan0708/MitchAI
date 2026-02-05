/**
 * AI Usage Analytics
 * 
 * Track AI usage per tenant, task type, and provider.
 * Enables cost analysis and optimization insights.
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { AIProvider, AITaskType, AIResponse } from './orchestrator';

// ============================================================================
// TYPES
// ============================================================================

export interface AIUsageRecord {
  tenantId: string;
  taskType: AITaskType;
  provider: AIProvider;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  cached: boolean;
  success: boolean;
  creditsUsed: number;
  estimatedCost: number; // USD
  timestamp: Date;
}

export interface AIUsageSummary {
  totalRequests: number;
  totalTokens: number;
  totalCredits: number;
  estimatedCost: number;
  cacheHitRate: number;
  avgLatencyMs: number;
  byTaskType: Record<string, { requests: number; tokens: number; cost: number }>;
  byProvider: Record<string, { requests: number; tokens: number; cost: number }>;
  topTenants: Array<{ tenantId: string; requests: number; tokens: number }>;
}

// ============================================================================
// COST ESTIMATES (per 1K tokens)
// ============================================================================

const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  // Local (FREE)
  'local': { input: 0, output: 0 },
  'ollama': { input: 0, output: 0 },
  
  // Remote GCP (uses your API keys, but track for awareness)
  'remote': { input: 0.00015, output: 0.0006 }, // GPT-4o-mini equivalent
  
  // Direct cloud (if used)
  'openai': { input: 0.00015, output: 0.0006 }, // GPT-4o-mini
  'anthropic': { input: 0.003, output: 0.015 }, // Claude Sonnet
  'google': { input: 0.000075, output: 0.0003 }, // Gemini Flash
};

// ============================================================================
// AI ANALYTICS CLASS
// ============================================================================

export class AIAnalytics {
  private pool: Pool | null = null;
  private redis: Redis | null = null;
  
  // In-memory counters for real-time stats
  private sessionStats = {
    requests: 0,
    tokens: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
    costSaved: 0, // By using local models
  };
  
  constructor(pool?: Pool, redis?: Redis) {
    this.pool = pool || null;
    this.redis = redis || null;
  }
  
  /**
   * Record an AI request
   */
  async recordUsage(
    tenantId: string,
    taskType: AITaskType,
    response: AIResponse
  ): Promise<void> {
    const promptTokens = response.usage?.promptTokens || 0;
    const completionTokens = response.usage?.completionTokens || 0;
    const totalTokens = response.usage?.totalTokens || promptTokens + completionTokens;
    
    // Calculate estimated cost
    const costRates = COST_PER_1K_TOKENS[response.provider] || COST_PER_1K_TOKENS['remote'];
    const estimatedCost = (promptTokens * costRates.input + completionTokens * costRates.output) / 1000;
    
    // Update session stats
    this.sessionStats.requests++;
    this.sessionStats.tokens += totalTokens;
    if (response.cached) {
      this.sessionStats.cacheHits++;
    } else {
      this.sessionStats.cacheMisses++;
    }
    if (!response.success) {
      this.sessionStats.errors++;
    }
    
    // Calculate cost saved by using local
    if (response.provider === 'local' || response.provider === 'ollama') {
      const cloudCost = (promptTokens * 0.00015 + completionTokens * 0.0006) / 1000;
      this.sessionStats.costSaved += cloudCost;
    }
    
    // Store in Redis for real-time dashboard
    if (this.redis) {
      try {
        const key = `ai:usage:${tenantId}:${new Date().toISOString().split('T')[0]}`;
        await this.redis.hincrby(key, 'requests', 1);
        await this.redis.hincrby(key, 'tokens', totalTokens);
        await this.redis.hincrby(key, `task:${taskType}`, 1);
        await this.redis.hincrby(key, `provider:${response.provider}`, 1);
        await this.redis.expire(key, 86400 * 30); // Keep 30 days
      } catch (error) {
        console.error('[AI Analytics] Redis error:', error);
      }
    }
    
    // Store in PostgreSQL for historical analysis
    if (this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO ai_usage_logs 
           (tenant_id, task_type, provider, model, prompt_tokens, completion_tokens, 
            total_tokens, latency_ms, cached, success, credits_used, estimated_cost)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            tenantId,
            taskType,
            response.provider,
            response.model,
            promptTokens,
            completionTokens,
            totalTokens,
            response.latencyMs,
            response.cached || false,
            response.success,
            response.creditsUsed || 0,
            estimatedCost,
          ]
        );
      } catch (error) {
        // Table might not exist yet - log and continue
        console.error('[AI Analytics] DB error:', error);
      }
    }
  }
  
  /**
   * Get session statistics
   */
  getSessionStats(): typeof this.sessionStats & { cacheHitRate: string } {
    const total = this.sessionStats.cacheHits + this.sessionStats.cacheMisses;
    const cacheHitRate = total > 0 
      ? ((this.sessionStats.cacheHits / total) * 100).toFixed(1) + '%' 
      : '0%';
    return { ...this.sessionStats, cacheHitRate };
  }
  
  /**
   * Get usage summary for a tenant
   */
  async getTenantUsage(tenantId: string, days: number = 30): Promise<AIUsageSummary | null> {
    if (!this.pool) return null;
    
    try {
      const result = await this.pool.query(
        `SELECT 
           COUNT(*) as total_requests,
           SUM(total_tokens) as total_tokens,
           SUM(credits_used) as total_credits,
           SUM(estimated_cost) as total_cost,
           AVG(latency_ms) as avg_latency,
           SUM(CASE WHEN cached THEN 1 ELSE 0 END)::float / COUNT(*) as cache_hit_rate,
           task_type,
           provider
         FROM ai_usage_logs
         WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
         GROUP BY task_type, provider`,
        [tenantId]
      );
      
      // Process results into summary
      const summary: AIUsageSummary = {
        totalRequests: 0,
        totalTokens: 0,
        totalCredits: 0,
        estimatedCost: 0,
        cacheHitRate: 0,
        avgLatencyMs: 0,
        byTaskType: {},
        byProvider: {},
        topTenants: [],
      };
      
      for (const row of result.rows) {
        summary.totalRequests += parseInt(row.total_requests);
        summary.totalTokens += parseInt(row.total_tokens || '0');
        summary.totalCredits += parseInt(row.total_credits || '0');
        summary.estimatedCost += parseFloat(row.total_cost || '0');
        summary.avgLatencyMs = parseFloat(row.avg_latency || '0');
        summary.cacheHitRate = parseFloat(row.cache_hit_rate || '0');
        
        // By task type
        if (!summary.byTaskType[row.task_type]) {
          summary.byTaskType[row.task_type] = { requests: 0, tokens: 0, cost: 0 };
        }
        summary.byTaskType[row.task_type].requests += parseInt(row.total_requests);
        summary.byTaskType[row.task_type].tokens += parseInt(row.total_tokens || '0');
        summary.byTaskType[row.task_type].cost += parseFloat(row.total_cost || '0');
        
        // By provider
        if (!summary.byProvider[row.provider]) {
          summary.byProvider[row.provider] = { requests: 0, tokens: 0, cost: 0 };
        }
        summary.byProvider[row.provider].requests += parseInt(row.total_requests);
        summary.byProvider[row.provider].tokens += parseInt(row.total_tokens || '0');
        summary.byProvider[row.provider].cost += parseFloat(row.total_cost || '0');
      }
      
      return summary;
    } catch (error) {
      console.error('[AI Analytics] Query error:', error);
      return null;
    }
  }
  
  /**
   * Get cost savings report
   */
  getCostSavingsReport(): {
    sessionSaved: number;
    projectedMonthlySavings: number;
    localRequestsPercent: number;
  } {
    const localRequests = this.sessionStats.requests - this.sessionStats.errors;
    const localPercent = this.sessionStats.requests > 0 
      ? (localRequests / this.sessionStats.requests) * 100 
      : 0;
    
    // Project monthly savings based on session usage
    // Assume 8 hours of usage per day, 22 business days
    const projectedMultiplier = 22 * 8; // Very rough estimate
    
    return {
      sessionSaved: this.sessionStats.costSaved,
      projectedMonthlySavings: this.sessionStats.costSaved * projectedMultiplier,
      localRequestsPercent: localPercent,
    };
  }
}

// ============================================================================
// DATABASE MIGRATION
// ============================================================================

export const AI_USAGE_MIGRATION = `
-- AI Usage Logs Table
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  cached BOOLEAN DEFAULT false,
  success BOOLEAN DEFAULT true,
  credits_used INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10, 6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant ON ai_usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_task ON ai_usage_logs(task_type);
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON ai_usage_logs(provider);
`;
