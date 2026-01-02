
import { Request, Response } from 'express';
import { LocationService } from '../services/tenant/location.service';
import { Pool } from 'pg';

export class LocationController {
  private locationService: LocationService;

  constructor(pool: Pool) {
    this.locationService = new LocationService(pool);
  }

  public getLocations = async (req: Request, res: Response) => {
    try {
      const locations = await this.locationService.getLocationsByTenantId(req.tenant!.tenantId);
      res.json(locations);
    } catch (error) {
      console.error('List locations error:', error);
      res.status(500).json({ error: 'Failed to fetch locations' });
    }
  };

  public createLocation = async (req: Request, res: Response) => {
    try {
      const location = await this.locationService.createLocation(req.tenant!.tenantId, req.body);
      res.status(201).json(location);
    } catch (error) {
      console.error('Create location error:', error);
      res.status(500).json({ error: 'Failed to create location' });
    }
  };
}
