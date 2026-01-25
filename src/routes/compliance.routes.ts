/**
 * COMPLIANCE ROUTES
 *
 * API endpoints for food safety and compliance management
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { validate } from '../middleware/validate.middleware';
import { apiResponse } from '../lib/api-response';
import {
  ComplianceService,
  TemperatureService,
  CorrectiveActionsService,
} from '../services/tenant/compliance';
import {
  createTemplateSchema,
  updateTemplateSchema,
  createCheckSchema,
  submitCheckSchema,
  listChecksSchema,
  createTemperatureLogSchema,
  listTemperatureLogsSchema,
  createEquipmentSchema,
  updateEquipmentSchema,
  createCorrectiveActionSchema,
  updateCorrectiveActionSchema,
  resolveCorrectiveActionSchema,
  // Unused schemas - kept for future implementation
  // createSupplierSchema,
  // updateSupplierSchema,
  // createDeliveryLogSchema,
  // updateAllergenMatrixSchema,
  // createTrainingRecordSchema,
  // updateTrainingRecordSchema,
  complianceDashboardSchema,
  exportComplianceReportSchema,
} from '../validators/compliance.validator';

export function createComplianceRouter(pool: Pool): Router {
  const router = Router();

  const complianceService = new ComplianceService(pool);
  const temperatureService = new TemperatureService(pool);
  const correctiveActionsService = new CorrectiveActionsService(pool);

  // ============================================================================
  // TEMPLATES
  // ============================================================================

  // List templates
  router.get('/templates', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const locationId = req.query.location_id as string | undefined;

      const templates = await complianceService.getTemplates(tenantId, locationId);
      return apiResponse.success(res, templates);
    } catch (error) {
      console.error('List templates error:', error);
      return apiResponse.serverError(res, 'Failed to list templates');
    }
  });

  // Create template
  router.post('/templates', validate(createTemplateSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const template = await complianceService.createTemplate(tenantId, req.body);
      return apiResponse.created(res, template);
    } catch (error) {
      console.error('Create template error:', error);
      return apiResponse.serverError(res, 'Failed to create template');
    }
  });

  // Get template by ID
  router.get('/templates/:id', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const template = await complianceService.getTemplateById(tenantId, req.params.id);

      if (!template) {
        return apiResponse.notFound(res, 'Template not found');
      }

      return apiResponse.success(res, template);
    } catch (error) {
      console.error('Get template error:', error);
      return apiResponse.serverError(res, 'Failed to get template');
    }
  });

  // Update template
  router.patch('/templates/:id', validate(updateTemplateSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const template = await complianceService.updateTemplate(
        tenantId,
        req.params.id,
        req.body
      );

      if (!template) {
        return apiResponse.notFound(res, 'Template not found');
      }

      return apiResponse.success(res, template);
    } catch (error) {
      console.error('Update template error:', error);
      return apiResponse.serverError(res, 'Failed to update template');
    }
  });

  // Delete template (soft delete)
  router.delete('/templates/:id', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const deleted = await complianceService.deleteTemplate(tenantId, req.params.id);

      if (!deleted) {
        return apiResponse.notFound(res, 'Template not found');
      }

      return apiResponse.success(res, { message: 'Template deleted' });
    } catch (error) {
      console.error('Delete template error:', error);
      return apiResponse.serverError(res, 'Failed to delete template');
    }
  });

  // ============================================================================
  // COMPLIANCE CHECKS
  // ============================================================================

  // List checks
  router.get('/checks', validate(listChecksSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const filters = {
        locationId: req.query.location_id as string | undefined,
        status: req.query.status as 'pending' | 'in_progress' | 'passed' | 'failed' | 'corrective_action' | undefined,
        checkType: req.query.check_type as string | undefined,
        startDate: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
        endDate: req.query.end_date ? new Date(req.query.end_date as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      };

      const result = await complianceService.getCheckHistory(tenantId, filters);
      return apiResponse.success(res, result);
    } catch (error) {
      console.error('List checks error:', error);
      return apiResponse.serverError(res, 'Failed to list checks');
    }
  });

  // Get scheduled checks for today
  router.get('/checks/scheduled', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const locationId = req.query.location_id as string;
      const date = req.query.date ? new Date(req.query.date as string) : new Date();

      if (!locationId) {
        return apiResponse.badRequest(res, 'location_id is required');
      }

      const checks = await complianceService.getScheduledChecks(tenantId, locationId, date);
      return apiResponse.success(res, checks);
    } catch (error) {
      console.error('Get scheduled checks error:', error);
      return apiResponse.serverError(res, 'Failed to get scheduled checks');
    }
  });

  // Create ad-hoc check
  router.post('/checks', validate(createCheckSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const userId = req.tenant!.userId;

      const check = await complianceService.createCheck(tenantId, { ...req.body, userId });
      return apiResponse.created(res, check);
    } catch (error) {
      console.error('Create check error:', error);
      return apiResponse.serverError(res, 'Failed to create check');
    }
  });

  // Get check by ID
  router.get('/checks/:id', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const check = await complianceService.getCheckById(tenantId, req.params.id);

      if (!check) {
        return apiResponse.notFound(res, 'Check not found');
      }

      return apiResponse.success(res, check);
    } catch (error) {
      console.error('Get check error:', error);
      return apiResponse.serverError(res, 'Failed to get check');
    }
  });

  // Start a check
  router.post('/checks/:id/start', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const userId = req.tenant!.userId;

      const check = await complianceService.startCheck(tenantId, req.params.id, userId);

      if (!check) {
        return apiResponse.notFound(res, 'Check not found');
      }

      return apiResponse.success(res, check);
    } catch (error) {
      console.error('Start check error:', error);
      return apiResponse.serverError(res, 'Failed to start check');
    }
  });

  // Submit completed check
  router.post('/checks/:id/submit', validate(submitCheckSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const check = await complianceService.submitCheck(
        tenantId,
        req.params.id,
        req.body
      );

      if (!check) {
        return apiResponse.notFound(res, 'Check not found');
      }

      return apiResponse.success(res, check);
    } catch (error) {
      console.error('Submit check error:', error);
      return apiResponse.serverError(res, 'Failed to submit check');
    }
  });

  // ============================================================================
  // TEMPERATURE LOGS
  // ============================================================================

  // List temperature logs
  router.get('/temperature', validate(listTemperatureLogsSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const filters = {
        locationId: req.query.location_id as string | undefined,
        equipmentId: req.query.equipment_id as string | undefined,
        readingType: req.query.reading_type as 'fridge' | 'freezer' | 'hot_holding' | 'cooking' | 'delivery' | 'ambient' | 'probe' | undefined,
        onlyBreaches: req.query.breaches_only === 'true',
        startDate: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
        endDate: req.query.end_date ? new Date(req.query.end_date as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      };

      const result = await temperatureService.getTemperatureLogs(tenantId, filters);
      return apiResponse.success(res, result);
    } catch (error) {
      console.error('List temperature logs error:', error);
      return apiResponse.serverError(res, 'Failed to list temperature logs');
    }
  });

  // Log temperature
  router.post('/temperature', validate(createTemperatureLogSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const log = await temperatureService.logTemperature(tenantId, req.body);
      return apiResponse.created(res, log);
    } catch (error) {
      console.error('Log temperature error:', error);
      return apiResponse.serverError(res, 'Failed to log temperature');
    }
  });

  // Get temperature breaches
  router.get('/temperature/breaches', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const periodParam = req.query.period as string | undefined;
      const periodMap: Record<string, 'day' | 'week' | 'month'> = {
        '1d': 'day', day: 'day',
        '7d': 'week', week: 'week',
        '30d': 'month', month: 'month',
      };
      const period = periodParam ? periodMap[periodParam] : 'week';

      const breaches = await temperatureService.getBreaches(tenantId, period);
      return apiResponse.success(res, breaches);
    } catch (error) {
      console.error('Get breaches error:', error);
      return apiResponse.serverError(res, 'Failed to get breaches');
    }
  });

  // Get equipment status
  router.get('/temperature/equipment', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const locationId = req.query.location_id as string;

      if (!locationId) {
        return apiResponse.badRequest(res, 'location_id is required');
      }

      const status = await temperatureService.getEquipmentStatus(tenantId, locationId);
      return apiResponse.success(res, status);
    } catch (error) {
      console.error('Get equipment status error:', error);
      return apiResponse.serverError(res, 'Failed to get equipment status');
    }
  });

  // ============================================================================
  // EQUIPMENT
  // ============================================================================

  // List equipment
  router.get('/equipment', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const locationId = req.query.location_id as string | undefined;

      const equipment = await temperatureService.getEquipment(tenantId, locationId);
      return apiResponse.success(res, equipment);
    } catch (error) {
      console.error('List equipment error:', error);
      return apiResponse.serverError(res, 'Failed to list equipment');
    }
  });

  // Create equipment
  router.post('/equipment', validate(createEquipmentSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const equipment = await temperatureService.createEquipment(tenantId, req.body);
      return apiResponse.created(res, equipment);
    } catch (error) {
      console.error('Create equipment error:', error);
      return apiResponse.serverError(res, 'Failed to create equipment');
    }
  });

  // Update equipment
  router.patch('/equipment/:id', validate(updateEquipmentSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const equipment = await temperatureService.updateEquipment(
        tenantId,
        req.params.id,
        req.body
      );

      if (!equipment) {
        return apiResponse.notFound(res, 'Equipment not found');
      }

      return apiResponse.success(res, equipment);
    } catch (error) {
      console.error('Update equipment error:', error);
      return apiResponse.serverError(res, 'Failed to update equipment');
    }
  });

  // Delete equipment (soft delete)
  router.delete('/equipment/:id', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const deleted = await temperatureService.deleteEquipment(tenantId, req.params.id);

      if (!deleted) {
        return apiResponse.notFound(res, 'Equipment not found');
      }

      return apiResponse.success(res, { message: 'Equipment deleted' });
    } catch (error) {
      console.error('Delete equipment error:', error);
      return apiResponse.serverError(res, 'Failed to delete equipment');
    }
  });

  // ============================================================================
  // CORRECTIVE ACTIONS
  // ============================================================================

  // List corrective actions
  router.get('/corrective-actions', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const filters = {
        locationId: req.query.location_id as string | undefined,
        status: req.query.status as 'open' | 'in_progress' | 'resolved' | 'verified' | undefined,
        severity: req.query.severity as 'low' | 'medium' | 'high' | 'critical' | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      };

      const result = await correctiveActionsService.getCorrectiveActions(tenantId, filters);
      return apiResponse.success(res, result);
    } catch (error) {
      console.error('List corrective actions error:', error);
      return apiResponse.serverError(res, 'Failed to list corrective actions');
    }
  });

  // Create corrective action
  router.post('/corrective-actions', validate(createCorrectiveActionSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const action = await correctiveActionsService.createCorrectiveAction(tenantId, req.body);
      return apiResponse.created(res, action);
    } catch (error) {
      console.error('Create corrective action error:', error);
      return apiResponse.serverError(res, 'Failed to create corrective action');
    }
  });

  // Update corrective action
  router.patch('/corrective-actions/:id', validate(updateCorrectiveActionSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const action = await correctiveActionsService.updateCorrectiveAction(
        tenantId,
        req.params.id,
        req.body
      );

      if (!action) {
        return apiResponse.notFound(res, 'Corrective action not found');
      }

      return apiResponse.success(res, action);
    } catch (error) {
      console.error('Update corrective action error:', error);
      return apiResponse.serverError(res, 'Failed to update corrective action');
    }
  });

  // Resolve corrective action
  router.post('/corrective-actions/:id/resolve', validate(resolveCorrectiveActionSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const userId = req.tenant!.userId;

      const action = await correctiveActionsService.resolveCorrectiveAction(
        tenantId,
        req.params.id,
        userId,
        req.body.verification_notes
      );

      if (!action) {
        return apiResponse.notFound(res, 'Corrective action not found');
      }

      return apiResponse.success(res, action);
    } catch (error) {
      console.error('Resolve corrective action error:', error);
      return apiResponse.serverError(res, 'Failed to resolve corrective action');
    }
  });

  // ============================================================================
  // DASHBOARD & REPORTS
  // ============================================================================

  // Get compliance dashboard
  router.get('/dashboard', validate(complianceDashboardSchema), async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const locationId = req.query.location_id as string | undefined;
      const period = (req.query.period as string) || '30d';

      const dashboard = await complianceService.getDashboard(tenantId, locationId, period);
      return apiResponse.success(res, dashboard);
    } catch (error) {
      console.error('Get dashboard error:', error);
      return apiResponse.serverError(res, 'Failed to get dashboard');
    }
  });

  // Get compliance score
  router.get('/score', async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const locationId = req.query.location_id as string | undefined;
      const periodParam = req.query.period as string | undefined;
      const periodMap: Record<string, 'day' | 'week' | 'month'> = {
        '1d': 'day', 'day': 'day',
        '7d': 'week', 'week': 'week',
        '30d': 'month', 'month': 'month',
      };
      const period = periodParam ? periodMap[periodParam] || 'month' : 'month';

      const score = await complianceService.getComplianceScore(tenantId, locationId, period);
      return apiResponse.success(res, score);
    } catch (error) {
      console.error('Get compliance score error:', error);
      return apiResponse.serverError(res, 'Failed to get compliance score');
    }
  });

  // Export compliance report - TODO: Implement exportReport method in ComplianceService
  router.post('/reports/export', validate(exportComplianceReportSchema), async (_req, res) => {
    try {
      // const tenantId = req.tenant!.tenantId;
      // const reportUrl = await complianceService.exportReport(tenantId, req.body);
      // return apiResponse.success(res, { url: reportUrl });
      return apiResponse.serverError(res, 'Export report feature not yet implemented');
    } catch (error) {
      console.error('Export report error:', error);
      return apiResponse.serverError(res, 'Failed to export report');
    }
  });

  return router;
}
