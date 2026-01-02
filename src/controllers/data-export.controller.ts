
import { Request, Response } from 'express';
import { DataExportService } from '../services/tenant/data-export.service';
import { Pool } from 'pg';

export class DataExportController {
  private dataExportService: DataExportService;

  constructor(pool: Pool) {
    this.dataExportService = new DataExportService(pool, {
      region: process.env.AWS_REGION!,
      bucket: process.env.S3_BUCKET!,
    });
  }

  public requestExport = async (req: Request, res: Response) => {
    try {
      const result = await this.dataExportService.requestExport({
        tenantId: req.tenant!.tenantId,
        requestedBy: req.tenant!.userId,
        exportType: req.body.exportType || 'full',
        format: req.body.format || 'json',
        dateRangeStart: req.body.dateRangeStart,
        dateRangeEnd: req.body.dateRangeEnd,
      });
      res.status(202).json(result);
    } catch (error) {
      console.error('Export request error:', error);
      res.status(500).json({ error: 'Failed to request export' });
    }
  };

  public getExportStatus = async (req: Request, res: Response) => {
    try {
      const result = await this.dataExportService.getExportStatus(
        req.params.exportId,
        req.tenant!.tenantId
      );
      if (!result) {
        res.status(404).json({ error: 'Export not found' });
        return;
      }
      res.json(result);
    } catch (error) {
      console.error('Get export status error:', error);
      res.status(500).json({ error: 'Failed to get export status' });
    }
  };
}
