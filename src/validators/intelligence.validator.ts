import { z } from 'zod';

// ============================================
// ALERTS
// ============================================

export const listAlertsSchema = z.object({
  query: z.object({
    severity: z.enum(['info', 'warning', 'critical']).optional(),
    alert_type: z.string().optional(),
    is_read: z.coerce.boolean().optional(),
    is_resolved: z.coerce.boolean().optional(),
    location_id: z.string().uuid().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),
});

export const getAlertSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const markAlertReadSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const resolveAlertSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const bulkMarkReadSchema = z.object({
  body: z.object({
    alert_ids: z.array(z.string().uuid()).min(1).max(100),
  }),
});

// ============================================
// INSIGHTS
// ============================================

export const listInsightsSchema = z.object({
  query: z.object({
    insight_type: z.enum([
      'review_compliance_correlation',
      'content_performance_predictor',
      'operational_recommendation',
      'competitive_insight',
      'trend_opportunity',
      'risk_alert',
      'revenue_opportunity',
    ]).optional(),
    impact_score: z.enum(['low', 'medium', 'high']).optional(),
    is_actionable: z.coerce.boolean().optional(),
    actioned: z.coerce.boolean().optional(),
    location_id: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),
});

export const getInsightSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const markInsightActionedSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const generateInsightsSchema = z.object({
  body: z.object({
    location_id: z.string().uuid().optional(),
  }),
});

export const getCorrelationsSchema = z.object({
  query: z.object({
    location_id: z.string().uuid().optional(),
    period: z.enum(['30d', '90d', '1y']).optional(),
  }),
});

export const getCrossModuleMetricsSchema = z.object({
  query: z.object({
    location_id: z.string().uuid().optional(),
  }),
});

// ============================================
// AUTOMATION RULES
// ============================================

export const listRulesSchema = z.object({
  query: z.object({
    active_only: z.coerce.boolean().optional(),
  }),
});

export const getRuleSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const createRuleSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Rule name is required'),
    description: z.string().optional(),
    trigger_type: z.enum([
      'review_received',
      'negative_review',
      'positive_review',
      'review_unresponded',
      'temp_breach',
      'check_overdue',
      'check_failed',
      'training_expiring',
      'content_scheduled',
      'content_published',
      'content_failed',
      'engagement_spike',
      'daily_schedule',
      'weekly_schedule',
      'monthly_schedule',
    ]),
    trigger_conditions: z.object({
      rating_below: z.number().min(1).max(5).optional(),
      rating_above: z.number().min(1).max(5).optional(),
      sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
      platform: z.string().optional(),
      contains_keywords: z.array(z.string()).optional(),
      severity_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      check_type: z.string().optional(),
      temperature_deviation: z.number().optional(),
      engagement_above: z.number().optional(),
      platforms: z.array(z.string()).optional(),
      schedule_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      schedule_days: z.array(z.number().min(0).max(6)).optional(),
      schedule_date: z.number().min(1).max(31).optional(),
      location_id: z.string().uuid().optional(),
    }),
    actions: z.array(z.object({
      type: z.enum([
        'notify_email',
        'notify_sms',
        'notify_slack',
        'notify_push',
        'create_alert',
        'assign_task',
        'generate_response',
        'escalate',
        'webhook',
      ]),
      config: z.object({
        recipients: z.array(z.string().email()).optional(),
        email_template: z.string().optional(),
        subject: z.string().optional(),
        phone_numbers: z.array(z.string()).optional(),
        message_template: z.string().optional(),
        slack_channel: z.string().optional(),
        slack_webhook: z.string().url().optional(),
        alert_severity: z.enum(['info', 'warning', 'critical']).optional(),
        alert_title: z.string().optional(),
        alert_message: z.string().optional(),
        assignee_id: z.string().uuid().optional(),
        task_title: z.string().optional(),
        task_description: z.string().optional(),
        due_in_hours: z.number().int().min(1).optional(),
        escalate_to_role: z.string().optional(),
        escalate_after_minutes: z.number().int().min(0).optional(),
        webhook_url: z.string().url().optional(),
        webhook_method: z.enum(['GET', 'POST', 'PUT']).optional(),
        webhook_headers: z.record(z.string()).optional(),
        webhook_payload: z.record(z.unknown()).optional(),
      }),
    })).min(1, 'At least one action is required'),
    is_active: z.boolean().optional(),
  }),
});

export const updateRuleSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    trigger_conditions: z.object({
      rating_below: z.number().min(1).max(5).optional(),
      rating_above: z.number().min(1).max(5).optional(),
      sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
      platform: z.string().optional(),
      contains_keywords: z.array(z.string()).optional(),
      severity_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      check_type: z.string().optional(),
      temperature_deviation: z.number().optional(),
      engagement_above: z.number().optional(),
      platforms: z.array(z.string()).optional(),
      schedule_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      schedule_days: z.array(z.number().min(0).max(6)).optional(),
      schedule_date: z.number().min(1).max(31).optional(),
      location_id: z.string().uuid().optional(),
    }).optional(),
    actions: z.array(z.object({
      type: z.enum([
        'notify_email',
        'notify_sms',
        'notify_slack',
        'notify_push',
        'create_alert',
        'assign_task',
        'generate_response',
        'escalate',
        'webhook',
      ]),
      config: z.object({
        recipients: z.array(z.string().email()).optional(),
        email_template: z.string().optional(),
        subject: z.string().optional(),
        phone_numbers: z.array(z.string()).optional(),
        message_template: z.string().optional(),
        slack_channel: z.string().optional(),
        slack_webhook: z.string().url().optional(),
        alert_severity: z.enum(['info', 'warning', 'critical']).optional(),
        alert_title: z.string().optional(),
        alert_message: z.string().optional(),
        assignee_id: z.string().uuid().optional(),
        task_title: z.string().optional(),
        task_description: z.string().optional(),
        due_in_hours: z.number().int().min(1).optional(),
        escalate_to_role: z.string().optional(),
        escalate_after_minutes: z.number().int().min(0).optional(),
        webhook_url: z.string().url().optional(),
        webhook_method: z.enum(['GET', 'POST', 'PUT']).optional(),
        webhook_headers: z.record(z.string()).optional(),
        webhook_payload: z.record(z.unknown()).optional(),
      }),
    })).optional(),
    is_active: z.boolean().optional(),
  }),
});

export const deleteRuleSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const toggleRuleSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const testRuleSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    test_data: z.record(z.unknown()),
  }),
});
