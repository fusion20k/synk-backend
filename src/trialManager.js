// Trial Manager Module for Synk Auto-Trial System
// Handles trial assignment with IP-based abuse prevention

const TRIAL_DURATION_DAYS = parseInt(process.env.TRIAL_DURATION_DAYS || '7');

/**
 * Check if IP address has already been used for a trial
 * @param {string} signupIp - IP address from signup request
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<boolean>} True if IP already used trial, false otherwise
 */
async function checkIpTrialAbuse(signupIp, supabase) {
  if (!signupIp) {
    console.log('[checkIpTrialAbuse] No IP provided, allowing trial');
    return false;
  }

  // Ignore localhost IPs - they're not real client IPs
  const localhostIps = ['::1', '127.0.0.1', '::ffff:127.0.0.1', 'localhost'];
  if (localhostIps.includes(signupIp)) {
    console.log(`[checkIpTrialAbuse] Localhost IP detected (${signupIp}), skipping abuse check`);
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('email')
      .eq('signup_ip', signupIp)
      .eq('plan', 'trial')
      .limit(1);

    if (error) {
      console.error('[checkIpTrialAbuse] Database error:', error.message);
      console.error('[checkIpTrialAbuse] This likely means signup_ip column does not exist. Apply migrations!');
      return false; // On error, allow trial (fail open)
    }

    const isAbuse = data && data.length > 0;
    console.log(`[checkIpTrialAbuse] IP ${signupIp} abuse check: ${isAbuse ? 'ABUSE DETECTED' : 'OK'}`);
    return isAbuse;
  } catch (err) {
    console.error('[checkIpTrialAbuse] Exception:', err.message);
    return false; // On exception, allow trial (fail open)
  }
}

/**
 * Assign trial to new user or mark as free if IP abuse detected
 * @param {string} email - User email
 * @param {string} signupIp - IP address from signup request
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<Object>} Trial assignment result
 */
async function assignTrialToUser(email, signupIp, supabase) {
  try {
    // Check for IP abuse
    const isAbuse = await checkIpTrialAbuse(signupIp, supabase);

    if (isAbuse) {
      console.log(`[assignTrialToUser] IP abuse detected for ${email} (IP: ${signupIp})`);
      return {
        success: true,
        plan: 'free',
        trial_started_at: null,
        trial_ends_at: null,
        reason: 'ip_already_used',
        message: 'Trial not available from this location'
      };
    }

    // Calculate trial period
    const now = new Date();
    const trialStartedAt = now.toISOString();
    const trialEndsAt = new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    console.log(`[assignTrialToUser] Assigning trial to ${email} (${TRIAL_DURATION_DAYS} days)`);
    console.log(`[assignTrialToUser] Trial period: ${trialStartedAt} → ${trialEndsAt}`);

    return {
      success: true,
      plan: 'trial',
      trial_started_at: trialStartedAt,
      trial_ends_at: trialEndsAt,
      reason: 'trial_assigned',
      message: `Welcome! You have ${TRIAL_DURATION_DAYS} days of Pro features.`
    };
  } catch (err) {
    console.error('[assignTrialToUser] Error:', err.message);
    // On error, default to free plan (fail safe)
    return {
      success: false,
      plan: 'free',
      trial_started_at: null,
      trial_ends_at: null,
      reason: 'error',
      message: 'Unable to assign trial, defaulting to free plan'
    };
  }
}

/**
 * Check if user's trial has expired (used by cron job)
 * @param {Object} user - User object from database
 * @returns {boolean} True if trial has expired
 */
function isTrialExpired(user) {
  if (user.plan !== 'trial' || !user.trial_ends_at) {
    return false;
  }

  const now = new Date();
  const trialEnds = new Date(user.trial_ends_at);
  
  return trialEnds <= now;
}

module.exports = {
  checkIpTrialAbuse,
  assignTrialToUser,
  isTrialExpired,
  TRIAL_DURATION_DAYS
};
