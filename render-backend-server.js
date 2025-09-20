console.log("🟢 LIVE: render-backend-server.js is starting up...");
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const fetch = require('node-fetch');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.post('/webhook', express.raw({type: 'application/json'}), (request, response) => {
  console.log("[Stripe Webhook] POST request received at /webhook endpoint.");
  response.json({received: true});
});

// At top of server file
const oauthResults = {}; // { state: { tokens, createdAt } }
console.log('[Server] BACKEND_URL=', process.env.BACKEND_URL || 'NOT SET');

// Middleware
app.use(cors({
  origin: ['https://synk-official.com', 'http://localhost:3000', 'https://synk-web.onrender.com'],
  credentials: true
}));
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
    if (existing) return res.status(409).json({ success: false, error: 'user_exists' });

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

    const ok = await bcrypt.compare(password, userRow.password_hash || '');
    if (!ok) return res.status(401).json({ success: false, error: 'invalid_credentials' });

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ success: true, token, user: { email } });
  } catch (e) {
    console.error('[POST /login] Error:', e.message);
    return res.status(500).json({ success: false, error: 'server_error' });
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
    return res.json({ success: true, plan, billing_period: u.billing_period, trial_end: u.trial_end });
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
