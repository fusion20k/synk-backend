const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const fetch = require('node-fetch');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Stripe = require('stripe');
require('dotenv').config();

const { checkProAccess, requireProAccess } = require('./src/accessControl');
const { assignTrialToUser } = require('./src/trialManager');
const { sendTrialWelcomeEmail } = require('./src/emailService');
const { 
  createCheckoutSession, 
  markCheckoutCompleted, 
  markCheckoutAbandoned 
} = require('./src/checkoutTracker');
const { initializeCronJobs } = require('./src/cronJobs');

const app = express();

// At top of server file
const oauthResults = {}; // { state: { tokens, createdAt } }
console.log('[Server] BACKEND_URL=', process.env.BACKEND_URL || 'NOT SET');

// Initialize Stripe (optional)
const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

// Middleware
app.use(cors({
  origin: ['https://synk-official.com', 'http://localhost:3000', 'https://synk-web.onrender.com'],
  credentials: true
}));

// Health check to verify server receives traffic
app.get('/stripe/ping', (req, res) => {
  console.log('[Stripe] Ping received');
  res.json({ ok: true });
});

// Stripe webhook must use raw body and be before express.json()
{
  // Helpful GET for browser checks (Stripe uses POST). Returns simple OK.
  app.get('/stripe/webhook', (req, res) => {
    console.log('[Stripe] GET /stripe/webhook (debug)');
    res.status(200).send('Stripe webhook endpoint is up. Use POST from Stripe.');
  });

  const webhookPaths = [
    '/stripe/webhook', '/stripe/webhook/',
    '/webhooks/stripe', '/webhooks/stripe/',
    '/api/stripe/webhook', '/api/stripe/webhook/',
    '/api/webhooks/stripe', '/api/webhooks/stripe/',
    '/webhook', '/webhook/'
  ];

  webhookPaths.forEach((p) => {
    app.get(p, (req, res) => {
      console.log(`[Stripe] GET ${p} (debug)`);
      res.status(200).send(`Stripe webhook endpoint is up at ${p}. Use POST from Stripe.`);
    });
  });

  webhookPaths.forEach((p) => app.head(p, (req, res) => {
    console.log(`[Stripe] HEAD ${p} (debug)`);
    res.status(200).send('OK');
  }));

  webhookPaths.forEach((p) => app.post(p, express.raw({ type: '*/*' }), async (req, res) => {
    console.log('[Stripe] Webhook hit');
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
      console.log('[Stripe] Event verified:', event.type);
    } catch (err) {
      console.error('[Stripe] Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      // Helper to map price IDs to plan + billing_period
      // Supports both STRIPE_PRICE_* and legacy *_PRICE names
      const PRICE_IDS = {
        FREE_MONTHLY: process.env.STRIPE_PRICE_FREE_MONTHLY || process.env.FREE_MONTHLY_PRICE || '',
        FREE_YEARLY: process.env.STRIPE_PRICE_FREE_YEARLY || process.env.FREE_YEARLY_PRICE || '',
        PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY || process.env.PRO_MONTHLY_PRICE || '',
        PRO_YEARLY: process.env.STRIPE_PRICE_PRO_YEARLY || process.env.PRO_YEARLY_PRICE || '',
        PRO_MONTHLY_30DAY: process.env.STRIPE_PRICE_PRO_MONTHLY_30DAY || '',
      };
      const PRICE_TO_PLAN = {};
      if (PRICE_IDS.FREE_MONTHLY) PRICE_TO_PLAN[PRICE_IDS.FREE_MONTHLY] = { plan: 'free', billing_period: 'monthly' };
      if (PRICE_IDS.FREE_YEARLY) PRICE_TO_PLAN[PRICE_IDS.FREE_YEARLY] = { plan: 'free', billing_period: 'yearly' };
      if (PRICE_IDS.PRO_MONTHLY) PRICE_TO_PLAN[PRICE_IDS.PRO_MONTHLY] = { plan: 'pro', billing_period: 'monthly' };
      if (PRICE_IDS.PRO_YEARLY) PRICE_TO_PLAN[PRICE_IDS.PRO_YEARLY] = { plan: 'pro', billing_period: 'yearly' };
      if (PRICE_IDS.PRO_MONTHLY_30DAY) PRICE_TO_PLAN[PRICE_IDS.PRO_MONTHLY_30DAY] = { plan: 'pro', billing_period: 'monthly' };

      async function applySubscriptionToUser({ priceId, status, customerId, emailHint, trialEnd }) {
        if (!stripe || !supabase) return;
        console.log('[Stripe] applySubscriptionToUser called:', { priceId, status, customerId, emailHint, trialEnd });
        
        let email = emailHint || null;
        let stripeCustomer = null;
        
        try {
          if (customerId) {
            stripeCustomer = await stripe.customers.retrieve(customerId);
            email = email || stripeCustomer.email || stripeCustomer.billing_details?.email || stripeCustomer.shipping?.email;
            console.log('[Stripe] Retrieved customer:', { id: customerId, email });
          }
        } catch (e) {
          console.warn('[Stripe] Failed to retrieve customer:', e.message);
        }
        
        if (!email) {
          console.error('[Stripe] CRITICAL: No email resolved for subscription mapping. customerId:', customerId);
          return;
        }

        const mapping = PRICE_TO_PLAN[priceId] || null;
        if (!mapping) {
          console.warn('[Stripe] Unknown priceId, leaving plan unchanged:', priceId);
          return;
        }

        // Try to find user by stripe_customer_id first, then email
        let userRow = null;
        try {
          if (customerId) {
            const { data } = await supabase.from('users').select('*').eq('stripe_customer_id', customerId).maybeSingle();
            userRow = data;
            console.log('[Stripe] User lookup by stripe_customer_id:', customerId, userRow ? 'FOUND' : 'NOT FOUND');
          }
          
          if (!userRow) {
            userRow = await getUserByEmail(email);
            console.log('[Stripe] User lookup by email:', email, userRow ? 'FOUND' : 'NOT FOUND');
          }
        } catch (e) {
          console.error('[Stripe] getUserByEmail error:', e.message);
        }
        
        if (!userRow) {
          try {
            await insertUser({ email, password_hash: null, plan: "free", stripe_customer_id: customerId });
            console.log('[Stripe] Placeholder user created for', email, 'with stripe_customer_id:', customerId);
          } catch (e) {
            console.error('[Stripe] insertUser error:', e.message);
          }
        }

        // Update user with plan, billing period, trial status, trial days remaining, and stripe_customer_id
        try {
          if (status === 'active' || status === 'trialing' || status === 'past_due') {
            const updateData = { 
              plan: mapping.plan, 
              billing_period: mapping.billing_period,
              stripe_customer_id: customerId
            };
            
            // Handle trial status and calculate days remaining
            console.log('[Stripe] Trial check - status:', status, 'trialEnd:', trialEnd);
            if (status === 'trialing') {
              updateData.is_trial = true;
              if (trialEnd) {
                // Calculate days remaining from trial_end timestamp
                const trialEndDate = new Date(trialEnd * 1000); // Stripe uses Unix timestamp in seconds
                const now = new Date();
                const daysRemaining = Math.max(0, Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24)));
                updateData.trial_days_remaining = daysRemaining;
                console.log('[Stripe] Setting is_trial = true, trial_days_remaining =', daysRemaining, 'for', email, '(trial ends:', trialEndDate.toISOString(), ')');
              } else {
                console.warn('[Stripe] Status is trialing but no trial_end provided!');
                updateData.trial_days_remaining = null;
              }
            } else if (status === 'active') {
              updateData.is_trial = false;
              updateData.trial_days_remaining = null;
              console.log('[Stripe] Setting is_trial = false, clearing trial_days_remaining for', email);
            } else {
              console.log('[Stripe] Status is', status, '- not setting trial info');
            }
            
            await updateUser(email, updateData);
            console.log('[Stripe] ✓ Plan updated for', email, ':', mapping.plan, mapping.billing_period, 'status:', status, 'is_trial:', updateData.is_trial, 'trial_days_remaining:', updateData.trial_days_remaining);
          } else {
            await updateUser(email, { plan: 'free', billing_period: null, is_trial: null, trial_days_remaining: null });
            console.log('[Stripe] Plan reverted to free for', email, 'status:', status);
          }
        } catch (e) {
          console.error('[Stripe] updateUser FAILED:', e.message, 'for email:', email);
        }
      }

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const emailHint = session.customer_details?.email || session.customer_email || null;
          
          await markCheckoutCompleted(session.id, supabase);
          
          if (session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription);
            const item = sub.items && sub.items.data && sub.items.data[0];
            const priceId = item && item.price && item.price.id;
            await applySubscriptionToUser({ customerId: session.customer, priceId, status: sub.status, emailHint, trialEnd: sub.trial_end });
            
            if (emailHint) {
              await updateUser(emailHint, { stripe_subscription_id: sub.id });
              console.log(`[Stripe] Updated subscription ID ${sub.id} for ${emailHint}`);
            }
          }
          break;
        }
        case 'checkout.session.expired': {
          const session = event.data.object;
          await markCheckoutAbandoned(session.id, supabase);
          console.log(`[Stripe] Marked checkout ${session.id} as abandoned`);
          break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.resumed':
        case 'customer.subscription.paused': {
          const sub = event.data.object;
          const item = sub.items && sub.items.data && sub.items.data[0];
          const priceId = item && item.price && item.price.id;
          await applySubscriptionToUser({ customerId: sub.customer, priceId, status: sub.status, trialEnd: sub.trial_end });
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const item = sub.items && sub.items.data && sub.items.data[0];
          const priceId = item && item.price && item.price.id;
          await applySubscriptionToUser({ customerId: sub.customer, priceId, status: sub.status, trialEnd: sub.trial_end });
          
          try {
            const stripeCustomer = await stripe.customers.retrieve(sub.customer);
            const email = stripeCustomer.email;
            if (email) {
              const { sendSubscriptionCancelledEmail } = require('./src/emailService');
              await sendSubscriptionCancelledEmail(email);
              console.log(`[Stripe] Sent subscription cancelled email to ${email}`);
            }
          } catch (err) {
            console.error('[Stripe] Failed to send cancellation email:', err.message);
          }
          break;
        }
        case 'invoice.paid': {
          const inv = event.data.object;
          const emailHint = inv.customer_email || inv.customer_details?.email || null;
          if (inv.subscription) {
            const sub = await stripe.subscriptions.retrieve(inv.subscription);
            const item = sub.items && sub.items.data && sub.items.data[0];
            const priceId = item && item.price && item.price.id;
            await applySubscriptionToUser({ customerId: sub.customer, priceId, status: sub.status, emailHint, trialEnd: sub.trial_end });
          }
          break;
        }
        default:
          // Ignore other events for now
          break;
      }

      res.json({ received: true });
    } catch (err) {
      console.error('[Stripe] Webhook handler error:', err);
      res.status(500).send('Webhook handler error');
    }
  }));
}

// JSON parser for remaining routes
app.use(express.json());

// Version check middleware
const versionCheckMiddleware = require('./src/versionMiddleware');
app.use(versionCheckMiddleware);

// OAuth2 client setup
const BACKEND_URL = process.env.BACKEND_URL || 'https://synk-web.onrender.com';
const REDIRECT_URI = `${BACKEND_URL}/oauth2callback`;

console.log('[OAuth2] Configuration:');
console.log('[OAuth2] BACKEND_URL:', BACKEND_URL);
console.log('[OAuth2] REDIRECT_URI:', REDIRECT_URI);
console.log('[OAuth2] CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('[OAuth2] CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

// Notion OAuth configuration
const NOTION_REDIRECT_URI = process.env.NOTION_REDIRECT_URI || `${BACKEND_URL}/oauth2callback/notion`;
console.log('[Notion OAuth] Configuration:');
console.log('[Notion OAuth] REDIRECT_URI:', NOTION_REDIRECT_URI);
console.log('[Notion OAuth] CLIENT_ID:', process.env.NOTION_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('[Notion OAuth] CLIENT_SECRET:', process.env.NOTION_CLIENT_SECRET ? 'SET' : 'NOT SET');

// Supabase client + auth helpers
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;
if (!supabase) console.warn('[Supabase] Not configured');

const JWT_SECRET = process.env.JWT_SECRET || 'REPLACE_ME';
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, error: 'missing_token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'invalid_token' });
  }
}
async function getUserByEmail(email) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
  if (error) throw error;
  return data || null;
}
async function insertUser(row) {
  if (!supabase) return;
  const { error } = await supabase.from('users').insert(row);
  if (error) throw error;
}
async function updateUser(email, patch) {
  if (!supabase) return;
  const { error } = await supabase.from('users').update(patch).eq('email', email);
  if (error) throw error;
}

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Synk Backend Server', 
    status: 'running',
    endpoints: [
      'GET /_health',
      'POST /signup',
      'POST /login',
      'GET /me',
      'GET /auth/google',
      'GET /auth/notion',
      'GET /oauth2callback',
      'GET /oauth2callback/notion',
      'GET /api/oauth/result'
    ]
  });
});

// Health check endpoint
app.get('/_health', (req, res) => res.json({ ok: true, host: BACKEND_URL }));

// Database schema check endpoint
app.get('/_schema-check', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ ok: false, error: 'Supabase not configured' });
    }

    const { data: testUser, error } = await supabase
      .from('users')
      .select('id, email, plan, trial_started_at, trial_ends_at, signup_ip')
      .limit(1);

    if (error) {
      return res.json({
        ok: false,
        error: error.message,
        hint: 'Migrations may not be applied. Check if signup_ip, trial_started_at, trial_ends_at columns exist.'
      });
    }

    return res.json({
      ok: true,
      message: 'Schema check passed',
      columns_exist: ['id', 'email', 'plan', 'trial_started_at', 'trial_ends_at', 'signup_ip'],
      sample_count: testUser?.length || 0
    });
  } catch (err) {
    return res.json({
      ok: false,
      error: err.message
    });
  }
});

// Signup
app.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, error: 'missing_params' });

    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, error: 'user_exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const signupIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || null;
    console.log(`[POST /signup] New signup: ${email} from IP: ${signupIp}`);

    const trialAssignment = await assignTrialToUser(email, signupIp, supabase);
    console.log(`[POST /signup] Trial assignment for ${email}:`, JSON.stringify(trialAssignment, null, 2));

    const row = { 
      email, 
      password_hash, 
      plan: trialAssignment.plan,
      trial_started_at: trialAssignment.trial_started_at,
      trial_ends_at: trialAssignment.trial_ends_at,
      signup_ip: signupIp
    };
    
    console.log(`[POST /signup] Inserting user with data:`, JSON.stringify(row, null, 2));
    await insertUser(row);
    console.log(`[POST /signup] ✓ User ${email} created with plan: ${trialAssignment.plan}`);

    if (trialAssignment.plan === 'trial') {
      const daysRemaining = parseInt(process.env.TRIAL_DURATION_DAYS || '7');
      await sendTrialWelcomeEmail(email, daysRemaining, trialAssignment.trial_ends_at);
      console.log(`[POST /signup] ✓ Sent trial welcome email to ${email}`);
    }

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ 
      success: true, 
      token, 
      user: { 
        email, 
        plan: trialAssignment.plan,
        trial_ends_at: trialAssignment.trial_ends_at
      }, 
      trial_message: trialAssignment.message,
      ...req.versionInfo 
    });
  } catch (e) {
    console.error('[POST /signup] Error:', e.message);
    console.error('[POST /signup] Stack:', e.stack);
    return res.status(500).json({ success: false, error: 'server_error', message: e.message });
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, error: 'missing_params' });

    const userRow = await getUserByEmail(email);
    if (!userRow) return res.status(401).json({ success: false, error: 'invalid_credentials' });

    // If user exists from webhook placeholder (no password yet), allow first login to set password
    if (!userRow.password_hash) {
      const password_hash = await bcrypt.hash(password, 10);
      await updateUser(email, { password_hash });
    }

    const ok = await bcrypt.compare(password, userRow.password_hash || password); // if freshly set above, this will also pass
    if (!ok) return res.status(401).json({ success: false, error: 'invalid_credentials' });

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ success: true, token, user: { email }, ...req.versionInfo });
  } catch (e) {
    console.error('[POST /login] Error:', e.message);
    return res.status(500).json({ success: false, error: 'server_error' });
  }
});

// Debug endpoint to fetch mapped plan by email (no auth; use only for testing, then remove)
app.get('/debug/plan/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const u = await getUserByEmail(email);
    return res.json({ ok: true, u });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Debug endpoint to sync trial status from Stripe
app.get('/debug/sync-trial/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const u = await getUserByEmail(email);
    
    if (!u) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    
    if (!u.stripe_customer_id) {
      return res.status(400).json({ ok: false, error: 'No stripe_customer_id for user' });
    }
    
    // Fetch subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: u.stripe_customer_id,
      limit: 10
    });
    
    console.log('[Debug] Found', subscriptions.data.length, 'subscriptions for', email);
    
    // Find active or trialing subscription
    const activeSub = subscriptions.data.find(sub => 
      sub.status === 'active' || sub.status === 'trialing'
    );
    
    if (!activeSub) {
      return res.json({ 
        ok: true, 
        message: 'No active subscription found',
        subscriptions: subscriptions.data.map(s => ({ id: s.id, status: s.status, trial_end: s.trial_end }))
      });
    }
    
    const updateData = {};
    
    if (activeSub.status === 'trialing' && activeSub.trial_end) {
      const trialEndDate = new Date(activeSub.trial_end * 1000);
      const now = new Date();
      const daysRemaining = Math.max(0, Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24)));
      
      updateData.is_trial = true;
      updateData.trial_days_remaining = daysRemaining;
      
      await updateUser(email, updateData);
      
      return res.json({
        ok: true,
        message: 'Trial synced successfully',
        subscription: {
          id: activeSub.id,
          status: activeSub.status,
          trial_end: activeSub.trial_end,
          trial_end_date: trialEndDate.toISOString(),
          days_remaining: daysRemaining
        },
        updated: updateData
      });
    } else if (activeSub.status === 'active') {
      updateData.is_trial = false;
      updateData.trial_days_remaining = null;
      
      await updateUser(email, updateData);
      
      return res.json({
        ok: true,
        message: 'Subscription is active (not trialing)',
        subscription: {
          id: activeSub.id,
          status: activeSub.status
        },
        updated: updateData
      });
    }
    
    return res.json({
      ok: true,
      message: 'Unexpected subscription status',
      subscription: {
        id: activeSub.id,
        status: activeSub.status,
        trial_end: activeSub.trial_end
      }
    });
    
  } catch (e) {
    console.error('[Debug] Sync trial error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// /me - plan source of truth
app.get('/me', authMiddleware, async (req, res) => {
  try {
    const email = req.user.email;
    let u = await getUserByEmail(email);
    if (!u) return res.status(404).json({ success: false, error: 'user_not_found' });

    // Auto-sync trial days if user is on trial - recalculate every time for accuracy
    if (stripe && u.is_trial && u.stripe_customer_id) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: u.stripe_customer_id,
          status: 'trialing',
          limit: 1
        });
        
        if (subscriptions.data.length > 0 && subscriptions.data[0].trial_end) {
          const trialEndDate = new Date(subscriptions.data[0].trial_end * 1000);
          const now = new Date();
          const daysRemaining = Math.max(0, Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24)));
          
          // Update database if changed
          if (u.trial_days_remaining !== daysRemaining) {
            await updateUser(email, { trial_days_remaining: daysRemaining });
            console.log('[GET /me] Updated trial_days_remaining:', daysRemaining);
            u.trial_days_remaining = daysRemaining;
          }
        }
      } catch (err) {
        console.error('[GET /me] Trial sync error:', err.message);
      }
    }

    const access = checkProAccess(u);

    const plan = u.plan ? { type: u.plan, billingCycle: u.billing_period } : null;
    return res.json({ 
      success: true, 
      email, 
      plan, 
      billing_period: u.billing_period,
      is_trial: u.is_trial || false,
      trial_days_remaining: u.trial_days_remaining || null,
      trial_ends_at: u.trial_ends_at || null,
      can_access_pro_features: access.canAccessProFeatures,
      pro_access_reason: access.reason,
      ...req.versionInfo
    });
  } catch (e) {
    console.error('[GET /me] Error:', e.message);
    return res.status(500).json({ success: false, error: 'server_error' });
  }
});

// Get detailed trial status
app.get('/api/user/trial-status', authMiddleware, async (req, res) => {
  try {
    const email = req.user.email;
    const u = await getUserByEmail(email);
    if (!u) return res.status(404).json({ success: false, error: 'user_not_found' });

    const access = checkProAccess(u);

    return res.json({
      success: true,
      plan: u.plan,
      can_access_pro_features: access.canAccessProFeatures,
      reason: access.reason,
      days_remaining: access.daysRemaining,
      trial_started_at: u.trial_started_at,
      trial_ends_at: access.trialEndsAt || u.trial_ends_at,
      billing_period: u.billing_period,
      stripe_subscription_id: u.stripe_subscription_id
    });
  } catch (e) {
    console.error('[GET /api/user/trial-status] Error:', e.message);
    return res.status(500).json({ success: false, error: 'server_error' });
  }
});

// Example Pro feature endpoint (demonstrates requireProAccess middleware)
app.get('/api/pro/test', authMiddleware, requireProAccess, async (req, res) => {
  return res.json({
    success: true,
    message: 'Welcome to Pro features!',
    access_info: req.proAccess,
    features_available: [
      'Unlimited Google Calendar connections',
      'Unlimited Notion database connections',
      'Automatic live sync every 7 seconds',
      'Manual and incremental sync',
      'Priority support'
    ]
  });
});

// Create Stripe checkout session for upgrade
app.post('/api/upgrade', authMiddleware, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ 
        success: false, 
        error: 'stripe_not_configured',
        message: 'Payment processing is not available'
      });
    }

    const email = req.user.email;
    const { priceId, successUrl, cancelUrl } = req.body || {};

    if (!priceId) {
      return res.status(400).json({ 
        success: false, 
        error: 'missing_price_id',
        message: 'Price ID is required'
      });
    }

    const u = await getUserByEmail(email);
    if (!u) return res.status(404).json({ success: false, error: 'user_not_found' });

    let customerId = u.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email,
        metadata: { synk_user_email: email }
      });
      customerId = customer.id;
      await updateUser(email, { stripe_customer_id: customerId });
      console.log(`[POST /api/upgrade] Created Stripe customer ${customerId} for ${email}`);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || 'https://synk-official.com/upgrade-success',
      cancel_url: cancelUrl || 'https://synk-official.com/upgrade',
      metadata: {
        user_email: email
      }
    });

    await createCheckoutSession(u.id, session.id, supabase);
    console.log(`[POST /api/upgrade] Created checkout session ${session.id} for ${email}`);

    return res.json({
      success: true,
      session_id: session.id,
      checkout_url: session.url
    });
  } catch (e) {
    console.error('[POST /api/upgrade] Error:', e.message);
    return res.status(500).json({ 
      success: false, 
      error: 'server_error',
      message: e.message
    });
  }
});

// Google OAuth initiation
app.get('/auth/google', (req, res) => {
  const state = req.query.state || Math.random().toString(36).substring(7);
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.readonly'],
    state: state,
    prompt: 'consent'
  });
  
  console.log('[Auth] Generated auth URL for state:', state);
  res.redirect(authUrl);
});

// Notion OAuth initiation
app.get('/auth/notion', (req, res) => {
  const state = req.query.state || Math.random().toString(36).substring(7);
  
  // Use the redirect URI from environment variable
  const testRedirectUri = NOTION_REDIRECT_URI;
  
  const authUrl = `https://api.notion.com/v1/oauth/authorize?` +
    `client_id=${process.env.NOTION_CLIENT_ID}&` +
    `response_type=code&` +
    `owner=user&` +
    `redirect_uri=${encodeURIComponent(testRedirectUri)}&` +
    `state=${state}`;
  
  console.log('[Notion Auth] Using redirect URI:', testRedirectUri);
  
  console.log('[Notion Auth] Generated auth URL for state:', state);
  res.redirect(authUrl);
});

// OAuth2 callback route
app.get('/oauth2callback', async (req, res) => {
  console.log('[OAuth2Callback] incoming request', { query: req.query });
  const { code, state, error } = req.query;
  
  if (error) {
    console.error('[OAuth2Callback] OAuth error from Google:', error);
    const errorUrl = `https://synk-official.com/oauth-error.html?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(req.query.error_description || 'OAuth authorization failed')}`;
    return res.redirect(errorUrl);
  }
  
  if (!code || !state) {
    console.error('[OAuth2Callback] Missing required parameters:', { code: !!code, state: !!state });
    const errorUrl = `https://synk-official.com/oauth-error.html?error=missing_parameters&error_description=${encodeURIComponent('Missing authorization code or state parameter')}`;
    return res.redirect(errorUrl);
  }

  try {
    console.log('[OAuth2Callback] Attempting token exchange with redirect URI:', REDIRECT_URI);
    const { tokens } = await oauth2Client.getToken(code);
    oauthResults[state] = { tokens, createdAt: Date.now() };
    console.log('[OAuth2Callback] tokens stored for state:', state);
    console.log('[OAuth2Callback] token types received:', Object.keys(tokens));
    return res.redirect('https://synk-official.com/oauth-success.html');
  } catch (err) {
    console.error('[OAuth2Callback] token exchange error details:', {
      message: err.message,
      code: err.code,
      status: err.status,
      response: err.response?.data
    });
    const errorUrl = `https://synk-official.com/oauth-error.html?error=token_exchange_failed&error_description=${encodeURIComponent(err.message)}`;
    return res.redirect(errorUrl);
  }
});

// Notion OAuth callback route
app.get('/oauth2callback/notion', async (req, res) => {
  console.log('[NotionOAuth2Callback] incoming request', { query: req.query });
  const { code, state, error } = req.query;
  
  if (error) {
    console.error('[NotionOAuth2Callback] OAuth error from Notion:', error);
    const errorUrl = `https://synk-official.com/oauth-error.html?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(req.query.error_description || 'Notion OAuth authorization failed')}`;
    return res.redirect(errorUrl);
  }
  
  if (!code || !state) {
    console.error('[NotionOAuth2Callback] Missing required parameters:', { code: !!code, state: !!state });
    const errorUrl = `https://synk-official.com/oauth-error.html?error=missing_parameters&error_description=${encodeURIComponent('Missing authorization code or state parameter')}`;
    return res.redirect(errorUrl);
  }

  try {
    console.log('[NotionOAuth2Callback] Attempting token exchange with redirect URI:', NOTION_REDIRECT_URI);
    
    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: NOTION_REDIRECT_URI,
      }),
    });

    const tokens = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokens.error || 'Unknown error'}`);
    }
    
    oauthResults[state] = { tokens, createdAt: Date.now() };
    console.log('[NotionOAuth2Callback] tokens stored for state:', state);
    console.log('[NotionOAuth2Callback] token types received:', Object.keys(tokens));
    return res.redirect('https://synk-official.com/oauth-success.html');
  } catch (err) {
    console.error('[NotionOAuth2Callback] token exchange error details:', {
      message: err.message,
      code: err.code,
      status: err.status,
      response: err.response?.data
    });
    const errorUrl = `https://synk-official.com/oauth-error.html?error=token_exchange_failed&error_description=${encodeURIComponent(err.message)}`;
    return res.redirect(errorUrl);
  }
});

// OAuth result polling endpoint
app.get('/api/oauth/result', (req, res) => {
  const { state } = req.query;
  console.log('[API.OAuthResult] poll request for state:', state);
  if (!state) return res.status(400).json({ error: 'missing_state' });

  const entry = oauthResults[state];
  if (!entry) {
    // return HTTP 200 with pending status (client expects status field)
    return res.status(200).json({ status: 'pending' });
  }

  const { tokens } = entry;
  // Optionally fetch calendars here if you want server to return them immediately.
  delete oauthResults[state];
  console.log('[API.OAuthResult] returning ready for state:', state);
  return res.status(200).json({ status: 'ready', tokens });
});

// Initialize cron jobs for trial management
if (supabase) {
  initializeCronJobs(supabase);
} else {
  console.warn('[Server] Supabase not configured, cron jobs disabled');
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Server] Listening on port ${PORT}`));
