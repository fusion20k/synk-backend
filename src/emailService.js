// Email Service Module for Synk Auto-Trial System
// Handles transactional email sending via Resend

const { Resend } = require('resend');
const emailTemplates = require('./emailTemplates');

let resend = null;

function getResendClient() {
  if (resend) {
    return resend;
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('[EmailService] Resend not configured. Emails will be logged but not sent.');
    return null;
  }

  resend = new Resend(apiKey);
  console.log('[EmailService] Resend client initialized');
  
  return resend;
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
    const template = emailTemplates[templateId];
    if (!template) {
      throw new Error(`Unknown email template: ${templateId}`);
    }

    const { subject, html } = template(variables);

    const resendClient = getResendClient();
    if (!resendClient) {
      console.log(`[EmailService] MOCK EMAIL (Resend not configured):`);
      console.log(`  To: ${to}`);
      console.log(`  Template: ${templateId}`);
      console.log(`  Subject: ${subject}`);
      console.log(`  Variables:`, variables);
      return;
    }

    const { data, error } = await resendClient.emails.send({
      from: process.env.RESEND_FROM || 'Synk <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      html: html
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log(`[EmailService] ✓ Email sent to ${to} (${templateId}):`, data.id);
  } catch (error) {
    console.error(`[EmailService] ✗ Failed to send email to ${to} (${templateId}):`, error.message);
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
