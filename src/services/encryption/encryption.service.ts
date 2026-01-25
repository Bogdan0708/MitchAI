/**
 * Encryption Service - AES-256-GCM encryption for sensitive credentials
 *
 * Features:
 * - AES-256-GCM encryption with authenticated encryption
 * - Support for key rotation
 * - Integration-ready for AWS KMS or HashiCorp Vault
 * - Secure key derivation using PBKDF2
 */

import * as crypto from 'crypto';
import { logger } from '../logger.service';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const KEY_LENGTH = 32; // 256 bits
const PBKDF2_ITERATIONS = 100000;

// Key version prefix for rotation support
const KEY_VERSION_PREFIX = 'v1:';

/**
 * Encrypted data structure
 */
interface EncryptedData {
  version: string;
  iv: string;
  authTag: string;
  salt: string;
  ciphertext: string;
}

/**
 * Key provider interface for external key management systems
 */
interface KeyProvider {
  getKey(keyId: string): Promise<Buffer>;
  rotateKey(keyId: string): Promise<string>; // Returns new key ID
  listKeyVersions(keyId: string): Promise<string[]>;
}

class EncryptionService {
  private masterKey: Buffer | null = null;
  private keyProvider: KeyProvider | null = null;
  private keyCache: Map<string, { key: Buffer; expiresAt: number }> = new Map();
  private readonly KEY_CACHE_TTL = 300000; // 5 minutes

  /**
   * Initialize the encryption service with a master key
   *
   * @param masterKey - Either a hex-encoded key string or will use ENCRYPTION_KEY env var
   */
  public initialize(masterKey?: string): void {
    const key = masterKey || process.env.ENCRYPTION_KEY;

    if (!key) {
      throw new Error(
        'Encryption key not provided. Set ENCRYPTION_KEY environment variable or pass key to initialize()'
      );
    }

    // Validate key length
    if (key.length < 32) {
      throw new Error('Encryption key must be at least 32 characters');
    }

    // Derive a proper key using PBKDF2 if the provided key isn't exactly 64 hex chars (32 bytes)
    if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
      this.masterKey = Buffer.from(key, 'hex');
    } else {
      // Derive key from passphrase
      const salt = crypto.createHash('sha256').update('mitch-hospitality-salt').digest();
      this.masterKey = crypto.pbkdf2Sync(key, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
    }

    logger.info('Encryption service initialized');
  }

  /**
   * Set a custom key provider (for AWS KMS, HashiCorp Vault, etc.)
   */
  public setKeyProvider(provider: KeyProvider): void {
    this.keyProvider = provider;
    logger.info('Custom key provider configured');
  }

  /**
   * Encrypt sensitive data
   *
   * @param plaintext - The data to encrypt
   * @param keyId - Optional key ID for multi-key support
   * @returns Base64 encoded encrypted data with metadata
   */
  public async encrypt(plaintext: string, keyId?: string): Promise<string> {
    const key = await this.getEncryptionKey(keyId);

    // Generate random IV and salt
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Derive a data encryption key from master key + salt
    const dek = crypto.pbkdf2Sync(key, salt, 10000, KEY_LENGTH, 'sha256');

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, dek, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    // Encrypt
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Build encrypted data structure
    const encryptedData: EncryptedData = {
      version: KEY_VERSION_PREFIX,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      salt: salt.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };

    return Buffer.from(JSON.stringify(encryptedData)).toString('base64');
  }

  /**
   * Decrypt sensitive data
   *
   * @param encryptedBase64 - Base64 encoded encrypted data
   * @param keyId - Optional key ID for multi-key support
   * @returns Decrypted plaintext
   */
  public async decrypt(encryptedBase64: string, keyId?: string): Promise<string> {
    try {
      // Parse encrypted data structure
      const encryptedJson = Buffer.from(encryptedBase64, 'base64').toString('utf8');
      const encryptedData: EncryptedData = JSON.parse(encryptedJson);

      // Validate version
      if (!encryptedData.version.startsWith('v')) {
        throw new Error('Invalid encryption version');
      }

      const key = await this.getEncryptionKey(keyId);

      // Decode components
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const authTag = Buffer.from(encryptedData.authTag, 'base64');
      const salt = Buffer.from(encryptedData.salt, 'base64');
      const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');

      // Derive the same data encryption key
      const dek = crypto.pbkdf2Sync(key, salt, 10000, KEY_LENGTH, 'sha256');

      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, dek, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      decipher.setAuthTag(authTag);

      // Decrypt
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return plaintext.toString('utf8');
    } catch (error) {
      logger.error('Decryption failed', {
        error: (error as Error).message,
      });
      throw new Error('Failed to decrypt data: invalid or corrupted ciphertext');
    }
  }

  /**
   * Encrypt data and return as bytes (for BYTEA database columns)
   */
  public async encryptToBytes(plaintext: string, keyId?: string): Promise<Buffer> {
    const encryptedBase64 = await this.encrypt(plaintext, keyId);
    return Buffer.from(encryptedBase64, 'base64');
  }

  /**
   * Decrypt data from bytes (from BYTEA database columns)
   */
  public async decryptFromBytes(encryptedBytes: Buffer, keyId?: string): Promise<string> {
    const encryptedBase64 = encryptedBytes.toString('base64');
    return this.decrypt(encryptedBase64, keyId);
  }

  /**
   * Re-encrypt data with a new key (for key rotation)
   */
  public async reEncrypt(
    encryptedBase64: string,
    oldKeyId?: string,
    newKeyId?: string
  ): Promise<string> {
    const plaintext = await this.decrypt(encryptedBase64, oldKeyId);
    return this.encrypt(plaintext, newKeyId);
  }

  /**
   * Generate a secure random encryption key
   */
  public generateKey(): string {
    return crypto.randomBytes(KEY_LENGTH).toString('hex');
  }

  /**
   * Hash sensitive data for comparison (one-way)
   */
  public hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate a secure random token
   */
  public generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Get encryption key (from cache, provider, or master key)
   */
  private async getEncryptionKey(keyId?: string): Promise<Buffer> {
    // If using external key provider
    if (this.keyProvider && keyId) {
      // Check cache first
      const cached = this.keyCache.get(keyId);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.key;
      }

      // Fetch from provider
      const key = await this.keyProvider.getKey(keyId);
      this.keyCache.set(keyId, {
        key,
        expiresAt: Date.now() + this.KEY_CACHE_TTL,
      });
      return key;
    }

    // Use master key
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }

    return this.masterKey;
  }

  /**
   * Clear the key cache (useful for testing or forced refresh)
   */
  public clearKeyCache(): void {
    this.keyCache.clear();
  }

  /**
   * Validate that a string is properly encrypted data
   */
  public isEncrypted(data: string): boolean {
    try {
      const decoded = Buffer.from(data, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      return (
        parsed.version &&
        parsed.iv &&
        parsed.authTag &&
        parsed.salt &&
        parsed.ciphertext
      );
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();

// Export convenience functions
export const encrypt = encryptionService.encrypt.bind(encryptionService);
export const decrypt = encryptionService.decrypt.bind(encryptionService);
export const encryptToBytes = encryptionService.encryptToBytes.bind(encryptionService);
export const decryptFromBytes = encryptionService.decryptFromBytes.bind(encryptionService);
export const generateKey = encryptionService.generateKey.bind(encryptionService);
export const generateToken = encryptionService.generateToken.bind(encryptionService);
export const hash = encryptionService.hash.bind(encryptionService);
