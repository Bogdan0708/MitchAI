
import { Request, Response } from 'express';
import { OrderService } from '../services/tenant/order.service';
import { Pool } from 'pg';

export class OrderController {
  private orderService: OrderService;

  constructor(pool: Pool) {
    this.orderService = new OrderService(pool);
  }

  public getOrders = async (req: Request, res: Response) => {
    try {
      const orders = await this.orderService.getOrdersByTenantId(req.tenant!.tenantId, req.query);
      res.json(orders);
    } catch (error) {
      console.error('List orders error:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  };

  public createOrder = async (req: Request, res: Response) => {
    try {
      const order = await this.orderService.createOrder(req.tenant!.tenantId, req.body);
      res.status(201).json(order);
    } catch (error) {
      console.error('Create order error:', error);
      res.status(500).json({ error: 'Failed to create order' });
    }
  };
}
