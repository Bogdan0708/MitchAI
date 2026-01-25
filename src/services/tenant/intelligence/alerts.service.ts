/**
 * Alerts Service
 *
 * Unified business alerting system across all modules.
 * Handles compliance, review, content, and operational alerts.
 */

import { Pool } from 'pg';
import { runInTenantContext } from '../../../lib/db-context';
import { logger } from '../../logger.service';
import { addJob } from '../../queue';

// Types
export interface BusinessAlert {
  id: string;
  tenantId: string;
  locationId: string | null;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  sourceType: string | null;
  sourceId: string | null;
  actionUrl: string | null;
  aiRecommendation: string | null;
  isRead: boolean;
  isResolved: boolean;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  createdAt: Date;
}

export type AlertType =
  // Compliance alerts
  | 'check_overdue'
  | 'temp_breach'
  | 'training_expiring'
  | 'audit_due'
  | 'corrective_action_due'
  // Review alerts
  | 'negative_spike'
  | 'review_requires_response'
  | 'rating_drop'
  | 'compliance_mention'
  // Content alerts
  | 'post_failed'
  | 'engagement_drop'
  | 'trending_opportunity'
  | 'scheduled_content_due'
  // Business alerts
  | 'low_inventory'
  | 'reservation_surge'
  | 'unusual_activity';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface CreateAlertDTO {
  locationId?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  sourceType?: string;
  sourceId?: string;
  actionUrl?: string;
  aiRecommendation?: string;
}

export interface AlertFilters {
  severity?: AlertSeverity;
  alertType?: AlertType;
  isRead?: boolean;
  isResolved?: boolean;
  locationId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AlertStats {
  total: number;
  unread: number;
  critical: number;
  warning: number;
  info: number;
  byType: Record<string, number>;
}

export interface AlertNotificationConfig {
  email: boolean;
  sms: boolean;
  slack: boolean;
  push: boolean;
  severityThreshold: AlertSeverity;
}

export class AlertsService {
  constructor(private pool: Pool) {}

  /**
   * Create a new business alert
   */
  public async createAlert(
    tenantId: string,
    data: CreateAlertDTO
  ): Promise<BusinessAlert> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO business_alerts (
          tenant_id, location_id, alert_type, severity,
          title, message, source_type, source_id,
          action_url, ai_recommendation
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          tenantId,
          data.locationId || null,
          data.alertType,
          data.severity,
          data.title,
          data.message,
          data.sourceType || null,
          data.sourceId || null,
          data.actionUrl || null,
          data.aiRecommendation || null,
        ]
      );

      const alert = this.mapRowToAlert(result.rows[0]);

      // Queue notification job for critical/warning alerts
      if (data.severity === 'critical' || data.severity === 'warning') {
        await addJob('alert.notify', {
          tenantId,
          alertId: alert.id,
          severity: data.severity,
        });
      }

      logger.info('Business alert created', {
        tenantId,
        alertId: alert.id,
        alertType: data.alertType,
        severity: data.severity,
      });

      return alert;
    });
  }

  /**
   * Get alerts with filters
   */
  public async getAlerts(
    tenantId: string,
    filters: AlertFilters = {}
  ): Promise<{ alerts: BusinessAlert[]; total: number }> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const conditions: string[] = ['tenant_id = $1'];
      const params: unknown[] = [tenantId];
      let paramIndex = 2;

      if (filters.severity) {
        conditions.push(`severity = $${paramIndex++}`);
        params.push(filters.severity);
      }

      if (filters.alertType) {
        conditions.push(`alert_type = $${paramIndex++}`);
        params.push(filters.alertType);
      }

      if (filters.isRead !== undefined) {
        conditions.push(`is_read = $${paramIndex++}`);
        params.push(filters.isRead);
      }

      if (filters.isResolved !== undefined) {
        conditions.push(`is_resolved = $${paramIndex++}`);
        params.push(filters.isResolved);
      }

      if (filters.locationId) {
        conditions.push(`location_id = $${paramIndex++}`);
        params.push(filters.locationId);
      }

      if (filters.startDate) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(filters.endDate);
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) FROM business_alerts WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Get alerts
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const result = await client.query(
        `SELECT * FROM business_alerts
         WHERE ${whereClause}
         ORDER BY
           CASE severity
             WHEN 'critical' THEN 1
             WHEN 'warning' THEN 2
             ELSE 3
           END,
           created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
      );

      return {
        alerts: result.rows.map(this.mapRowToAlert),
        total,
      };
    });
  }

  /**
   * Get unread alerts
   */
  public async getUnreadAlerts(tenantId: string): Promise<BusinessAlert[]> {
    const result = await this.getAlerts(tenantId, {
      isRead: false,
      isResolved: false,
    });
    return result.alerts;
  }

  /**
   * Get alert by ID
   */
  public async getAlertById(
    tenantId: string,
    alertId: string
  ): Promise<BusinessAlert | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM business_alerts WHERE id = $1 AND tenant_id = $2`,
        [alertId, tenantId]
      );
      return result.rows.length > 0 ? this.mapRowToAlert(result.rows[0]) : null;
    });
  }

  /**
   * Mark alert as read
   */
  public async markAsRead(
    tenantId: string,
    alertId: string
  ): Promise<BusinessAlert | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE business_alerts
         SET is_read = true
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [alertId, tenantId]
      );

      return result.rows.length > 0 ? this.mapRowToAlert(result.rows[0]) : null;
    });
  }

  /**
   * Mark multiple alerts as read
   */
  public async bulkMarkAsRead(
    tenantId: string,
    alertIds: string[]
  ): Promise<number> {
    if (alertIds.length === 0) return 0;

    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE business_alerts
         SET is_read = true
         WHERE id = ANY($1) AND tenant_id = $2`,
        [alertIds, tenantId]
      );

      return result.rowCount || 0;
    });
  }

  /**
   * Resolve an alert
   */
  public async resolveAlert(
    tenantId: string,
    alertId: string,
    userId: string
  ): Promise<BusinessAlert | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE business_alerts
         SET is_resolved = true, resolved_at = NOW(), resolved_by = $3
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [alertId, tenantId, userId]
      );

      if (result.rows.length > 0) {
        logger.info('Alert resolved', { tenantId, alertId, userId });
        return this.mapRowToAlert(result.rows[0]);
      }

      return null;
    });
  }

  /**
   * Get alert statistics
   */
  public async getAlertStats(tenantId: string): Promise<AlertStats> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE is_read = false) as unread,
           COUNT(*) FILTER (WHERE severity = 'critical' AND is_resolved = false) as critical,
           COUNT(*) FILTER (WHERE severity = 'warning' AND is_resolved = false) as warning,
           COUNT(*) FILTER (WHERE severity = 'info' AND is_resolved = false) as info
         FROM business_alerts
         WHERE tenant_id = $1`,
        [tenantId]
      );

      const typeResult = await client.query(
        `SELECT alert_type, COUNT(*) as count
         FROM business_alerts
         WHERE tenant_id = $1 AND is_resolved = false
         GROUP BY alert_type`,
        [tenantId]
      );

      const byType: Record<string, number> = {};
      for (const row of typeResult.rows) {
        byType[row.alert_type] = parseInt(row.count, 10);
      }

      const stats = result.rows[0];
      return {
        total: parseInt(stats.total, 10),
        unread: parseInt(stats.unread, 10),
        critical: parseInt(stats.critical, 10),
        warning: parseInt(stats.warning, 10),
        info: parseInt(stats.info, 10),
        byType,
      };
    });
  }

  /**
   * Create compliance-related alerts
   */
  public async createComplianceAlert(
    tenantId: string,
    type: 'check_overdue' | 'temp_breach' | 'training_expiring' | 'audit_due' | 'corrective_action_due',
    data: {
      locationId?: string;
      title: string;
      message: string;
      sourceType?: string;
      sourceId?: string;
      actionUrl?: string;
    }
  ): Promise<BusinessAlert> {
    const severity: AlertSeverity =
      type === 'temp_breach' ? 'critical' :
      type === 'check_overdue' || type === 'corrective_action_due' ? 'warning' :
      'info';

    return this.createAlert(tenantId, {
      ...data,
      alertType: type,
      severity,
    });
  }

  /**
   * Create review-related alerts
   */
  public async createReviewAlert(
    tenantId: string,
    type: 'negative_spike' | 'review_requires_response' | 'rating_drop' | 'compliance_mention',
    data: {
      locationId?: string;
      title: string;
      message: string;
      sourceId?: string;
      actionUrl?: string;
      aiRecommendation?: string;
    }
  ): Promise<BusinessAlert> {
    const severity: AlertSeverity =
      type === 'compliance_mention' ? 'critical' :
      type === 'negative_spike' || type === 'rating_drop' ? 'warning' :
      'info';

    return this.createAlert(tenantId, {
      ...data,
      alertType: type,
      severity,
      sourceType: 'review',
    });
  }

  /**
   * Create content-related alerts
   */
  public async createContentAlert(
    tenantId: string,
    type: 'post_failed' | 'engagement_drop' | 'trending_opportunity' | 'scheduled_content_due',
    data: {
      locationId?: string;
      title: string;
      message: string;
      sourceId?: string;
      actionUrl?: string;
    }
  ): Promise<BusinessAlert> {
    const severity: AlertSeverity =
      type === 'post_failed' ? 'warning' :
      'info';

    return this.createAlert(tenantId, {
      ...data,
      alertType: type,
      severity,
      sourceType: 'content',
    });
  }

  /**
   * Check for and generate temperature breach alerts
   */
  public async checkTemperatureBreaches(tenantId: string): Promise<void> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Find recent unalerted temperature breaches
      const result = await client.query(
        `SELECT tl.*, e.name as equipment_name, l.name as location_name
         FROM temperature_logs tl
         LEFT JOIN equipment e ON tl.equipment_id = e.id
         LEFT JOIN locations l ON tl.location_id = l.id
         WHERE tl.tenant_id = $1
           AND tl.is_within_limits = false
           AND tl.recorded_at > NOW() - INTERVAL '1 hour'
           AND NOT EXISTS (
             SELECT 1 FROM business_alerts ba
             WHERE ba.source_id = tl.id::text
               AND ba.alert_type = 'temp_breach'
           )`,
        [tenantId]
      );

      for (const row of result.rows) {
        await this.createComplianceAlert(tenantId, 'temp_breach', {
          locationId: row.location_id,
          title: `Temperature Breach: ${row.equipment_name || 'Unknown Equipment'}`,
          message: `Temperature reading of ${row.reading_celsius}°C is outside acceptable limits (${row.lower_limit}°C - ${row.upper_limit}°C) at ${row.location_name || 'Unknown Location'}`,
          sourceType: 'temperature_log',
          sourceId: row.id,
          actionUrl: `/compliance/temperature/${row.id}`,
        });
      }
    });
  }

  /**
   * Check for overdue compliance checks
   */
  public async checkOverdueChecks(tenantId: string): Promise<void> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT cc.*, l.name as location_name, ct.name as template_name
         FROM compliance_checks cc
         LEFT JOIN locations l ON cc.location_id = l.id
         LEFT JOIN compliance_templates ct ON cc.template_id = ct.id
         WHERE cc.tenant_id = $1
           AND cc.status = 'pending'
           AND cc.scheduled_at < NOW()
           AND NOT EXISTS (
             SELECT 1 FROM business_alerts ba
             WHERE ba.source_id = cc.id::text
               AND ba.alert_type = 'check_overdue'
               AND ba.created_at > NOW() - INTERVAL '24 hours'
           )`,
        [tenantId]
      );

      for (const row of result.rows) {
        await this.createComplianceAlert(tenantId, 'check_overdue', {
          locationId: row.location_id,
          title: `Overdue Check: ${row.template_name || row.check_type}`,
          message: `Compliance check at ${row.location_name || 'Unknown Location'} was scheduled for ${new Date(row.scheduled_at).toLocaleString()} and is now overdue.`,
          sourceType: 'compliance_check',
          sourceId: row.id,
          actionUrl: `/compliance/checks/${row.id}`,
        });
      }
    });
  }

  /**
   * Check for expiring training certifications
   */
  public async checkExpiringTraining(tenantId: string): Promise<void> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT tr.*, tu.first_name, tu.last_name, tu.email
         FROM training_records tr
         JOIN tenant_users tu ON tr.user_id = tu.id
         WHERE tr.tenant_id = $1
           AND tr.expiry_date IS NOT NULL
           AND tr.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
           AND tr.status != 'expired'
           AND NOT EXISTS (
             SELECT 1 FROM business_alerts ba
             WHERE ba.source_id = tr.id::text
               AND ba.alert_type = 'training_expiring'
               AND ba.created_at > NOW() - INTERVAL '7 days'
           )`,
        [tenantId]
      );

      for (const row of result.rows) {
        await this.createComplianceAlert(tenantId, 'training_expiring', {
          title: `Training Expiring: ${row.course_name}`,
          message: `${row.first_name} ${row.last_name}'s ${row.course_name} certification expires on ${new Date(row.expiry_date).toLocaleDateString()}.`,
          sourceType: 'training_record',
          sourceId: row.id,
          actionUrl: `/compliance/training/${row.id}`,
        });
      }
    });
  }

  private mapRowToAlert(row: Record<string, unknown>): BusinessAlert {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      locationId: row.location_id as string | null,
      alertType: row.alert_type as AlertType,
      severity: row.severity as AlertSeverity,
      title: row.title as string,
      message: row.message as string,
      sourceType: row.source_type as string | null,
      sourceId: row.source_id as string | null,
      actionUrl: row.action_url as string | null,
      aiRecommendation: row.ai_recommendation as string | null,
      isRead: row.is_read as boolean,
      isResolved: row.is_resolved as boolean,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : null,
      resolvedBy: row.resolved_by as string | null,
      createdAt: new Date(row.created_at as string),
    };
  }
}
