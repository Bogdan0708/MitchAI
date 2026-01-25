/**
 * Automation Service
 *
 * Workflow automation rules engine for triggering
 * actions based on events across modules.
 */

import { Pool } from 'pg';
import { runInTenantContext } from '../../../lib/db-context';
import { logger } from '../../logger.service';
import { addJob } from '../../queue';

// Types
export interface AutomationRule {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  triggerType: TriggerType;
  triggerConditions: TriggerCondition;
  actions: AutomationAction[];
  isActive: boolean;
  lastTriggeredAt: Date | null;
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TriggerType =
  // Review triggers
  | 'review_received'
  | 'negative_review'
  | 'positive_review'
  | 'review_unresponded'
  // Compliance triggers
  | 'temp_breach'
  | 'check_overdue'
  | 'check_failed'
  | 'training_expiring'
  // Content triggers
  | 'content_scheduled'
  | 'content_published'
  | 'content_failed'
  | 'engagement_spike'
  // Schedule triggers
  | 'daily_schedule'
  | 'weekly_schedule'
  | 'monthly_schedule';

export interface TriggerCondition {
  // Review conditions
  ratingBelow?: number;
  ratingAbove?: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
  platform?: string;
  containsKeywords?: string[];

  // Compliance conditions
  severityLevel?: 'low' | 'medium' | 'high' | 'critical';
  checkType?: string;
  temperatureDeviation?: number;

  // Content conditions
  engagementAbove?: number;
  platforms?: string[];

  // Schedule conditions
  scheduleTime?: string; // HH:MM format
  scheduleDays?: number[]; // 0-6 for days of week
  scheduleDate?: number; // 1-31 for day of month

  // General
  locationId?: string;
}

export interface AutomationAction {
  type: ActionType;
  config: ActionConfig;
}

export type ActionType =
  | 'notify_email'
  | 'notify_sms'
  | 'notify_slack'
  | 'notify_push'
  | 'create_alert'
  | 'assign_task'
  | 'generate_response'
  | 'escalate'
  | 'webhook';

export interface ActionConfig {
  // Email
  recipients?: string[];
  emailTemplate?: string;
  subject?: string;

  // SMS
  phoneNumbers?: string[];
  messageTemplate?: string;

  // Slack
  slackChannel?: string;
  slackWebhook?: string;

  // Alert
  alertSeverity?: 'info' | 'warning' | 'critical';
  alertTitle?: string;
  alertMessage?: string;

  // Task
  assigneeId?: string;
  taskTitle?: string;
  taskDescription?: string;
  dueInHours?: number;

  // Escalation
  escalateToRole?: string;
  escalateAfterMinutes?: number;

  // Webhook
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST' | 'PUT';
  webhookHeaders?: Record<string, string>;
  webhookPayload?: Record<string, unknown>;
}

export interface CreateRuleDTO {
  name: string;
  description?: string;
  triggerType: TriggerType;
  triggerConditions: TriggerCondition;
  actions: AutomationAction[];
  isActive?: boolean;
}

export interface UpdateRuleDTO {
  name?: string;
  description?: string;
  triggerConditions?: TriggerCondition;
  actions?: AutomationAction[];
  isActive?: boolean;
}

export interface TriggerEvent {
  type: TriggerType;
  tenantId: string;
  locationId?: string;
  data: Record<string, unknown>;
}

export interface RuleExecutionResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  actionsExecuted: number;
  errors: string[];
}

export class AutomationService {
  constructor(private pool: Pool) {}

  /**
   * Get all automation rules
   */
  public async getRules(
    tenantId: string,
    activeOnly: boolean = false
  ): Promise<AutomationRule[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const conditions = ['tenant_id = $1', 'deleted_at IS NULL'];
      if (activeOnly) {
        conditions.push('is_active = true');
      }

      const result = await client.query(
        `SELECT * FROM automation_rules
         WHERE ${conditions.join(' AND ')}
         ORDER BY created_at DESC`,
        [tenantId]
      );

      return result.rows.map(this.mapRowToRule);
    });
  }

  /**
   * Get a single rule
   */
  public async getRule(
    tenantId: string,
    ruleId: string
  ): Promise<AutomationRule | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM automation_rules
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [ruleId, tenantId]
      );

      return result.rows.length > 0 ? this.mapRowToRule(result.rows[0]) : null;
    });
  }

  /**
   * Create a new automation rule
   */
  public async createRule(
    tenantId: string,
    data: CreateRuleDTO
  ): Promise<AutomationRule> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO automation_rules (
           tenant_id, name, description, trigger_type,
           trigger_conditions, actions, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          tenantId,
          data.name,
          data.description || null,
          data.triggerType,
          JSON.stringify(data.triggerConditions),
          JSON.stringify(data.actions),
          data.isActive !== false,
        ]
      );

      logger.info('Automation rule created', {
        tenantId,
        ruleId: result.rows[0].id,
        triggerType: data.triggerType,
      });

      return this.mapRowToRule(result.rows[0]);
    });
  }

  /**
   * Update an automation rule
   */
  public async updateRule(
    tenantId: string,
    ruleId: string,
    data: UpdateRuleDTO
  ): Promise<AutomationRule | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const updates: string[] = ['updated_at = NOW()'];
      const params: unknown[] = [ruleId, tenantId];
      let paramIndex = 3;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        params.push(data.name);
      }

      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        params.push(data.description);
      }

      if (data.triggerConditions !== undefined) {
        updates.push(`trigger_conditions = $${paramIndex++}`);
        params.push(JSON.stringify(data.triggerConditions));
      }

      if (data.actions !== undefined) {
        updates.push(`actions = $${paramIndex++}`);
        params.push(JSON.stringify(data.actions));
      }

      if (data.isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        params.push(data.isActive);
      }

      const result = await client.query(
        `UPDATE automation_rules
         SET ${updates.join(', ')}
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
         RETURNING *`,
        params
      );

      return result.rows.length > 0 ? this.mapRowToRule(result.rows[0]) : null;
    });
  }

  /**
   * Delete an automation rule (soft delete)
   */
  public async deleteRule(
    tenantId: string,
    ruleId: string
  ): Promise<boolean> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE automation_rules
         SET deleted_at = NOW()
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [ruleId, tenantId]
      );

      return (result.rowCount || 0) > 0;
    });
  }

  /**
   * Toggle rule active status
   */
  public async toggleRule(
    tenantId: string,
    ruleId: string
  ): Promise<AutomationRule | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE automation_rules
         SET is_active = NOT is_active, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [ruleId, tenantId]
      );

      return result.rows.length > 0 ? this.mapRowToRule(result.rows[0]) : null;
    });
  }

  /**
   * Process a trigger event and execute matching rules
   */
  public async processEvent(event: TriggerEvent): Promise<RuleExecutionResult[]> {
    const results: RuleExecutionResult[] = [];

    // Get active rules for this trigger type
    const rules = await this.getMatchingRules(event.tenantId, event.type);

    for (const rule of rules) {
      const result = await this.evaluateAndExecuteRule(rule, event);
      results.push(result);
    }

    return results;
  }

  /**
   * Get rules matching a trigger type
   */
  private async getMatchingRules(
    tenantId: string,
    triggerType: TriggerType
  ): Promise<AutomationRule[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM automation_rules
         WHERE tenant_id = $1
           AND trigger_type = $2
           AND is_active = true
           AND deleted_at IS NULL`,
        [tenantId, triggerType]
      );

      return result.rows.map(this.mapRowToRule);
    });
  }

  /**
   * Evaluate conditions and execute rule if matched
   */
  private async evaluateAndExecuteRule(
    rule: AutomationRule,
    event: TriggerEvent
  ): Promise<RuleExecutionResult> {
    const result: RuleExecutionResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      triggered: false,
      actionsExecuted: 0,
      errors: [],
    };

    // Check if conditions match
    if (!this.evaluateConditions(rule.triggerConditions, event)) {
      return result;
    }

    result.triggered = true;

    // Execute actions
    for (const action of rule.actions) {
      try {
        await this.executeAction(action, event, rule);
        result.actionsExecuted++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`${action.type}: ${errorMessage}`);
        logger.error('Automation action failed', {
          ruleId: rule.id,
          actionType: action.type,
          error: errorMessage,
        });
      }
    }

    // Update rule trigger stats
    await this.updateRuleTriggerStats(rule.tenantId, rule.id);

    logger.info('Automation rule executed', {
      ruleId: rule.id,
      ruleName: rule.name,
      triggerType: event.type,
      actionsExecuted: result.actionsExecuted,
      errors: result.errors.length,
    });

    return result;
  }

  /**
   * Evaluate trigger conditions against event data
   */
  private evaluateConditions(
    conditions: TriggerCondition,
    event: TriggerEvent
  ): boolean {
    const data = event.data;

    // Location filter
    if (conditions.locationId && event.locationId !== conditions.locationId) {
      return false;
    }

    // Rating conditions
    if (conditions.ratingBelow && (data.rating as number) >= conditions.ratingBelow) {
      return false;
    }

    if (conditions.ratingAbove && (data.rating as number) <= conditions.ratingAbove) {
      return false;
    }

    // Sentiment condition
    if (conditions.sentiment && data.sentiment !== conditions.sentiment) {
      return false;
    }

    // Platform condition
    if (conditions.platform && data.platform !== conditions.platform) {
      return false;
    }

    // Keywords condition
    if (conditions.containsKeywords && conditions.containsKeywords.length > 0) {
      const text = ((data.text as string) || '').toLowerCase();
      const hasKeyword = conditions.containsKeywords.some(
        (kw) => text.includes(kw.toLowerCase())
      );
      if (!hasKeyword) {
        return false;
      }
    }

    // Severity condition
    if (conditions.severityLevel && data.severity !== conditions.severityLevel) {
      return false;
    }

    // Check type condition
    if (conditions.checkType && data.checkType !== conditions.checkType) {
      return false;
    }

    // Engagement condition
    if (conditions.engagementAbove && (data.engagement as number) <= conditions.engagementAbove) {
      return false;
    }

    // Platforms condition (for content)
    if (conditions.platforms && conditions.platforms.length > 0) {
      const eventPlatforms = data.platforms as string[] || [];
      const hasMatchingPlatform = conditions.platforms.some(
        (p) => eventPlatforms.includes(p)
      );
      if (!hasMatchingPlatform) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute a single automation action
   */
  private async executeAction(
    action: AutomationAction,
    event: TriggerEvent,
    rule: AutomationRule
  ): Promise<void> {
    const config = action.config;

    switch (action.type) {
      case 'notify_email':
        await addJob('automation.email', {
          tenantId: event.tenantId,
          recipients: config.recipients || [],
          template: config.emailTemplate,
          subject: this.interpolateTemplate(config.subject || '', event.data),
          data: event.data,
        });
        break;

      case 'notify_sms':
        await addJob('automation.sms', {
          tenantId: event.tenantId,
          phoneNumbers: config.phoneNumbers || [],
          message: this.interpolateTemplate(config.messageTemplate || '', event.data),
        });
        break;

      case 'notify_slack':
        await addJob('automation.slack', {
          tenantId: event.tenantId,
          channel: config.slackChannel,
          webhook: config.slackWebhook,
          message: this.interpolateTemplate(config.messageTemplate || '', event.data),
          data: event.data,
        });
        break;

      case 'notify_push':
        await addJob('automation.push', {
          tenantId: event.tenantId,
          title: this.interpolateTemplate(config.alertTitle || '', event.data),
          message: this.interpolateTemplate(config.alertMessage || '', event.data),
          data: event.data,
        });
        break;

      case 'create_alert':
        await addJob('alert.create', {
          tenantId: event.tenantId,
          locationId: event.locationId,
          alertType: event.type,
          severity: config.alertSeverity || 'info',
          title: this.interpolateTemplate(config.alertTitle || rule.name, event.data),
          message: this.interpolateTemplate(config.alertMessage || '', event.data),
          sourceType: 'automation',
          sourceId: rule.id,
        });
        break;

      case 'assign_task':
        await addJob('automation.task', {
          tenantId: event.tenantId,
          assigneeId: config.assigneeId,
          title: this.interpolateTemplate(config.taskTitle || '', event.data),
          description: this.interpolateTemplate(config.taskDescription || '', event.data),
          dueAt: config.dueInHours
            ? new Date(Date.now() + config.dueInHours * 60 * 60 * 1000)
            : undefined,
          sourceType: 'automation',
          sourceId: rule.id,
        });
        break;

      case 'generate_response':
        if (event.data.reviewId) {
          await addJob('review.generateResponse', {
            tenantId: event.tenantId,
            reviewId: event.data.reviewId,
            autoSubmit: false,
          });
        }
        break;

      case 'escalate':
        await addJob('automation.escalate', {
          tenantId: event.tenantId,
          escalateToRole: config.escalateToRole,
          delayMinutes: config.escalateAfterMinutes || 0,
          originalEvent: event,
          ruleId: rule.id,
        });
        break;

      case 'webhook':
        if (config.webhookUrl) {
          await addJob('automation.webhook', {
            tenantId: rule.tenantId,
            url: config.webhookUrl,
            method: config.webhookMethod || 'POST',
            headers: config.webhookHeaders || {},
            payload: {
              ...(config.webhookPayload || {}),
              event: event,
              rule: {
                id: rule.id,
                name: rule.name,
              },
            },
          });
        }
        break;
    }
  }

  /**
   * Interpolate template variables
   */
  private interpolateTemplate(
    template: string,
    data: Record<string, unknown>
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = data[key];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Update rule trigger statistics
   */
  private async updateRuleTriggerStats(
    tenantId: string,
    ruleId: string
  ): Promise<void> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      await client.query(
        `UPDATE automation_rules
         SET last_triggered_at = NOW(), trigger_count = trigger_count + 1
         WHERE id = $1 AND tenant_id = $2`,
        [ruleId, tenantId]
      );
    });
  }

  /**
   * Test a rule against sample data
   */
  public async testRule(
    tenantId: string,
    ruleId: string,
    testData: Record<string, unknown>
  ): Promise<{ wouldTrigger: boolean; matchedConditions: string[] }> {
    const rule = await this.getRule(tenantId, ruleId);
    if (!rule) {
      throw new Error('Rule not found');
    }

    const event: TriggerEvent = {
      type: rule.triggerType,
      tenantId,
      locationId: testData.locationId as string | undefined,
      data: testData,
    };

    const matchedConditions: string[] = [];
    const conditions = rule.triggerConditions;

    // Check each condition and track which matched
    if (conditions.ratingBelow) {
      if ((testData.rating as number) < conditions.ratingBelow) {
        matchedConditions.push(`rating < ${conditions.ratingBelow}`);
      }
    }

    if (conditions.sentiment) {
      if (testData.sentiment === conditions.sentiment) {
        matchedConditions.push(`sentiment = ${conditions.sentiment}`);
      }
    }

    if (conditions.containsKeywords && conditions.containsKeywords.length > 0) {
      const text = ((testData.text as string) || '').toLowerCase();
      const matchedKeywords = conditions.containsKeywords.filter(
        (kw) => text.includes(kw.toLowerCase())
      );
      if (matchedKeywords.length > 0) {
        matchedConditions.push(`contains: ${matchedKeywords.join(', ')}`);
      }
    }

    const wouldTrigger = this.evaluateConditions(conditions, event);

    return {
      wouldTrigger,
      matchedConditions,
    };
  }

  /**
   * Get default rule templates
   */
  public getDefaultRuleTemplates(): CreateRuleDTO[] {
    return [
      {
        name: 'Alert on Negative Reviews',
        description: 'Send alert when a negative review is received',
        triggerType: 'negative_review',
        triggerConditions: {
          ratingBelow: 3,
          sentiment: 'negative',
        },
        actions: [
          {
            type: 'create_alert',
            config: {
              alertSeverity: 'warning',
              alertTitle: 'Negative Review Received',
              alertMessage: 'A {{rating}}-star review was received on {{platform}}',
            },
          },
          {
            type: 'generate_response',
            config: {},
          },
        ],
      },
      {
        name: 'Temperature Breach Notification',
        description: 'Notify manager on temperature breach',
        triggerType: 'temp_breach',
        triggerConditions: {
          severityLevel: 'high',
        },
        actions: [
          {
            type: 'notify_email',
            config: {
              emailTemplate: 'temp_breach',
              subject: 'URGENT: Temperature Breach Detected',
            },
          },
          {
            type: 'create_alert',
            config: {
              alertSeverity: 'critical',
              alertTitle: 'Temperature Breach',
              alertMessage: 'Temperature of {{temperature}}°C recorded - outside safe limits',
            },
          },
        ],
      },
      {
        name: 'Daily Compliance Reminder',
        description: 'Send daily reminder for pending compliance checks',
        triggerType: 'daily_schedule',
        triggerConditions: {
          scheduleTime: '06:00',
        },
        actions: [
          {
            type: 'notify_email',
            config: {
              emailTemplate: 'daily_compliance',
              subject: 'Daily Compliance Checks Due',
            },
          },
        ],
      },
      {
        name: 'Celebrate Positive Reviews',
        description: 'Share great reviews with the team',
        triggerType: 'positive_review',
        triggerConditions: {
          ratingAbove: 4,
          sentiment: 'positive',
        },
        actions: [
          {
            type: 'notify_slack',
            config: {
              slackChannel: '#wins',
              messageTemplate: '⭐ New {{rating}}-star review on {{platform}}! "{{text}}"',
            },
          },
        ],
      },
    ];
  }

  private mapRowToRule(row: Record<string, unknown>): AutomationRule {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      name: row.name as string,
      description: row.description as string | null,
      triggerType: row.trigger_type as TriggerType,
      triggerConditions: row.trigger_conditions as TriggerCondition,
      actions: row.actions as AutomationAction[],
      isActive: row.is_active as boolean,
      lastTriggeredAt: row.last_triggered_at
        ? new Date(row.last_triggered_at as string)
        : null,
      triggerCount: row.trigger_count as number,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
