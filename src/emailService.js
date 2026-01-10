// Email Service Module for Synk Auto-Trial System
// Handles transactional email sending via Nodemailer

const nodemailer = require('nodemailer');
const emailTemplates = require('./emailTemplates');

// Create reusable transporter
let transporter = null;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const smtpConfig = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  };

  // Validate SMTP config
  if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
    console.warn('[EmailService] SMTP not configured. Emails will be logged but not sent.');
    return null;
  }

  transporter = nodemailer.createTransport(smtpConfig);
  
  // Verify connection on first use
  transporter.verify((error) => {
    if (error) {
      console.error('[EmailService] SMTP connection failed:', error.message);
    } else {
      console.log('[EmailService] SMTP connection verified');
    }
  });

  return transporter;
}

/**
 * Send transactional email
 * @param {string} to - Recipient email address
 * @param {string} templateId - Template ID (trial_welcome, trial_expiring_soon, etc.)
 * @param {Object} variables - Variables to inject into template
 * @returns {Promise<void>}
 */
async function sendEmail(to, templateId, variables = {}) {
  try {
    // Get template
    const template = emailTemplates[templateId];
    if (!template) {
      throw new Error(`Unknown email template: ${templateId}`);
    }

    const { subject, html } = template(variables);

    // Check if SMTP is configured
    const smtp = getTransporter();
    if (!smtp) {
      console.log(`[EmailService] MOCK EMAIL (SMTP not configured):`);
      console.log(`  To: ${to}`);
      console.log(`  Template: ${templateId}`);
      console.log(`  Subject: ${subject}`);
      console.log(`  Variables:`, variables);
      return; // Don't actually send
    }

    // Send email
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@synk-official.com',
      to: to,
      subject: subject,
      html: html
    };

    const info = await smtp.sendMail(mailOptions);
    console.log(`[EmailService] ✓ Email sent to ${to} (${templateId}):`, info.messageId);
  } catch (error) {
    console.error(`[EmailService] ✗ Failed to send email to ${to} (${templateId}):`, error.message);
    // Don't throw - we don't want email failures to break core functionality
  }
}

/**
 * Send welcome email when user starts trial
 * @param {string} email - User email
 * @param {number} daysRemaining - Days in trial
 * @param {string} trialEndsAt - ISO timestamp when trial ends
 */
async function sendTrialWelcomeEmail(email, daysRemaining, trialEndsAt) {
  return sendEmail(email, 'trial_welcome', {
    email,
    days_remaining: daysRemaining,
    trial_ends_at: trialEndsAt,
    upgrade_url: 'https://synk-official.com/upgrade'
  });
}

/**
 * Send warning email 2 days before trial expiration
 * @param {string} email - User email
 * @param {string} trialEndsAt - ISO timestamp when trial ends
 */
async function sendTrialExpiringEmail(email, trialEndsAt) {
  return sendEmail(email, 'trial_expiring_soon', {
    email,
    days_remaining: 2,
    trial_ends_at: trialEndsAt,
    upgrade_url: 'https://synk-official.com/upgrade'
  });
}

/**
 * Send notification when trial has expired
 * @param {string} email - User email
 */
async function sendTrialExpiredEmail(email) {
  return sendEmail(email, 'trial_expired', {
    email,
    upgrade_url: 'https://synk-official.com/upgrade',
    support_url: 'https://synk-official.com/support'
  });
}

/**
 * Send reminder for abandoned checkout (24 hours after)
 * @param {string} email - User email
 */
async function sendCheckoutAbandonedEmail(email) {
  return sendEmail(email, 'checkout_abandoned', {
    email,
    upgrade_url: 'https://synk-official.com/upgrade'
  });
}

/**
 * Send confirmation when subscription is cancelled
 * @param {string} email - User email
 */
async function sendSubscriptionCancelledEmail(email) {
  return sendEmail(email, 'subscription_cancelled', {
    email,
    support_url: 'https://synk-official.com/support'
  });
}

module.exports = {
  sendEmail,
  sendTrialWelcomeEmail,
  sendTrialExpiringEmail,
  sendTrialExpiredEmail,
  sendCheckoutAbandonedEmail,
  sendSubscriptionCancelledEmail
};
