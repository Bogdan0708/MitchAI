import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { generateToken } from '../../middleware/tenant.middleware';

interface LoginCredentials {
  email: string;
  password: string;
}

export class AuthService {
  private jwtSecret: string;

  constructor(private pool: Pool, jwtSecret: string) {
    this.jwtSecret = jwtSecret;
  }

  async login(credentials: LoginCredentials, ipAddress: string): Promise<{ accessToken: string; user: any; tenant: any }> {
    const { email, password } = credentials;

    // Query user with tenant info
    const result = await this.pool.query(
      `SELECT tu.*, t.slug as tenant_slug, t.status as tenant_status,
              t.name as tenant_name, pt.name as tier_name
      FROM tenant_users tu
      JOIN tenants t ON tu.tenant_id = t.id
      LEFT JOIN pricing_tiers pt ON t.tier_id = pt.id
      WHERE tu.email = $1 AND tu.deleted_at IS NULL AND t.deleted_at IS NULL`,
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = result.rows[0];

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new Error(`Account locked until ${user.locked_until}`);
    }

    // Check tenant status
    if (user.tenant_status !== 'active' && user.tenant_status !== 'trial') {
      throw new Error('Tenant account is not active');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      // Increment failed login attempts
      await this.pool.query(
        `UPDATE tenant_users
        SET failed_login_attempts = failed_login_attempts + 1,
            locked_until = CASE
              WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
              ELSE NULL
            END
        WHERE id = $1`,
        [user.id]
      );

      throw new Error('Invalid credentials');
    }

    // Reset failed login attempts and update last login
    await this.pool.query(
      `UPDATE tenant_users
      SET failed_login_attempts = 0,
          locked_until = NULL,
          last_login_at = NOW(),
          last_login_ip = $1
      WHERE id = $2`,
      [ipAddress, user.id]
    );

    // Generate JWT token
    const accessToken = generateToken(
      {
        tenantId: user.tenant_id,
        tenantSlug: user.tenant_slug,
        userId: user.id,
        userRole: user.role,
        email: user.email,
      },
      this.jwtSecret
    );

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      },
      tenant: {
        id: user.tenant_id,
        slug: user.tenant_slug,
        name: user.tenant_name,
        tier: user.tier_name || 'starter',
      },
    };
  }

}
