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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; background-color: #1a1a1a; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">Synk</h1>
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
            <td style="padding: 20px 40px; text-align: center; border-top: 1px solid #2a2a2a;">
              <p style="margin: 0; color: #888888; font-size: 14px;">
                Synk - Seamless Google Calendar & Notion Sync
              </p>
              <p style="margin: 10px 0 0; color: #666666; font-size: 12px;">
                <a href="https://synk-official.com" style="color: #FF5733; text-decoration: none;">Visit Website</a> | 
                <a href="https://synk-official.com/support" style="color: #FF5733; text-decoration: none;">Support</a>
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
    <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 24px; font-weight: 600;">
      Welcome to Synk Pro! 🎉
    </h2>
    <p style="margin: 0 0 16px; color: #cccccc; font-size: 16px; line-height: 1.6;">
      Hi there,
    </p>
    <p style="margin: 0 0 16px; color: #cccccc; font-size: 16px; line-height: 1.6;">
      You've just unlocked <strong style="color: #ffffff;">${days_remaining} days of Synk Pro</strong> features! Your trial will run until <strong style="color: #ffffff;">${endDate}</strong>.
    </p>
    <div style="background-color: #2a2a2a; border-left: 4px solid #FF5733; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <h3 style="margin: 0 0 8px; color: #FF5733; font-size: 16px; font-weight: 600;">What you get with Pro:</h3>
      <ul style="margin: 8px 0 0; padding-left: 20px; color: #cccccc;">
        <li style="margin-bottom: 4px;">Unlimited Google Calendar connections</li>
        <li style="margin-bottom: 4px;">Unlimited Notion database connections</li>
        <li style="margin-bottom: 4px;">Automatic live sync every 7 seconds</li>
        <li style="margin-bottom: 4px;">Manual and incremental sync</li>
        <li>Priority support</li>
      </ul>
    </div>
    <p style="margin: 20px 0 16px; color: #cccccc; font-size: 16px; line-height: 1.6;">
      Start syncing your calendars and tasks now to experience the full power of Synk!
    </p>
    <table role="presentation" style="margin: 30px 0;">
      <tr>
        <td style="border-radius: 6px; background-color: #FF5733;">
          <a href="${upgrade_url}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
            Upgrade to Keep Pro Access
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 20px 0 0; color: #888888; font-size: 14px; line-height: 1.6;">
      Questions? We're here to help at <a href="https://synk-official.com/support" style="color: #FF5733; text-decoration: none;">support</a>.
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
    <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 24px; font-weight: 600;">
      Your Trial Ends in ${days_remaining} Days ⏰
    </h2>
    <p style="margin: 0 0 16px; color: #cccccc; font-size: 16px; line-height: 1.6;">
      Hi there,
    </p>
    <p style="margin: 0 0 16px; color: #cccccc; font-size: 16px; line-height: 1.6;">
      Just a friendly reminder that your Synk Pro trial will expire on <strong style="color: #ffffff;">${endDate}</strong>.
    </p>
    <div style="background-color: #2a2a2a; border-left: 4px solid #FFA500; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #FFA500; font-size: 15px; line-height: 1.5;">
        <strong>⚠️ What happens when your trial ends:</strong><br>
        <span style="color: #cccccc;">• Automatic sync will stop<br>
        • You'll be limited to 1 calendar and 1 database<br>
        • Manual sync only</span>
      </p>
    </div>
    <p style="margin: 20px 0 16px; color: #cccccc; font-size: 16px; line-height: 1.6;">
      Don't lose access to the features you've been using! Upgrade now to keep your workflow seamless.
    </p>
    <table role="presentation" style="margin: 30px 0;">
      <tr>
        <td style="border-radius: 6px; background-color: #FF5733;">
          <a href="${upgrade_url}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
            Upgrade to Pro Now
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 20px 0 0; color: #888888; font-size: 14px; line-height: 1.6;">
      Still deciding? <a href="https://synk-official.com/pricing" style="color: #FF5733; text-decoration: none;">View our pricing</a>
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
    <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 24px; font-weight: 600;">
      Your Trial Has Ended
    </h2>
    <p style="margin: 0 0 16px; color: #cccccc; font-size: 16px; line-height: 1.6;">
      Hi there,
    </p>
    <p style="margin: 0 0 16px; color: #cccccc; font-size: 16px; line-height: 1.6;">
      Your Synk Pro trial has expired, and your account has been moved to the Free plan.
    </p>
    <div style="background-color: #2a2a2a; border-left: 4px solid #888888; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #cccccc; font-size: 15px; line-height: 1.5;">
        <strong style="color: #ffffff;">Your Free plan includes:</strong><br>
        ✓ 1 Google Calendar connection<br>
        ✓ 1 Notion database connection<br>
        ✓ Manual sync only
      </p>
    </div>
    <p style="margin: 20px 0 16px; color: #cccccc; font-size: 16px; line-height: 1.6;">
      Want to get back to unlimited syncing and automatic updates? Upgrade to Pro anytime!
    </p>
    <table role="presentation" style="margin: 30px 0;">
      <tr>
        <td style="border-radius: 6px; background-color: #FF5733;">
          <a href="${upgrade_url}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
            Upgrade to Pro
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 20px 0 0; color: #888888; font-size: 14px; line-height: 1.6;">
      Have questions? <a href="${support_url}" style="color: #FF5733; text-decoration: none;">Contact support</a>
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
    <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 24px; font-weight: 600;">
      Complete Your Upgrade to Synk Pro
    </h2>
    <p style="margin: 0 0 16px; color: #cccccc; font-size: 16px; line-height: 1.6;">
      Hi there,
    </p>
    <p style="margin: 0 0 16px; color: #cccccc; font-size: 16px; line-height: 1.6;">
      We noticed you started upgrading to Synk Pro but didn't complete the checkout. We'd love to have you as a Pro user!
    </p>
    <div style="background-color: #2a2a2a; border-left: 4px solid #FF5733; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #cccccc; font-size: 15px; line-height: 1.5;">
        <strong style="color: #FF5733;">💡 With Synk Pro you get:</strong><br>
        • Unlimited connections<br>
        • Automatic sync every 7 seconds<br>
        • Priority support<br>
        • All future Pro features
      </p>
    </div>
    <p style="margin: 20px 0 16px; color: #cccccc; font-size: 16px; line-height: 1.6;">
      Ready to complete your upgrade? Just click below to pick up where you left off.
    </p>
    <table role="presentation" style="margin: 30px 0;">
      <tr>
        <td style="border-radius: 6px; background-color: #FF5733;">
          <a href="${upgrade_url}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
            Complete Upgrade
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 20px 0 0; color: #888888; font-size: 14px; line-height: 1.6;">
      Need help? <a href="https://synk-official.com/support" style="color: #FF5733; text-decoration: none;">We're here to help</a>
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
    <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 24px; font-weight: 600;">
      Your Subscription Has Been Cancelled
    </h2>
    <p style="margin: 0 0 16px; color: #cccccc; font-size: 16px; line-height: 1.6;">
      Hi there,
    </p>
    <p style="margin: 0 0 16px; color: #cccccc; font-size: 16px; line-height: 1.6;">
      We've received your cancellation request. Your Synk Pro subscription has been cancelled and you've been moved to the Free plan.
    </p>
    <div style="background-color: #2a2a2a; border-left: 4px solid #888888; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #cccccc; font-size: 15px; line-height: 1.5;">
        <strong style="color: #ffffff;">What's changing:</strong><br>
        • Automatic sync has stopped<br>
        • You're limited to 1 calendar and 1 database<br>
        • Only manual sync is available
      </p>
    </div>
    <p style="margin: 20px 0 16px; color: #cccccc; font-size: 16px; line-height: 1.6;">
      We're sorry to see you go! If there's anything we could have done better, we'd love to hear from you.
    </p>
    <table role="presentation" style="margin: 30px 0;">
      <tr>
        <td style="border-radius: 6px; background-color: #888888;">
          <a href="${support_url}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
            Send Feedback
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 20px 0 0; color: #888888; font-size: 14px; line-height: 1.6;">
      Changed your mind? You can <a href="https://synk-official.com/upgrade" style="color: #FF5733; text-decoration: none;">reactivate Pro</a> anytime.
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
