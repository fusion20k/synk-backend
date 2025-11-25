const express = require('express');
const config = require('./config');
const TokenExchangeManager = require('./token-exchange');
const TokenStorage = require('./token-storage');

class OAuthCallbackServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.pendingCallbacks = new Map(); // Store pending OAuth flows
    this.tokenStorage = new TokenStorage(); // Create instance for token operations
    this.setupRoutes();
  }

  setupRoutes() {
    // Google OAuth callback
    this.app.get('/oauth/google/callback', async (req, res) => {
      console.log('Google OAuth callback received');
      
      try {
        const { code, state, error } = req.query;
        
        if (error) {
          console.error('Google OAuth error:', error);
          res.send(this.getErrorPage('Google OAuth Error', error));
          this.notifyCallback('google', { error });
          return;
        }
        
        if (!code) {
          console.error('No authorization code received');
          res.send(this.getErrorPage('Authorization Failed', 'No authorization code received'));
          this.notifyCallback('google', { error: 'No code' });
          return;
        }
        
        // Validate state and get PKCE data
        const pendingFlow = this.pendingCallbacks.get(`google-${state}`);
        if (!pendingFlow) {
          console.error('Invalid or expired state parameter');
          res.send(this.getErrorPage('Security Error', 'Invalid or expired state parameter'));
          this.notifyCallback('google', { error: 'Invalid state' });
          return;
        }
        
        console.log('Google OAuth code received, exchanging for tokens...');
        
        // Exchange code for tokens
        const tokens = await TokenExchangeManager.exchangeGoogleCode(code, pendingFlow.pkceData);
        const profile = await TokenExchangeManager.fetchGoogleProfile(tokens.access_token);
        const calendars = await TokenExchangeManager.fetchGoogleCalendars(tokens.access_token);
        
        // Save tokens securely
        await this.tokenStorage.saveTokens('google', {
          ...tokens,
          email: profile.email,
          name: profile.name
        });
        
        console.log('✓ Google OAuth completed successfully');
        res.send(this.getSuccessPage('Google Calendar Connected!', profile.email));
        
        // Notify the main process
        this.notifyCallback('google', {
          success: true,
          profile,
          calendars: calendars.map(cal => ({
            id: cal.id,
            name: cal.summary,
            primary: cal.primary || false,
            accessRole: cal.accessRole,
            timeZone: cal.timeZone,
            backgroundColor: cal.backgroundColor
          }))
        });
        
        // Clean up
        this.pendingCallbacks.delete(`google-${state}`);
        
      } catch (error) {
        console.error('Google OAuth callback error:', error);
        res.send(this.getErrorPage('OAuth Error', error.message));
        this.notifyCallback('google', { error: error.message });
      }
    });

    // Notion OAuth callback
    this.app.get('/oauth/notion/callback', async (req, res) => {
      console.log('Notion OAuth callback received');
      
      try {
        const { code, state, error } = req.query;
        
        if (error) {
          console.error('Notion OAuth error:', error);
          res.send(this.getErrorPage('Notion OAuth Error', error));
          this.notifyCallback('notion', { error });
          return;
        }
        
        if (!code) {
          console.error('No authorization code received');
          res.send(this.getErrorPage('Authorization Failed', 'No authorization code received'));
          this.notifyCallback('notion', { error: 'No code' });
          return;
        }
        
        // Validate state
        const pendingFlow = this.pendingCallbacks.get(`notion-${state}`);
        if (!pendingFlow) {
          console.error('Invalid or expired state parameter');
          res.send(this.getErrorPage('Security Error', 'Invalid or expired state parameter'));
          this.notifyCallback('notion', { error: 'Invalid state' });
          return;
        }
        
        console.log('Notion OAuth code received, exchanging for tokens...');
        
        // Exchange code for tokens
        const tokens = await TokenExchangeManager.exchangeNotionCode(code);
        const databases = await TokenExchangeManager.fetchNotionDatabases(tokens.access_token);
        
        // Save tokens securely
        await this.tokenStorage.saveTokens('notion', {
          ...tokens,
          workspace_name: tokens.workspace_name,
          workspace_id: tokens.workspace_id
        });
        
        console.log('✓ Notion OAuth completed successfully');
        res.send(this.getSuccessPage('Notion Connected!', tokens.workspace_name || 'Notion Workspace'));
        
        // Notify the main process
        this.notifyCallback('notion', {
          success: true,
          tokens,
          databases: databases.map(db => ({
            id: db.id,
            title: db.title?.[0]?.plain_text || 'Untitled Database',
            properties: Object.keys(db.properties || {}),
            last_edited_time: db.last_edited_time
          }))
        });
        
        // Clean up
        this.pendingCallbacks.delete(`notion-${state}`);
        
      } catch (error) {
        console.error('Notion OAuth callback error:', error);
        res.send(this.getErrorPage('OAuth Error', error.message));
        this.notifyCallback('notion', { error: error.message });
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        mode: config.get('MODE'),
        timestamp: new Date().toISOString()
      });
    });
  }

  getSuccessPage(title, subtitle) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>OAuth Success - Synk</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              text-align: center;
              padding: 50px 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: rgba(255, 255, 255, 0.1);
              padding: 40px;
              border-radius: 20px;
              backdrop-filter: blur(10px);
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            }
            h1 { color: #22c55e; margin-bottom: 10px; }
            p { margin: 10px 0; opacity: 0.9; }
            .countdown { font-size: 14px; opacity: 0.7; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✓ ${title}</h1>
            <p>${subtitle}</p>
            <p>You can now close this window and return to Synk.</p>
            <div class="countdown">This window will close automatically in <span id="timer">5</span> seconds.</div>
          </div>
          <script>
            let countdown = 5;
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

  getErrorPage(title, message) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>OAuth Error - Synk</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              text-align: center;
              padding: 50px 20px;
              background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
              color: white;
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: rgba(255, 255, 255, 0.1);
              padding: 40px;
              border-radius: 20px;
              backdrop-filter: blur(10px);
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            }
            h1 { color: #ef4444; margin-bottom: 10px; }
            p { margin: 10px 0; opacity: 0.9; }
            .error-details { 
              background: rgba(0, 0, 0, 0.2); 
              padding: 15px; 
              border-radius: 10px; 
              margin: 20px 0;
              font-family: monospace;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✗ ${title}</h1>
            <div class="error-details">${message}</div>
            <p>You can close this window and try again.</p>
            <p>If the problem persists, check the Synk console for more details.</p>
          </div>
        </body>
      </html>
    `;
  }

  registerPendingFlow(service, state, data) {
    const key = `${service}-${state}`;
    this.pendingCallbacks.set(key, {
      ...data,
      timestamp: Date.now()
    });
    
    // Clean up expired flows after 10 minutes
    setTimeout(() => {
      this.pendingCallbacks.delete(key);
    }, 10 * 60 * 1000);
  }

  notifyCallback(service, result) {
    // This would typically emit an event or call a callback
    // For now, we'll store the result for the main process to check
    this.lastCallbackResult = { service, result, timestamp: Date.now() };
  }

  async start(port = 3000) {
    return new Promise((resolve, reject) => {
      const tryPort = (currentPort) => {
        this.server = this.app.listen(currentPort, (err) => {
          if (err) {
            if (err.code === 'EADDRINUSE' && currentPort === 3000) {
              console.log(`Port 3000 is busy, trying port ${currentPort + 1}...`);
              tryPort(currentPort + 1);
            } else {
              reject(err);
            }
          } else {
            const actualPort = this.server.address().port;
            console.log(`✓ OAuth callback server started on port ${actualPort}`);
            
            if (actualPort !== 3000) {
              console.log(`⚠️  Using port ${actualPort} instead of 3000`);
              console.log(`⚠️  Make sure your OAuth redirect URIs include port ${actualPort}`);
            }
            
            resolve(actualPort);
          }
        });
      };
      
      tryPort(port);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
      console.log('✓ OAuth callback server stopped');
    }
  }

  isRunning() {
    return this.server && this.server.listening;
  }
}

module.exports = OAuthCallbackServer;