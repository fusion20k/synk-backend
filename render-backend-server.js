const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const fetch = require('node-fetch');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Stripe = require('stripe');
require('dotenv').config();

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
        PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY || process.env.PRO_MONTHLY_PRICE || '',
        PRO_YEARLY: process.env.STRIPE_PRICE_PRO_YEARLY || process.env.PRO_YEARLY_PRICE || '',
        ULTIMATE_MONTHLY: process.env.STRIPE_PRICE_ULTIMATE_MONTHLY || process.env.ULTIMATE_MONTHLY_PRICE || '',
        ULTIMATE_YEARLY: process.env.STRIPE_PRICE_ULTIMATE_YEARLY || process.env.ULTIMATE_YEARLY_PRICE || '',
      };
      const PRICE_TO_PLAN = {};
      if (PRICE_IDS.PRO_MONTHLY) PRICE_TO_PLAN[PRICE_IDS.PRO_MONTHLY] = { plan: 'pro', billing_period: 'monthly' };
      if (PRICE_IDS.PRO_YEARLY) PRICE_TO_PLAN[PRICE_IDS.PRO_YEARLY] = { plan: 'pro', billing_period: 'yearly' };
      if (PRICE_IDS.ULTIMATE_MONTHLY) PRICE_TO_PLAN[PRICE_IDS.ULTIMATE_MONTHLY] = { plan: 'ultimate', billing_period: 'monthly' };
      if (PRICE_IDS.ULTIMATE_YEARLY) PRICE_TO_PLAN[PRICE_IDS.ULTIMATE_YEARLY] = { plan: 'ultimate', billing_period: 'yearly' };

      async function applySubscriptionToUser({ priceId, status, customerId, emailHint }) {
        if (!stripe || !supabase) return;
        let email = emailHint || null;
        try {
          if (!email && customerId) {
            const customer = await stripe.customers.retrieve(customerId);
            email = customer && (customer.email || customer.billing_details?.email || customer.shipping?.email);
          }
        } catch (e) {
          console.warn('[Stripe] Failed to retrieve customer for email mapping:', e.message);
        }
        if (!email) {
          console.warn('[Stripe] No email resolved for subscription mapping');
          return;
        }

        const mapping = PRICE_TO_PLAN[priceId] || null;
        if (!mapping) {
          console.warn('[Stripe] Unknown priceId, leaving plan unchanged:', priceId);
          return;
        }

        // Ensure user exists; if not, pre-create placeholder row so order doesn't matter
        let userRow = null;
        try {
          userRow = await getUserByEmail(email);
        } catch (e) {
          console.error('[Stripe] getUserByEmail error:', e.message);
        }
        if (!userRow) {
          try {
            await insertUser({ email, password_hash: null, plan: null, billing_period: null, trial_end: null });
            console.log('[Stripe] Placeholder user created for', email);
          } catch (e) {
            console.error('[Stripe] insertUser error:', e.message);
          }
        }

        // If subscription is active, set plan; if canceled/unpaid, clear plan
        try {
          if (status === 'active' || status === 'trialing' || status === 'past_due') {
            await updateUser(email, { plan: mapping.plan, billing_period: mapping.billing_period, trial_end: null });
            console.log('[Stripe] Plan set for', email, mapping.plan, mapping.billing_period);
          } else {
            await updateUser(email, { plan: null, billing_period: null, trial_end: null });
            console.log('[Stripe] Plan cleared for', email, status);
          }
        } catch (e) {
          console.error('[Stripe] updateUser error:', e.message);
        }
      }

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          // Try to get email from session first
          const emailHint = session.customer_details?.email || session.customer_email || null;
          // Retrieve subscription to get price ID
          if (session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription);
            const item = sub.items && sub.items.data && sub.items.data[0];
            const priceId = item && item.price && item.price.id;
            await applySubscriptionToUser({ customerId: session.customer, priceId, status: sub.status, emailHint });
          }
          break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.resumed':
        case 'customer.subscription.paused':
        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const item = sub.items && sub.items.data && sub.items.data[0];
          const priceId = item && item.price && item.price.id;
          // For these events, we only have customer ID; email is fetched inside
          await applySubscriptionToUser({ customerId: sub.customer, priceId, status: sub.status });
          break;
        }
        case 'invoice.paid': {
          const inv = event.data.object;
          const emailHint = inv.customer_email || inv.customer_details?.email || null;
          if (inv.subscription) {
            const sub = await stripe.subscriptions.retrieve(inv.subscription);
            const item = sub.items && sub.items.data && sub.items.data[0];
            const priceId = item && item.price && item.price.id;
            await applySubscriptionToUser({ customerId: sub.customer, priceId, status: sub.status, emailHint });
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

    const trial_end = new Date(Date.now() + 14*24*60*60*1000).toISOString();
    const row = { email, password_hash, plan: 'pro', billing_period: 'trial', trial_end };
    await insertUser(row);

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ success: true, token, user: { email } });
  } catch (e) {
    console.error('[POST /signup] Error:', e.message);
    return res.status(500).json({ success: false, error: 'server_error' });
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
    return res.json({ success: true, token, user: { email } });
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

// /me - plan source of truth
app.get('/me', authMiddleware, async (req, res) => {
  try {
    const email = req.user.email;
    const u = await getUserByEmail(email);
    if (!u) return res.status(404).json({ success: false, error: 'user_not_found' });

    // Expire trial if needed
    if (u.trial_end && new Date() > new Date(u.trial_end) && u.billing_period === 'trial') {
      await updateUser(email, { plan: null, billing_period: null, trial_end: null });
      u.plan = null; u.billing_period = null; u.trial_end = null;
    }

    const plan = u.plan ? { type: u.plan, billingCycle: u.billing_period } : null;
    return res.json({ success: true, email, plan, billing_period: u.billing_period, trial_end: u.trial_end });
  } catch (e) {
    console.error('[GET /me] Error:', e.message);
    return res.status(500).json({ success: false, error: 'server_error' });
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Server] Listening on port ${PORT}`));
