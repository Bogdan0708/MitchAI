
import { Request, Response } from 'express';
import { TenantService } from '../services/tenant/tenant.service';
import { Pool } from 'pg';

export class TenantController {
  private tenantService: TenantService;

  constructor(pool: Pool) {
    this.tenantService = new TenantService(pool);
  }

  public getTenant = async (req: Request, res: Response) => {
    try {
      const tenant = await this.tenantService.getTenantById(req.tenant!.tenantId);
      res.json(tenant);
    } catch (error) {
      console.error('Get tenant error:', error);
      res.status(500).json({ error: 'Failed to fetch tenant' });
    }
  };

  public updateTenant = async (req: Request, res: Response) => {
    try {
      const tenant = await this.tenantService.updateTenant(req.tenant!.tenantId, req.body);
      res.json(tenant);
    } catch (error) {
      console.error('Update tenant error:', error);
      res.status(500).json({ error: 'Failed to update tenant' });
    }
  };
}
