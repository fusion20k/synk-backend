const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function syncTrialDaysRemaining() {
  console.log('[SyncTrialDays] Starting sync...');
  
  try {
    // Get all users who are currently on trial
    const { data: trialUsers, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_trial', true);
    
    if (error) {
      console.error('[SyncTrialDays] Error fetching trial users:', error);
      return;
    }
    
    console.log(`[SyncTrialDays] Found ${trialUsers.length} users on trial`);
    
    for (const user of trialUsers) {
      try {
        if (!user.stripe_customer_id) {
          console.warn(`[SyncTrialDays] User ${user.email} has no stripe_customer_id, skipping`);
          continue;
        }
        
        // Fetch all subscriptions for this customer
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripe_customer_id,
          status: 'trialing',
          limit: 1
        });
        
        if (subscriptions.data.length === 0) {
          // No active trial found, update user
          console.log(`[SyncTrialDays] No active trial for ${user.email}, clearing trial status`);
          await supabase
            .from('users')
            .update({ is_trial: false, trial_days_remaining: null })
            .eq('email', user.email);
          continue;
        }
        
        const subscription = subscriptions.data[0];
        const trialEnd = subscription.trial_end;
        
        if (trialEnd) {
          const trialEndDate = new Date(trialEnd * 1000);
          const now = new Date();
          const daysRemaining = Math.max(0, Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24)));
          
          console.log(`[SyncTrialDays] Updating ${user.email}: ${daysRemaining} days remaining`);
          
          await supabase
            .from('users')
            .update({ trial_days_remaining: daysRemaining })
            .eq('email', user.email);
        }
      } catch (err) {
        console.error(`[SyncTrialDays] Error processing user ${user.email}:`, err.message);
      }
    }
    
    console.log('[SyncTrialDays] Sync complete');
  } catch (err) {
    console.error('[SyncTrialDays] Fatal error:', err);
  }
}

// Run immediately if executed directly
if (require.main === module) {
  syncTrialDaysRemaining()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { syncTrialDaysRemaining };
