
import { Request, Response } from 'express';
import { ReservationService } from '../services/tenant/reservation.service';
import { Pool } from 'pg';

export class ReservationController {
  private reservationService: ReservationService;

  constructor(pool: Pool) {
    this.reservationService = new ReservationService(pool);
  }

  public getReservations = async (req: Request, res: Response) => {
    try {
      const reservations = await this.reservationService.getReservationsByTenantId(req.tenant!.tenantId, req.query);
      res.json(reservations);
    } catch (error) {
      console.error('List reservations error:', error);
      res.status(500).json({ error: 'Failed to fetch reservations' });
    }
  };

  public createReservation = async (req: Request, res: Response) => {
    try {
      const reservation = await this.reservationService.createReservation(req.tenant!.tenantId, req.body);
      res.status(201).json(reservation);
    } catch (error) {
      console.error('Create reservation error:', error);
      res.status(500).json({ error: 'Failed to create reservation' });
    }
  };
}
