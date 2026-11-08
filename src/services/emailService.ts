/**
 * Email Service
 * Supports multiple providers: SendGrid, Resend, SMTP
 * Configuration managed via admin settings
 */

import { supabase } from '@/integrations/supabase/client';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

interface EmailSettings {
  provider: 'sendgrid' | 'resend' | 'smtp';
  sendgrid_api_key?: string;
  resend_api_key?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  smtp_from_email?: string;
  smtp_from_name?: string;
  notifications_enabled: boolean;
}

/**
 * Fetch email settings from admin_settings table
 */
async function getEmailSettings(): Promise<EmailSettings | null> {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'email_provider',
        'sendgrid_api_key',
        'resend_api_key',
        'smtp_host',
        'smtp_port',
        'smtp_username',
        'smtp_password',
        'smtp_from_email',
        'smtp_from_name',
        'email_notifications_enabled'
      ]);

    if (error) throw error;

    const settings: any = {};
    data?.forEach(item => {
      const key = item.setting_key.replace('email_', '');
      settings[key] = item.setting_value;
    });

    if (!settings.notifications_enabled || settings.notifications_enabled === 'false') {
      console.log('📧 Email notifications are disabled');
      return null;
    }

    return {
      provider: settings.provider || 'smtp',
      sendgrid_api_key: settings.sendgrid_api_key,
      resend_api_key: settings.resend_api_key,
      smtp_host: settings.smtp_host,
      smtp_port: parseInt(settings.smtp_port) || 587,
      smtp_username: settings.smtp_username,
      smtp_password: settings.smtp_password,
      smtp_from_email: settings.smtp_from_email,
      smtp_from_name: settings.smtp_from_name || 'IFA Connect',
      notifications_enabled: true
    };
  } catch (error) {
    console.error('Error fetching email settings:', error);
    return null;
  }
}

/**
 * Send email using SendGrid
 */
async function sendViaSendGrid(options: EmailOptions, apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: options.to }],
          subject: options.subject,
        }],
        from: {
          email: options.from || 'noreply@ifa-connect.com',
          name: 'IFA Connect'
        },
        content: [
          {
            type: 'text/html',
            value: options.html
          },
          ...(options.text ? [{
            type: 'text/plain',
            value: options.text
          }] : [])
        ],
        ...(options.replyTo ? { reply_to: { email: options.replyTo } } : {})
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('SendGrid error:', error);
      return false;
    }

    console.log('✅ Email sent via SendGrid to:', options.to);
    return true;
  } catch (error) {
    console.error('SendGrid send error:', error);
    return false;
  }
}

/**
 * Send email using Resend
 */
async function sendViaResend(options: EmailOptions, apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: options.from || 'IFA Connect <noreply@ifa-connect.com>',
        to: [options.to],
        subject: options.subject,
        html: options.html,
        ...(options.text ? { text: options.text } : {}),
        ...(options.replyTo ? { reply_to: options.replyTo } : {})
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Resend error:', error);
      return false;
    }

    console.log('✅ Email sent via Resend to:', options.to);
    return true;
  } catch (error) {
    console.error('Resend send error:', error);
    return false;
  }
}

/**
 * Send email using SMTP (via Supabase Edge Function)
 * Note: Direct SMTP from browser is not possible, needs server-side function
 */
async function sendViaSMTP(options: EmailOptions, settings: EmailSettings): Promise<boolean> {
  try {
    // Call Supabase Edge Function that handles SMTP
    const { data, error } = await supabase.functions.invoke('send-email-smtp', {
      body: {
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        from: options.from || `${settings.smtp_from_name} <${settings.smtp_from_email}>`,
        replyTo: options.replyTo,
        smtp: {
          host: settings.smtp_host,
          port: settings.smtp_port,
          username: settings.smtp_username,
          password: settings.smtp_password
        }
      }
    });

    if (error) {
      console.error('SMTP error:', error);
      return false;
    }

    console.log('✅ Email sent via SMTP to:', options.to);
    return true;
  } catch (error) {
    console.error('SMTP send error:', error);
    return false;
  }
}

/**
 * Main function to send email
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const settings = await getEmailSettings();

  if (!settings) {
    console.log('📧 Email notifications disabled or not configured');
    return false;
  }

  try {
    switch (settings.provider) {
      case 'sendgrid':
        if (!settings.sendgrid_api_key) {
          console.error('SendGrid API key not configured');
          return false;
        }
        return await sendViaSendGrid(options, settings.sendgrid_api_key);

      case 'resend':
        if (!settings.resend_api_key) {
          console.error('Resend API key not configured');
          return false;
        }
        return await sendViaResend(options, settings.resend_api_key);

      case 'smtp':
        if (!settings.smtp_host || !settings.smtp_username || !settings.smtp_password) {
          console.error('SMTP settings not fully configured');
          return false;
        }
        return await sendViaSMTP(options, settings);

      default:
        console.error('Unknown email provider:', settings.provider);
        return false;
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Email Templates
 */

export const emailTemplates = {
  bookingConfirmation: (data: {
    userName: string;
    babalawoName: string;
    sessionDate: string;
    sessionTime: string;
    amount: number;
    sessionId: string;
  }) => ({
    subject: 'Booking Confirmation - IFA Connect',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .detail-label { font-weight: bold; color: #6b7280; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Booking Confirmed! ✅</h1>
            </div>
            <div class="content">
              <p>Hi ${data.userName},</p>
              <p>Your consultation with <strong>${data.babalawoName}</strong> has been successfully booked.</p>

              <div class="details">
                <div class="detail-row">
                  <span class="detail-label">Babalawo</span>
                  <span>${data.babalawoName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Date</span>
                  <span>${data.sessionDate}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Time</span>
                  <span>${data.sessionTime}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Amount Paid</span>
                  <span>₦${data.amount.toLocaleString()}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Session ID</span>
                  <span>${data.sessionId}</span>
                </div>
              </div>

              <p>Please join the session at the scheduled time. You'll receive a reminder 24 hours and 1 hour before your session.</p>

              <a href="${window.location.origin}/dashboard/user" class="button">View My Sessions</a>

              <p>If you need to reschedule or have any questions, please contact our support team.</p>
            </div>
            <div class="footer">
              <p>This email was sent by IFA Connect</p>
              <p>© ${new Date().getFullYear()} IFA Connect. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Booking Confirmed!

      Hi ${data.userName},

      Your consultation with ${data.babalawoName} has been successfully booked.

      Date: ${data.sessionDate}
      Time: ${data.sessionTime}
      Amount Paid: ₦${data.amount.toLocaleString()}
      Session ID: ${data.sessionId}

      Please join the session at the scheduled time.

      View your sessions: ${window.location.origin}/dashboard/user
    `
  }),

  walletTopUp: (data: {
    userName: string;
    amount: number;
    newBalance: number;
    reference: string;
  }) => ({
    subject: 'Wallet Top-Up Successful - IFA Connect',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .amount { font-size: 36px; font-weight: bold; color: #10b981; text-align: center; margin: 20px 0; }
            .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Wallet Topped Up! 💰</h1>
            </div>
            <div class="content">
              <p>Hi ${data.userName},</p>
              <p>Your wallet has been successfully topped up.</p>

              <div class="amount">₦${data.amount.toLocaleString()}</div>

              <div class="details">
                <p><strong>New Balance:</strong> ₦${data.newBalance.toLocaleString()}</p>
                <p><strong>Reference:</strong> ${data.reference}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
              </div>

              <p>You can now use your wallet balance to book consultations.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Wallet Topped Up!

      Hi ${data.userName},

      Amount Added: ₦${data.amount.toLocaleString()}
      New Balance: ₦${data.newBalance.toLocaleString()}
      Reference: ${data.reference}
    `
  }),

  instantSessionAlert: (data: {
    babalawoName: string;
    userName: string;
    sessionId: string;
  }) => ({
    subject: '🔔 New Instant Session Request - IFA Connect',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .urgent { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
            .button { display: inline-block; background: #f59e0b; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-size: 18px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 New Instant Session!</h1>
            </div>
            <div class="content">
              <p>Hi ${data.babalawoName},</p>

              <div class="urgent">
                <strong>URGENT:</strong> ${data.userName} is waiting for an instant consultation with you right now!
              </div>

              <p><strong>Session ID:</strong> ${data.sessionId}</p>

              <a href="${window.location.origin}/session/${data.sessionId}" class="button">Join Session Now</a>

              <p>Please join within the next 5 minutes to provide the best experience.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      NEW INSTANT SESSION REQUEST

      Hi ${data.babalawoName},

      ${data.userName} is waiting for an instant consultation!
      Session ID: ${data.sessionId}

      Join now: ${window.location.origin}/session/${data.sessionId}
    `
  })
};

/**
 * Helper function to send booking confirmation email
 */
export async function sendBookingConfirmation(data: Parameters<typeof emailTemplates.bookingConfirmation>[0], userEmail: string) {
  const template = emailTemplates.bookingConfirmation(data);
  return await sendEmail({
    to: userEmail,
    subject: template.subject,
    html: template.html,
    text: template.text
  });
}

/**
 * Helper function to send wallet top-up email
 */
export async function sendWalletTopUpConfirmation(data: Parameters<typeof emailTemplates.walletTopUp>[0], userEmail: string) {
  const template = emailTemplates.walletTopUp(data);
  return await sendEmail({
    to: userEmail,
    subject: template.subject,
    html: template.html,
    text: template.text
  });
}

/**
 * Helper function to send instant session alert email
 */
export async function sendInstantSessionAlert(data: Parameters<typeof emailTemplates.instantSessionAlert>[0], babalawoEmail: string) {
  const template = emailTemplates.instantSessionAlert(data);
  return await sendEmail({
    to: babalawoEmail,
    subject: template.subject,
    html: template.html,
    text: template.text
  });
}
