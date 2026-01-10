// Checkout Tracker Module for Synk Auto-Trial System
// Handles abandoned checkout detection and reminder logic

/**
 * Create checkout session record when user initiates upgrade
 * @param {string} userId - User UUID from database
 * @param {string} stripeSessionId - Stripe checkout session ID
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<void>}
 */
async function createCheckoutSession(userId, stripeSessionId, supabase) {
  try {
    const { error } = await supabase
      .from('checkout_sessions')
      .insert({
        user_id: userId,
        stripe_session_id: stripeSessionId,
        status: 'pending',
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('[createCheckoutSession] Error:', error.message);
      throw error;
    }

    console.log(`[createCheckoutSession] ✓ Created checkout session ${stripeSessionId} for user ${userId}`);
  } catch (err) {
    console.error('[createCheckoutSession] Exception:', err.message);
    throw err;
  }
}

/**
 * Mark checkout session as completed (called from Stripe webhook)
 * @param {string} stripeSessionId - Stripe checkout session ID
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<void>}
 */
async function markCheckoutCompleted(stripeSessionId, supabase) {
  try {
    const { error } = await supabase
      .from('checkout_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('stripe_session_id', stripeSessionId);

    if (error) {
      console.error('[markCheckoutCompleted] Error:', error.message);
      throw error;
    }

    console.log(`[markCheckoutCompleted] ✓ Marked checkout ${stripeSessionId} as completed`);
  } catch (err) {
    console.error('[markCheckoutCompleted] Exception:', err.message);
    // Don't throw - this is non-critical
  }
}

/**
 * Mark checkout session as abandoned (called from Stripe webhook)
 * @param {string} stripeSessionId - Stripe checkout session ID
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<void>}
 */
async function markCheckoutAbandoned(stripeSessionId, supabase) {
  try {
    const { error } = await supabase
      .from('checkout_sessions')
      .update({
        status: 'abandoned'
      })
      .eq('stripe_session_id', stripeSessionId);

    if (error) {
      console.error('[markCheckoutAbandoned] Error:', error.message);
      throw error;
    }

    console.log(`[markCheckoutAbandoned] ✓ Marked checkout ${stripeSessionId} as abandoned`);
  } catch (err) {
    console.error('[markCheckoutAbandoned] Exception:', err.message);
    // Don't throw - this is non-critical
  }
}

/**
 * Get abandoned checkouts that need reminder emails (>24 hours old, no reminder sent)
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<Array>} Array of checkout records with user email
 */
async function getAbandonedCheckouts(supabase) {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('checkout_sessions')
      .select(`
        id,
        stripe_session_id,
        created_at,
        users:user_id (
          email,
          plan
        )
      `)
      .eq('status', 'pending')
      .lt('created_at', twentyFourHoursAgo)
      .is('reminder_sent_at', null);

    if (error) {
      console.error('[getAbandonedCheckouts] Error:', error.message);
      throw error;
    }

    console.log(`[getAbandonedCheckouts] Found ${data?.length || 0} abandoned checkouts`);
    return data || [];
  } catch (err) {
    console.error('[getAbandonedCheckouts] Exception:', err.message);
    return [];
  }
}

/**
 * Mark that reminder email was sent for a checkout
 * @param {string} checkoutId - Checkout session UUID
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<void>}
 */
async function markReminderSent(checkoutId, supabase) {
  try {
    const { error } = await supabase
      .from('checkout_sessions')
      .update({
        reminder_sent_at: new Date().toISOString()
      })
      .eq('id', checkoutId);

    if (error) {
      console.error('[markReminderSent] Error:', error.message);
      throw error;
    }

    console.log(`[markReminderSent] ✓ Marked reminder sent for checkout ${checkoutId}`);
  } catch (err) {
    console.error('[markReminderSent] Exception:', err.message);
    // Don't throw - this is non-critical
  }
}

/**
 * Get checkout statistics (for monitoring/debugging)
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<Object>} Stats object
 */
async function getCheckoutStats(supabase) {
  try {
    const { data, error } = await supabase
      .from('checkout_sessions')
      .select('status');

    if (error) {
      console.error('[getCheckoutStats] Error:', error.message);
      return { pending: 0, completed: 0, abandoned: 0, total: 0 };
    }

    const stats = {
      pending: data.filter(c => c.status === 'pending').length,
      completed: data.filter(c => c.status === 'completed').length,
      abandoned: data.filter(c => c.status === 'abandoned').length,
      total: data.length
    };

    return stats;
  } catch (err) {
    console.error('[getCheckoutStats] Exception:', err.message);
    return { pending: 0, completed: 0, abandoned: 0, total: 0 };
  }
}

module.exports = {
  createCheckoutSession,
  markCheckoutCompleted,
  markCheckoutAbandoned,
  getAbandonedCheckouts,
  markReminderSent,
  getCheckoutStats
};
