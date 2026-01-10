// Access Control Module for Synk Auto-Trial System
// Provides Pro feature access gating based on user plan status

/**
 * Check if user has Pro feature access
 * @param {Object} user - User object from database
 * @returns {Object} Access verdict with reason and days remaining
 */
function checkProAccess(user) {
  if (!user || !user.plan) {
    return {
      canAccessProFeatures: false,
      reason: 'no_plan',
      daysRemaining: null,
      trialEndsAt: null
    };
  }

  // Pro subscription - immediate access
  if (user.plan === 'pro') {
    return {
      canAccessProFeatures: true,
      reason: 'pro_subscription',
      daysRemaining: null,
      trialEndsAt: null
    };
  }

  // Trial - check if still active
  if (user.plan === 'trial') {
    if (!user.trial_ends_at) {
      // Trial plan but no expiration date (data integrity issue)
      return {
        canAccessProFeatures: false,
        reason: 'invalid_trial',
        daysRemaining: null,
        trialEndsAt: null
      };
    }

    const now = new Date();
    const trialEnds = new Date(user.trial_ends_at);
    
    if (trialEnds > now) {
      // Active trial
      const daysRemaining = Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24));
      return {
        canAccessProFeatures: true,
        reason: 'active_trial',
        daysRemaining: daysRemaining,
        trialEndsAt: user.trial_ends_at
      };
    } else {
      // Expired trial (should be downgraded by cron job)
      return {
        canAccessProFeatures: false,
        reason: 'expired_trial',
        daysRemaining: 0,
        trialEndsAt: user.trial_ends_at
      };
    }
  }

  // Free plan - no access
  if (user.plan === 'free') {
    return {
      canAccessProFeatures: false,
      reason: 'free_plan',
      daysRemaining: null,
      trialEndsAt: null
    };
  }

  // Unknown plan
  return {
    canAccessProFeatures: false,
    reason: 'unknown_plan',
    daysRemaining: null,
    trialEndsAt: null
  };
}

/**
 * Express middleware to require Pro access for routes
 * Use this on endpoints that should only be accessible to Pro/Trial users
 * 
 * Usage:
 * app.post('/api/pro-feature', authMiddleware, requireProAccess, async (req, res) => {
 *   // Your Pro feature logic here
 * });
 */
async function requireProAccess(req, res, next) {
  try {
    const email = req.user?.email;
    if (!email) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Authentication required'
      });
    }

    // Get getUserByEmail from parent scope (will be passed in or imported)
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    );

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        error: 'user_not_found',
        message: 'User not found'
      });
    }

    const access = checkProAccess(user);

    if (access.canAccessProFeatures) {
      // Grant access - attach access info to request
      req.proAccess = access;
      return next();
    } else {
      // Deny access
      return res.status(403).json({
        success: false,
        error: 'pro_access_required',
        reason: access.reason,
        message: 'Upgrade to Pro to access this feature',
        upgrade_url: 'https://synk-official.com/upgrade',
        days_remaining: access.daysRemaining
      });
    }
  } catch (err) {
    console.error('[requireProAccess] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to check Pro access'
    });
  }
}

module.exports = {
  checkProAccess,
  requireProAccess
};
