/**
 * Email Service
 *
 * Transactional email handling using SendGrid
 * Supports multiple email types:
 * - Welcome emails
 * - Password reset
 * - Export notifications
 * - Account alerts
 */

export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    type: string;
  }>;
}

export class EmailService {
  private apiKey: string;
  private fromEmail: string;
  private fromName: string;
  private enabled: boolean;

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY || '';
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@mitch-ai.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'Mitch AI Platform';
    this.enabled = !!this.apiKey;

    if (!this.enabled) {
      console.warn('Email service disabled: SENDGRID_API_KEY not configured');
    }
  }

  /**
   * Send an email via SendGrid
   */
  async send(options: SendEmailOptions): Promise<boolean> {
    if (!this.enabled) {
      console.log('Email not sent (service disabled):', options.subject);
      return false;
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: options.to }] }],
          from: {
            email: options.from || this.fromEmail,
            name: this.fromName
          },
          reply_to: options.replyTo ? { email: options.replyTo } : undefined,
          subject: options.subject,
          content: [
            { type: 'text/plain', value: options.text },
            ...(options.html ? [{ type: 'text/html', value: options.html }] : [])
          ],
          attachments: options.attachments?.map((a) => ({
            filename: a.filename,
            content: Buffer.from(a.content).toString('base64'),
            type: a.type
          }))
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('SendGrid error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send welcome email to new tenant
   */
  async sendWelcomeEmail(
    email: string,
    businessName: string,
    adminName: string,
    loginUrl: string
  ): Promise<boolean> {
    const template = this.getWelcomeTemplate(businessName, adminName, loginUrl);
    return this.send({
      to: email,
      ...template
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    resetUrl: string,
    expiresIn: string = '1 hour'
  ): Promise<boolean> {
    const template = this.getPasswordResetTemplate(resetUrl, expiresIn);
    return this.send({
      to: email,
      ...template
    });
  }

  /**
   * Send data export completion email
   */
  async sendExportReadyEmail(
    email: string,
    exportType: string,
    downloadUrl: string,
    expiresAt: Date
  ): Promise<boolean> {
    const template = this.getExportReadyTemplate(exportType, downloadUrl, expiresAt);
    return this.send({
      to: email,
      ...template
    });
  }

  /**
   * Send account lockout notification
   */
  async sendAccountLockoutEmail(
    email: string,
    ipAddress: string,
    unlockTime: Date
  ): Promise<boolean> {
    const template = this.getAccountLockoutTemplate(ipAddress, unlockTime);
    return this.send({
      to: email,
      ...template
    });
  }

  /**
   * Send payment failed notification
   */
  async sendPaymentFailedEmail(
    email: string,
    businessName: string,
    amount: number,
    updatePaymentUrl: string
  ): Promise<boolean> {
    const template = this.getPaymentFailedTemplate(businessName, amount, updatePaymentUrl);
    return this.send({
      to: email,
      ...template
    });
  }

  /**
   * Send subscription upgraded notification
   */
  async sendSubscriptionUpgradedEmail(
    email: string,
    businessName: string,
    newTier: string,
    features: string[]
  ): Promise<boolean> {
    const template = this.getSubscriptionUpgradedTemplate(businessName, newTier, features);
    return this.send({
      to: email,
      ...template
    });
  }

  // Email Templates

  private getWelcomeTemplate(
    businessName: string,
    adminName: string,
    loginUrl: string
  ): EmailTemplate {
    return {
      subject: `Welcome to Mitch AI Platform - ${businessName}`,
      text: `
Hi ${adminName},

Welcome to Mitch AI Platform! Your account for ${businessName} has been created successfully.

You can access your dashboard at: ${loginUrl}

Here's what you can do:
- Set up your menu and let AI enhance your descriptions
- Configure your AI chatbot for customer inquiries
- Manage reservations and orders
- Track analytics and ROI

If you have any questions, reply to this email or visit our help center.

Best regards,
The Mitch AI Team
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .features { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .feature { padding: 8px 0; border-bottom: 1px solid #eee; }
    .feature:last-child { border-bottom: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Mitch AI Platform</h1>
    </div>
    <div class="content">
      <p>Hi ${adminName},</p>
      <p>Welcome! Your account for <strong>${businessName}</strong> has been created successfully.</p>

      <a href="${loginUrl}" class="button">Access Your Dashboard</a>

      <div class="features">
        <h3>What you can do:</h3>
        <div class="feature">Set up your menu and let AI enhance your descriptions</div>
        <div class="feature">Configure your AI chatbot for customer inquiries</div>
        <div class="feature">Manage reservations and orders</div>
        <div class="feature">Track analytics and ROI</div>
      </div>

      <p>If you have any questions, reply to this email or visit our help center.</p>

      <p>Best regards,<br>The Mitch AI Team</p>
    </div>
  </div>
</body>
</html>
      `.trim()
    };
  }

  private getPasswordResetTemplate(resetUrl: string, expiresIn: string): EmailTemplate {
    return {
      subject: 'Reset Your Password - Mitch AI Platform',
      text: `
You requested a password reset for your Mitch AI Platform account.

Click this link to reset your password: ${resetUrl}

This link expires in ${expiresIn}.

If you didn't request this, please ignore this email.

Best regards,
The Mitch AI Team
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .warning { background: #fef3c7; padding: 10px; border-radius: 6px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset</h1>
    </div>
    <div class="content">
      <p>You requested a password reset for your Mitch AI Platform account.</p>

      <a href="${resetUrl}" class="button">Reset Password</a>

      <div class="warning">
        This link expires in ${expiresIn}.
      </div>

      <p>If you didn't request this, please ignore this email.</p>

      <p>Best regards,<br>The Mitch AI Team</p>
    </div>
  </div>
</body>
</html>
      `.trim()
    };
  }

  private getExportReadyTemplate(
    exportType: string,
    downloadUrl: string,
    expiresAt: Date
  ): EmailTemplate {
    const expiresFormatted = expiresAt.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return {
      subject: `Your Data Export is Ready - ${exportType}`,
      text: `
Your data export (${exportType}) is ready for download.

Download link: ${downloadUrl}

This link expires on ${expiresFormatted}.

Best regards,
The Mitch AI Team
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Export Ready</h1>
    </div>
    <div class="content">
      <p>Your data export (<strong>${exportType}</strong>) is ready for download.</p>

      <a href="${downloadUrl}" class="button">Download Export</a>

      <p><small>This link expires on ${expiresFormatted}.</small></p>

      <p>Best regards,<br>The Mitch AI Team</p>
    </div>
  </div>
</body>
</html>
      `.trim()
    };
  }

  private getAccountLockoutTemplate(ipAddress: string, unlockTime: Date): EmailTemplate {
    const unlockFormatted = unlockTime.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return {
      subject: 'Account Security Alert - Mitch AI Platform',
      text: `
Your account has been temporarily locked due to multiple failed login attempts.

IP Address: ${ipAddress}
Your account will be unlocked at: ${unlockFormatted}

If this wasn't you, please contact support immediately.

Best regards,
The Mitch AI Team
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #EF4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .alert { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Security Alert</h1>
    </div>
    <div class="content">
      <div class="alert">
        <strong>Your account has been temporarily locked</strong> due to multiple failed login attempts.
      </div>

      <p><strong>IP Address:</strong> ${ipAddress}</p>
      <p><strong>Unlock time:</strong> ${unlockFormatted}</p>

      <p>If this wasn't you, please contact support immediately.</p>

      <p>Best regards,<br>The Mitch AI Team</p>
    </div>
  </div>
</body>
</html>
      `.trim()
    };
  }

  private getPaymentFailedTemplate(
    businessName: string,
    amount: number,
    updatePaymentUrl: string
  ): EmailTemplate {
    return {
      subject: 'Payment Failed - Action Required',
      text: `
We were unable to process your payment of $${amount.toFixed(2)} for ${businessName}.

Please update your payment method to avoid service interruption: ${updatePaymentUrl}

Best regards,
The Mitch AI Team
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #F59E0B; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #F59E0B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Payment Failed</h1>
    </div>
    <div class="content">
      <p>We were unable to process your payment of <strong>$${amount.toFixed(2)}</strong> for <strong>${businessName}</strong>.</p>

      <a href="${updatePaymentUrl}" class="button">Update Payment Method</a>

      <p>Please update your payment method to avoid service interruption.</p>

      <p>Best regards,<br>The Mitch AI Team</p>
    </div>
  </div>
</body>
</html>
      `.trim()
    };
  }

  private getSubscriptionUpgradedTemplate(
    businessName: string,
    newTier: string,
    features: string[]
  ): EmailTemplate {
    const featuresList = features.map((f) => `- ${f}`).join('\n');
    const featuresHtml = features.map((f) => `<li>${f}</li>`).join('');

    return {
      subject: `Subscription Upgraded to ${newTier} - ${businessName}`,
      text: `
Great news! Your subscription for ${businessName} has been upgraded to ${newTier}.

New features now available:
${featuresList}

Start exploring your new capabilities in the dashboard.

Best regards,
The Mitch AI Team
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .features { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Subscription Upgraded!</h1>
    </div>
    <div class="content">
      <p>Great news! Your subscription for <strong>${businessName}</strong> has been upgraded to <strong>${newTier}</strong>.</p>

      <div class="features">
        <h3>New features now available:</h3>
        <ul>${featuresHtml}</ul>
      </div>

      <p>Start exploring your new capabilities in the dashboard.</p>

      <p>Best regards,<br>The Mitch AI Team</p>
    </div>
  </div>
</body>
</html>
      `.trim()
    };
  }
}

// Export singleton instance
export const emailService = new EmailService();
