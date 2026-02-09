import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { apiResponse } from '../middleware/error.middleware';

export function createAnalyticsRouter(pool: Pool): Router {
  const router = Router();

  // Get full analytics data
  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      const period = (req.query.period as string) || '30d';
      
      // Calculate date range
      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - days);

      // Get current period metrics
      const metricsQuery = await pool.query(`
        SELECT 
          COALESCE(SUM(total_amount::numeric), 0) as revenue,
          COUNT(*) as orders,
          COALESCE(AVG(total_amount::numeric), 0) as avg_order_value,
          COUNT(DISTINCT customer_id) as customers
        FROM orders 
        WHERE tenant_id = $1 
          AND created_at >= $2
          AND status = 'completed'
      `, [tenantId, startDate]);

      // Get previous period metrics
      const prevMetricsQuery = await pool.query(`
        SELECT 
          COALESCE(SUM(total_amount::numeric), 0) as revenue,
          COUNT(*) as orders,
          COALESCE(AVG(total_amount::numeric), 0) as avg_order_value,
          COUNT(DISTINCT customer_id) as customers
        FROM orders 
        WHERE tenant_id = $1 
          AND created_at >= $2 
          AND created_at < $3
          AND status = 'completed'
      `, [tenantId, prevStartDate, startDate]);

      // Get revenue chart data (daily)
      const chartQuery = await pool.query(`
        WITH current_period AS (
          SELECT 
            DATE(created_at) as date,
            COALESCE(SUM(total_amount::numeric), 0) as revenue
          FROM orders 
          WHERE tenant_id = $1 
            AND created_at >= $2
            AND status = 'completed'
          GROUP BY DATE(created_at)
        ),
        previous_period AS (
          SELECT 
            DATE(created_at) + INTERVAL '${days} days' as date,
            COALESCE(SUM(total_amount::numeric), 0) as revenue
          FROM orders 
          WHERE tenant_id = $1 
            AND created_at >= $3 
            AND created_at < $2
            AND status = 'completed'
          GROUP BY DATE(created_at)
        ),
        date_series AS (
          SELECT generate_series(
            $2::date,
            CURRENT_DATE,
            '1 day'::interval
          )::date as date
        )
        SELECT 
          ds.date,
          COALESCE(cp.revenue, 0) as current,
          COALESCE(pp.revenue, 0) as previous
        FROM date_series ds
        LEFT JOIN current_period cp ON cp.date = ds.date
        LEFT JOIN previous_period pp ON pp.date = ds.date
        ORDER BY ds.date
        LIMIT 30
      `, [tenantId, startDate, prevStartDate]);

      // Get peak hours
      const peakHoursQuery = await pool.query(`
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as orders
        FROM orders 
        WHERE tenant_id = $1 
          AND created_at >= $2
          AND status = 'completed'
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `, [tenantId, startDate]);

      // Get top selling items
      const topItemsQuery = await pool.query(`
        SELECT 
          mi.name,
          COUNT(oi.id) as orders,
          COALESCE(SUM(oi.total_price::numeric), 0) as revenue
        FROM order_items oi
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.tenant_id = $1 
          AND o.created_at >= $2
          AND o.status = 'completed'
        GROUP BY mi.id, mi.name
        ORDER BY orders DESC
        LIMIT 5
      `, [tenantId, startDate]);

      // Get review stats
      const reviewStatsQuery = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COALESCE(AVG(rating), 0) as average_rating,
          COUNT(*) FILTER (WHERE sentiment = 'positive') as positive,
          COUNT(*) FILTER (WHERE sentiment = 'neutral') as neutral,
          COUNT(*) FILTER (WHERE sentiment = 'negative') as negative,
          ROUND(
            COUNT(*) FILTER (WHERE response IS NOT NULL)::numeric / 
            NULLIF(COUNT(*), 0) * 100
          ) as response_rate
        FROM reviews 
        WHERE tenant_id = $1 
          AND created_at >= $2
      `, [tenantId, startDate]);

      // Get AI usage stats
      const aiStatsQuery = await pool.query(`
        SELECT 
          COUNT(*) as total_requests,
          COALESCE(SUM(tokens_used), 0) as tokens_used,
          COALESCE(SUM(cost_saved), 0) as cost_saved,
          COUNT(*) FILTER (WHERE operation = 'review_response') as reviews_responded,
          COUNT(*) FILTER (WHERE operation = 'menu_description') as menu_items_enhanced,
          COUNT(*) FILTER (WHERE operation = 'chat') as chat_messages_handled
        FROM ai_usage 
        WHERE tenant_id = $1 
          AND created_at >= $2
      `, [tenantId, startDate]);

      const metrics = metricsQuery.rows[0];
      const prevMetrics = prevMetricsQuery.rows[0];
      const reviewStats = reviewStatsQuery.rows[0];
      const aiStats = aiStatsQuery.rows[0];

      return apiResponse.success(res, {
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
        revenueChart: chartQuery.rows.map(r => ({
          date: r.date,
          current: parseFloat(r.current) || 0,
          previous: parseFloat(r.previous) || 0,
        })),
        peakHours: peakHoursQuery.rows.map(r => ({
          hour: parseInt(r.hour),
          orders: parseInt(r.orders),
        })),
        topItems: topItemsQuery.rows.map(r => ({
          name: r.name,
          orders: parseInt(r.orders),
          revenue: parseFloat(r.revenue) || 0,
        })),
        reviewStats: {
          total: parseInt(reviewStats.total) || 0,
          averageRating: parseFloat(reviewStats.average_rating) || 0,
          sentimentBreakdown: {
            positive: parseInt(reviewStats.positive) || 0,
            neutral: parseInt(reviewStats.neutral) || 0,
            negative: parseInt(reviewStats.negative) || 0,
          },
          responseRate: parseInt(reviewStats.response_rate) || 0,
        },
        aiStats: {
          totalRequests: parseInt(aiStats.total_requests) || 0,
          tokensUsed: parseInt(aiStats.tokens_used) || 0,
          costSaved: parseFloat(aiStats.cost_saved) || 0,
          reviewsResponded: parseInt(aiStats.reviews_responded) || 0,
          menuItemsEnhanced: parseInt(aiStats.menu_items_enhanced) || 0,
          chatMessagesHandled: parseInt(aiStats.chat_messages_handled) || 0,
        },
      });
    } catch (error) {
      console.error('Analytics error:', error);
      return apiResponse.serverError(res, 'Failed to get analytics');
    }
  });

  // Get AI-powered insights
  router.get('/insights', async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      
      // Generate insights based on data analysis
      const insights: { type: string; title: string; description: string; impact: 'high' | 'medium' | 'low' }[] = [];

      // Check for revenue trends
      const trendQuery = await pool.query(`
        WITH weekly AS (
          SELECT 
            DATE_TRUNC('week', created_at) as week,
            SUM(total_amount::numeric) as revenue
          FROM orders 
          WHERE tenant_id = $1 
            AND created_at >= NOW() - INTERVAL '4 weeks'
            AND status = 'completed'
          GROUP BY DATE_TRUNC('week', created_at)
          ORDER BY week DESC
          LIMIT 2
        )
        SELECT * FROM weekly
      `, [tenantId]);

      if (trendQuery.rows.length >= 2) {
        const current = parseFloat(trendQuery.rows[0]?.revenue) || 0;
        const previous = parseFloat(trendQuery.rows[1]?.revenue) || 0;
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

      // Check for top performer
      const topItemQuery = await pool.query(`
        SELECT mi.name, COUNT(*) as orders
        FROM order_items oi
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.tenant_id = $1 
          AND o.created_at >= NOW() - INTERVAL '7 days'
          AND o.status = 'completed'
        GROUP BY mi.id, mi.name
        ORDER BY orders DESC
        LIMIT 1
      `, [tenantId]);

      if (topItemQuery.rows[0]) {
        insights.push({
          type: 'opportunity',
          title: `"${topItemQuery.rows[0].name}" is trending`,
          description: `${topItemQuery.rows[0].orders} orders this week. Feature it prominently!`,
          impact: 'medium',
        });
      }

      // Check for negative reviews
      const negativeQuery = await pool.query(`
        SELECT COUNT(*) as count
        FROM reviews 
        WHERE tenant_id = $1 
          AND created_at >= NOW() - INTERVAL '7 days'
          AND sentiment = 'negative'
          AND response IS NULL
      `, [tenantId]);

      const negCount = parseInt(negativeQuery.rows[0]?.count) || 0;
      if (negCount > 0) {
        insights.push({
          type: 'alert',
          title: `${negCount} unanswered negative review${negCount > 1 ? 's' : ''}`,
          description: 'Respond quickly to protect your reputation.',
          impact: 'high',
        });
      }

      // Check peak hours optimization
      const peakQuery = await pool.query(`
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as orders
        FROM orders 
        WHERE tenant_id = $1 
          AND created_at >= NOW() - INTERVAL '14 days'
          AND status = 'completed'
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY orders DESC
        LIMIT 1
      `, [tenantId]);

      if (peakQuery.rows[0]) {
        const peakHour = parseInt(peakQuery.rows[0].hour);
        insights.push({
          type: 'opportunity',
          title: `Peak hour: ${peakHour}:00 - ${peakHour + 1}:00`,
          description: 'Consider extra staffing or prep during this time.',
          impact: 'medium',
        });
      }

      // Default insight if none generated
      if (insights.length === 0) {
        insights.push({
          type: 'opportunity',
          title: 'Keep collecting data',
          description: 'More orders and reviews will unlock better insights.',
          impact: 'low',
        });
      }

      return apiResponse.success(res, { insights });
    } catch (error) {
      console.error('Insights error:', error);
      return apiResponse.serverError(res, 'Failed to get insights');
    }
  });

  return router;
}
