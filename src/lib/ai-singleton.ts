/**
 * AI Router Singleton
 *
 * Maintains a single AIRouter instance across all requests to avoid
 * unnecessary instantiation overhead.
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { AIRouter } from '../services/tenant/ai';

let instance: AIRouter | null = null;

/**
 * Get the singleton AIRouter instance.
 * Creates one if it doesn't exist using the default router configuration.
 *
 * @param pool PostgreSQL connection pool for usage tracking
 * @param redis Optional Redis instance for future caching implementation
 * @returns The singleton AIRouter instance
 */
export function getAIRouter(pool: Pool, redis?: Redis): AIRouter {
  if (!instance) {
    // Initialize with environment-based default configuration
    instance = new AIRouter(
      {
        providers: {
          openai: {
            provider: 'openai',
            enabled: !!process.env.OPENAI_API_KEY,
            apiKey: process.env.OPENAI_API_KEY,
            defaultModel: 'gpt-4o-mini',
            maxTokens: 4096,
            temperature: 0.7,
            rateLimit: 60,
            priority: 2
          },
          claude: {
            provider: 'claude',
            enabled: !!process.env.ANTHROPIC_API_KEY,
            apiKey: process.env.ANTHROPIC_API_KEY,
            defaultModel: 'claude-3-5-sonnet-20241022',
            maxTokens: 4096,
            temperature: 0.7,
            rateLimit: 60,
            priority: 2
          },
          perplexity: {
            provider: 'perplexity',
            enabled: !!process.env.PERPLEXITY_API_KEY,
            apiKey: process.env.PERPLEXITY_API_KEY,
            defaultModel: 'llama-3.1-sonar-small-128k-online',
            maxTokens: 4096,
            temperature: 0.7,
            rateLimit: 60,
            priority: 3
          },
          lm_studio: {
            provider: 'lm_studio',
            enabled: !!process.env.LM_STUDIO_URL || process.env.ENABLE_LOCAL_AI === 'true',
            baseUrl: process.env.LM_STUDIO_URL || 'http://localhost:1234/v1',
            defaultModel: 'local-model',
            maxTokens: 4096,
            temperature: 0.7,
            rateLimit: 1000,
            priority: process.env.LOCAL_AI_FIRST === 'true' ? 1 : 4
          },
          ollama: {
            provider: 'ollama',
            enabled: !!process.env.OLLAMA_URL || process.env.ENABLE_LOCAL_AI === 'true',
            baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
            defaultModel: 'llama3.2',
            maxTokens: 4096,
            temperature: 0.7,
            rateLimit: 1000,
            priority: process.env.LOCAL_AI_FIRST === 'true' ? 1 : 4
          }
        },
        defaultProvider: (process.env.DEFAULT_AI_PROVIDER as any) || 'openai',
        enableFallback: process.env.AI_ENABLE_FALLBACK !== 'false',
        localFirst: process.env.LOCAL_AI_FIRST === 'true',
        trackUsage: true
      },
      pool,
      redis
    );

    console.log('AIRouter singleton initialized');
  }

  return instance;
}

/**
 * Reset the singleton instance.
 * Useful for testing or when configuration needs to be reloaded.
 */
export function resetAIRouter(): void {
  instance = null;
  console.log('AIRouter singleton reset');
}
