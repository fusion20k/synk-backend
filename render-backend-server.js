const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();

// At top of server file
const oauthResults = {}; // { state: { tokens, createdAt } }
console.log('[Server] BACKEND_URL=', process.env.BACKEND_URL || 'NOT SET');

// Middleware
app.use(cors({
  origin: ['https://synk-official.com', 'http://localhost:3000', 'https://synk-backend.onrender.com'],
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

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Synk Backend Server', 
    status: 'running',
    endpoints: [
      'GET /_health',
      'GET /auth/google',
      'GET /oauth2callback',
      'GET /api/oauth/result'
    ]
  });
});

// Health check endpoint
app.get('/_health', (req, res) => res.json({ ok: true, host: BACKEND_URL }));

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

// OAuth2 callback route
app.get('/oauth2callback', async (req, res) => {
  console.log('[OAuth2Callback] incoming request', { query: req.query });
  const { code, state, error } = req.query;
  
  if (error) {
    console.error('[OAuth2Callback] OAuth error from Google:', error);
    return res.status(400).send(`OAuth error: ${error}`);
  }
  
  if (!code || !state) {
    console.error('[OAuth2Callback] Missing required parameters:', { code: !!code, state: !!state });
    return res.status(400).send('Missing code or state');
  }

  try {
    console.log('[OAuth2Callback] Attempting token exchange with redirect URI:', REDIRECT_URI);
    const { tokens } = await oauth2Client.getToken(code);
    oauthResults[state] = { tokens, createdAt: Date.now() };
    console.log('[OAuth2Callback] tokens stored for state:', state);
    console.log('[OAuth2Callback] token types received:', Object.keys(tokens));
    return res.send('<html><body><h2>✅ Synk connected successfully — close this tab.</h2></body></html>');
  } catch (err) {
    console.error('[OAuth2Callback] token exchange error details:', {
      message: err.message,
      code: err.code,
      status: err.status,
      response: err.response?.data
    });
    return res.status(500).send(`OAuth token exchange failed: ${err.message}`);
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