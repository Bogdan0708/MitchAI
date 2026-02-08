/**
 * EMAIL SERVICE
 * 
 * Sends transactional emails via AWS SES
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export class EmailService {
  private ses: SESClient;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.ses = new SESClient({ 
      region: process.env.AWS_REGION || 'eu-west-2' 
    });
    this.fromEmail = process.env.SES_FROM_EMAIL || 'noreply@mitchfromtransylvania.com';
    this.fromName = process.env.SES_FROM_NAME || 'Mitch Platform';
  }

  async send(options: EmailOptions): Promise<boolean> {
    try {
      const toAddresses = Array.isArray(options.to) ? options.to : [options.to];
      
      const command = new SendEmailCommand({
        Source: `${this.fromName} <${this.fromEmail}>`,
        Destination: {
          ToAddresses: toAddresses,
        },
        Message: {
          Subject: {
            Data: options.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: options.html,
              Charset: 'UTF-8',
            },
            ...(options.text && {
              Text: {
                Data: options.text,
                Charset: 'UTF-8',
              },
            }),
          },
        },
        ...(options.replyTo && {
          ReplyToAddresses: [options.replyTo],
        }),
      });

      await this.ses.send(command);
      console.log(`[Email] Sent to ${toAddresses.join(', ')}: ${options.subject}`);
      return true;
    } catch (error: any) {
      console.error('[Email] Failed to send:', error.message);
      return false;
    }
  }

  // ============================================================================
  // EMAIL TEMPLATES
  // ============================================================================

  async sendOrderAlert(to: string, order: {
    orderNumber: string;
    total: number;
    items: Array<{ name: string; quantity: number }>;
    createdAt: Date;
  }): Promise<boolean> {
    const itemsList = order.items
      .map(i => `<li>${i.quantity}x ${i.name}</li>`)
      .join('');

    return this.send({
      to,
      subject: `🧛 New Order: ${order.orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8B0000;">New Order Received!</h2>
          <p><strong>Order:</strong> ${order.orderNumber}</p>
          <p><strong>Total:</strong> £${order.total.toFixed(2)}</p>
          <p><strong>Time:</strong> ${order.createdAt.toLocaleString('en-GB')}</p>
          <h3>Items:</h3>
          <ul>${itemsList}</ul>
          <hr style="border: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This is an automated notification from Mitch Platform.
          </p>
        </div>
      `,
    });
  }

  async sendDailySummary(to: string, summary: {
    date: string;
    totalOrders: number;
    totalRevenue: number;
    topItems: Array<{ name: string; count: number }>;
  }): Promise<boolean> {
    const topItemsList = summary.topItems
      .map(i => `<li>${i.name}: ${i.count} sold</li>`)
      .join('');

    return this.send({
      to,
      subject: `📊 Daily Summary: ${summary.date}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8B0000;">Daily Sales Summary</h2>
          <p><strong>Date:</strong> ${summary.date}</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 24px;"><strong>${summary.totalOrders}</strong> orders</p>
            <p style="margin: 5px 0 0; font-size: 24px;"><strong>£${summary.totalRevenue.toFixed(2)}</strong> revenue</p>
          </div>
          ${summary.topItems.length > 0 ? `
            <h3>Top Sellers:</h3>
            <ol>${topItemsList}</ol>
          ` : ''}
          <hr style="border: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            Mitch Platform - Your AI-powered restaurant assistant
          </p>
        </div>
      `,
    });
  }

  async sendErrorAlert(to: string, error: {
    message: string;
    endpoint?: string;
    timestamp: Date;
  }): Promise<boolean> {
    return this.send({
      to,
      subject: `⚠️ Error Alert: ${error.message.substring(0, 50)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #cc0000;">Error Alert</h2>
          <p><strong>Time:</strong> ${error.timestamp.toISOString()}</p>
          ${error.endpoint ? `<p><strong>Endpoint:</strong> ${error.endpoint}</p>` : ''}
          <div style="background: #fff0f0; padding: 15px; border-radius: 4px; border-left: 4px solid #cc0000;">
            <code>${error.message}</code>
          </div>
          <p style="margin-top: 20px;">
            <a href="https://sentry.io" style="color: #8B0000;">View in Sentry →</a>
          </p>
        </div>
      `,
    });
  }
}

// Singleton instance
let emailService: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailService) {
    emailService = new EmailService();
  }
  return emailService;
}
