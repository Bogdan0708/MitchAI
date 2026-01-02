/**
 * DATA EXPORT SERVICE
 *
 * Handles tenant data exports for:
 * - GDPR compliance
 * - Data portability
 * - Backup purposes
 * - Migration support
 */

import { Pool, PoolClient } from 'pg';
import { createWriteStream, promises as fs } from 'fs';
import archiver from 'archiver';
import { Parser } from '@json2csv/plainjs';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ExportRequest {
  tenantId: string;
  requestedBy: string;
  exportType: 'full' | 'orders' | 'menu' | 'customers' | 'reservations';
  format: 'json' | 'csv' | 'sql';
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  includeDeleted?: boolean;
}

export interface ExportResult {
  exportId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileUrl?: string;
  fileSize?: number;
  expiresAt?: Date;
  error?: string;
}

// ============================================================================
// DATA EXPORT SERVICE
// ============================================================================

export class DataExportService {
  private pool: Pool;
  private s3Client: S3Client;
  private s3Bucket: string;
  private exportDir: string;

  constructor(
    pool: Pool,
    s3Config: { region: string; bucket: string },
    exportDir: string = '/tmp/exports'
  ) {
    this.pool = pool;
    this.s3Client = new S3Client({ region: s3Config.region });
    this.s3Bucket = s3Config.bucket;
    this.exportDir = exportDir;
  }

  /**
   * Request data export (asynchronous process)
   */
  async requestExport(request: ExportRequest): Promise<ExportResult> {
    const client = await this.pool.connect();
    try {
      // Create export record
      const result = await client.query(
        `INSERT INTO data_exports (
          tenant_id, requested_by, export_type, status,
          file_format, date_range_start, date_range_end,
          requested_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW() + INTERVAL '7 days')
        RETURNING id`,
        [
          request.tenantId,
          request.requestedBy,
          request.exportType,
          'pending',
          request.format,
          request.dateRangeStart,
          request.dateRangeEnd
        ]
      );

      const exportId = result.rows[0].id;

      // Process export asynchronously
      this.processExport(exportId, request).catch(err =>
        console.error(`Export ${exportId} failed:`, err)
      );

      return {
        exportId,
        status: 'pending'
      };
    } finally {
      client.release();
    }
  }

  /**
   * Process export in background
   */
  private async processExport(exportId: string, request: ExportRequest): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Update status to processing
      await client.query(
        'UPDATE data_exports SET status = $1 WHERE id = $2',
        ['processing', exportId]
      );

      // Export data based on type
      let filePath: string;
      switch (request.exportType) {
        case 'full':
          filePath = await this.exportFullData(client, request);
          break;
        case 'orders':
          filePath = await this.exportOrders(client, request);
          break;
        case 'menu':
          filePath = await this.exportMenu(client, request);
          break;
        case 'customers':
          filePath = await this.exportCustomers(client, request);
          break;
        case 'reservations':
          filePath = await this.exportReservations(client, request);
          break;
        default:
          throw new Error(`Unknown export type: ${request.exportType}`);
      }

      // Upload to S3
      const fileStats = await fs.stat(filePath);
      const s3Key = `exports/${request.tenantId}/${exportId}/${path.basename(filePath)}`;

      await this.uploadToS3(filePath, s3Key);

      // Generate presigned URL (7 days expiration)
      const fileUrl = `https://${this.s3Bucket}.s3.amazonaws.com/${s3Key}`;

      // Update export record
      await client.query(
        `UPDATE data_exports
        SET status = $1, file_url = $2, file_size_bytes = $3, completed_at = NOW()
        WHERE id = $4`,
        ['completed', fileUrl, fileStats.size, exportId]
      );

      // Cleanup local file
      await fs.unlink(filePath);

      // Send notification email
      await this.sendExportReadyEmail(client, exportId, request.tenantId);
    } catch (error) {
      // Update status to failed
      await client.query(
        `UPDATE data_exports SET status = $1, error_message = $2 WHERE id = $3`,
        ['failed', error instanceof Error ? error.message : 'Unknown error', exportId]
      );

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Export full tenant data (all tables)
   */
  private async exportFullData(client: PoolClient, request: ExportRequest): Promise<string> {
    const { tenantId, format } = request;
    const exportPath = path.join(this.exportDir, `${tenantId}-full-${Date.now()}`);

    await fs.mkdir(exportPath, { recursive: true });

    // Tables to export
    const tables = [
      'locations',
      'menu_categories',
      'menu_items',
      'tables',
      'reservations',
      'orders',
      'order_items',
      'tenant_users'
    ];

    if (format === 'json') {
      // Export each table as JSON
      for (const table of tables) {
        const data = await this.queryTable(client, tenantId, table, request);
        await fs.writeFile(
          path.join(exportPath, `${table}.json`),
          JSON.stringify(data, null, 2)
        );
      }

      // Create ZIP archive
      const zipPath = `${exportPath}.zip`;
      await this.createZipArchive(exportPath, zipPath);

      // Cleanup directory
      await fs.rm(exportPath, { recursive: true });

      return zipPath;
    } else if (format === 'csv') {
      // Export each table as CSV
      for (const table of tables) {
        const data = await this.queryTable(client, tenantId, table, request);
        const csv = this.jsonToCSV(data);
        await fs.writeFile(path.join(exportPath, `${table}.csv`), csv);
      }

      const zipPath = `${exportPath}.zip`;
      await this.createZipArchive(exportPath, zipPath);
      await fs.rm(exportPath, { recursive: true });

      return zipPath;
    } else if (format === 'sql') {
      // Generate SQL dump
      const sqlPath = `${exportPath}.sql`;
      await this.generateSQLDump(client, tenantId, tables, sqlPath, request);
      return sqlPath;
    }

    throw new Error(`Unsupported format: ${format}`);
  }

  /**
   * Export orders data
   */
  private async exportOrders(client: PoolClient, request: ExportRequest): Promise<string> {
    const { tenantId, format } = request;
    const filePath = path.join(
      this.exportDir,
      `${tenantId}-orders-${Date.now()}.${format}`
    );

    // Query orders with items
    const query = `
      SELECT
        o.id, o.order_number, o.order_type,
        o.customer_name, o.customer_email, o.customer_phone,
        o.subtotal, o.tax_amount, o.tip_amount, o.total_amount,
        o.status, o.payment_status, o.payment_method,
        o.created_at, o.updated_at,
        l.name as location_name,
        json_agg(
          json_build_object(
            'item_name', oi.item_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price
          )
        ) as items
      FROM orders o
      LEFT JOIN locations l ON o.location_id = l.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.tenant_id = $1
        ${request.dateRangeStart ? 'AND o.created_at >= $2' : ''}
        ${request.dateRangeEnd ? 'AND o.created_at <= $3' : ''}
      GROUP BY o.id, l.name
      ORDER BY o.created_at DESC
    `;

    const params: (string | Date)[] = [tenantId];
    if (request.dateRangeStart) params.push(request.dateRangeStart);
    if (request.dateRangeEnd) params.push(request.dateRangeEnd);

    const result = await client.query(query, params);
    const data = result.rows;

    if (format === 'json') {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } else if (format === 'csv') {
      // Flatten nested items for CSV
      const flatData = data.flatMap(order => {
        const baseOrder = { ...order };
        delete baseOrder.items;

        return order.items.map((item: any) => ({
          ...baseOrder,
          ...item
        }));
      });

      const csv = this.jsonToCSV(flatData);
      await fs.writeFile(filePath, csv);
    }

    return filePath;
  }

  /**
   * Export menu data
   */
  private async exportMenu(client: PoolClient, request: ExportRequest): Promise<string> {
    const { tenantId, format } = request;
    const filePath = path.join(
      this.exportDir,
      `${tenantId}-menu-${Date.now()}.${format}`
    );

    const query = `
      SELECT
        mi.id, mi.name, mi.description, mi.price,
        mi.sku, mi.is_available, mi.calories,
        mi.allergens, mi.image_url,
        mc.name as category_name,
        mi.created_at, mi.updated_at
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE mi.tenant_id = $1
      ${request.includeDeleted ? '' : 'AND mi.deleted_at IS NULL'}
      ORDER BY mc.sort_order, mi.sort_order
    `;

    const result = await client.query(query, [tenantId]);
    const data = result.rows;

    if (format === 'json') {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } else if (format === 'csv') {
      const csv = this.jsonToCSV(data);
      await fs.writeFile(filePath, csv);
    }

    return filePath;
  }

  /**
   * Export customer data (from orders and reservations)
   */
  private async exportCustomers(client: PoolClient, request: ExportRequest): Promise<string> {
    const { tenantId, format } = request;
    const filePath = path.join(
      this.exportDir,
      `${tenantId}-customers-${Date.now()}.${format}`
    );

    const query = `
      SELECT DISTINCT ON (email)
        COALESCE(o.customer_email, r.customer_email) as email,
        COALESCE(o.customer_name, r.customer_name) as name,
        COALESCE(o.customer_phone, r.customer_phone) as phone,
        COUNT(DISTINCT o.id) as order_count,
        SUM(o.total_amount) as total_spent,
        COUNT(DISTINCT r.id) as reservation_count,
        MIN(COALESCE(o.created_at, r.created_at)) as first_interaction,
        MAX(COALESCE(o.created_at, r.created_at)) as last_interaction
      FROM (
        SELECT customer_email as email, customer_name as name, customer_phone as phone, created_at FROM orders WHERE tenant_id = $1
        UNION ALL
        SELECT customer_email as email, customer_name as name, customer_phone as phone, created_at FROM reservations WHERE tenant_id = $1
      ) combined
      LEFT JOIN orders o ON COALESCE(combined.email, '') = COALESCE(o.customer_email, '') AND o.tenant_id = $1
      LEFT JOIN reservations r ON COALESCE(combined.email, '') = COALESCE(r.customer_email, '') AND r.tenant_id = $1
      WHERE COALESCE(combined.email, combined.phone) IS NOT NULL
      GROUP BY email, name, phone
      ORDER BY email, last_interaction DESC
    `;

    const result = await client.query(query, [tenantId]);
    const data = result.rows;

    if (format === 'json') {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } else if (format === 'csv') {
      const csv = this.jsonToCSV(data);
      await fs.writeFile(filePath, csv);
    }

    return filePath;
  }

  /**
   * Export reservations data
   */
  private async exportReservations(client: PoolClient, request: ExportRequest): Promise<string> {
    const { tenantId, format } = request;
    const filePath = path.join(
      this.exportDir,
      `${tenantId}-reservations-${Date.now()}.${format}`
    );

    const query = `
      SELECT
        r.id, r.customer_name, r.customer_email, r.customer_phone,
        r.party_size, r.reservation_date, r.reservation_time,
        r.status, r.special_requests,
        l.name as location_name,
        t.table_number,
        r.created_at, r.updated_at
      FROM reservations r
      LEFT JOIN locations l ON r.location_id = l.id
      LEFT JOIN tables t ON r.table_id = t.id
      WHERE r.tenant_id = $1
        ${request.dateRangeStart ? 'AND r.reservation_date >= $2' : ''}
        ${request.dateRangeEnd ? 'AND r.reservation_date <= $3' : ''}
      ORDER BY r.reservation_date DESC, r.reservation_time DESC
    `;

    const params: (string | Date)[] = [tenantId];
    if (request.dateRangeStart) params.push(request.dateRangeStart);
    if (request.dateRangeEnd) params.push(request.dateRangeEnd);

    const result = await client.query(query, params);
    const data = result.rows;

    if (format === 'json') {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } else if (format === 'csv') {
      const csv = this.jsonToCSV(data);
      await fs.writeFile(filePath, csv);
    }

    return filePath;
  }

  /**
   * Allowlist of valid table names for export (SQL injection prevention)
   */
  private static readonly ALLOWED_TABLES = new Set([
    'locations',
    'menu_categories',
    'menu_items',
    'tables',
    'reservations',
    'orders',
    'order_items',
    'tenant_users'
  ]);

  /**
   * Query table data for export
   *
   * SECURITY: Table name is validated against allowlist to prevent SQL injection
   */
  private async queryTable(
    client: PoolClient,
    tenantId: string,
    table: string,
    request: ExportRequest
  ): Promise<any[]> {
    // Validate table name against allowlist (SQL injection prevention)
    if (!DataExportService.ALLOWED_TABLES.has(table)) {
      throw new Error(`Invalid table name: ${table}. Allowed tables: ${Array.from(DataExportService.ALLOWED_TABLES).join(', ')}`);
    }

    // Use pg-format or identifier quoting for additional safety
    // Table name is now guaranteed to be in allowlist
    const query = `
      SELECT * FROM "${table}"
      WHERE tenant_id = $1
      ${request.includeDeleted ? '' : 'AND deleted_at IS NULL'}
    `;

    const result = await client.query(query, [tenantId]);
    return result.rows;
  }

  /**
   * Generate SQL dump
   *
   * SECURITY: All table names are validated through queryTable() which uses allowlist
   */
  private async generateSQLDump(
    client: PoolClient,
    tenantId: string,
    tables: string[],
    outputPath: string,
    request: ExportRequest
  ): Promise<void> {
    const writeStream = createWriteStream(outputPath);

    // Write header
    writeStream.write(`-- Data export for tenant: ${tenantId}\n`);
    writeStream.write(`-- Generated at: ${new Date().toISOString()}\n\n`);

    for (const table of tables) {
      // Validate table name against allowlist (queryTable does this check)
      if (!DataExportService.ALLOWED_TABLES.has(table)) {
        console.warn(`Skipping invalid table: ${table}`);
        continue;
      }

      const data = await this.queryTable(client, tenantId, table, request);

      if (data.length === 0) continue;

      // Generate INSERT statements - table name is validated above
      writeStream.write(`-- Table: ${table}\n`);

      for (const row of data) {
        const columns = Object.keys(row);
        const values = Object.values(row).map(v => {
          if (v === null) return 'NULL';
          if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
          if (v instanceof Date) return `'${v.toISOString()}'`;
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
          return v;
        });

        // Table name is safe (validated against allowlist above)
        writeStream.write(
          `INSERT INTO "${table}" (${columns.join(', ')}) VALUES (${values.join(', ')});
`
        );
      }

      writeStream.write('\n');
    }

    writeStream.end();

    return new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  /**
   * Convert JSON to CSV
   */
  private jsonToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const parser = new Parser();
    return parser.parse(data);
  }

  /**
   * Create ZIP archive
   */
  private async createZipArchive(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  /**
   * Upload file to S3
   */
  private async uploadToS3(filePath: string, s3Key: string): Promise<void> {
    const fileContent = await fs.readFile(filePath);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: s3Key,
        Body: fileContent,
        ContentType: this.getContentType(filePath)
      })
    );
  }

  /**
   * Get content type for file
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.json': 'application/json',
      '.csv': 'text/csv',
      '.sql': 'application/sql',
      '.zip': 'application/zip'
    };
    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Send export ready notification email
   */
  private async sendExportReadyEmail(
    client: PoolClient,
    exportId: string,
    _tenantId: string
  ): Promise<void> {
    // Get tenant and user info
    const result = await client.query(
      `SELECT t.contact_email, de.file_url, de.expires_at
      FROM data_exports de
      JOIN tenants t ON de.tenant_id = t.id
      WHERE de.id = $1`,
      [exportId]
    );

    if (result.rows.length === 0) return;

    const { contact_email, file_url, expires_at } = result.rows[0];

    // TODO: Send actual email
    console.log(`Export ready for ${contact_email}: ${file_url} (expires: ${expires_at})`);
  }

  /**
   * Get export status
   */
  async getExportStatus(exportId: string, tenantId: string): Promise<ExportResult | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT id, status, file_url, file_size_bytes, expires_at, error_message
        FROM data_exports WHERE id = $1 AND tenant_id = $2`,
        [exportId, tenantId]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      const signedUrl = row.file_url
        ? await this.createSignedDownloadUrl(row.file_url)
        : undefined;
      return {
        exportId: row.id,
        status: row.status,
        fileUrl: signedUrl || row.file_url,
        fileSize: row.file_size_bytes,
        expiresAt: row.expires_at,
        error: row.error_message
      };
    } finally {
      client.release();
    }
  }

  private async createSignedDownloadUrl(fileUrl: string): Promise<string> {
    // Extract key from stored URL (expects https://bucket.s3.amazonaws.com/key)
    const prefix = `https://${this.s3Bucket}.s3.amazonaws.com/`;
    const key = fileUrl.startsWith(prefix) ? fileUrl.slice(prefix.length) : fileUrl;

    const command = new GetObjectCommand({
      Bucket: this.s3Bucket,
      Key: key
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: 900 }); // 15 minutes
  }

  /**
   * Cleanup expired exports (run via cron)
   */
  async cleanupExpiredExports(): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `DELETE FROM data_exports
        WHERE expires_at < NOW() AND status = 'completed'
        RETURNING id, file_url`
      );

      // TODO: Delete files from S3
      for (const row of result.rows) {
        console.log(`Deleted expired export: ${row.id}`);
      }

      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }
}

export default DataExportService;
