/**
 * TWO-FACTOR AUTHENTICATION SERVICE
 *
 * Provides TOTP-based 2FA for admin accounts.
 * Uses RFC 6238 Time-Based One-Time Password algorithm.
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { Pool } from 'pg';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface TwoFASetupResult {
  secret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

export interface TwoFAVerifyResult {
  success: boolean;
  message?: string;
}

// ============================================================================
// TWO-FACTOR AUTHENTICATION SERVICE
// ============================================================================

export class TwoFAService {
  private pool: Pool;
  private issuer: string;

  constructor(pool: Pool, issuer: string = 'Mitch Hospitality') {
    this.pool = pool;
    this.issuer = issuer;
  }

  /**
   * Generate a new 2FA secret and QR code for setup
   */
  async generateSetup(userId: string, userEmail: string): Promise<TwoFASetupResult> {
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `${this.issuer}:${userEmail}`,
      issuer: this.issuer,
      length: 32,
    });

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(8);

    // Generate QR code data URL
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!);

    // Store pending setup (not yet verified)
    await this.storePendingSetup(userId, secret.base32, backupCodes);

    return {
      secret: secret.base32,
      qrCodeDataUrl,
      backupCodes,
    };
  }

  /**
   * Verify a TOTP token during setup (enables 2FA)
   */
  async verifySetup(userId: string, token: string): Promise<TwoFAVerifyResult> {
    // Get pending setup
    const result = await this.pool.query(
      `SELECT pending_totp_secret, pending_backup_codes 
       FROM tenant_users WHERE id = $1`,
      [userId]
    );

    if (!result.rows[0]?.pending_totp_secret) {
      return { success: false, message: '2FA setup not initiated' };
    }

    const secret = result.rows[0].pending_totp_secret;

    // Verify token
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1, // Allow 1 step before/after for clock drift
    });

    if (!isValid) {
      return { success: false, message: 'Invalid verification code' };
    }

    // Enable 2FA - move pending to active
    await this.pool.query(
      `UPDATE tenant_users 
       SET totp_secret = pending_totp_secret,
           backup_codes = pending_backup_codes,
           totp_enabled = true,
           totp_enabled_at = NOW(),
           pending_totp_secret = NULL,
           pending_backup_codes = NULL
       WHERE id = $1`,
      [userId]
    );

    return { success: true, message: '2FA enabled successfully' };
  }

  /**
   * Verify a TOTP token during login
   */
  async verifyToken(userId: string, token: string): Promise<TwoFAVerifyResult> {
    const result = await this.pool.query(
      `SELECT totp_secret, totp_enabled, backup_codes FROM tenant_users WHERE id = $1`,
      [userId]
    );

    if (!result.rows[0]?.totp_enabled) {
      return { success: false, message: '2FA not enabled' };
    }

    const { totp_secret, backup_codes } = result.rows[0];

    // First try TOTP verification
    const isValidTotp = speakeasy.totp.verify({
      secret: totp_secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (isValidTotp) {
      return { success: true };
    }

    // Try backup code
    const isValidBackup = await this.verifyBackupCode(userId, token, backup_codes);
    if (isValidBackup) {
      return { success: true, message: 'Backup code used' };
    }

    return { success: false, message: 'Invalid verification code' };
  }

  /**
   * Check if user has 2FA enabled
   */
  async isEnabled(userId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT totp_enabled FROM tenant_users WHERE id = $1',
      [userId]
    );
    return result.rows[0]?.totp_enabled === true;
  }

  /**
   * Disable 2FA for a user (requires password verification first)
   */
  async disable(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE tenant_users 
       SET totp_secret = NULL,
           totp_enabled = false,
           totp_enabled_at = NULL,
           backup_codes = NULL,
           pending_totp_secret = NULL,
           pending_backup_codes = NULL
       WHERE id = $1`,
      [userId]
    );
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const backupCodes = this.generateBackupCodes(8);
    const hashedCodes = backupCodes.map(code => this.hashBackupCode(code));

    await this.pool.query(
      'UPDATE tenant_users SET backup_codes = $1 WHERE id = $2',
      [JSON.stringify(hashedCodes), userId]
    );

    return backupCodes;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  }

  private hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code.replace('-', '')).digest('hex');
  }

  private async storePendingSetup(
    userId: string,
    secret: string,
    backupCodes: string[]
  ): Promise<void> {
    const hashedCodes = backupCodes.map(code => this.hashBackupCode(code));
    
    await this.pool.query(
      `UPDATE tenant_users 
       SET pending_totp_secret = $1, pending_backup_codes = $2 
       WHERE id = $3`,
      [secret, JSON.stringify(hashedCodes), userId]
    );
  }

  private async verifyBackupCode(
    userId: string,
    code: string,
    backupCodesJson: string
  ): Promise<boolean> {
    const normalizedCode = code.replace('-', '').toUpperCase();
    const hashedInput = this.hashBackupCode(normalizedCode);
    
    let backupCodes: string[];
    try {
      backupCodes = JSON.parse(backupCodesJson);
    } catch {
      return false;
    }

    const codeIndex = backupCodes.indexOf(hashedInput);
    if (codeIndex === -1) {
      return false;
    }

    // Remove used backup code
    backupCodes.splice(codeIndex, 1);
    await this.pool.query(
      'UPDATE tenant_users SET backup_codes = $1 WHERE id = $2',
      [JSON.stringify(backupCodes), userId]
    );

    return true;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let twoFAServiceInstance: TwoFAService | null = null;

export function initTwoFAService(pool: Pool, issuer?: string): TwoFAService {
  twoFAServiceInstance = new TwoFAService(pool, issuer);
  return twoFAServiceInstance;
}

export function getTwoFAService(): TwoFAService {
  if (!twoFAServiceInstance) {
    throw new Error('TwoFAService not initialized');
  }
  return twoFAServiceInstance;
}

export default TwoFAService;
