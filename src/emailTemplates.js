// Email Templates Module for Synk Auto-Trial System
// Provides HTML email templates for trial lifecycle notifications

/**
 * Base HTML wrapper for all emails
 */
function emailWrapper(content) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Synk</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #6366f1; font-size: 32px; font-weight: 700;">Synk</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                Synk - Seamless Google Calendar & Notion Sync
              </p>
              <p style="margin: 10px 0 0; color: #9ca3af; font-size: 12px;">
                <a href="https://synk-official.com" style="color: #6366f1; text-decoration: none;">Visit Website</a> | 
                <a href="https://synk-official.com/support" style="color: #6366f1; text-decoration: none;">Support</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Trial Welcome Email - Sent when user signs up
 */
function trial_welcome(variables) {
  const { email, days_remaining, trial_ends_at, upgrade_url } = variables;
  const endDate = new Date(trial_ends_at).toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  const content = `
    <h2 style="margin: 0 0 20px; color: #111827; font-size: 24px; font-weight: 600;">
      Welcome to Synk Pro! 🎉
    </h2>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">
      Hi there,
    </p>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">
      You've just unlocked <strong>${days_remaining} days of Synk Pro</strong> features! Your trial will run until <strong>${endDate}</strong>.
    </p>
    <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <h3 style="margin: 0 0 8px; color: #166534; font-size: 16px; font-weight: 600;">What you get with Pro:</h3>
      <ul style="margin: 8px 0 0; padding-left: 20px; color: #166534;">
        <li style="margin-bottom: 4px;">Unlimited Google Calendar connections</li>
        <li style="margin-bottom: 4px;">Unlimited Notion database connections</li>
        <li style="margin-bottom: 4px;">Automatic live sync every 7 seconds</li>
        <li style="margin-bottom: 4px;">Manual and incremental sync</li>
        <li>Priority support</li>
      </ul>
    </div>
    <p style="margin: 20px 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">
      Start syncing your calendars and tasks now to experience the full power of Synk!
    </p>
    <table role="presentation" style="margin: 30px 0;">
      <tr>
        <td style="border-radius: 6px; background-color: #6366f1;">
          <a href="${upgrade_url}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
            Upgrade to Keep Pro Access
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Questions? We're here to help at <a href="https://synk-official.com/support" style="color: #6366f1; text-decoration: none;">support</a>.
    </p>
  `;

  return {
    subject: `Welcome to Synk Pro - Your ${days_remaining}-Day Trial Starts Now!`,
    html: emailWrapper(content)
  };
}

/**
 * Trial Expiring Soon Email - Sent 2 days before expiration
 */
function trial_expiring_soon(variables) {
  const { email, days_remaining, trial_ends_at, upgrade_url } = variables;
  const endDate = new Date(trial_ends_at).toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric'
  });

  const content = `
    <h2 style="margin: 0 0 20px; color: #111827; font-size: 24px; font-weight: 600;">
      Your Trial Ends in ${days_remaining} Days ⏰
    </h2>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">
      Hi there,
    </p>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">
      Just a friendly reminder that your Synk Pro trial will expire on <strong>${endDate}</strong>.
    </p>
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #92400e; font-size: 15px; line-height: 1.5;">
        <strong>⚠️ What happens when your trial ends:</strong><br>
        • Automatic sync will stop<br>
        • You'll be limited to 1 calendar and 1 database<br>
        • Manual sync only
      </p>
    </div>
    <p style="margin: 20px 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">
      Don't lose access to the features you've been using! Upgrade now to keep your workflow seamless.
    </p>
    <table role="presentation" style="margin: 30px 0;">
      <tr>
        <td style="border-radius: 6px; background-color: #f59e0b;">
          <a href="${upgrade_url}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
            Upgrade to Pro Now
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Still deciding? <a href="https://synk-official.com/pricing" style="color: #6366f1; text-decoration: none;">View our pricing</a>
    </p>
  `;

  return {
    subject: `⏰ Only ${days_remaining} Days Left on Your Synk Pro Trial`,
    html: emailWrapper(content)
  };
}

/**
 * Trial Expired Email - Sent when trial ends and user is downgraded
 */
function trial_expired(variables) {
  const { email, upgrade_url, support_url } = variables;

  const content = `
    <h2 style="margin: 0 0 20px; color: #111827; font-size: 24px; font-weight: 600;">
      Your Trial Has Ended
    </h2>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">
      Hi there,
    </p>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">
      Your Synk Pro trial has expired, and your account has been moved to the Free plan.
    </p>
    <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.5;">
        <strong>Your Free plan includes:</strong><br>
        ✓ 1 Google Calendar connection<br>
        ✓ 1 Notion database connection<br>
        ✓ Manual sync only
      </p>
    </div>
    <p style="margin: 20px 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">
      Want to get back to unlimited syncing and automatic updates? Upgrade to Pro anytime!
    </p>
    <table role="presentation" style="margin: 30px 0;">
      <tr>
        <td style="border-radius: 6px; background-color: #6366f1;">
          <a href="${upgrade_url}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
            Upgrade to Pro
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Have questions? <a href="${support_url}" style="color: #6366f1; text-decoration: none;">Contact support</a>
    </p>
  `;

  return {
    subject: 'Your Synk Pro Trial Has Ended',
    html: emailWrapper(content)
  };
}

/**
 * Checkout Abandoned Email - Sent 24 hours after incomplete checkout
 */
function checkout_abandoned(variables) {
  const { email, upgrade_url } = variables;

  const content = `
    <h2 style="margin: 0 0 20px; color: #111827; font-size: 24px; font-weight: 600;">
      Complete Your Upgrade to Synk Pro
    </h2>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">
      Hi there,
    </p>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">
      We noticed you started upgrading to Synk Pro but didn't complete the checkout. We'd love to have you as a Pro user!
    </p>
    <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #1e40af; font-size: 15px; line-height: 1.5;">
        <strong>💡 With Synk Pro you get:</strong><br>
        • Unlimited connections<br>
        • Automatic sync every 7 seconds<br>
        • Priority support<br>
        • All future Pro features
      </p>
    </div>
    <p style="margin: 20px 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">
      Ready to complete your upgrade? Just click below to pick up where you left off.
    </p>
    <table role="presentation" style="margin: 30px 0;">
      <tr>
        <td style="border-radius: 6px; background-color: #6366f1;">
          <a href="${upgrade_url}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
            Complete Upgrade
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Need help? <a href="https://synk-official.com/support" style="color: #6366f1; text-decoration: none;">We're here to help</a>
    </p>
  `;

  return {
    subject: 'Complete Your Synk Pro Upgrade',
    html: emailWrapper(content)
  };
}

/**
 * Subscription Cancelled Email - Sent when user cancels Pro subscription
 */
function subscription_cancelled(variables) {
  const { email, support_url } = variables;

  const content = `
    <h2 style="margin: 0 0 20px; color: #111827; font-size: 24px; font-weight: 600;">
      Your Subscription Has Been Cancelled
    </h2>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">
      Hi there,
    </p>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">
      We've received your cancellation request. Your Synk Pro subscription has been cancelled and you've been moved to the Free plan.
    </p>
    <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.5;">
        <strong>What's changing:</strong><br>
        • Automatic sync has stopped<br>
        • You're limited to 1 calendar and 1 database<br>
        • Only manual sync is available
      </p>
    </div>
    <p style="margin: 20px 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">
      We're sorry to see you go! If there's anything we could have done better, we'd love to hear from you.
    </p>
    <table role="presentation" style="margin: 30px 0;">
      <tr>
        <td style="border-radius: 6px; background-color: #6b7280;">
          <a href="${support_url}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
            Send Feedback
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Changed your mind? You can <a href="https://synk-official.com/upgrade" style="color: #6366f1; text-decoration: none;">reactivate Pro</a> anytime.
    </p>
  `;

  return {
    subject: 'Your Synk Pro Subscription Has Been Cancelled',
    html: emailWrapper(content)
  };
}

module.exports = {
  trial_welcome,
  trial_expiring_soon,
  trial_expired,
  checkout_abandoned,
  subscription_cancelled
};
