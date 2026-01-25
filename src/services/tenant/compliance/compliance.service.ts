/**
 * Compliance Service
 *
 * Core compliance management including templates and checks.
 * Handles HACCP-compliant digital compliance workflows.
 */

import { Pool } from 'pg';
import { runInTenantContext } from '../../../lib/db-context';
import { logger } from '../../logger.service';

// Types
export interface ComplianceTemplate {
  id: string;
  tenantId: string;
  locationId: string | null;
  name: string;
  description: string | null;
  category: 'temperature' | 'cleaning' | 'receiving' | 'allergen' | 'pest_control' | 'opening' | 'closing' | 'custom';
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'on_demand';
  timeWindows: Array<{ start: string; end: string }>;
  checklistItems: Array<{
    id: string;
    prompt: string;
    type: 'boolean' | 'number' | 'text' | 'select' | 'photo';
    options?: string[];
    critical: boolean;
    photoRequired: boolean;
  }>;
  regulatoryReference: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceCheck {
  id: string;
  tenantId: string;
  locationId: string;
  templateId: string | null;
  userId: string;
  checkType: string;
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'corrective_action';
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  responses: Array<{
    itemId: string;
    value: unknown;
    notes?: string;
    photoUrl?: string;
    timestamp: string;
  }>;
  score: number | null;
  signatureUrl: string | null;
  gpsLocation: { lat: number; lng: number; accuracy: number } | null;
  deviceInfo: Record<string, unknown> | null;
  createdAt: Date;
}

export interface CreateTemplateDTO {
  name: string;
  description?: string;
  category: ComplianceTemplate['category'];
  frequency: ComplianceTemplate['frequency'];
  locationId?: string;
  timeWindows?: Array<{ start: string; end: string }>;
  checklistItems: ComplianceTemplate['checklistItems'];
  regulatoryReference?: string;
}

export interface CreateCheckDTO {
  templateId?: string;
  locationId: string;
  userId: string;
  checkType: string;
  scheduledAt?: Date;
}

export interface SubmitCheckDTO {
  responses: ComplianceCheck['responses'];
  signatureUrl?: string;
  gpsLocation?: ComplianceCheck['gpsLocation'];
  deviceInfo?: ComplianceCheck['deviceInfo'];
}

export interface CheckFilters {
  locationId?: string;
  status?: ComplianceCheck['status'];
  checkType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class ComplianceService {
  constructor(private pool: Pool) {}

  // ============================================================
  // TEMPLATE METHODS
  // ============================================================

  /**
   * Get all compliance templates for a tenant
   */
  public async getTemplates(tenantId: string, locationId?: string): Promise<ComplianceTemplate[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      let query = `
        SELECT id, tenant_id as "tenantId", location_id as "locationId",
               name, description, category, frequency,
               time_windows as "timeWindows",
               checklist_items as "checklistItems",
               regulatory_reference as "regulatoryReference",
               is_active as "isActive",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM compliance_templates
        WHERE tenant_id = $1 AND deleted_at IS NULL
      `;
      const params: unknown[] = [tenantId];

      if (locationId) {
        query += ` AND (location_id = $2 OR location_id IS NULL)`;
        params.push(locationId);
      }

      query += ` ORDER BY name`;

      const result = await client.query(query, params);
      return result.rows;
    });
  }

  /**
   * Get a specific template by ID
   */
  public async getTemplateById(tenantId: string, templateId: string): Promise<ComplianceTemplate | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT id, tenant_id as "tenantId", location_id as "locationId",
                name, description, category, frequency,
                time_windows as "timeWindows",
                checklist_items as "checklistItems",
                regulatory_reference as "regulatoryReference",
                is_active as "isActive",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM compliance_templates
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [tenantId, templateId]
      );
      return result.rows[0] || null;
    });
  }

  /**
   * Create a new compliance template
   */
  public async createTemplate(tenantId: string, data: CreateTemplateDTO): Promise<ComplianceTemplate> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO compliance_templates
         (tenant_id, location_id, name, description, category, frequency,
          time_windows, checklist_items, regulatory_reference)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   name, description, category, frequency,
                   time_windows as "timeWindows",
                   checklist_items as "checklistItems",
                   regulatory_reference as "regulatoryReference",
                   is_active as "isActive",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [
          tenantId,
          data.locationId || null,
          data.name,
          data.description || null,
          data.category,
          data.frequency,
          JSON.stringify(data.timeWindows || []),
          JSON.stringify(data.checklistItems),
          data.regulatoryReference || null,
        ]
      );

      logger.info('Compliance template created', {
        tenantId,
        templateId: result.rows[0].id,
        name: data.name,
      });

      return result.rows[0];
    });
  }

  /**
   * Update a compliance template
   */
  public async updateTemplate(
    tenantId: string,
    templateId: string,
    data: Partial<CreateTemplateDTO> & { isActive?: boolean }
  ): Promise<ComplianceTemplate | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      if (data.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(data.description);
      }
      if (data.category !== undefined) {
        setClauses.push(`category = $${paramIndex++}`);
        values.push(data.category);
      }
      if (data.frequency !== undefined) {
        setClauses.push(`frequency = $${paramIndex++}`);
        values.push(data.frequency);
      }
      if (data.locationId !== undefined) {
        setClauses.push(`location_id = $${paramIndex++}`);
        values.push(data.locationId);
      }
      if (data.timeWindows !== undefined) {
        setClauses.push(`time_windows = $${paramIndex++}`);
        values.push(JSON.stringify(data.timeWindows));
      }
      if (data.checklistItems !== undefined) {
        setClauses.push(`checklist_items = $${paramIndex++}`);
        values.push(JSON.stringify(data.checklistItems));
      }
      if (data.regulatoryReference !== undefined) {
        setClauses.push(`regulatory_reference = $${paramIndex++}`);
        values.push(data.regulatoryReference);
      }
      if (data.isActive !== undefined) {
        setClauses.push(`is_active = $${paramIndex++}`);
        values.push(data.isActive);
      }

      if (setClauses.length === 0) {
        return this.getTemplateById(tenantId, templateId);
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(tenantId, templateId);

      const result = await client.query(
        `UPDATE compliance_templates
         SET ${setClauses.join(', ')}
         WHERE tenant_id = $${paramIndex} AND id = $${paramIndex + 1} AND deleted_at IS NULL
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   name, description, category, frequency,
                   time_windows as "timeWindows",
                   checklist_items as "checklistItems",
                   regulatory_reference as "regulatoryReference",
                   is_active as "isActive",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        values
      );

      if (result.rows[0]) {
        logger.info('Compliance template updated', { tenantId, templateId });
      }

      return result.rows[0] || null;
    });
  }

  /**
   * Soft delete a template
   */
  public async deleteTemplate(tenantId: string, templateId: string): Promise<boolean> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE compliance_templates
         SET deleted_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [tenantId, templateId]
      );

      if (result.rowCount && result.rowCount > 0) {
        logger.info('Compliance template deleted', { tenantId, templateId });
        return true;
      }
      return false;
    });
  }

  // ============================================================
  // CHECK METHODS
  // ============================================================

  /**
   * Get scheduled checks for a specific day
   */
  public async getScheduledChecks(
    tenantId: string,
    locationId: string,
    date: Date
  ): Promise<ComplianceCheck[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT id, tenant_id as "tenantId", location_id as "locationId",
                template_id as "templateId", user_id as "userId",
                check_type as "checkType", status, scheduled_at as "scheduledAt",
                started_at as "startedAt", completed_at as "completedAt",
                responses, score, signature_url as "signatureUrl",
                gps_location as "gpsLocation", device_info as "deviceInfo",
                created_at as "createdAt"
         FROM compliance_checks
         WHERE tenant_id = $1 AND location_id = $2
           AND scheduled_at >= $3 AND scheduled_at <= $4
         ORDER BY scheduled_at`,
        [tenantId, locationId, startOfDay, endOfDay]
      );
      return result.rows;
    });
  }

  /**
   * Get a single check by ID
   */
  public async getCheckById(
    tenantId: string,
    checkId: string
  ): Promise<ComplianceCheck | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT id, tenant_id as "tenantId", location_id as "locationId",
                template_id as "templateId", user_id as "userId",
                check_type as "checkType", status, scheduled_at as "scheduledAt",
                started_at as "startedAt", completed_at as "completedAt",
                responses, score, signature_url as "signatureUrl",
                gps_location as "gpsLocation", device_info as "deviceInfo",
                created_at as "createdAt"
         FROM compliance_checks WHERE id = $1 AND tenant_id = $2`,
        [checkId, tenantId]
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    });
  }

  /**
   * Get check history with filters
   */
  public async getCheckHistory(
    tenantId: string,
    filters: CheckFilters
  ): Promise<{ checks: ComplianceCheck[]; total: number }> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      let whereClause = 'WHERE tenant_id = $1';
      const params: unknown[] = [tenantId];
      let paramIndex = 2;

      if (filters.locationId) {
        whereClause += ` AND location_id = $${paramIndex++}`;
        params.push(filters.locationId);
      }
      if (filters.status) {
        whereClause += ` AND status = $${paramIndex++}`;
        params.push(filters.status);
      }
      if (filters.checkType) {
        whereClause += ` AND check_type = $${paramIndex++}`;
        params.push(filters.checkType);
      }
      if (filters.startDate) {
        whereClause += ` AND created_at >= $${paramIndex++}`;
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereClause += ` AND created_at <= $${paramIndex++}`;
        params.push(filters.endDate);
      }

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM compliance_checks ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Get paginated results
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const result = await client.query(
        `SELECT id, tenant_id as "tenantId", location_id as "locationId",
                template_id as "templateId", user_id as "userId",
                check_type as "checkType", status, scheduled_at as "scheduledAt",
                started_at as "startedAt", completed_at as "completedAt",
                responses, score, signature_url as "signatureUrl",
                gps_location as "gpsLocation", device_info as "deviceInfo",
                created_at as "createdAt"
         FROM compliance_checks
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      return { checks: result.rows, total };
    });
  }

  /**
   * Create a new compliance check
   */
  public async createCheck(tenantId: string, data: CreateCheckDTO): Promise<ComplianceCheck> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO compliance_checks
         (tenant_id, location_id, template_id, user_id, check_type, scheduled_at, status, responses)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', '[]')
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   template_id as "templateId", user_id as "userId",
                   check_type as "checkType", status, scheduled_at as "scheduledAt",
                   started_at as "startedAt", completed_at as "completedAt",
                   responses, score, signature_url as "signatureUrl",
                   gps_location as "gpsLocation", device_info as "deviceInfo",
                   created_at as "createdAt"`,
        [
          tenantId,
          data.locationId,
          data.templateId || null,
          data.userId,
          data.checkType,
          data.scheduledAt || null,
        ]
      );

      logger.info('Compliance check created', {
        tenantId,
        checkId: result.rows[0].id,
        checkType: data.checkType,
      });

      return result.rows[0];
    });
  }

  /**
   * Start a compliance check
   */
  public async startCheck(tenantId: string, checkId: string, userId: string): Promise<ComplianceCheck | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE compliance_checks
         SET status = 'in_progress', started_at = NOW(), user_id = $3
         WHERE tenant_id = $1 AND id = $2 AND status = 'pending'
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   template_id as "templateId", user_id as "userId",
                   check_type as "checkType", status, scheduled_at as "scheduledAt",
                   started_at as "startedAt", completed_at as "completedAt",
                   responses, score, signature_url as "signatureUrl",
                   gps_location as "gpsLocation", device_info as "deviceInfo",
                   created_at as "createdAt"`,
        [tenantId, checkId, userId]
      );

      if (result.rows[0]) {
        logger.info('Compliance check started', { tenantId, checkId });
      }

      return result.rows[0] || null;
    });
  }

  /**
   * Submit a completed compliance check
   */
  public async submitCheck(
    tenantId: string,
    checkId: string,
    data: SubmitCheckDTO
  ): Promise<ComplianceCheck | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Get the check and its template
      const checkResult = await client.query(
        `SELECT cc.*, ct.checklist_items
         FROM compliance_checks cc
         LEFT JOIN compliance_templates ct ON cc.template_id = ct.id
         WHERE cc.tenant_id = $1 AND cc.id = $2 AND cc.status = 'in_progress'`,
        [tenantId, checkId]
      );

      if (!checkResult.rows[0]) {
        return null;
      }

      const check = checkResult.rows[0];
      const checklistItems = check.checklist_items || [];

      // Calculate score based on responses
      const { score, hasCriticalFailure } = this.calculateCheckScore(
        data.responses,
        checklistItems
      );

      // Determine status
      let status: ComplianceCheck['status'] = 'passed';
      if (hasCriticalFailure) {
        status = 'corrective_action';
      } else if (score < 80) {
        status = 'failed';
      }

      const result = await client.query(
        `UPDATE compliance_checks
         SET status = $3, completed_at = NOW(), responses = $4,
             score = $5, signature_url = $6, gps_location = $7, device_info = $8
         WHERE tenant_id = $1 AND id = $2
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   template_id as "templateId", user_id as "userId",
                   check_type as "checkType", status, scheduled_at as "scheduledAt",
                   started_at as "startedAt", completed_at as "completedAt",
                   responses, score, signature_url as "signatureUrl",
                   gps_location as "gpsLocation", device_info as "deviceInfo",
                   created_at as "createdAt"`,
        [
          tenantId,
          checkId,
          status,
          JSON.stringify(data.responses),
          score,
          data.signatureUrl || null,
          data.gpsLocation ? JSON.stringify(data.gpsLocation) : null,
          data.deviceInfo ? JSON.stringify(data.deviceInfo) : null,
        ]
      );

      if (result.rows[0]) {
        logger.info('Compliance check submitted', {
          tenantId,
          checkId,
          status,
          score,
        });

        // Log to audit ledger
        await this.logToAuditLedger(client, tenantId, {
          entityType: 'compliance_check',
          entityId: checkId,
          action: 'create',
          changes: { status, score, responsesCount: data.responses.length },
          actorId: check.user_id,
        });
      }

      return result.rows[0] || null;
    });
  }

  /**
   * Get compliance score summary
   */
  public async getComplianceScore(
    tenantId: string,
    locationId?: string,
    period: 'day' | 'week' | 'month' = 'month'
  ): Promise<{
    overallScore: number;
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    pendingChecks: number;
    byCategory: Record<string, { score: number; count: number }>;
  }> {
    const periodDays = period === 'day' ? 1 : period === 'week' ? 7 : 30;

    return runInTenantContext(this.pool, tenantId, async (client) => {
      let whereClause = `WHERE cc.tenant_id = $1 AND cc.created_at >= NOW() - INTERVAL '${periodDays} days'`;
      const params: unknown[] = [tenantId];

      if (locationId) {
        whereClause += ` AND cc.location_id = $2`;
        params.push(locationId);
      }

      // Get overall stats
      const statsResult = await client.query(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE status = 'passed') as passed,
           COUNT(*) FILTER (WHERE status = 'failed' OR status = 'corrective_action') as failed,
           COUNT(*) FILTER (WHERE status = 'pending') as pending,
           AVG(score) FILTER (WHERE score IS NOT NULL) as avg_score
         FROM compliance_checks cc
         ${whereClause}`,
        params
      );

      const stats = statsResult.rows[0];

      // Get by category
      const categoryResult = await client.query(
        `SELECT
           ct.category,
           AVG(cc.score) as avg_score,
           COUNT(*) as count
         FROM compliance_checks cc
         LEFT JOIN compliance_templates ct ON cc.template_id = ct.id
         ${whereClause}
           AND ct.category IS NOT NULL
           AND cc.score IS NOT NULL
         GROUP BY ct.category`,
        params
      );

      const byCategory: Record<string, { score: number; count: number }> = {};
      for (const row of categoryResult.rows) {
        byCategory[row.category] = {
          score: parseFloat(row.avg_score) || 0,
          count: parseInt(row.count, 10),
        };
      }

      return {
        overallScore: parseFloat(stats.avg_score) || 100,
        totalChecks: parseInt(stats.total, 10),
        passedChecks: parseInt(stats.passed, 10),
        failedChecks: parseInt(stats.failed, 10),
        pendingChecks: parseInt(stats.pending, 10),
        byCategory,
      };
    });
  }

  /**
   * Get compliance dashboard summary
   */
  public async getDashboard(
    tenantId: string,
    locationId?: string,
    period: string = '30d'
  ): Promise<{
    complianceScore: number;
    checksToday: number;
    checksDue: number;
    openActions: number;
    criticalAlerts: number;
    recentChecks: ComplianceCheck[];
    equipmentAlerts: unknown[];
  }> {
    const periodDays = period === '7d' ? 7 : period === '90d' ? 90 : 30;

    return runInTenantContext(this.pool, tenantId, async (client) => {
      let whereClause = `WHERE tenant_id = $1`;
      const params: unknown[] = [tenantId];

      if (locationId) {
        whereClause += ` AND location_id = $2`;
        params.push(locationId);
      }

      // Get compliance score
      const scoreResult = await client.query(
        `SELECT AVG(score) as avg_score
         FROM compliance_checks
         ${whereClause} AND score IS NOT NULL AND created_at >= NOW() - INTERVAL '${periodDays} days'`,
        params
      );

      // Get checks completed today
      const todayResult = await client.query(
        `SELECT COUNT(*) as count
         FROM compliance_checks
         ${whereClause} AND DATE(completed_at) = CURRENT_DATE`,
        params
      );

      // Get checks due (pending or overdue)
      const dueResult = await client.query(
        `SELECT COUNT(*) as count
         FROM compliance_checks
         ${whereClause} AND status IN ('pending', 'in_progress')`,
        params
      );

      // Get open corrective actions
      const actionsResult = await client.query(
        `SELECT COUNT(*) as count
         FROM corrective_actions
         ${whereClause} AND status IN ('open', 'in_progress')`,
        params
      );

      // Get critical alerts (failed checks in last 24 hours)
      const alertsResult = await client.query(
        `SELECT COUNT(*) as count
         FROM compliance_checks
         ${whereClause} AND status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours'`,
        params
      );

      // Get recent checks
      const recentResult = await client.query(
        `SELECT cc.*, ct.name as template_name, ct.category
         FROM compliance_checks cc
         LEFT JOIN compliance_templates ct ON cc.template_id = ct.id
         ${whereClause.replace('tenant_id', 'cc.tenant_id')}
         ORDER BY cc.created_at DESC
         LIMIT 10`,
        params
      );

      return {
        complianceScore: parseFloat(scoreResult.rows[0]?.avg_score) || 100,
        checksToday: parseInt(todayResult.rows[0]?.count, 10) || 0,
        checksDue: parseInt(dueResult.rows[0]?.count, 10) || 0,
        openActions: parseInt(actionsResult.rows[0]?.count, 10) || 0,
        criticalAlerts: parseInt(alertsResult.rows[0]?.count, 10) || 0,
        recentChecks: recentResult.rows,
        equipmentAlerts: [],
      };
    });
  }

  /**
   * Get overdue checks
   */
  public async getOverdueChecks(tenantId: string): Promise<ComplianceCheck[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT id, tenant_id as "tenantId", location_id as "locationId",
                template_id as "templateId", user_id as "userId",
                check_type as "checkType", status, scheduled_at as "scheduledAt",
                started_at as "startedAt", completed_at as "completedAt",
                responses, score, signature_url as "signatureUrl",
                gps_location as "gpsLocation", device_info as "deviceInfo",
                created_at as "createdAt"
         FROM compliance_checks
         WHERE tenant_id = $1
           AND status = 'pending'
           AND scheduled_at < NOW()
         ORDER BY scheduled_at`,
        [tenantId]
      );
      return result.rows;
    });
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /**
   * Calculate check score based on responses
   */
  private calculateCheckScore(
    responses: SubmitCheckDTO['responses'],
    checklistItems: ComplianceTemplate['checklistItems']
  ): { score: number; hasCriticalFailure: boolean } {
    if (checklistItems.length === 0) {
      return { score: 100, hasCriticalFailure: false };
    }

    let totalPoints = 0;
    let earnedPoints = 0;
    let hasCriticalFailure = false;

    const itemMap = new Map(checklistItems.map((item) => [item.id, item]));

    for (const response of responses) {
      const item = itemMap.get(response.itemId);
      if (!item) continue;

      const weight = item.critical ? 2 : 1;
      totalPoints += weight;

      // Determine if response is a "pass"
      let passed = true;
      if (item.type === 'boolean') {
        passed = response.value === true;
      } else if (item.type === 'number') {
        // For temperature checks, this would need context about limits
        passed = response.value !== null && response.value !== undefined;
      }

      if (passed) {
        earnedPoints += weight;
      } else if (item.critical) {
        hasCriticalFailure = true;
      }
    }

    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 100;

    return { score: Math.round(score * 100) / 100, hasCriticalFailure };
  }

  /**
   * Log to compliance audit ledger
   */
  private async logToAuditLedger(
    client: import('pg').PoolClient,
    tenantId: string,
    data: {
      entityType: string;
      entityId: string;
      action: string;
      changes: Record<string, unknown>;
      actorId: string;
    }
  ): Promise<void> {
    const previousHash = await this.getLastAuditHash(client, tenantId, data.entityType, data.entityId);
    const currentHash = this.computeAuditHash(data, previousHash);

    await client.query(
      `INSERT INTO compliance_audit_ledger
       (tenant_id, entity_type, entity_id, action, previous_hash, current_hash, changes, actor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tenantId,
        data.entityType,
        data.entityId,
        data.action,
        previousHash,
        currentHash,
        JSON.stringify(data.changes),
        data.actorId,
      ]
    );
  }

  /**
   * Get the last audit hash for chain verification
   */
  private async getLastAuditHash(
    client: import('pg').PoolClient,
    tenantId: string,
    entityType: string,
    entityId: string
  ): Promise<string | null> {
    const result = await client.query(
      `SELECT current_hash
       FROM compliance_audit_ledger
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenantId, entityType, entityId]
    );
    return result.rows[0]?.current_hash || null;
  }

  /**
   * Compute audit hash for tamper detection
   */
  private computeAuditHash(
    data: { changes: Record<string, unknown> },
    previousHash: string | null
  ): string {
    const crypto = require('crypto');
    const content = JSON.stringify({ data: data.changes, prev: previousHash });
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
