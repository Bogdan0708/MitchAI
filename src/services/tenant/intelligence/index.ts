/**
 * Intelligence Module Index
 *
 * Exports all business intelligence services and types
 */

// Alerts service
export {
  AlertsService,
  BusinessAlert,
  AlertType,
  AlertSeverity,
  CreateAlertDTO,
  AlertFilters,
  AlertStats,
  AlertNotificationConfig,
} from './alerts.service';

// Insights service
export {
  InsightsService,
  BusinessInsight,
  InsightType,
  ImpactLevel,
  DataPoint,
  RecommendedAction,
  InsightFilters,
  CorrelationResult,
  CrossModuleMetrics,
} from './insights.service';

// Automation service
export {
  AutomationService,
  AutomationRule,
  TriggerType,
  TriggerCondition,
  AutomationAction,
  ActionType,
  ActionConfig,
  CreateRuleDTO,
  UpdateRuleDTO,
  TriggerEvent,
  RuleExecutionResult,
} from './automation.service';
