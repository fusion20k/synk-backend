const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { isTrialExpired } = require('./trialManager');
const { 
  sendTrialExpiredEmail, 
  sendCheckoutAbandonedEmail 
} = require('./emailService');
const { 
  getAbandonedCheckouts, 
  markReminderSent 
} = require('./checkoutTracker');

let supabase = null;

function initializeCronJobs(supabaseInstance) {
  supabase = supabaseInstance;

  if (!supabase) {
    console.warn('[CronJobs] Supabase not configured, cron jobs disabled');
    return;
  }

  console.log('[CronJobs] Initializing scheduled jobs...');

  cron.schedule('0 3 * * *', async () => {
    console.log('[CronJobs] Running daily trial downgrade job at 3:00 AM EST');
    await downgradeExpiredTrials();
  }, {
    timezone: 'America/New_York'
  });

  cron.schedule('0 * * * *', async () => {
    console.log('[CronJobs] Running hourly checkout reminder job');
    await sendCheckoutReminders();
  }, {
    timezone: 'America/New_York'
  });

  console.log('[CronJobs] ✓ Scheduled jobs initialized:');
  console.log('[CronJobs]   - Trial downgrade: Daily at 3:00 AM EST');
  console.log('[CronJobs]   - Checkout reminders: Hourly (EST)');
}

async function downgradeExpiredTrials() {
  try {
    // Get current time in EST
    const now = new Date();
    const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const currentTimeISO = estNow.toISOString();
    
    console.log(`[CronJobs] Checking for expired trials (current EST: ${currentTimeISO})`);

    const { data: expiredUsers, error } = await supabase
      .from('users')
      .select('email, trial_ends_at')
      .eq('plan', 'trial')
      .lt('trial_ends_at', currentTimeISO);

    if (error) {
      console.error('[CronJobs] Error fetching expired trials:', error.message);
      return;
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      console.log('[CronJobs] No expired trials to downgrade');
      return;
    }

    console.log(`[CronJobs] Found ${expiredUsers.length} expired trials to downgrade`);

    for (const user of expiredUsers) {
      try {
        const { error: updateError } = await supabase
          .from('users')
          .update({ plan: 'free' })
          .eq('email', user.email);

        if (updateError) {
          console.error(`[CronJobs] Failed to downgrade user ${user.email}:`, updateError.message);
          continue;
        }

        console.log(`[CronJobs] ✓ Downgraded ${user.email} from trial to free (expired: ${user.trial_ends_at})`);

        await sendTrialExpiredEmail(user.email);
        console.log(`[CronJobs] ✓ Sent trial expired email to ${user.email}`);
      } catch (err) {
        console.error(`[CronJobs] Error processing user ${user.email}:`, err.message);
      }
    }

    console.log(`[CronJobs] ✓ Trial downgrade job completed: ${expiredUsers.length} users processed`);
  } catch (err) {
    console.error('[CronJobs] Trial downgrade job failed:', err.message);
  }
}

async function sendCheckoutReminders() {
  try {
    const abandonedCheckouts = await getAbandonedCheckouts(supabase);

    if (abandonedCheckouts.length === 0) {
      console.log('[CronJobs] No abandoned checkouts to remind');
      return;
    }

    console.log(`[CronJobs] Found ${abandonedCheckouts.length} abandoned checkouts to remind`);

    for (const checkout of abandonedCheckouts) {
      try {
        const userEmail = checkout.users?.email;
        if (!userEmail) {
          console.warn(`[CronJobs] Checkout ${checkout.id} has no user email, skipping`);
          continue;
        }

        await sendCheckoutAbandonedEmail(userEmail);
        console.log(`[CronJobs] ✓ Sent checkout reminder to ${userEmail}`);

        await markReminderSent(checkout.id, supabase);
      } catch (err) {
        console.error(`[CronJobs] Error processing checkout ${checkout.id}:`, err.message);
      }
    }

    console.log(`[CronJobs] ✓ Checkout reminder job completed: ${abandonedCheckouts.length} reminders sent`);
  } catch (err) {
    console.error('[CronJobs] Checkout reminder job failed:', err.message);
  }
}

module.exports = {
  initializeCronJobs,
  downgradeExpiredTrials,
  sendCheckoutReminders
};
