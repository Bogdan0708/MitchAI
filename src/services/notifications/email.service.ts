/**
 * EMAIL NOTIFICATION SERVICE
 *
 * Handles transactional emails:
 * - Welcome emails
 * - Review alerts
 * - Order notifications
 * - Account notifications
 *
 * Uses SendGrid in production, mock console logging in development
 */

import { Pool } from 'pg';
import sgMail from '@sendgrid/mail';

// ============================================================================
// TYPES
// ============================================================================

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface EmailNotificationPreferences {
  reviewAlerts: boolean;
  orderNotifications: boolean;
  weeklyDigest: boolean;
  marketingEmails: boolean;
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

const TEMPLATES = {
  welcome: (data: { firstName: string; businessName: string; loginUrl: string }): EmailTemplate => ({
    subject: `Welcome to Mitch's AI Hospitality Platform!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fff; padding: 30px; border: 1px solid #e1e1e1; border-top: none; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Mitch's AI</h1>
          </div>
          <div class="content">
            <h2>Hi ${data.firstName},</h2>
            <p>Welcome to Mitch's AI Hospitality Platform! We're thrilled to have <strong>${data.businessName}</strong> join our community.</p>
            <p>Here's what you can do now:</p>
            <ul>
              <li>Add your menu items and let AI enhance descriptions</li>
              <li>Connect your Google Business Profile to import reviews</li>
              <li>Set up your AI chat assistant</li>
              <li>Explore analytics and insights</li>
            </ul>
            <a href="${data.loginUrl}" class="button">Go to Dashboard</a>
            <p>Your 14-day free trial has started. Enjoy exploring all our features!</p>
            <p>Best regards,<br>The Mitch's AI Team</p>
          </div>
          <div class="footer">
            <p>Need help? Reply to this email or visit our support center.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Welcome to Mitch's AI Hospitality Platform!

Hi ${data.firstName},

Welcome! We're thrilled to have ${data.businessName} join our community.

Here's what you can do now:
- Add your menu items and let AI enhance descriptions
- Connect your Google Business Profile to import reviews
- Set up your AI chat assistant
- Explore analytics and insights

Go to your dashboard: ${data.loginUrl}

Your 14-day free trial has started. Enjoy exploring all our features!

Best regards,
The Mitch's AI Team
    `.trim(),
  }),

  newReview: (data: {
    businessName: string;
    reviewerName: string;
    rating: number;
    reviewText: string;
    platform: string;
    dashboardUrl: string;
  }): EmailTemplate => ({
    subject: `New ${data.rating}-star review on ${data.platform}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${data.rating >= 4 ? '#10b981' : data.rating >= 3 ? '#f59e0b' : '#ef4444'}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fff; padding: 30px; border: 1px solid #e1e1e1; border-top: none; }
          .review-box { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .stars { color: #fbbf24; font-size: 24px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Review Alert</h2>
          </div>
          <div class="content">
            <p><strong>${data.businessName}</strong> received a new review on <strong>${data.platform}</strong>:</p>
            <div class="review-box">
              <div class="stars">${'★'.repeat(data.rating)}${'☆'.repeat(5 - data.rating)}</div>
              <p><strong>${data.reviewerName}</strong></p>
              <p>"${data.reviewText}"</p>
            </div>
            <p>Use our AI to generate a personalized response:</p>
            <a href="${data.dashboardUrl}" class="button">Respond to Review</a>
          </div>
          <div class="footer">
            <p>Manage your notification preferences in Settings.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
New Review Alert for ${data.businessName}

You received a new ${data.rating}-star review on ${data.platform}:

${data.reviewerName}: "${data.reviewText}"

Respond to this review: ${data.dashboardUrl}
    `.trim(),
  }),

  orderConfirmation: (data: {
    orderNumber: string;
    customerName: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    total: number;
    estimatedTime: string;
  }): EmailTemplate => ({
    subject: `Order #${data.orderNumber} Confirmed`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fff; padding: 30px; border: 1px solid #e1e1e1; border-top: none; }
          .order-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .order-table th, .order-table td { padding: 10px; text-align: left; border-bottom: 1px solid #e1e1e1; }
          .total-row { font-weight: bold; font-size: 18px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Order Confirmed!</h2>
          </div>
          <div class="content">
            <p>Hi ${data.customerName},</p>
            <p>Thank you for your order! Here are the details:</p>
            <p><strong>Order #${data.orderNumber}</strong></p>
            <table class="order-table">
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
              </tr>
              ${data.items.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.quantity}</td>
                  <td>$${item.price.toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="2">Total</td>
                <td>$${data.total.toFixed(2)}</td>
              </tr>
            </table>
            <p><strong>Estimated ready time:</strong> ${data.estimatedTime}</p>
          </div>
          <div class="footer">
            <p>Questions about your order? Contact the restaurant directly.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Order Confirmed!

Hi ${data.customerName},

Thank you for your order #${data.orderNumber}!

Items:
${data.items.map(item => `- ${item.name} x${item.quantity}: $${item.price.toFixed(2)}`).join('\n')}

Total: $${data.total.toFixed(2)}

Estimated ready time: ${data.estimatedTime}
    `.trim(),
  }),

  exportReady: (data: {
    businessName: string;
    exportType: string;
    downloadUrl: string;
    expiresAt: string;
    fileSize: string;
  }): EmailTemplate => ({
    subject: `Your data export is ready - ${data.businessName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fff; padding: 30px; border: 1px solid #e1e1e1; border-top: none; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .info-box { background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .warning { color: #f59e0b; font-size: 14px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Data Export Ready</h1>
          </div>
          <div class="content">
            <h2>Your export is complete!</h2>
            <p>Your ${data.exportType} data export for <strong>${data.businessName}</strong> is now ready for download.</p>
            <div class="info-box">
              <p><strong>Export Type:</strong> ${data.exportType}</p>
              <p><strong>File Size:</strong> ${data.fileSize}</p>
              <p><strong>Expires:</strong> ${data.expiresAt}</p>
            </div>
            <a href="${data.downloadUrl}" class="button">Download Export</a>
            <p class="warning">Note: This download link will expire in 7 days. Please download your data before then.</p>
          </div>
          <div class="footer">
            <p>This export was requested from your Mitch's AI dashboard.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Your Data Export is Ready

Your ${data.exportType} data export for ${data.businessName} is now ready for download.

Export Type: ${data.exportType}
File Size: ${data.fileSize}
Expires: ${data.expiresAt}

Download your export: ${data.downloadUrl}

Note: This download link will expire in 7 days.
    `.trim(),
  }),

  weeklyDigest: (data: {
    businessName: string;
    weekOf: string;
    stats: {
      revenue: number;
      orders: number;
      newReviews: number;
      avgRating: number;
    };
    dashboardUrl: string;
  }): EmailTemplate => ({
    subject: `Weekly Digest: ${data.businessName} - ${data.weekOf}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fff; padding: 30px; border: 1px solid #e1e1e1; border-top: none; }
          .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
          .stat-card { background: #f9fafb; padding: 20px; border-radius: 8px; text-align: center; }
          .stat-value { font-size: 28px; font-weight: bold; color: #667eea; }
          .stat-label { color: #666; font-size: 14px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Weekly Digest</h2>
            <p>${data.weekOf}</p>
          </div>
          <div class="content">
            <h3>Hi ${data.businessName} Team,</h3>
            <p>Here's your weekly performance summary:</p>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value">$${data.stats.revenue.toLocaleString()}</div>
                <div class="stat-label">Revenue</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${data.stats.orders}</div>
                <div class="stat-label">Orders</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${data.stats.newReviews}</div>
                <div class="stat-label">New Reviews</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${data.stats.avgRating.toFixed(1)}</div>
                <div class="stat-label">Avg Rating</div>
              </div>
            </div>
            <p style="text-align: center;">
              <a href="${data.dashboardUrl}" class="button">View Full Dashboard</a>
            </p>
          </div>
          <div class="footer">
            <p>Manage your notification preferences in Settings.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Weekly Digest - ${data.businessName}
Week of ${data.weekOf}

Performance Summary:
- Revenue: $${data.stats.revenue.toLocaleString()}
- Orders: ${data.stats.orders}
- New Reviews: ${data.stats.newReviews}
- Average Rating: ${data.stats.avgRating.toFixed(1)}

View your full dashboard: ${data.dashboardUrl}
    `.trim(),
  }),
};

// ============================================================================
// EMAIL SERVICE
// ============================================================================

export class EmailService {
  private pool: Pool;
  private fromEmail: string;
  private fromName: string;
  private useSendGrid: boolean;

  constructor(pool: Pool) {
    this.pool = pool;
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@mitchs.ai';
    this.fromName = process.env.EMAIL_FROM_NAME || "Mitch's AI";

    // Initialize SendGrid if API key is provided
    const sendGridKey = process.env.SENDGRID_API_KEY;
    this.useSendGrid = Boolean(sendGridKey) && process.env.NODE_ENV === 'production';

    if (sendGridKey) {
      sgMail.setApiKey(sendGridKey);
    }
  }

  /**
   * Send an email
   * Uses SendGrid in production, logs to console in development
   */
  async send(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string }> {
    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const fromAddress = options.from || `${this.fromName} <${this.fromEmail}>`;

    // Use SendGrid in production
    if (this.useSendGrid) {
      try {
        const [response] = await sgMail.send({
          to: options.to,
          from: fromAddress,
          subject: options.subject,
          html: options.html,
          text: options.text,
          replyTo: options.replyTo,
        });

        const sgMessageId = response.headers['x-message-id'] || messageId;

        // Log to database for tracking
        await this.logEmail(options.to, fromAddress, options.subject, 'sent', sgMessageId);

        return { success: true, messageId: sgMessageId };
      } catch (error) {
        console.error('SendGrid error:', error);
        await this.logEmail(options.to, fromAddress, options.subject, 'failed', messageId);
        throw error;
      }
    }

    // Log email in development (mock mode)
    console.log('='.repeat(60));
    console.log('EMAIL NOTIFICATION (Development Mode)');
    console.log('='.repeat(60));
    console.log('To:', options.to);
    console.log('From:', fromAddress);
    console.log('Subject:', options.subject);
    console.log('Message ID:', messageId);
    console.log('-'.repeat(60));
    console.log('Text Preview:', options.text?.substring(0, 200) || '(HTML only)');
    console.log('='.repeat(60));

    // Log to database for tracking
    await this.logEmail(options.to, fromAddress, options.subject, 'sent', messageId);

    return { success: true, messageId };
  }

  /**
   * Log email to database for tracking
   */
  private async logEmail(
    to: string,
    from: string,
    subject: string,
    status: string,
    messageId: string
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO email_logs (
          id, to_email, from_email, subject, status, message_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [messageId, to, from, subject, status, messageId]
      );
    } catch {
      // Table might not exist in demo mode - silently ignore
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcome(
    to: string,
    firstName: string,
    businessName: string
  ): Promise<{ success: boolean; messageId?: string }> {
    const template = TEMPLATES.welcome({
      firstName,
      businessName,
      loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/dashboard`,
    });

    return this.send({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send new review notification
   */
  async sendReviewAlert(
    to: string,
    data: {
      businessName: string;
      reviewerName: string;
      rating: number;
      reviewText: string;
      platform: string;
    }
  ): Promise<{ success: boolean; messageId?: string }> {
    const template = TEMPLATES.newReview({
      ...data,
      dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/dashboard/reviews`,
    });

    return this.send({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send order confirmation to customer
   */
  async sendOrderConfirmation(
    to: string,
    data: {
      orderNumber: string;
      customerName: string;
      items: Array<{ name: string; quantity: number; price: number }>;
      total: number;
      estimatedTime: string;
    }
  ): Promise<{ success: boolean; messageId?: string }> {
    const template = TEMPLATES.orderConfirmation(data);

    return this.send({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send weekly digest email
   */
  async sendWeeklyDigest(
    to: string,
    businessName: string,
    stats: {
      revenue: number;
      orders: number;
      newReviews: number;
      avgRating: number;
    }
  ): Promise<{ success: boolean; messageId?: string }> {
    const weekOf = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const template = TEMPLATES.weeklyDigest({
      businessName,
      weekOf,
      stats,
      dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/dashboard`,
    });

    return this.send({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send export ready notification
   */
  async sendExportReady(
    to: string,
    data: {
      businessName: string;
      exportType: string;
      downloadUrl: string;
      expiresAt: Date;
      fileSize: number;
    }
  ): Promise<{ success: boolean; messageId?: string }> {
    // Format file size
    const formatFileSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const template = TEMPLATES.exportReady({
      businessName: data.businessName,
      exportType: data.exportType,
      downloadUrl: data.downloadUrl,
      expiresAt: data.expiresAt.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
      fileSize: formatFileSize(data.fileSize),
    });

    return this.send({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Get notification preferences for a user
   */
  async getPreferences(userId: string): Promise<EmailNotificationPreferences> {
    try {
      const result = await this.pool.query(
        `SELECT notification_settings FROM tenant_users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length > 0 && result.rows[0].notification_settings) {
        return result.rows[0].notification_settings;
      }
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
    }

    // Return defaults
    return {
      reviewAlerts: true,
      orderNotifications: true,
      weeklyDigest: true,
      marketingEmails: false,
    };
  }

  /**
   * Update notification preferences for a user
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<EmailNotificationPreferences>
  ): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE tenant_users
         SET notification_settings = COALESCE(notification_settings, '{}'::jsonb) || $1::jsonb
         WHERE id = $2`,
        [JSON.stringify(preferences), userId]
      );
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      throw error;
    }
  }
}

export default EmailService;
