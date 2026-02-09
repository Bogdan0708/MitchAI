/**
 * TWO-FACTOR AUTHENTICATION ROUTES
 *
 * API endpoints for managing 2FA settings
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { validate } from '../middleware/validate.middleware';
import { apiResponse } from '../lib/api-response';
import { TwoFAService } from '../services/twofa.service';
import { getAuditService } from '../services/audit.service';

// Validation schemas
const verifyTokenSchema = z.object({
  body: z.object({
    token: z.string().min(6).max(8),
  }),
});

const disableSchema = z.object({
  body: z.object({
    password: z.string().min(1),
  }),
});

export function createTwoFARouter(pool: Pool): Router {
  const router = Router();
  const twoFAService = new TwoFAService(pool, 'Mitch Hospitality');

  /**
   * GET /2fa/status
   * Check 2FA status for current user
   */
  router.get('/status', async (req, res) => {
    try {
      const userId = req.tenant!.userId;
      const isEnabled = await twoFAService.isEnabled(userId);

      return apiResponse.success(res, {
        enabled: isEnabled,
      });
    } catch (error) {
      console.error('2FA status error:', error);
      return apiResponse.serverError(res, 'Failed to check 2FA status');
    }
  });

  /**
   * POST /2fa/setup
   * Generate 2FA secret and QR code for setup
   */
  router.post('/setup', async (req, res) => {
    try {
      const userId = req.tenant!.userId;

      // Check if already enabled
      const isEnabled = await twoFAService.isEnabled(userId);
      if (isEnabled) {
        return apiResponse.badRequest(res, '2FA is already enabled. Disable it first to set up again.');
      }

      // Get user email for QR code label
      const userResult = await pool.query(
        'SELECT email FROM tenant_users WHERE id = $1',
        [userId]
      );
      const userEmail = userResult.rows[0]?.email || 'user';

      // Generate setup
      const setup = await twoFAService.generateSetup(userId, userEmail);

      // Audit log
      try {
        const auditService = getAuditService();
        await auditService.logFromRequest(req, 'security.api_key_created', {
          entityType: 'user',
          entityId: userId,
          metadata: { action: '2fa_setup_initiated' },
        });
      } catch { /* audit log error ignored */ }

      return apiResponse.success(res, {
        qr_code: setup.qrCodeDataUrl,
        secret: setup.secret, // For manual entry
        backup_codes: setup.backupCodes,
        message: 'Scan the QR code with your authenticator app, then verify with a code',
      });
    } catch (error) {
      console.error('2FA setup error:', error);
      return apiResponse.serverError(res, 'Failed to initiate 2FA setup');
    }
  });

  /**
   * POST /2fa/verify-setup
   * Verify TOTP token to complete 2FA setup
   */
  router.post('/verify-setup', validate(verifyTokenSchema), async (req, res) => {
    try {
      const userId = req.tenant!.userId;
      const { token } = req.body;

      const result = await twoFAService.verifySetup(userId, token);

      if (!result.success) {
        return apiResponse.badRequest(res, result.message || 'Verification failed');
      }

      // Audit log
      try {
        const auditService = getAuditService();
        await auditService.logFromRequest(req, 'user.updated', {
          entityType: 'user',
          entityId: userId,
          metadata: { action: '2fa_enabled' },
        });
      } catch { /* audit log error ignored */ }

      return apiResponse.success(res, {
        message: '2FA has been enabled successfully',
        enabled: true,
      });
    } catch (error) {
      console.error('2FA verify setup error:', error);
      return apiResponse.serverError(res, 'Failed to verify 2FA setup');
    }
  });

  /**
   * POST /2fa/disable
   * Disable 2FA (requires password verification)
   */
  router.post('/disable', validate(disableSchema), async (req, res) => {
    try {
      const userId = req.tenant!.userId;
      const { password } = req.body;

      // Verify password first
      const userResult = await pool.query(
        'SELECT password_hash FROM tenant_users WHERE id = $1',
        [userId]
      );

      if (!userResult.rows[0]) {
        return apiResponse.notFound(res, 'User not found');
      }

      const isValidPassword = await bcrypt.compare(password, userResult.rows[0].password_hash);
      if (!isValidPassword) {
        return apiResponse.unauthorized(res, 'Invalid password');
      }

      // Check if 2FA is enabled
      const isEnabled = await twoFAService.isEnabled(userId);
      if (!isEnabled) {
        return apiResponse.badRequest(res, '2FA is not enabled');
      }

      // Disable 2FA
      await twoFAService.disable(userId);

      // Audit log
      try {
        const auditService = getAuditService();
        await auditService.logFromRequest(req, 'user.updated', {
          entityType: 'user',
          entityId: userId,
          metadata: { action: '2fa_disabled' },
        });
      } catch { /* audit log error ignored */ }

      return apiResponse.success(res, {
        message: '2FA has been disabled',
        enabled: false,
      });
    } catch (error) {
      console.error('2FA disable error:', error);
      return apiResponse.serverError(res, 'Failed to disable 2FA');
    }
  });

  /**
   * POST /2fa/backup-codes
   * Regenerate backup codes (requires 2FA token verification)
   */
  router.post('/backup-codes', validate(verifyTokenSchema), async (req, res) => {
    try {
      const userId = req.tenant!.userId;
      const { token } = req.body;

      // Verify current 2FA token
      const verifyResult = await twoFAService.verifyToken(userId, token);
      if (!verifyResult.success) {
        return apiResponse.unauthorized(res, 'Invalid verification code');
      }

      // Generate new backup codes
      const backupCodes = await twoFAService.regenerateBackupCodes(userId);

      // Audit log
      try {
        const auditService = getAuditService();
        await auditService.logFromRequest(req, 'user.updated', {
          entityType: 'user',
          entityId: userId,
          metadata: { action: '2fa_backup_codes_regenerated' },
        });
      } catch { /* audit log error ignored */ }

      return apiResponse.success(res, {
        backup_codes: backupCodes,
        message: 'New backup codes generated. Save these securely.',
      });
    } catch (error) {
      console.error('Backup codes regeneration error:', error);
      return apiResponse.serverError(res, 'Failed to regenerate backup codes');
    }
  });

  return router;
}

export default createTwoFARouter;
