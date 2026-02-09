import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { apiResponse } from '../lib/api-response';

// Redis client singleton
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    redis.connect().catch(() => { redis = null; });
    return redis;
  } catch {
    // Redis connection failed, continue without cache
    return null; 
  }
}

async function getCached<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  const r = getRedis();
  if (r) {
    try {
      const cached = await r.get(key);
      if (cached) return JSON.parse(cached);
    } catch { /* ignore cache errors */ }
  }
  const data = await fetcher();
  if (r) {
    try { await r.setex(key, ttlSeconds, JSON.stringify(data)); } catch { /* ignore cache errors */ }
  }
  return data;
}

export function createAnalyticsRouter(pool: Pool): Router {
  const router = Router();

  // Get full analytics data - OPTIMIZED with parallel queries and caching
  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      const period = (req.query.period as string) || '30d';
      const cacheKey = `analytics:${tenantId}:${period}`;
      
      // Cache for 5 minutes - analytics don't need real-time updates
      const data = await getCached(cacheKey, 300, async () => {
        const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - days);

        // Run all queries in parallel for speed
        const [
          metricsResult,
          prevMetricsResult,
          chartResult,
          peakHoursResult,
          topItemsResult,
          reviewStatsResult,
          aiStatsResult,
        ] = await Promise.all([
          // Current period metrics
          pool.query(`
            SELECT 
              COALESCE(SUM(total_amount::numeric), 0) as revenue,
              COUNT(*) as orders,
              COALESCE(AVG(total_amount::numeric), 0) as avg_order_value,
              COUNT(DISTINCT customer_id) as customers
            FROM orders 
            WHERE tenant_id = $1 AND created_at >= $2 AND status = 'completed'
          `, [tenantId, startDate]),

          // Previous period metrics
          pool.query(`
            SELECT 
              COALESCE(SUM(total_amount::numeric), 0) as revenue,
              COUNT(*) as orders,
              COALESCE(AVG(total_amount::numeric), 0) as avg_order_value,
              COUNT(DISTINCT customer_id) as customers
            FROM orders 
            WHERE tenant_id = $1 AND created_at >= $2 AND created_at < $3 AND status = 'completed'
          `, [tenantId, prevStartDate, startDate]),

          // Revenue chart - simplified for performance
          pool.query(`
            SELECT 
              DATE(created_at) as date,
              COALESCE(SUM(total_amount::numeric), 0) as current,
              0 as previous
            FROM orders 
            WHERE tenant_id = $1 AND created_at >= $2 AND status = 'completed'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
            LIMIT 30
          `, [tenantId, startDate]),

          // Peak hours
          pool.query(`
            SELECT 
              EXTRACT(HOUR FROM created_at)::int as hour,
              COUNT(*)::int as orders
            FROM orders 
            WHERE tenant_id = $1 AND created_at >= $2 AND status = 'completed'
            GROUP BY EXTRACT(HOUR FROM created_at)
            ORDER BY hour
          `, [tenantId, startDate]),

          // Top selling items
          pool.query(`
            SELECT 
              mi.name,
              COUNT(oi.id)::int as orders,
              COALESCE(SUM(oi.total_price::numeric), 0) as revenue
            FROM order_items oi
            JOIN menu_items mi ON mi.id = oi.menu_item_id
            JOIN orders o ON o.id = oi.order_id
            WHERE o.tenant_id = $1 AND o.created_at >= $2 AND o.status = 'completed'
            GROUP BY mi.id, mi.name
            ORDER BY orders DESC
            LIMIT 5
          `, [tenantId, startDate]),

          // Review stats
          pool.query(`
            SELECT 
              COUNT(*)::int as total,
              COALESCE(AVG(rating), 0) as average_rating,
              COUNT(*) FILTER (WHERE sentiment = 'positive')::int as positive,
              COUNT(*) FILTER (WHERE sentiment = 'neutral')::int as neutral,
              COUNT(*) FILTER (WHERE sentiment = 'negative')::int as negative,
              COALESCE(ROUND(COUNT(*) FILTER (WHERE response_text IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100), 0)::int as response_rate
            FROM reviews 
            WHERE tenant_id = $1 AND created_at >= $2
          `, [tenantId, startDate]),

          // AI usage stats
          pool.query(`
            SELECT 
              COUNT(*)::int as total_requests,
              COALESCE(SUM(input_tokens + output_tokens), 0)::int as tokens_used,
              COALESCE(SUM(cost_usd), 0) as cost_saved,
              COUNT(*) FILTER (WHERE request_type = 'review_response')::int as reviews_responded,
              COUNT(*) FILTER (WHERE request_type = 'menu_description')::int as menu_items_enhanced,
              COUNT(*) FILTER (WHERE request_type = 'chat')::int as chat_messages_handled
            FROM ai_usage 
            WHERE tenant_id = $1 AND created_at >= $2
          `, [tenantId, startDate]),
        ]);

        const metrics = metricsResult.rows[0];
        const prevMetrics = prevMetricsResult.rows[0];
        const reviewStats = reviewStatsResult.rows[0];
        const aiStats = aiStatsResult.rows[0];

        return {
          metrics: {
            revenue: parseFloat(metrics.revenue) || 0,
            orders: parseInt(metrics.orders) || 0,
            avgOrderValue: parseFloat(metrics.avg_order_value) || 0,
            customers: parseInt(metrics.customers) || 0,
          },
          previousPeriod: {
            revenue: parseFloat(prevMetrics.revenue) || 0,
            orders: parseInt(prevMetrics.orders) || 0,
            avgOrderValue: parseFloat(prevMetrics.avg_order_value) || 0,
            customers: parseInt(prevMetrics.customers) || 0,
          },
          revenueChart: chartResult.rows.reverse().map(r => ({
            date: r.date,
            current: parseFloat(r.current) || 0,
            previous: parseFloat(r.previous) || 0,
          })),
          peakHours: peakHoursResult.rows.map(r => ({
            hour: r.hour,
            orders: r.orders,
          })),
          topItems: topItemsResult.rows.map(r => ({
            name: r.name,
            orders: r.orders,
            revenue: parseFloat(r.revenue) || 0,
          })),
          reviewStats: {
            total: reviewStats.total || 0,
            averageRating: parseFloat(reviewStats.average_rating) || 0,
            sentimentBreakdown: {
              positive: reviewStats.positive || 0,
              neutral: reviewStats.neutral || 0,
              negative: reviewStats.negative || 0,
            },
            responseRate: reviewStats.response_rate || 0,
          },
          aiStats: {
            totalRequests: aiStats.total_requests || 0,
            tokensUsed: aiStats.tokens_used || 0,
            costSaved: parseFloat(aiStats.cost_saved) || 0,
            reviewsResponded: aiStats.reviews_responded || 0,
            menuItemsEnhanced: aiStats.menu_items_enhanced || 0,
            chatMessagesHandled: aiStats.chat_messages_handled || 0,
          },
        };
      });

      return apiResponse.success(res, data);
    } catch (error) {
      console.error('Analytics error:', error);
      return apiResponse.serverError(res, 'Failed to get analytics');
    }
  });

  // Get AI-powered insights - cached for 10 minutes
  router.get('/insights', async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      const cacheKey = `analytics:insights:${tenantId}`;
      
      const data = await getCached(cacheKey, 600, async () => {
        const insights: { type: string; title: string; description: string; impact: 'high' | 'medium' | 'low' }[] = [];

        // Run insight queries in parallel
        const [trendResult, topItemResult, negativeResult, peakResult] = await Promise.all([
          // Revenue trend
          pool.query(`
            WITH weekly AS (
              SELECT DATE_TRUNC('week', created_at) as week, SUM(total_amount::numeric) as revenue
              FROM orders 
              WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '4 weeks' AND status = 'completed'
              GROUP BY DATE_TRUNC('week', created_at)
              ORDER BY week DESC LIMIT 2
            )
            SELECT * FROM weekly
          `, [tenantId]),

          // Top item
          pool.query(`
            SELECT mi.name, COUNT(*)::int as orders
            FROM order_items oi
            JOIN menu_items mi ON mi.id = oi.menu_item_id
            JOIN orders o ON o.id = oi.order_id
            WHERE o.tenant_id = $1 AND o.created_at >= NOW() - INTERVAL '7 days' AND o.status = 'completed'
            GROUP BY mi.id, mi.name ORDER BY orders DESC LIMIT 1
          `, [tenantId]),

          // Unanswered negative reviews
          pool.query(`
            SELECT COUNT(*)::int as count FROM reviews 
            WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '7 days' 
              AND sentiment = 'negative' AND response_text IS NULL
          `, [tenantId]),

          // Peak hour
          pool.query(`
            SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*)::int as orders
            FROM orders WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '14 days' AND status = 'completed'
            GROUP BY EXTRACT(HOUR FROM created_at) ORDER BY orders DESC LIMIT 1
          `, [tenantId]),
        ]);

        // Process revenue trend
        if (trendResult.rows.length >= 2) {
          const current = parseFloat(trendResult.rows[0]?.revenue) || 0;
          const previous = parseFloat(trendResult.rows[1]?.revenue) || 0;
          const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;

          if (change > 10) {
            insights.push({
              type: 'success',
              title: 'Revenue Growing',
              description: `Sales up ${change.toFixed(0)}% vs last week. Keep the momentum!`,
              impact: 'high',
            });
          } else if (change < -10) {
            insights.push({
              type: 'alert',
              title: 'Revenue Declining',
              description: `Sales down ${Math.abs(change).toFixed(0)}% vs last week. Consider promotions.`,
              impact: 'high',
            });
          }
        }

        // Top performer
        if (topItemResult.rows[0]) {
          insights.push({
            type: 'opportunity',
            title: `"${topItemResult.rows[0].name}" is trending`,
            description: `${topItemResult.rows[0].orders} orders this week. Feature it prominently!`,
            impact: 'medium',
          });
        }

        // Negative reviews
        const negCount = negativeResult.rows[0]?.count || 0;
        if (negCount > 0) {
          insights.push({
            type: 'alert',
            title: `${negCount} unanswered negative review${negCount > 1 ? 's' : ''}`,
            description: 'Respond quickly to protect your reputation.',
            impact: 'high',
          });
        }

        // Peak hour
        if (peakResult.rows[0]) {
          const peakHour = peakResult.rows[0].hour;
          insights.push({
            type: 'opportunity',
            title: `Peak hour: ${peakHour}:00 - ${peakHour + 1}:00`,
            description: 'Consider extra staffing or prep during this time.',
            impact: 'medium',
          });
        }

        // Default if empty
        if (insights.length === 0) {
          insights.push({
            type: 'opportunity',
            title: 'Keep collecting data',
            description: 'More orders and reviews will unlock better insights.',
            impact: 'low',
          });
        }

        return { insights };
      });

      return apiResponse.success(res, data);
    } catch (error) {
      console.error('Insights error:', error);
      return apiResponse.serverError(res, 'Failed to get insights');
    }
  });

  return router;
}
