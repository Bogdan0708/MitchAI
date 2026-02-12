/**
 * Corrective Actions Service
 *
 * Manages corrective actions for compliance failures and incidents.
 */

import { Pool } from 'pg';
import { runInTenantContext } from '../../../lib/db-context';
import { logger } from '../../logger.service';

// Types
export interface CorrectiveAction {
  id: string;
  tenantId: string;
  locationId: string;
  complianceCheckId: string | null;
  temperatureLogId: string | null;
  incidentType: 'temperature_breach' | 'check_failed' | 'audit_finding' | 'customer_complaint' | 'staff_issue' | 'equipment_failure' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  rootCause: string | null;
  actionTaken: string | null;
  preventiveMeasures: string | null;
  assignedTo: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'verified';
  dueDate: Date | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  verificationNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCorrectiveActionDTO {
  locationId: string;
  complianceCheckId?: string;
  temperatureLogId?: string;
  incidentType: CorrectiveAction['incidentType'];
  severity: CorrectiveAction['severity'];
  description: string;
  assignedTo?: string;
  dueDate?: Date;
}

export interface UpdateCorrectiveActionDTO {
  rootCause?: string;
  actionTaken?: string;
  preventiveMeasures?: string;
  assignedTo?: string;
  status?: CorrectiveAction['status'];
  dueDate?: Date;
  verificationNotes?: string;
}

export interface CorrectiveActionFilters {
  locationId?: string;
  status?: CorrectiveAction['status'];
  severity?: CorrectiveAction['severity'];
  incidentType?: CorrectiveAction['incidentType'];
  assignedTo?: string;
  overdueOnly?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class CorrectiveActionsService {
  constructor(private pool: Pool) {}

  /**
   * Get corrective actions with filters
   */
  public async getCorrectiveActions(
    tenantId: string,
    filters: CorrectiveActionFilters
  ): Promise<{ actions: CorrectiveAction[]; total: number }> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      let whereClause = 'WHERE ca.tenant_id = $1';
      const params: unknown[] = [tenantId];
      let paramIndex = 2;

      if (filters.locationId) {
        whereClause += ` AND ca.location_id = $${paramIndex++}`;
        params.push(filters.locationId);
      }
      if (filters.status) {
        whereClause += ` AND ca.status = $${paramIndex++}`;
        params.push(filters.status);
      }
      if (filters.severity) {
        whereClause += ` AND ca.severity = $${paramIndex++}`;
        params.push(filters.severity);
      }
      if (filters.incidentType) {
        whereClause += ` AND ca.incident_type = $${paramIndex++}`;
        params.push(filters.incidentType);
      }
      if (filters.assignedTo) {
        whereClause += ` AND ca.assigned_to = $${paramIndex++}`;
        params.push(filters.assignedTo);
      }
      if (filters.overdueOnly) {
        whereClause += ` AND ca.due_date < NOW() AND ca.status NOT IN ('resolved', 'verified')`;
      }
      if (filters.startDate) {
        whereClause += ` AND ca.created_at >= $${paramIndex++}`;
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereClause += ` AND ca.created_at <= $${paramIndex++}`;
        params.push(filters.endDate);
      }

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM corrective_actions ca ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Get paginated results with assignee name
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const result = await client.query(
        `SELECT ca.id, ca.tenant_id as "tenantId", ca.location_id as "locationId",
                ca.compliance_check_id as "complianceCheckId",
                ca.temperature_log_id as "temperatureLogId",
                ca.incident_type as "incidentType", ca.severity, ca.description,
                ca.root_cause as "rootCause", ca.action_taken as "actionTaken",
                ca.preventive_measures as "preventiveMeasures",
                ca.assigned_to as "assignedTo", ca.status, ca.due_date as "dueDate",
                ca.resolved_at as "resolvedAt", ca.resolved_by as "resolvedBy",
                ca.verification_notes as "verificationNotes",
                ca.created_at as "createdAt", ca.updated_at as "updatedAt",
                tu.email as assignee_email, CONCAT(tu.first_name, ' ', tu.last_name) as assignee_name,
                l.name as location_name
         FROM corrective_actions ca
         LEFT JOIN tenant_users tu ON ca.assigned_to = tu.id
         LEFT JOIN locations l ON ca.location_id = l.id
         ${whereClause}
         ORDER BY
           CASE ca.severity
             WHEN 'critical' THEN 1
             WHEN 'high' THEN 2
             WHEN 'medium' THEN 3
             ELSE 4
           END,
           ca.due_date ASC NULLS LAST,
           ca.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      return { actions: result.rows, total };
    });
  }

  /**
   * Get a specific corrective action
   */
  public async getCorrectiveAction(
    tenantId: string,
    actionId: string
  ): Promise<CorrectiveAction | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT id, tenant_id as "tenantId", location_id as "locationId",
                compliance_check_id as "complianceCheckId",
                temperature_log_id as "temperatureLogId",
                incident_type as "incidentType", severity, description,
                root_cause as "rootCause", action_taken as "actionTaken",
                preventive_measures as "preventiveMeasures",
                assigned_to as "assignedTo", status, due_date as "dueDate",
                resolved_at as "resolvedAt", resolved_by as "resolvedBy",
                verification_notes as "verificationNotes",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM corrective_actions
         WHERE tenant_id = $1 AND id = $2`,
        [tenantId, actionId]
      );
      return result.rows[0] || null;
    });
  }

  /**
   * Create a corrective action
   */
  public async createCorrectiveAction(
    tenantId: string,
    data: CreateCorrectiveActionDTO
  ): Promise<CorrectiveAction> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO corrective_actions
         (tenant_id, location_id, compliance_check_id, temperature_log_id,
          incident_type, severity, description, assigned_to, due_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   compliance_check_id as "complianceCheckId",
                   temperature_log_id as "temperatureLogId",
                   incident_type as "incidentType", severity, description,
                   root_cause as "rootCause", action_taken as "actionTaken",
                   preventive_measures as "preventiveMeasures",
                   assigned_to as "assignedTo", status, due_date as "dueDate",
                   resolved_at as "resolvedAt", resolved_by as "resolvedBy",
                   verification_notes as "verificationNotes",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [
          tenantId,
          data.locationId,
          data.complianceCheckId || null,
          data.temperatureLogId || null,
          data.incidentType,
          data.severity,
          data.description,
          data.assignedTo || null,
          data.dueDate || null,
        ]
      );

      logger.info('Corrective action created', {
        tenantId,
        actionId: result.rows[0].id,
        severity: data.severity,
        incidentType: data.incidentType,
      });

      return result.rows[0];
    });
  }

  /**
   * Update a corrective action
   */
  public async updateCorrectiveAction(
    tenantId: string,
    actionId: string,
    data: UpdateCorrectiveActionDTO
  ): Promise<CorrectiveAction | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      const fieldMap: Record<string, string> = {
        rootCause: 'root_cause',
        actionTaken: 'action_taken',
        preventiveMeasures: 'preventive_measures',
        assignedTo: 'assigned_to',
        status: 'status',
        dueDate: 'due_date',
        verificationNotes: 'verification_notes',
      };

      for (const [key, column] of Object.entries(fieldMap)) {
        if (data[key as keyof UpdateCorrectiveActionDTO] !== undefined) {
          setClauses.push(`${column} = $${paramIndex++}`);
          values.push(data[key as keyof UpdateCorrectiveActionDTO]);
        }
      }

      if (setClauses.length === 0) {
        return this.getCorrectiveAction(tenantId, actionId);
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(tenantId, actionId);

      const result = await client.query(
        `UPDATE corrective_actions
         SET ${setClauses.join(', ')}
         WHERE tenant_id = $${paramIndex} AND id = $${paramIndex + 1}
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   compliance_check_id as "complianceCheckId",
                   temperature_log_id as "temperatureLogId",
                   incident_type as "incidentType", severity, description,
                   root_cause as "rootCause", action_taken as "actionTaken",
                   preventive_measures as "preventiveMeasures",
                   assigned_to as "assignedTo", status, due_date as "dueDate",
                   resolved_at as "resolvedAt", resolved_by as "resolvedBy",
                   verification_notes as "verificationNotes",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        values
      );

      if (result.rows[0]) {
        logger.info('Corrective action updated', { tenantId, actionId });
      }

      return result.rows[0] || null;
    });
  }

  /**
   * Resolve a corrective action
   */
  public async resolveCorrectiveAction(
    tenantId: string,
    actionId: string,
    userId: string,
    data: {
      actionTaken: string;
      preventiveMeasures?: string;
    }
  ): Promise<CorrectiveAction | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE corrective_actions
         SET status = 'resolved', action_taken = $3, preventive_measures = $4,
             resolved_at = NOW(), resolved_by = $5, updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND status != 'verified'
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   compliance_check_id as "complianceCheckId",
                   temperature_log_id as "temperatureLogId",
                   incident_type as "incidentType", severity, description,
                   root_cause as "rootCause", action_taken as "actionTaken",
                   preventive_measures as "preventiveMeasures",
                   assigned_to as "assignedTo", status, due_date as "dueDate",
                   resolved_at as "resolvedAt", resolved_by as "resolvedBy",
                   verification_notes as "verificationNotes",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [tenantId, actionId, data.actionTaken, data.preventiveMeasures || null, userId]
      );

      if (result.rows[0]) {
        logger.info('Corrective action resolved', { tenantId, actionId, userId });
      }

      return result.rows[0] || null;
    });
  }

  /**
   * Verify a resolved corrective action
   */
  public async verifyCorrectiveAction(
    tenantId: string,
    actionId: string,
    userId: string,
    verificationNotes?: string
  ): Promise<CorrectiveAction | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE corrective_actions
         SET status = 'verified', verification_notes = $3, updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND status = 'resolved'
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   compliance_check_id as "complianceCheckId",
                   temperature_log_id as "temperatureLogId",
                   incident_type as "incidentType", severity, description,
                   root_cause as "rootCause", action_taken as "actionTaken",
                   preventive_measures as "preventiveMeasures",
                   assigned_to as "assignedTo", status, due_date as "dueDate",
                   resolved_at as "resolvedAt", resolved_by as "resolvedBy",
                   verification_notes as "verificationNotes",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [tenantId, actionId, verificationNotes || null]
      );

      if (result.rows[0]) {
        logger.info('Corrective action verified', { tenantId, actionId, userId });
      }

      return result.rows[0] || null;
    });
  }

  /**
   * Get corrective action statistics
   */
  public async getStatistics(
    tenantId: string,
    period: 'week' | 'month' | 'quarter' = 'month'
  ): Promise<{
    total: number;
    open: number;
    overdue: number;
    resolvedInPeriod: number;
    averageResolutionDays: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  }> {
    const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 90;

    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE status IN ('open', 'in_progress')) as open,
           COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('resolved', 'verified')) as overdue,
           COUNT(*) FILTER (WHERE resolved_at >= NOW() - INTERVAL '${periodDays} days') as resolved_in_period,
           AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400)
             FILTER (WHERE resolved_at IS NOT NULL) as avg_resolution_days,
           json_object_agg(COALESCE(severity, 'unknown'), severity_count) as by_severity,
           json_object_agg(COALESCE(incident_type, 'unknown'), type_count) as by_type
         FROM corrective_actions ca
         LEFT JOIN (
           SELECT severity, COUNT(*) as severity_count
           FROM corrective_actions
           WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '${periodDays} days'
           GROUP BY severity
         ) sc ON true
         LEFT JOIN (
           SELECT incident_type, COUNT(*) as type_count
           FROM corrective_actions
           WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '${periodDays} days'
           GROUP BY incident_type
         ) tc ON true
         WHERE ca.tenant_id = $1 AND ca.created_at >= NOW() - INTERVAL '${periodDays} days'`,
        [tenantId]
      );

      const stats = result.rows[0];

      return {
        total: parseInt(stats.total, 10),
        open: parseInt(stats.open, 10),
        overdue: parseInt(stats.overdue, 10),
        resolvedInPeriod: parseInt(stats.resolved_in_period, 10),
        averageResolutionDays: parseFloat(stats.avg_resolution_days) || 0,
        bySeverity: stats.by_severity || {},
        byType: stats.by_type || {},
      };
    });
  }
}
