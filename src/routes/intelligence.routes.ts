/**
 * INTELLIGENCE ROUTES
 *
 * API endpoints for business intelligence, alerts, and automation
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { validate } from '../middleware/validate.middleware';
import { apiResponse } from '../lib/api-response';
import {
  AlertsService,
  InsightsService,
  AutomationService,
} from '../services/tenant/intelligence';
import {
  listAlertsSchema,
  getAlertSchema,
  markAlertReadSchema,
  resolveAlertSchema,
  bulkMarkReadSchema,
  listInsightsSchema,
  getInsightSchema,
  markInsightActionedSchema,
  generateInsightsSchema,
  getCorrelationsSchema,
  getCrossModuleMetricsSchema,
  listRulesSchema,
  getRuleSchema,
  createRuleSchema,
  updateRuleSchema,
  deleteRuleSchema,
  toggleRuleSchema,
  testRuleSchema,
} from '../validators/intelligence.validator';

export function createIntelligenceRouter(pool: Pool): Router {
  const router = Router();

  const alertsService = new AlertsService(pool);
  const insightsService = new InsightsService(pool);
  const automationService = new AutomationService(pool);

  // ============================================================================
  // ALERTS
  // ============================================================================

  // List alerts
  router.get('/alerts', validate(listAlertsSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const filters = {
        severity: req.query.severity as 'info' | 'warning' | 'critical' | undefined,
        alertType: req.query.alert_type as 'check_overdue' | 'temp_breach' | 'training_expiring' | 'audit_due' | 'corrective_action_due' | 'negative_spike' | 'review_requires_response' | 'rating_drop' | 'compliance_mention' | 'post_failed' | 'engagement_drop' | 'trending_opportunity' | 'scheduled_content_due' | 'low_inventory' | 'reservation_surge' | 'unusual_activity' | undefined,
        isRead: req.query.is_read === 'true' ? true :
                req.query.is_read === 'false' ? false : undefined,
        isResolved: req.query.is_resolved === 'true' ? true :
                    req.query.is_resolved === 'false' ? false : undefined,
        locationId: req.query.location_id as string | undefined,
        startDate: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
        endDate: req.query.end_date ? new Date(req.query.end_date as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      };

      const result = await alertsService.getAlerts(tenantId, filters);
      return apiResponse.success(res, result);
    } catch (error) {
      console.error('List alerts error:', error);
      return apiResponse.serverError(res, 'Failed to list alerts');
    }
  });

  // Get unread alert count
  router.get('/alerts/unread', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const stats = await alertsService.getAlertStats(tenantId);
      return apiResponse.success(res, { unread: stats.unread, critical: stats.critical });
    } catch (error) {
      console.error('Get unread alerts error:', error);
      return apiResponse.serverError(res, 'Failed to get unread alerts');
    }
  });

  // Get alert by ID
  router.get('/alerts/:id', validate(getAlertSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const alert = await alertsService.getAlertById(tenantId, req.params.id);

      if (!alert) {
        return apiResponse.notFound(res, 'Alert not found');
      }

      return apiResponse.success(res, alert);
    } catch (error) {
      console.error('Get alert error:', error);
      return apiResponse.serverError(res, 'Failed to get alert');
    }
  });

  // Mark alert as read
  router.patch('/alerts/:id/read', validate(markAlertReadSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const alert = await alertsService.markAsRead(tenantId, req.params.id);

      if (!alert) {
        return apiResponse.notFound(res, 'Alert not found');
      }

      return apiResponse.success(res, alert);
    } catch (error) {
      console.error('Mark alert read error:', error);
      return apiResponse.serverError(res, 'Failed to mark alert as read');
    }
  });

  // Resolve alert
  router.patch('/alerts/:id/resolve', validate(resolveAlertSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const userId = req.tenant!.userId;

      const alert = await alertsService.resolveAlert(tenantId, req.params.id, userId);

      if (!alert) {
        return apiResponse.notFound(res, 'Alert not found');
      }

      return apiResponse.success(res, alert);
    } catch (error) {
      console.error('Resolve alert error:', error);
      return apiResponse.serverError(res, 'Failed to resolve alert');
    }
  });

  // Bulk mark alerts as read
  router.post('/alerts/bulk/read', validate(bulkMarkReadSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const count = await alertsService.bulkMarkAsRead(tenantId, req.body.alert_ids);
      return apiResponse.success(res, { updated: count });
    } catch (error) {
      console.error('Bulk mark read error:', error);
      return apiResponse.serverError(res, 'Failed to bulk mark alerts as read');
    }
  });

  // ============================================================================
  // INSIGHTS
  // ============================================================================

  // List insights
  router.get('/insights', validate(listInsightsSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const filters = {
        insightType: req.query.insight_type as 'review_compliance_correlation' | 'content_performance_predictor' | 'operational_recommendation' | 'competitive_insight' | 'trend_opportunity' | 'risk_alert' | 'revenue_opportunity' | undefined,
        impactScore: req.query.impact_score as 'low' | 'medium' | 'high' | undefined,
        isActionable: req.query.is_actionable === 'true' ? true :
                      req.query.is_actionable === 'false' ? false : undefined,
        actioned: req.query.actioned === 'true' ? true :
                  req.query.actioned === 'false' ? false : undefined,
        locationId: req.query.location_id as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      };

      const result = await insightsService.getInsights(tenantId, filters);
      return apiResponse.success(res, result);
    } catch (error) {
      console.error('List insights error:', error);
      return apiResponse.serverError(res, 'Failed to list insights');
    }
  });

  // Get insight by ID
  router.get('/insights/:id', validate(getInsightSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const insight = await insightsService.getInsightById(tenantId, req.params.id);

      if (!insight) {
        return apiResponse.notFound(res, 'Insight not found');
      }

      return apiResponse.success(res, insight);
    } catch (error) {
      console.error('Get insight error:', error);
      return apiResponse.serverError(res, 'Failed to get insight');
    }
  });

  // Mark insight as actioned
  router.patch('/insights/:id/actioned', validate(markInsightActionedSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const insight = await insightsService.markActioned(tenantId, req.params.id);

      if (!insight) {
        return apiResponse.notFound(res, 'Insight not found');
      }

      return apiResponse.success(res, insight);
    } catch (error) {
      console.error('Mark insight actioned error:', error);
      return apiResponse.serverError(res, 'Failed to mark insight as actioned');
    }
  });

  // Generate new insights
  router.post('/insights/generate', validate(generateInsightsSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      // locationId is accepted but not used in current implementation
      // const locationId = req.body.location_id as string | undefined;

      const insights = await insightsService.generateInsights(tenantId);
      return apiResponse.success(res, insights);
    } catch (error) {
      console.error('Generate insights error:', error);
      return apiResponse.serverError(res, 'Failed to generate insights');
    }
  });

  // Get recommendations
  router.get('/recommendations', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

      const recommendations = await insightsService.getRecommendations(tenantId, limit);
      return apiResponse.success(res, recommendations);
    } catch (error) {
      console.error('Get recommendations error:', error);
      return apiResponse.serverError(res, 'Failed to get recommendations');
    }
  });

  // Get correlations
  router.get('/correlations', validate(getCorrelationsSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      // locationId and period are accepted but not used in current implementation
      // const locationId = req.query.location_id as string | undefined;
      // const period = (req.query.period as string) || '30d';

      const correlations = await insightsService.getCorrelations(tenantId);
      return apiResponse.success(res, correlations);
    } catch (error) {
      console.error('Get correlations error:', error);
      return apiResponse.serverError(res, 'Failed to get correlations');
    }
  });

  // Get cross-module metrics
  router.get('/cross-module-metrics', validate(getCrossModuleMetricsSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      // locationId is accepted but not used in current implementation
      // const locationId = req.query.location_id as string | undefined;

      const metrics = await insightsService.getCrossModuleMetrics(tenantId);
      return apiResponse.success(res, metrics);
    } catch (error) {
      console.error('Get cross-module metrics error:', error);
      return apiResponse.serverError(res, 'Failed to get cross-module metrics');
    }
  });

  // ============================================================================
  // AUTOMATION RULES
  // ============================================================================

  // List automation rules
  router.get('/rules', validate(listRulesSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const activeOnly = req.query.active_only === 'true';

      const rules = await automationService.getRules(tenantId, activeOnly);
      return apiResponse.success(res, rules);
    } catch (error) {
      console.error('List rules error:', error);
      return apiResponse.serverError(res, 'Failed to list automation rules');
    }
  });

  // Get rule templates
  router.get('/rules/templates', async (_req, res) => {
    try {
      const templates = automationService.getDefaultRuleTemplates();
      return apiResponse.success(res, templates);
    } catch (error) {
      console.error('Get rule templates error:', error);
      return apiResponse.serverError(res, 'Failed to get rule templates');
    }
  });

  // Get rule by ID
  router.get('/rules/:id', validate(getRuleSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const rule = await automationService.getRule(tenantId, req.params.id);

      if (!rule) {
        return apiResponse.notFound(res, 'Rule not found');
      }

      return apiResponse.success(res, rule);
    } catch (error) {
      console.error('Get rule error:', error);
      return apiResponse.serverError(res, 'Failed to get automation rule');
    }
  });

  // Create automation rule
  router.post('/rules', validate(createRuleSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const rule = await automationService.createRule(tenantId, req.body);
      return apiResponse.created(res, rule);
    } catch (error) {
      console.error('Create rule error:', error);
      return apiResponse.serverError(res, 'Failed to create automation rule');
    }
  });

  // Update automation rule
  router.patch('/rules/:id', validate(updateRuleSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const rule = await automationService.updateRule(
        tenantId,
        req.params.id,
        req.body
      );

      if (!rule) {
        return apiResponse.notFound(res, 'Rule not found');
      }

      return apiResponse.success(res, rule);
    } catch (error) {
      console.error('Update rule error:', error);
      return apiResponse.serverError(res, 'Failed to update automation rule');
    }
  });

  // Delete automation rule
  router.delete('/rules/:id', validate(deleteRuleSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const deleted = await automationService.deleteRule(tenantId, req.params.id);

      if (!deleted) {
        return apiResponse.notFound(res, 'Rule not found');
      }

      return apiResponse.success(res, { message: 'Rule deleted' });
    } catch (error) {
      console.error('Delete rule error:', error);
      return apiResponse.serverError(res, 'Failed to delete automation rule');
    }
  });

  // Toggle rule active status
  router.post('/rules/:id/toggle', validate(toggleRuleSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const rule = await automationService.toggleRule(tenantId, req.params.id);

      if (!rule) {
        return apiResponse.notFound(res, 'Rule not found');
      }

      return apiResponse.success(res, rule);
    } catch (error) {
      console.error('Toggle rule error:', error);
      return apiResponse.serverError(res, 'Failed to toggle automation rule');
    }
  });

  // Test automation rule
  router.post('/rules/:id/test', validate(testRuleSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const result = await automationService.testRule(
        tenantId,
        req.params.id,
        req.body.test_data
      );

      return apiResponse.success(res, result);
    } catch (error) {
      console.error('Test rule error:', error);
      return apiResponse.serverError(res, 'Failed to test automation rule');
    }
  });

  // ============================================================================
  // ALERT RULES (alias for /rules - for frontend compatibility)
  // ============================================================================

  router.get('/alert-rules', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      // Note: ruleType filtering not implemented in service, returning all active rules
      const rules = await automationService.getRules(tenantId, false);
      return apiResponse.success(res, rules);
    } catch (error) {
      console.error('List alert rules error:', error);
      return apiResponse.serverError(res, 'Failed to list alert rules');
    }
  });

  router.post('/alert-rules', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const rule = await automationService.createRule(tenantId, { ...req.body, ruleType: 'alert' });
      return apiResponse.created(res, rule);
    } catch (error) {
      console.error('Create alert rule error:', error);
      return apiResponse.serverError(res, 'Failed to create alert rule');
    }
  });

  router.patch('/alert-rules/:id', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const rule = await automationService.updateRule(tenantId, req.params.id, req.body);
      if (!rule) return apiResponse.notFound(res, 'Alert rule not found');
      return apiResponse.success(res, rule);
    } catch (error) {
      console.error('Update alert rule error:', error);
      return apiResponse.serverError(res, 'Failed to update alert rule');
    }
  });

  router.delete('/alert-rules/:id', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const deleted = await automationService.deleteRule(tenantId, req.params.id);
      if (!deleted) return apiResponse.notFound(res, 'Alert rule not found');
      return apiResponse.success(res, { deleted: true });
    } catch (error) {
      console.error('Delete alert rule error:', error);
      return apiResponse.serverError(res, 'Failed to delete alert rule');
    }
  });

  router.post('/alert-rules/:id/toggle', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const rule = await automationService.toggleRule(tenantId, req.params.id);
      if (!rule) return apiResponse.notFound(res, 'Alert rule not found');
      return apiResponse.success(res, rule);
    } catch (error) {
      console.error('Toggle alert rule error:', error);
      return apiResponse.serverError(res, 'Failed to toggle alert rule');
    }
  });

  // ============================================================================
  // AUTOMATIONS (alias for /rules with type=automation)
  // ============================================================================

  router.get('/automations', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      // Note: ruleType filtering not implemented in service, returning all rules
      const rules = await automationService.getRules(tenantId, false);
      return apiResponse.success(res, rules);
    } catch (error) {
      console.error('List automations error:', error);
      return apiResponse.serverError(res, 'Failed to list automations');
    }
  });

  router.post('/automations', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const rule = await automationService.createRule(tenantId, { ...req.body, ruleType: 'automation' });
      return apiResponse.created(res, rule);
    } catch (error) {
      console.error('Create automation error:', error);
      return apiResponse.serverError(res, 'Failed to create automation');
    }
  });

  router.patch('/automations/:id', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const rule = await automationService.updateRule(tenantId, req.params.id, req.body);
      if (!rule) return apiResponse.notFound(res, 'Automation not found');
      return apiResponse.success(res, rule);
    } catch (error) {
      console.error('Update automation error:', error);
      return apiResponse.serverError(res, 'Failed to update automation');
    }
  });

  router.delete('/automations/:id', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const deleted = await automationService.deleteRule(tenantId, req.params.id);
      if (!deleted) return apiResponse.notFound(res, 'Automation not found');
      return apiResponse.success(res, { deleted: true });
    } catch (error) {
      console.error('Delete automation error:', error);
      return apiResponse.serverError(res, 'Failed to delete automation');
    }
  });

  router.post('/automations/:id/toggle', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const rule = await automationService.toggleRule(tenantId, req.params.id);
      if (!rule) return apiResponse.notFound(res, 'Automation not found');
      return apiResponse.success(res, rule);
    } catch (error) {
      console.error('Toggle automation error:', error);
      return apiResponse.serverError(res, 'Failed to toggle automation');
    }
  });

  router.post('/automations/:id/test', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const result = await automationService.testRule(tenantId, req.params.id, req.body.test_data);
      return apiResponse.success(res, result);
    } catch (error) {
      console.error('Test automation error:', error);
      return apiResponse.serverError(res, 'Failed to test automation');
    }
  });

  // ============================================================================
  // DASHBOARD
  // ============================================================================

  router.get('/dashboard', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      // locationId filtering not available in current service implementation
      // const locationId = req.query.location_id as string | undefined;

      // Get alert stats (locationId filtering not available in current service)
      const alertStats = await alertsService.getAlertStats(tenantId);

      // Get top insights
      const insightsResult = await insightsService.getInsights(tenantId, { limit: 5 });
      const insightsList = Array.isArray(insightsResult) ? insightsResult :
                          (insightsResult as { items?: any[] })?.items || [];

      // Get active automation count
      const rulesResult = await automationService.getRules(tenantId, true);
      const rulesList = Array.isArray(rulesResult) ? rulesResult : [];

      // Calculate health score based on alerts and compliance
      const criticalAlerts = alertStats.critical || 0;
      const warningAlerts = alertStats.warning || 0;
      const healthScore = Math.max(0, 100 - (criticalAlerts * 10) - (warningAlerts * 3));

      return apiResponse.success(res, {
        alertsSummary: {
          unread: alertStats.unread || 0,
          critical: criticalAlerts,
          warning: warningAlerts,
        },
        topInsights: insightsList.slice(0, 5),
        activeAutomations: rulesList.filter((r: any) => r.isActive).length,
        healthScore,
        recommendations: [
          'Review unread alerts to stay on top of issues',
          'Consider automating responses to common scenarios',
          'Check compliance dashboard for any overdue tasks',
        ],
      });
    } catch (error) {
      console.error('Get intelligence dashboard error:', error);
      return apiResponse.serverError(res, 'Failed to get dashboard');
    }
  });

  return router;
}
