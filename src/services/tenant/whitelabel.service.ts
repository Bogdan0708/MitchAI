/**
 * WHITE-LABEL SERVICE
 *
 * Customization and branding for tenants:
 * - Theme configuration (colors, fonts)
 * - Custom domain support
 * - Logo and branding upload
 * - Email template customization
 * - Subdomain provisioning
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  borderRadius: 'none' | 'small' | 'medium' | 'large';
  buttonStyle: 'flat' | 'outlined' | 'rounded';
}

export interface BrandingConfig {
  logoUrl?: string;
  faviconUrl?: string;
  coverImageUrl?: string;
  businessName: string;
  tagline?: string;
  supportEmail?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    tiktok?: string;
  };
}

export interface DomainConfig {
  customDomain?: string;
  subdomain: string;
  sslEnabled: boolean;
  sslExpiresAt?: Date;
  dnsVerified: boolean;
  lastVerifiedAt?: Date;
}

export interface EmailTemplateConfig {
  welcomeSubject: string;
  welcomeBody: string;
  orderConfirmationSubject: string;
  orderConfirmationBody: string;
  reservationConfirmationSubject: string;
  reservationConfirmationBody: string;
  reviewRequestSubject: string;
  reviewRequestBody: string;
}

export interface WhiteLabelConfig {
  tenantId: string;
  theme: ThemeConfig;
  branding: BrandingConfig;
  domain: DomainConfig;
  emailTemplates: EmailTemplateConfig;
  chatWidgetConfig: {
    position: 'bottom-right' | 'bottom-left';
    greeting: string;
    placeholder: string;
    showPoweredBy: boolean;
  };
}

const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#4F46E5',
  secondaryColor: '#6366F1',
  accentColor: '#EC4899',
  backgroundColor: '#FFFFFF',
  textColor: '#1F2937',
  fontFamily: 'Inter, system-ui, sans-serif',
  borderRadius: 'medium',
  buttonStyle: 'rounded',
};

const DEFAULT_EMAIL_TEMPLATES: EmailTemplateConfig = {
  welcomeSubject: 'Welcome to {{businessName}}!',
  welcomeBody: `Hi {{customerName}},

Welcome to {{businessName}}! We're excited to have you.

Start exploring our menu and earn loyalty points with every order.

Best regards,
The {{businessName}} Team`,

  orderConfirmationSubject: 'Your order #{{orderNumber}} is confirmed',
  orderConfirmationBody: `Hi {{customerName}},

Your order #{{orderNumber}} has been confirmed!

Order Details:
{{orderItems}}

Total: {{orderTotal}}

We'll notify you when your order is ready.

Thank you for choosing {{businessName}}!`,

  reservationConfirmationSubject: 'Reservation confirmed for {{reservationDate}}',
  reservationConfirmationBody: `Hi {{customerName}},

Your reservation at {{businessName}} is confirmed!

Details:
- Date: {{reservationDate}}
- Time: {{reservationTime}}
- Party size: {{partySize}}

See you soon!`,

  reviewRequestSubject: 'How was your experience at {{businessName}}?',
  reviewRequestBody: `Hi {{customerName}},

Thank you for visiting {{businessName}}! We hope you enjoyed your experience.

We'd love to hear your feedback. Please take a moment to share your thoughts:
{{reviewLink}}

Your feedback helps us improve!

Best regards,
The {{businessName}} Team`,
};

export class WhiteLabelService {
  private pool: Pool;
  private redis: Redis;
  private s3Client: S3Client;
  private bucketName: string;
  private cdnBaseUrl: string;

  constructor(pool: Pool, redis: Redis) {
    this.pool = pool;
    this.redis = redis;
    this.bucketName = process.env.AWS_S3_BUCKET || 'mitch-assets';
    this.cdnBaseUrl = process.env.CDN_BASE_URL || 'https://cdn.mitch-ai.com';

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: process.env.AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      } : undefined,
    });
  }

  /**
   * Get white-label configuration for a tenant
   */
  async getConfig(tenantId: string): Promise<WhiteLabelConfig> {
    // Check cache
    const cached = await this.redis.get(`whitelabel:${tenantId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from database
    const result = await this.pool.query(
      `SELECT
        t.id as tenant_id,
        t.business_name,
        t.slug,
        wl.*
       FROM tenants t
       LEFT JOIN whitelabel_configs wl ON wl.tenant_id = t.id
       WHERE t.id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error('Tenant not found');
    }

    const row = result.rows[0];

    const config: WhiteLabelConfig = {
      tenantId,
      theme: row.theme_config ? JSON.parse(row.theme_config) : DEFAULT_THEME,
      branding: {
        businessName: row.business_name,
        logoUrl: row.logo_url,
        faviconUrl: row.favicon_url,
        coverImageUrl: row.cover_image_url,
        tagline: row.tagline,
        supportEmail: row.support_email,
        socialLinks: row.social_links ? JSON.parse(row.social_links) : undefined,
      },
      domain: {
        subdomain: row.slug,
        customDomain: row.custom_domain,
        sslEnabled: row.ssl_enabled || false,
        sslExpiresAt: row.ssl_expires_at ? new Date(row.ssl_expires_at) : undefined,
        dnsVerified: row.dns_verified || false,
        lastVerifiedAt: row.last_dns_verified_at ? new Date(row.last_dns_verified_at) : undefined,
      },
      emailTemplates: row.email_templates
        ? JSON.parse(row.email_templates)
        : DEFAULT_EMAIL_TEMPLATES,
      chatWidgetConfig: row.chat_widget_config
        ? JSON.parse(row.chat_widget_config)
        : {
            position: 'bottom-right',
            greeting: `Hi! Welcome to ${row.business_name}. How can I help you?`,
            placeholder: 'Type your message...',
            showPoweredBy: true,
          },
    };

    // Cache for 5 minutes
    await this.redis.setex(`whitelabel:${tenantId}`, 300, JSON.stringify(config));

    return config;
  }

  /**
   * Update theme configuration
   */
  async updateTheme(tenantId: string, theme: Partial<ThemeConfig>): Promise<ThemeConfig> {
    const currentConfig = await this.getConfig(tenantId);
    const newTheme = { ...currentConfig.theme, ...theme };

    await this.pool.query(
      `INSERT INTO whitelabel_configs (tenant_id, theme_config)
       VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO UPDATE
       SET theme_config = $2, updated_at = NOW()`,
      [tenantId, JSON.stringify(newTheme)]
    );

    await this.invalidateCache(tenantId);
    return newTheme;
  }

  /**
   * Update branding configuration
   */
  async updateBranding(
    tenantId: string,
    branding: Partial<BrandingConfig>
  ): Promise<BrandingConfig> {
    const currentConfig = await this.getConfig(tenantId);
    const newBranding = { ...currentConfig.branding, ...branding };

    await this.pool.query(
      `UPDATE tenants SET business_name = $1 WHERE id = $2`,
      [branding.businessName || currentConfig.branding.businessName, tenantId]
    );

    await this.pool.query(
      `INSERT INTO whitelabel_configs (tenant_id, tagline, support_email, social_links)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id) DO UPDATE
       SET tagline = $2, support_email = $3, social_links = $4, updated_at = NOW()`,
      [tenantId, newBranding.tagline, newBranding.supportEmail, JSON.stringify(newBranding.socialLinks)]
    );

    await this.invalidateCache(tenantId);
    return newBranding;
  }

  /**
   * Upload logo
   */
  async uploadLogo(
    tenantId: string,
    file: Buffer,
    mimeType: string
  ): Promise<string> {
    const extension = mimeType.split('/')[1] || 'png';
    const key = `tenants/${tenantId}/logo-${randomUUID()}.${extension}`;

    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file,
      ContentType: mimeType,
      CacheControl: 'max-age=31536000',
    }));

    const logoUrl = `${this.cdnBaseUrl}/${key}`;

    await this.pool.query(
      `INSERT INTO whitelabel_configs (tenant_id, logo_url)
       VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO UPDATE
       SET logo_url = $2, updated_at = NOW()`,
      [tenantId, logoUrl]
    );

    await this.invalidateCache(tenantId);
    return logoUrl;
  }

  /**
   * Upload favicon
   */
  async uploadFavicon(
    tenantId: string,
    file: Buffer,
    mimeType: string
  ): Promise<string> {
    const key = `tenants/${tenantId}/favicon-${randomUUID()}.ico`;

    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file,
      ContentType: mimeType,
      CacheControl: 'max-age=31536000',
    }));

    const faviconUrl = `${this.cdnBaseUrl}/${key}`;

    await this.pool.query(
      `INSERT INTO whitelabel_configs (tenant_id, favicon_url)
       VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO UPDATE
       SET favicon_url = $2, updated_at = NOW()`,
      [tenantId, faviconUrl]
    );

    await this.invalidateCache(tenantId);
    return faviconUrl;
  }

  /**
   * Configure custom domain
   */
  async configureCustomDomain(
    tenantId: string,
    customDomain: string
  ): Promise<{
    domain: string;
    dnsRecords: Array<{ type: string; name: string; value: string }>;
  }> {
    // Validate domain format
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
    if (!domainRegex.test(customDomain)) {
      throw new Error('Invalid domain format');
    }

    // Check if domain is already in use
    const existing = await this.pool.query(
      'SELECT tenant_id FROM whitelabel_configs WHERE custom_domain = $1 AND tenant_id != $2',
      [customDomain, tenantId]
    );

    if (existing.rows.length > 0) {
      throw new Error('Domain already in use');
    }

    await this.pool.query(
      `INSERT INTO whitelabel_configs (tenant_id, custom_domain, dns_verified)
       VALUES ($1, $2, false)
       ON CONFLICT (tenant_id) DO UPDATE
       SET custom_domain = $2, dns_verified = false, updated_at = NOW()`,
      [tenantId, customDomain]
    );

    await this.invalidateCache(tenantId);

    // Return DNS records to configure
    return {
      domain: customDomain,
      dnsRecords: [
        {
          type: 'CNAME',
          name: customDomain,
          value: 'app.mitch-ai.com',
        },
        {
          type: 'TXT',
          name: `_mitch-verify.${customDomain}`,
          value: `mitch-verify=${tenantId}`,
        },
      ],
    };
  }

  /**
   * Verify custom domain DNS
   */
  async verifyCustomDomain(tenantId: string): Promise<boolean> {
    const config = await this.getConfig(tenantId);

    if (!config.domain.customDomain) {
      throw new Error('No custom domain configured');
    }

    // In production, perform actual DNS lookup
    // const dns = require('dns').promises;
    // const records = await dns.resolveTxt(`_mitch-verify.${config.domain.customDomain}`);
    // const verified = records.flat().some(r => r === `mitch-verify=${tenantId}`);

    // For now, simulate verification
    const verified = true;

    if (verified) {
      await this.pool.query(
        `UPDATE whitelabel_configs
         SET dns_verified = true, last_dns_verified_at = NOW()
         WHERE tenant_id = $1`,
        [tenantId]
      );
      await this.invalidateCache(tenantId);
    }

    return verified;
  }

  /**
   * Update email templates
   */
  async updateEmailTemplates(
    tenantId: string,
    templates: Partial<EmailTemplateConfig>
  ): Promise<EmailTemplateConfig> {
    const currentConfig = await this.getConfig(tenantId);
    const newTemplates = { ...currentConfig.emailTemplates, ...templates };

    await this.pool.query(
      `INSERT INTO whitelabel_configs (tenant_id, email_templates)
       VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO UPDATE
       SET email_templates = $2, updated_at = NOW()`,
      [tenantId, JSON.stringify(newTemplates)]
    );

    await this.invalidateCache(tenantId);
    return newTemplates;
  }

  /**
   * Update chat widget configuration
   */
  async updateChatWidgetConfig(
    tenantId: string,
    config: Partial<WhiteLabelConfig['chatWidgetConfig']>
  ): Promise<WhiteLabelConfig['chatWidgetConfig']> {
    const currentConfig = await this.getConfig(tenantId);
    const newConfig = { ...currentConfig.chatWidgetConfig, ...config };

    await this.pool.query(
      `INSERT INTO whitelabel_configs (tenant_id, chat_widget_config)
       VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO UPDATE
       SET chat_widget_config = $2, updated_at = NOW()`,
      [tenantId, JSON.stringify(newConfig)]
    );

    await this.invalidateCache(tenantId);
    return newConfig;
  }

  /**
   * Generate CSS variables from theme
   */
  generateCSSVariables(theme: ThemeConfig): string {
    const borderRadiusMap = {
      none: '0',
      small: '4px',
      medium: '8px',
      large: '16px',
    };

    return `
      :root {
        --primary: ${theme.primaryColor};
        --secondary: ${theme.secondaryColor};
        --accent: ${theme.accentColor};
        --background: ${theme.backgroundColor};
        --text: ${theme.textColor};
        --font-family: ${theme.fontFamily};
        --border-radius: ${borderRadiusMap[theme.borderRadius]};
      }
    `.trim();
  }

  /**
   * Render email template with variables
   */
  renderEmailTemplate(
    template: string,
    variables: Record<string, string>
  ): string {
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return rendered;
  }

  /**
   * Get tenant by custom domain or subdomain
   */
  async getTenantByDomain(domain: string): Promise<string | null> {
    // Check cache first
    const cached = await this.redis.get(`domain:${domain}`);
    if (cached) {
      return cached;
    }

    // Check custom domain
    let result = await this.pool.query(
      `SELECT tenant_id FROM whitelabel_configs
       WHERE custom_domain = $1 AND dns_verified = true`,
      [domain]
    );

    if (result.rows.length > 0) {
      const tenantId = result.rows[0].tenant_id;
      await this.redis.setex(`domain:${domain}`, 3600, tenantId);
      return tenantId;
    }

    // Check subdomain (slug)
    const subdomain = domain.split('.')[0];
    result = await this.pool.query(
      'SELECT id FROM tenants WHERE slug = $1',
      [subdomain]
    );

    if (result.rows.length > 0) {
      const tenantId = result.rows[0].id;
      await this.redis.setex(`domain:${domain}`, 3600, tenantId);
      return tenantId;
    }

    return null;
  }

  /**
   * Invalidate cache for tenant
   */
  private async invalidateCache(tenantId: string): Promise<void> {
    await this.redis.del(`whitelabel:${tenantId}`);

    // Also invalidate domain cache
    const config = await this.pool.query(
      'SELECT custom_domain FROM whitelabel_configs WHERE tenant_id = $1',
      [tenantId]
    );

    if (config.rows[0]?.custom_domain) {
      await this.redis.del(`domain:${config.rows[0].custom_domain}`);
    }
  }
}
