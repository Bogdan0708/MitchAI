/**
 * AUDIT SERVICE
 *
 * Centralized audit logging for security and compliance.
 * Tracks all significant actions for security monitoring and GDPR compliance.
 */

import { Pool } from 'pg';
import { Request } from 'express';

// ============================================================================
// TYPES
// ============================================================================

export interface AuditEvent {
  tenantId?: string;
  userId?: string;
  action: AuditAction;
  entityType?: EntityType;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

// Categorized audit actions
export type AuditAction =
  // Authentication
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.password_reset_requested'
  | 'auth.password_reset_completed'
  | 'auth.token_refreshed'
  // User management
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.role_changed'
  | 'user.invited'
  // Tenant/Business
  | 'tenant.settings_updated'
  | 'tenant.subscription_changed'
  | 'tenant.billing_updated'
  // Data operations
  | 'menu.item_created'
  | 'menu.item_updated'
  | 'menu.item_deleted'
  | 'menu.category_created'
  | 'menu.category_deleted'
  | 'order.created'
  | 'order.status_changed'
  | 'order.cancelled'
  | 'order.refunded'
  // Integrations
  | 'integration.connected'
  | 'integration.disconnected'
  | 'integration.sync_started'
  | 'integration.sync_completed'
  // Security events
  | 'security.rate_limit_exceeded'
  | 'security.suspicious_activity'
  | 'security.api_key_created'
  | 'security.api_key_revoked'
  // Data export (GDPR)
  | 'data.export_requested'
  | 'data.export_completed'
  | 'data.deletion_requested'
  // Admin actions
  | 'admin.impersonation_started'
  | 'admin.impersonation_ended'
  // Generic
  | 'api.request'
  | 'error.unhandled';

export type EntityType =
  | 'user'
  | 'tenant'
  | 'menu_item'
  | 'menu_category'
  | 'order'
  | 'reservation'
  | 'review'
  | 'integration'
  | 'subscription'
  | 'api_key';

// ============================================================================
// AUDIT SERVICE CLASS
// ============================================================================

export class AuditService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Log an audit event
   */
  async log(event: AuditEvent): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO audit_logs 
          (tenant_id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          event.tenantId || null,
          event.userId || null,
          event.action,
          event.entityType || null,
          event.entityId || null,
          event.oldValues ? JSON.stringify(event.oldValues) : null,
          event.newValues ? JSON.stringify(event.newValues) : null,
          event.ipAddress || null,
          event.userAgent || null,
          JSON.stringify(event.metadata || {}),
        ]
      );
    } catch (error) {
      // Don't throw - audit failures shouldn't break the app
      console.error('[AuditService] Failed to log event:', error);
    }
  }

  /**
   * Log from Express request context
   */
  async logFromRequest(
    req: Request,
    action: AuditAction,
    options: Partial<AuditEvent> = {}
  ): Promise<void> {
    await this.log({
      tenantId: req.tenant?.tenantId,
      userId: req.tenant?.userId,
      action,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      ...options,
    });
  }

  /**
   * Log authentication event
   */
  async logAuth(
    action: 'auth.login' | 'auth.login_failed' | 'auth.logout',
    req: Request,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      tenantId: req.tenant?.tenantId,
      userId,
      action,
      entityType: 'user',
      entityId: userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        ...metadata,
        email: req.body?.email, // Don't log password!
      },
    });
  }

  /**
   * Log data change with before/after values
   */
  async logChange(
    req: Request,
    action: AuditAction,
    entityType: EntityType,
    entityId: string,
    oldValues: Record<string, any> | null,
    newValues: Record<string, any> | null
  ): Promise<void> {
    // Redact sensitive fields
    const redact = (obj: Record<string, any> | null) => {
      if (!obj) return null;
      const redacted = { ...obj };
      const sensitiveFields = ['password', 'password_hash', 'token', 'secret', 'api_key'];
      sensitiveFields.forEach(field => {
        if (field in redacted) redacted[field] = '[REDACTED]';
      });
      return redacted;
    };

    await this.log({
      tenantId: req.tenant?.tenantId,
      userId: req.tenant?.userId,
      action,
      entityType,
      entityId,
      oldValues: redact(oldValues) || undefined,
      newValues: redact(newValues) || undefined,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /**
   * Log security event
   */
  async logSecurity(
    action: 'security.rate_limit_exceeded' | 'security.suspicious_activity',
    req: Request,
    metadata: Record<string, any>
  ): Promise<void> {
    await this.log({
      tenantId: req.tenant?.tenantId,
      userId: req.tenant?.userId,
      action,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata,
    });
  }

  /**
   * Query audit logs for a tenant
   */
  async getAuditLogs(
    tenantId: string,
    options: {
      action?: string;
      userId?: string;
      entityType?: string;
      entityId?: string;
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ logs: any[]; total: number }> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (options.action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(options.action);
    }
    if (options.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(options.userId);
    }
    if (options.entityType) {
      conditions.push(`entity_type = $${paramIndex++}`);
      params.push(options.entityType);
    }
    if (options.entityId) {
      conditions.push(`entity_id = $${paramIndex++}`);
      params.push(options.entityId);
    }
    if (options.fromDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(options.fromDate);
    }
    if (options.toDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(options.toDate);
    }

    const whereClause = conditions.join(' AND ');
    const limit = Math.min(options.limit || 50, 100);
    const offset = options.offset || 0;

    const [logsResult, countResult] = await Promise.all([
      this.pool.query(
        `SELECT id, user_id, action, entity_type, entity_id, old_values, new_values, 
                ip_address, user_agent, metadata, created_at
         FROM audit_logs 
         WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
      this.pool.query(
        `SELECT COUNT(*) FROM audit_logs WHERE ${whereClause}`,
        params
      ),
    ]);

    return {
      logs: logsResult.rows,
      total: parseInt(countResult.rows[0].count),
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let auditServiceInstance: AuditService | null = null;

export function initAuditService(pool: Pool): AuditService {
  auditServiceInstance = new AuditService(pool);
  return auditServiceInstance;
}

export function getAuditService(): AuditService {
  if (!auditServiceInstance) {
    throw new Error('AuditService not initialized. Call initAuditService first.');
  }
  return auditServiceInstance;
}

export default AuditService;
