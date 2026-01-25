
import { Request, Response } from 'express';
import { MenuService } from '../services/tenant/menu.service';
import { Pool } from 'pg';

export class MenuController {
  private menuService: MenuService;

  constructor(pool: Pool) {
    this.menuService = new MenuService(pool);
  }

  public getMenuItems = async (req: Request, res: Response) => {
    try {
      const menuItems = await this.menuService.getMenuItemsByTenantId(req.tenant!.tenantId);
      res.json({ data: menuItems });
    } catch (error) {
      console.error('List menu error:', error);
      res.status(500).json({ error: 'Failed to fetch menu' });
    }
  };

  public createMenuItem = async (req: Request, res: Response) => {
    try {
      const menuItem = await this.menuService.createMenuItem(req.tenant!.tenantId, req.body);
      res.status(201).json({ data: menuItem });
    } catch (error) {
      console.error('Create menu item error:', error);
      res.status(500).json({ error: 'Failed to create menu item' });
    }
  };
}
