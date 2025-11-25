// oauth-server-secure.js - Production OAuth Server with Environment Variables
require('dotenv').config({ path: '.env.production' });

const express = require('express');
const { google } = require('googleapis');

// Validate required environment variables
const requiredEnvVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NOTION_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars);
  console.error('Please check your .env.production file');
  process.exit(1);
}

console.log('✅ Environment variables loaded successfully');

// OAuth Configuration
const GOOGLE_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
  scopes: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ]
};

// In-memory token storage (production should use Redis/Database)
const tokensByState = {};

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// OAuth2 callback endpoint
app.get('/oauth2callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    console.log('[OAuth2Callback] Received callback:', { code: !!code, state });

    if (!code) {
      console.error('[OAuth2Callback] No authorization code provided');
      return res.status(400).send(generateErrorPage('Authorization code not provided'));
    }

    if (!state) {
      console.error('[OAuth2Callback] No state parameter provided');
      return res.status(400).send(generateErrorPage('State parameter not provided'));
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CONFIG.clientId,
      GOOGLE_CONFIG.clientSecret,
      GOOGLE_CONFIG.redirectUri
    );

    console.log('[OAuth2Callback] Exchanging code for tokens...');
    
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      console.error('[OAuth2Callback] Failed to obtain access token');
      return res.status(400).send(generateErrorPage('Failed to obtain access token'));
    }

    console.log('[OAuth2Callback] Tokens obtained successfully');

    // Store tokens temporarily in memory under the given state
    tokensByState[state] = {
      tokens,
      timestamp: Date.now()
    };
    
    console.log('[OAuth2Callback] Tokens stored for state:', state);

    // Set a cleanup timeout (5 minutes)
    setTimeout(() => {
      if (tokensByState[state]) {
        console.log('[OAuth2Callback] Cleaning up expired tokens for state:', state);
        delete tokensByState[state];
      }
    }, 5 * 60 * 1000);

    // Respond with success page
    res.send(generateSuccessPage());

  } catch (error) {
    console.error('[OAuth2Callback] Error:', error);
    res.status(500).send(generateErrorPage('OAuth authentication failed'));
  }
});

// Polling endpoint for desktop client
app.get('/api/oauth/result', async (req, res) => {
  try {
    const { state } = req.query;
    
    console.log('[OAuth Result] Polling request for state:', state);

    if (!state) {
      console.log('[OAuth Result] No state parameter provided');
      return res.json({ status: 'error', error: 'missing_state' });
    }

    const tokenData = tokensByState[state];

    if (!tokenData) {
      console.log('[OAuth Result] No tokens found for state:', state);
      return res.json({ status: 'pending' });
    }

    console.log('[OAuth Result] Tokens found, fetching calendars...');

    try {
      // Create OAuth2 client and set credentials
      const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CONFIG.clientId,
        GOOGLE_CONFIG.clientSecret,
        GOOGLE_CONFIG.redirectUri
      );
      oauth2Client.setCredentials(tokenData.tokens);

      // Fetch user's calendars
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const result = await calendar.calendarList.list();
      const calendars = result.data.items || [];

      console.log('[OAuth Result] Successfully fetched calendars:', calendars.length);

      // Clean up tokens after successful use
      delete tokensByState[state];
      console.log('[OAuth Result] Cleaned up tokens for state:', state);

      // Return calendars in the format expected by the desktop client
      return res.json({
        status: 'ready',
        calendars: calendars.map(cal => ({
          id: cal.id,
          name: cal.summary,
          summary: cal.summary,
          primary: cal.primary || false,
          accessRole: cal.accessRole || 'reader',
          timeZone: cal.timeZone || 'UTC'
        }))
      });

    } catch (calendarError) {
      console.error('[OAuth Result] Calendar API error:', calendarError);
      
      // Clean up tokens on error
      delete tokensByState[state];
      
      return res.json({ 
        status: 'error', 
        error: 'calendar_fetch_failed',
        details: calendarError.message 
      });
    }

  } catch (error) {
    console.error('[OAuth Result] Unexpected error:', error);
    return res.json({ 
      status: 'error', 
      error: 'server_error',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    activeTokens: Object.keys(tokensByState).length
  });
});

// Generate success page HTML
function generateSuccessPage() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Google Account Linked</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          text-align: center; 
          padding: 50px; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          max-width: 400px;
        }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h2 { color: #333; margin-bottom: 15px; }
        p { color: #666; margin-bottom: 20px; }
        .countdown { color: #999; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">✅</div>
        <h2>Google Account Linked Successfully!</h2>
        <p>You can close this tab and return to the Synk app.</p>
        <div class="countdown">This tab will close automatically in <span id="timer">3</span> seconds.</div>
      </div>
      <script>
        let countdown = 3;
        const timer = document.getElementById('timer');
        const interval = setInterval(() => {
          countdown--;
          timer.textContent = countdown;
          if (countdown <= 0) {
            clearInterval(interval);
            window.close();
          }
        }, 1000);
      </script>
    </body>
    </html>
  `;
}

// Generate error page HTML
function generateErrorPage(message) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>OAuth Error</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          text-align: center; 
          padding: 50px; 
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          max-width: 400px;
        }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h2 { color: #333; margin-bottom: 15px; }
        p { color: #666; margin-bottom: 20px; }
        .retry-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
        }
        .retry-btn:hover { background: #0056b3; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">❌</div>
        <h2>OAuth Failed</h2>
        <p>${message}</p>
        <button class="retry-btn" onclick="window.close()">Close Tab</button>
      </div>
    </body>
    </html>
  `;
}

// Start server
if (require.main === module) {
  app.listen(port, () => {
    console.log(`🚀 Secure OAuth server listening on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;