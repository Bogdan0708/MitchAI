import { Pool } from 'pg';
import { MenuService } from '../../services/tenant/menu.service';

// Mock pg
jest.mock('pg', () => {
  const mPool = {
    connect: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

describe('MenuService', () => {
  let pool: Pool;
  let client: any;
  let menuService: MenuService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup client mock
    client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    
    // Setup pool mock to return client
    pool = new Pool();
    (pool.connect as jest.Mock).mockResolvedValue(client);
    
    menuService = new MenuService(pool);
  });

  describe('getMenuItemsByTenantId', () => {
    it('should use RLS context (transaction)', async () => {
      const tenantId = 'tenant-123';
      const mockItems = [{ id: '1', name: 'Pasta' }];
      
      // Setup query responses
      // 1. BEGIN
      // 2. set_config
      // 3. SELECT menu_items
      // 4. COMMIT
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // set_config
        .mockResolvedValueOnce({ rows: mockItems }) // SELECT
        .mockResolvedValueOnce({}); // COMMIT

      const result = await menuService.getMenuItemsByTenantId(tenantId);

      expect(pool.connect).toHaveBeenCalled();
      expect(client.query).toHaveBeenCalledTimes(4);
      expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(client.query).toHaveBeenNthCalledWith(2, "SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
      expect(client.query).toHaveBeenNthCalledWith(4, 'COMMIT');
      expect(client.release).toHaveBeenCalled();
      expect(result).toEqual(mockItems);
    });

    it('should rollback on error', async () => {
      const tenantId = 'tenant-123';
      
      // Fail on SELECT
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // set_config
        .mockRejectedValueOnce(new Error('DB Error')); // SELECT

      await expect(menuService.getMenuItemsByTenantId(tenantId)).rejects.toThrow('DB Error');

      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalled();
    });
  });
});
