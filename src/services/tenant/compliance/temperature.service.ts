/**
 * Temperature Service
 *
 * Temperature monitoring and breach detection for HACCP compliance.
 * Handles manual logging and IoT sensor integration.
 */

import { Pool } from 'pg';
import { runInTenantContext } from '../../../lib/db-context';
import { logger } from '../../logger.service';
import { addJob } from '../../queue';

// Types
export interface TemperatureLog {
  id: string;
  tenantId: string;
  locationId: string;
  equipmentId: string | null;
  userId: string | null;
  readingCelsius: number;
  readingType: 'fridge' | 'freezer' | 'hot_holding' | 'cooking' | 'delivery' | 'ambient' | 'probe';
  itemName: string | null;
  isWithinLimits: boolean;
  lowerLimit: number | null;
  upperLimit: number | null;
  correctiveActionTaken: string | null;
  photoUrl: string | null;
  source: 'manual' | 'iot_sensor' | 'bluetooth_probe';
  sensorId: string | null;
  recordedAt: Date;
  createdAt: Date;
}

export interface Equipment {
  id: string;
  tenantId: string;
  locationId: string;
  name: string;
  equipmentType: 'fridge' | 'freezer' | 'hot_holding' | 'probe' | 'dishwasher' | 'oven' | 'grill' | 'other';
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  tempLowerLimit: number | null;
  tempUpperLimit: number | null;
  calibrationDueDate: Date | null;
  lastServiceDate: Date | null;
  nextServiceDate: Date | null;
  status: 'active' | 'maintenance' | 'retired';
  iotDeviceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface LogTemperatureDTO {
  locationId: string;
  equipmentId?: string;
  userId?: string;
  readingCelsius: number;
  readingType: TemperatureLog['readingType'];
  itemName?: string;
  lowerLimit?: number;
  upperLimit?: number;
  correctiveActionTaken?: string;
  photoUrl?: string;
  source?: TemperatureLog['source'];
  sensorId?: string;
  recordedAt?: Date;
}

export interface TemperatureFilters {
  locationId?: string;
  equipmentId?: string;
  readingType?: TemperatureLog['readingType'];
  onlyBreaches?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// Default temperature limits by type (Celsius)
const DEFAULT_LIMITS: Record<string, { lower: number; upper: number }> = {
  fridge: { lower: 1, upper: 5 },
  freezer: { lower: -25, upper: -18 },
  hot_holding: { lower: 63, upper: 90 },
  cooking: { lower: 75, upper: 100 },
  delivery: { lower: 1, upper: 8 },
  ambient: { lower: 15, upper: 25 },
  probe: { lower: -50, upper: 150 },
};

export class TemperatureService {
  constructor(private pool: Pool) {}

  // ============================================================
  // TEMPERATURE LOGGING
  // ============================================================

  /**
   * Log a temperature reading
   */
  public async logTemperature(tenantId: string, data: LogTemperatureDTO): Promise<TemperatureLog> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Get equipment limits if equipmentId provided
      let lowerLimit = data.lowerLimit;
      let upperLimit = data.upperLimit;
      let equipmentName: string | null = null;

      if (data.equipmentId) {
        const equipmentResult = await client.query(
          `SELECT name, temp_lower_limit, temp_upper_limit
           FROM equipment
           WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
          [tenantId, data.equipmentId]
        );

        if (equipmentResult.rows[0]) {
          const equipment = equipmentResult.rows[0];
          equipmentName = equipment.name;
          lowerLimit = lowerLimit ?? equipment.temp_lower_limit;
          upperLimit = upperLimit ?? equipment.temp_upper_limit;
        }
      }

      // Use default limits if not specified
      if (lowerLimit === undefined || upperLimit === undefined) {
        const defaults = DEFAULT_LIMITS[data.readingType] || DEFAULT_LIMITS.probe;
        lowerLimit = lowerLimit ?? defaults.lower;
        upperLimit = upperLimit ?? defaults.upper;
      }

      // Check if within limits
      const isWithinLimits =
        data.readingCelsius >= lowerLimit && data.readingCelsius <= upperLimit;

      const result = await client.query(
        `INSERT INTO temperature_logs
         (tenant_id, location_id, equipment_id, user_id, reading_celsius,
          reading_type, item_name, is_within_limits, lower_limit, upper_limit,
          corrective_action_taken, photo_url, source, sensor_id, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   equipment_id as "equipmentId", user_id as "userId",
                   reading_celsius as "readingCelsius", reading_type as "readingType",
                   item_name as "itemName", is_within_limits as "isWithinLimits",
                   lower_limit as "lowerLimit", upper_limit as "upperLimit",
                   corrective_action_taken as "correctiveActionTaken",
                   photo_url as "photoUrl", source, sensor_id as "sensorId",
                   recorded_at as "recordedAt", created_at as "createdAt"`,
        [
          tenantId,
          data.locationId,
          data.equipmentId || null,
          data.userId || null,
          data.readingCelsius,
          data.readingType,
          data.itemName || null,
          isWithinLimits,
          lowerLimit,
          upperLimit,
          data.correctiveActionTaken || null,
          data.photoUrl || null,
          data.source || 'manual',
          data.sensorId || null,
          data.recordedAt || new Date(),
        ]
      );

      const log = result.rows[0];

      logger.info('Temperature logged', {
        tenantId,
        logId: log.id,
        reading: data.readingCelsius,
        type: data.readingType,
        isWithinLimits,
      });

      // If breach detected, queue alert job
      if (!isWithinLimits) {
        await addJob('compliance.temperature.breach', {
          tenantId,
          locationId: data.locationId,
          equipmentId: data.equipmentId || '',
          equipmentName: equipmentName || data.readingType,
          readingCelsius: data.readingCelsius,
          limitExceeded: data.readingCelsius < lowerLimit ? 'lower' : 'upper',
          limitValue: data.readingCelsius < lowerLimit ? lowerLimit : upperLimit,
          temperatureLogId: log.id,
        });

        logger.warn('Temperature breach detected', {
          tenantId,
          logId: log.id,
          reading: data.readingCelsius,
          limits: { lower: lowerLimit, upper: upperLimit },
        });
      }

      return log;
    });
  }

  /**
   * Get temperature logs with filters
   */
  public async getTemperatureLogs(
    tenantId: string,
    filters: TemperatureFilters
  ): Promise<{ logs: TemperatureLog[]; total: number }> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      let whereClause = 'WHERE tenant_id = $1';
      const params: unknown[] = [tenantId];
      let paramIndex = 2;

      if (filters.locationId) {
        whereClause += ` AND location_id = $${paramIndex++}`;
        params.push(filters.locationId);
      }
      if (filters.equipmentId) {
        whereClause += ` AND equipment_id = $${paramIndex++}`;
        params.push(filters.equipmentId);
      }
      if (filters.readingType) {
        whereClause += ` AND reading_type = $${paramIndex++}`;
        params.push(filters.readingType);
      }
      if (filters.onlyBreaches) {
        whereClause += ` AND is_within_limits = false`;
      }
      if (filters.startDate) {
        whereClause += ` AND recorded_at >= $${paramIndex++}`;
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereClause += ` AND recorded_at <= $${paramIndex++}`;
        params.push(filters.endDate);
      }

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM temperature_logs ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Get paginated results
      const limit = filters.limit || 100;
      const offset = filters.offset || 0;

      const result = await client.query(
        `SELECT id, tenant_id as "tenantId", location_id as "locationId",
                equipment_id as "equipmentId", user_id as "userId",
                reading_celsius as "readingCelsius", reading_type as "readingType",
                item_name as "itemName", is_within_limits as "isWithinLimits",
                lower_limit as "lowerLimit", upper_limit as "upperLimit",
                corrective_action_taken as "correctiveActionTaken",
                photo_url as "photoUrl", source, sensor_id as "sensorId",
                recorded_at as "recordedAt", created_at as "createdAt"
         FROM temperature_logs
         ${whereClause}
         ORDER BY recorded_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      return { logs: result.rows, total };
    });
  }

  /**
   * Get temperature breaches
   */
  public async getBreaches(
    tenantId: string,
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<{
    breaches: TemperatureLog[];
    summary: {
      total: number;
      byType: Record<string, number>;
      byEquipment: Record<string, number>;
    };
  }> {
    const periodDays = period === 'day' ? 1 : period === 'week' ? 7 : 30;

    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `SELECT tl.id, tl.tenant_id as "tenantId", tl.location_id as "locationId",
                tl.equipment_id as "equipmentId", tl.user_id as "userId",
                tl.reading_celsius as "readingCelsius", tl.reading_type as "readingType",
                tl.item_name as "itemName", tl.is_within_limits as "isWithinLimits",
                tl.lower_limit as "lowerLimit", tl.upper_limit as "upperLimit",
                tl.corrective_action_taken as "correctiveActionTaken",
                tl.photo_url as "photoUrl", tl.source, tl.sensor_id as "sensorId",
                tl.recorded_at as "recordedAt", tl.created_at as "createdAt",
                e.name as equipment_name
         FROM temperature_logs tl
         LEFT JOIN equipment e ON tl.equipment_id = e.id
         WHERE tl.tenant_id = $1
           AND tl.is_within_limits = false
           AND tl.recorded_at >= NOW() - INTERVAL '${periodDays} days'
         ORDER BY tl.recorded_at DESC`,
        [tenantId]
      );

      // Calculate summary
      const byType: Record<string, number> = {};
      const byEquipment: Record<string, number> = {};

      for (const breach of result.rows) {
        byType[breach.readingType] = (byType[breach.readingType] || 0) + 1;
        if (breach.equipment_name) {
          byEquipment[breach.equipment_name] = (byEquipment[breach.equipment_name] || 0) + 1;
        }
      }

      return {
        breaches: result.rows,
        summary: {
          total: result.rows.length,
          byType,
          byEquipment,
        },
      };
    });
  }

  // ============================================================
  // EQUIPMENT MANAGEMENT
  // ============================================================

  /**
   * Get all equipment for a location
   */
  public async getEquipment(tenantId: string, locationId?: string): Promise<Equipment[]> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      let query = `
        SELECT id, tenant_id as "tenantId", location_id as "locationId",
               name, equipment_type as "equipmentType", serial_number as "serialNumber",
               manufacturer, model, temp_lower_limit as "tempLowerLimit",
               temp_upper_limit as "tempUpperLimit",
               calibration_due_date as "calibrationDueDate",
               last_service_date as "lastServiceDate",
               next_service_date as "nextServiceDate",
               status, iot_device_id as "iotDeviceId", metadata,
               created_at as "createdAt", updated_at as "updatedAt"
        FROM equipment
        WHERE tenant_id = $1 AND deleted_at IS NULL
      `;
      const params: unknown[] = [tenantId];

      if (locationId) {
        query += ` AND location_id = $2`;
        params.push(locationId);
      }

      query += ` ORDER BY name`;

      const result = await client.query(query, params);
      return result.rows;
    });
  }

  /**
   * Create new equipment
   */
  public async createEquipment(
    tenantId: string,
    data: {
      locationId: string;
      name: string;
      equipmentType: Equipment['equipmentType'];
      serialNumber?: string;
      manufacturer?: string;
      model?: string;
      tempLowerLimit?: number;
      tempUpperLimit?: number;
      iotDeviceId?: string;
    }
  ): Promise<Equipment> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Use default limits if not provided
      const defaults = DEFAULT_LIMITS[data.equipmentType] || DEFAULT_LIMITS.fridge;
      const lowerLimit = data.tempLowerLimit ?? defaults.lower;
      const upperLimit = data.tempUpperLimit ?? defaults.upper;

      const result = await client.query(
        `INSERT INTO equipment
         (tenant_id, location_id, name, equipment_type, serial_number,
          manufacturer, model, temp_lower_limit, temp_upper_limit, iot_device_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   name, equipment_type as "equipmentType", serial_number as "serialNumber",
                   manufacturer, model, temp_lower_limit as "tempLowerLimit",
                   temp_upper_limit as "tempUpperLimit",
                   calibration_due_date as "calibrationDueDate",
                   last_service_date as "lastServiceDate",
                   next_service_date as "nextServiceDate",
                   status, iot_device_id as "iotDeviceId", metadata,
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [
          tenantId,
          data.locationId,
          data.name,
          data.equipmentType,
          data.serialNumber || null,
          data.manufacturer || null,
          data.model || null,
          lowerLimit,
          upperLimit,
          data.iotDeviceId || null,
        ]
      );

      logger.info('Equipment created', {
        tenantId,
        equipmentId: result.rows[0].id,
        name: data.name,
      });

      return result.rows[0];
    });
  }

  /**
   * Update equipment
   */
  public async updateEquipment(
    tenantId: string,
    equipmentId: string,
    data: Partial<{
      name: string;
      equipmentType: Equipment['equipmentType'];
      serialNumber: string;
      manufacturer: string;
      model: string;
      tempLowerLimit: number;
      tempUpperLimit: number;
      calibrationDueDate: Date;
      lastServiceDate: Date;
      nextServiceDate: Date;
      status: Equipment['status'];
      iotDeviceId: string;
    }>
  ): Promise<Equipment | null> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      const fieldMap: Record<string, string> = {
        name: 'name',
        equipmentType: 'equipment_type',
        serialNumber: 'serial_number',
        manufacturer: 'manufacturer',
        model: 'model',
        tempLowerLimit: 'temp_lower_limit',
        tempUpperLimit: 'temp_upper_limit',
        calibrationDueDate: 'calibration_due_date',
        lastServiceDate: 'last_service_date',
        nextServiceDate: 'next_service_date',
        status: 'status',
        iotDeviceId: 'iot_device_id',
      };

      for (const [key, column] of Object.entries(fieldMap)) {
        if (data[key as keyof typeof data] !== undefined) {
          setClauses.push(`${column} = $${paramIndex++}`);
          values.push(data[key as keyof typeof data]);
        }
      }

      if (setClauses.length === 0) {
        return null;
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(tenantId, equipmentId);

      const result = await client.query(
        `UPDATE equipment
         SET ${setClauses.join(', ')}
         WHERE tenant_id = $${paramIndex} AND id = $${paramIndex + 1} AND deleted_at IS NULL
         RETURNING id, tenant_id as "tenantId", location_id as "locationId",
                   name, equipment_type as "equipmentType", serial_number as "serialNumber",
                   manufacturer, model, temp_lower_limit as "tempLowerLimit",
                   temp_upper_limit as "tempUpperLimit",
                   calibration_due_date as "calibrationDueDate",
                   last_service_date as "lastServiceDate",
                   next_service_date as "nextServiceDate",
                   status, iot_device_id as "iotDeviceId", metadata,
                   created_at as "createdAt", updated_at as "updatedAt"`,
        values
      );

      if (result.rows[0]) {
        logger.info('Equipment updated', { tenantId, equipmentId });
      }

      return result.rows[0] || null;
    });
  }

  /**
   * Delete equipment (soft delete)
   */
  public async deleteEquipment(tenantId: string, equipmentId: string): Promise<boolean> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE equipment
         SET deleted_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [tenantId, equipmentId]
      );

      if (result.rowCount && result.rowCount > 0) {
        logger.info('Equipment deleted', { tenantId, equipmentId });
        return true;
      }
      return false;
    });
  }

  /**
   * Get equipment status summary
   */
  public async getEquipmentStatus(
    tenantId: string,
    locationId: string
  ): Promise<Array<Equipment & { lastReading?: TemperatureLog; alertStatus: 'ok' | 'warning' | 'critical' }>> {
    return runInTenantContext(this.pool, tenantId, async (client) => {
      // Get equipment with latest readings
      const result = await client.query(
        `WITH latest_readings AS (
           SELECT DISTINCT ON (equipment_id)
             equipment_id,
             reading_celsius,
             is_within_limits,
             recorded_at
           FROM temperature_logs
           WHERE tenant_id = $1 AND location_id = $2
           ORDER BY equipment_id, recorded_at DESC
         )
         SELECT e.id, e.tenant_id as "tenantId", e.location_id as "locationId",
                e.name, e.equipment_type as "equipmentType",
                e.serial_number as "serialNumber",
                e.manufacturer, e.model,
                e.temp_lower_limit as "tempLowerLimit",
                e.temp_upper_limit as "tempUpperLimit",
                e.calibration_due_date as "calibrationDueDate",
                e.last_service_date as "lastServiceDate",
                e.next_service_date as "nextServiceDate",
                e.status, e.iot_device_id as "iotDeviceId", e.metadata,
                e.created_at as "createdAt", e.updated_at as "updatedAt",
                lr.reading_celsius as last_reading_celsius,
                lr.is_within_limits as last_reading_within_limits,
                lr.recorded_at as last_reading_at
         FROM equipment e
         LEFT JOIN latest_readings lr ON e.id = lr.equipment_id
         WHERE e.tenant_id = $1 AND e.location_id = $2 AND e.deleted_at IS NULL
         ORDER BY e.name`,
        [tenantId, locationId]
      );

      return result.rows.map((row) => {
        let alertStatus: 'ok' | 'warning' | 'critical' = 'ok';

        // Check if last reading is a breach
        if (row.last_reading_within_limits === false) {
          alertStatus = 'critical';
        }
        // Check if no reading in last hour for IoT equipment
        else if (row.iotDeviceId && row.last_reading_at) {
          const lastReadingAge = Date.now() - new Date(row.last_reading_at).getTime();
          if (lastReadingAge > 3600000) {
            // 1 hour
            alertStatus = 'warning';
          }
        }
        // Check calibration due
        else if (row.calibrationDueDate && new Date(row.calibrationDueDate) < new Date()) {
          alertStatus = 'warning';
        }

        return {
          ...row,
          lastReading: row.last_reading_celsius
            ? {
                readingCelsius: row.last_reading_celsius,
                isWithinLimits: row.last_reading_within_limits,
                recordedAt: row.last_reading_at,
              }
            : undefined,
          alertStatus,
        };
      });
    });
  }
}
