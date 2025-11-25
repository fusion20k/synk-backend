// Production-only OAuth implementation for Synk
// No local servers, no demo mode - production endpoints only

const keytar = require('keytar');
const crypto = require('crypto');

// Use Node.js built-in fetch (available in Node 18+)
// Only require node-fetch as fallback for older Node versions
let fetch;
if (typeof globalThis.fetch === 'undefined') {
  try {
    fetch = require('node-fetch');
  } catch (e) {
    console.error('Warning: node-fetch not available, fetch API will not work');
  }
} else {
  fetch = globalThis.fetch;
}

// Load environment variables
require('dotenv').config();

const BACKEND_URL = process.env.BACKEND_URL || 'https://synk-web.onrender.com';

// Define Google Calendar scopes (including identity for user profile)
const SCOPES = process.env.GOOGLE_SCOPES ? 
  process.env.GOOGLE_SCOPES.split(' ') : 
  [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    "openid",
    "profile", 
    "email"
  ];

// OAuth Configuration from environment variables
const OAUTH_CONFIG = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${BACKEND_URL}/oauth2callback`,
    scopes: SCOPES
  },
  notion: {
    clientId: process.env.NOTION_CLIENT_ID,
    clientSecret: process.env.NOTION_CLIENT_SECRET,
    redirectUri: process.env.NOTION_REDIRECT_URI || `${BACKEND_URL}/oauth2callback/notion`
  }
};

// Validate required environment variables
const requiredVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NOTION_CLIENT_ID', 'NOTION_CLIENT_SECRET', 'BACKEND_URL'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars);
  console.error('Please check your .env file');
}

// Keytar service configuration
const SERVICE = 'synk-app';
const GOOGLE_ACCOUNT = 'google-oauth';
const NOTION_ACCOUNT = 'notion-oauth';

// Google OAuth via production server + polling
async function googleOAuthViaProduction(shellRef) {
  // Validate configuration
  if (!OAUTH_CONFIG.google.clientId || !OAUTH_CONFIG.google.clientSecret) {
    console.error('❌ Google OAuth not configured. Missing CLIENT_ID or CLIENT_SECRET');
    return { ok: false, error: 'oauth_not_configured' };
  }

  console.log('🚀 Starting Google OAuth via production server...');
  
  const state = crypto.randomBytes(16).toString('hex');
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    `client_id=${encodeURIComponent(OAUTH_CONFIG.google.clientId)}&` +
    `redirect_uri=${encodeURIComponent(OAUTH_CONFIG.google.redirectUri)}&` +
    'response_type=code&' +
    `scope=${encodeURIComponent(OAUTH_CONFIG.google.scopes.join(' '))}&` +
    'access_type=offline&' +
    'prompt=consent%20select_account&' +
    `state=${encodeURIComponent(state)}`;

  // Use the shell reference passed from main process
  if (!shellRef) {
    console.error('❌ Shell reference not provided');
    return { ok: false, error: 'shell_reference_missing' };
  }
  
  console.log('[Client OAuth] Opening system browser for auth:', authUrl);
  await shellRef.openExternal(authUrl); // MUST be system browser

  try {
    // Poll production server for result
    const result = await pollForResult(state);
    
    if (result.status === 'ready' && result.tokens) {
      console.log('[OAuth] Tokens received, storing and fetching calendars...');
      
      // Store tokens
      await storeGoogleTokens(result.tokens);
      
      // Fetch calendars to verify the tokens work
      const { listGoogleCalendars } = require('./google');
      const calendars = await listGoogleCalendars();
      
      console.log(`[OAuth] Successfully fetched ${calendars.allCalendars?.length || 0} calendars`);
      return { ok: true, calendars };
    } else {
      console.error('[OAuth] Invalid result from server:', result);
      return { ok: false, error: 'invalid_server_response' };
    }
  } catch (error) {
    console.error('[OAuth] Error during OAuth process:', error);
    return { ok: false, error: error.message };
  }
}

async function pollForResult(state) {
  const pollUrl = `${BACKEND_URL}/api/oauth/result?state=${state}`;
  const start = Date.now();
  const maxMs = 2 * 60 * 1000; // 2 minutes
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(pollUrl, { method: 'GET' });
      const json = await res.json();
      console.log('[Client OAuth] Poll response:', res.status, json);
      if (res.status === 200 && json.status === 'ready') {
        // got tokens
        return json;
      }
    } catch (err) {
      console.error('[Client OAuth] poll error', err && err.message);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('OAuth polling timed out');
}

// Notion OAuth via production server + polling
async function notionOAuthViaProduction(shellRef) {
  // Validate configuration
  if (!OAUTH_CONFIG.notion.clientId || !OAUTH_CONFIG.notion.clientSecret) {
    console.error('❌ Notion OAuth not configured. Missing CLIENT_ID or CLIENT_SECRET');
    return { ok: false, error: 'oauth_not_configured' };
  }

  console.log('🚀 Starting Notion OAuth via production server...');
  
  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = new URL('https://api.notion.com/v1/oauth/authorize');
  authUrl.searchParams.set('client_id', OAUTH_CONFIG.notion.clientId);
  authUrl.searchParams.set('redirect_uri', OAUTH_CONFIG.notion.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('owner', 'user');
  authUrl.searchParams.set('state', state);

  console.log('[Client OAuth] Opening browser for Notion authentication...');
  console.log('[Client OAuth] Redirect URI:', OAUTH_CONFIG.notion.redirectUri);

  // Use the shell reference passed from main process
  if (!shellRef) {
    console.error('❌ Shell reference not provided for Notion OAuth');
    return { ok: false, error: 'shell_reference_missing' };
  }

  // Open in system browser
  await shellRef.openExternal(authUrl.toString());

  // Poll production server for result
  const pollEndpoint = `${process.env.BACKEND_URL}/api/oauth/result?state=${encodeURIComponent(state)}`;
  const maxMs = 2 * 60 * 1000; // 2 minutes
  const start = Date.now();

  console.log('[Client OAuth] Polling server for Notion OAuth result...');
  console.log('[Client OAuth] Poll endpoint:', pollEndpoint);

  while (Date.now() - start < maxMs) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log(`[Client OAuth] Polling Notion... (${elapsed}s elapsed)`, new Date().toISOString());
      
      const resp = await fetch(pollEndpoint, { 
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Synk-Desktop-Client/1.0'
        }
      });
      
      console.log(`[Client OAuth] Response status: ${resp.status} ${resp.statusText}`);
      
      if (!resp.ok) {
        if (resp.status === 404) {
          console.log('[Client OAuth] Notion OAuth result not ready yet, continuing to poll...');
        } else {
          console.log(`[Client OAuth] Server error ${resp.status}, continuing to poll...`);
        }
        continue;
      }
      
      const data = await resp.json();
      console.log('[Client OAuth] Server response:', JSON.stringify(data, null, 2));
      
      if (data.success === true) {
        console.log('[Client OAuth] ✅ Notion OAuth SUCCESS!');
        if (data.tokens) {
          // Store tokens locally using keytar
          await storeNotionTokens(data.tokens);
        }
        
        // Fetch databases to verify the tokens work
        const { listDatabases } = require('./notion');
        const result = await listDatabases();
        const databases = result.databases || [];
        
        console.log(`[OAuth] Successfully fetched ${databases.length || 0} Notion databases`);
        return { ok: true, workspace: data.workspace, databases: databases };
      }
      
      if (data.success === false) {
        console.error('[Client OAuth] ❌ Notion OAuth failed:', data.error || 'unknown_error');
        return { ok: false, error: data.error || 'oauth_failed' };
      }
      
      // Legacy status format support
      if (data.status === 'pending') {
        console.log('[Client OAuth] Status: pending, continuing to poll...');
        continue;
      }
      if (data.status === 'ready') {
        const workspaceName = data.workspace || (data.tokens && data.tokens.workspace_name);
        console.log('[Client OAuth] ✅ Notion workspace connected:', workspaceName);
        
        // Store tokens locally using keytar
        if (data.tokens) {
          await storeNotionTokens(data.tokens);
        }
        
        // Fetch databases to verify the tokens work
        const { listDatabases } = require('./notion');
        const result = await listDatabases();
        const databases = result.databases || [];
        
        console.log(`[OAuth] Successfully fetched ${databases.length || 0} Notion databases`);
        return { ok: true, workspace: workspaceName, databases: databases };
      }
      if (data.status === 'error') {
        console.error('[Client OAuth] ❌ Server error:', data.error);
        return { ok: false, error: data.error || 'server_error' };
      }
      
      console.log('[Client OAuth] Unknown response format, continuing to poll...');
      
    } catch (err) {
      console.error('[Client OAuth] Polling error:', err.message);
      console.error('[Client OAuth] Full error:', err);
      // continue polling until timeout
    }
  }

  console.error('[Client OAuth] ❌ Timeout after 2 minutes');
  return { ok: false, error: 'timeout' };
}

// Legacy compatibility functions
async function googleOAuth(shell) {
  const result = await googleOAuthViaProduction(shell);
  if (result.ok) {
    return { 
      success: true, 
      calendars: result.calendars,
      message: 'OAuth flow completed successfully.' 
    };
  } else {
    throw new Error(result.error || 'OAuth failed');
  }
}

async function notionOAuth(shell) {
  const result = await notionOAuthViaProduction(shell);
  if (result.ok) {
    return { 
      success: true, 
      workspace: result.workspace,
      databases: result.databases,
      message: 'Notion OAuth flow completed successfully.' 
    };
  } else {
    throw new Error(result.error || 'Notion OAuth failed');
  }
}

// Token management functions
async function getGoogleToken() {
  try {
    const tokenString = await keytar.getPassword(SERVICE, GOOGLE_ACCOUNT);
    if (!tokenString) {
      throw new Error('No Google token found. Please connect your Google account first.');
    }
    
    const tokenData = JSON.parse(tokenString);
    
    // Check if token is expired
    if (tokenData.expires_at && Date.now() >= tokenData.expires_at) {
      console.log('Google token expired, attempting refresh...');
      
      if (tokenData.refresh_token) {
        // Refresh the token
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: OAUTH_CONFIG.google.clientId,
            client_secret: OAUTH_CONFIG.google.clientSecret,
            refresh_token: tokenData.refresh_token,
            grant_type: 'refresh_token'
          })
        });
        
        const refreshData = await refreshResponse.json();
        
        if (refreshData.access_token) {
          // Update stored token
          const updatedTokenData = {
            ...tokenData,
            access_token: refreshData.access_token,
            expires_in: refreshData.expires_in,
            expires_at: Date.now() + (refreshData.expires_in * 1000)
          };
          
          await keytar.setPassword(SERVICE, GOOGLE_ACCOUNT, JSON.stringify(updatedTokenData));
          console.log('✅ Google token refreshed successfully');
          return updatedTokenData;
        } else {
          throw new Error('Failed to refresh Google token');
        }
      } else {
        throw new Error('Google token expired and no refresh token available');
      }
    }
    
    return tokenData;
  } catch (error) {
    console.error('Error getting Google token:', error);
    throw error;
  }
}

async function getNotionToken() {
  try {
    const tokenString = await keytar.getPassword(SERVICE, NOTION_ACCOUNT);
    if (!tokenString) {
      throw new Error('No Notion token found. Please connect your Notion account first.');
    }
    
    return JSON.parse(tokenString);
  } catch (error) {
    console.error('Error getting Notion token:', error);
    throw error;
  }
}

async function storeGoogleTokens(tokens) {
  try {
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      expires_at: Date.now() + (tokens.expires_in * 1000),
      scope: tokens.scope,
      token_type: tokens.token_type || 'Bearer'
    };
    
    await keytar.setPassword(SERVICE, GOOGLE_ACCOUNT, JSON.stringify(tokenData));
    console.log('✅ Google tokens stored securely');
    return tokenData;
  } catch (error) {
    console.error('Error storing Google tokens:', error);
    throw error;
  }
}

async function storeNotionTokens(tokens) {
  try {
    const tokenData = {
      access_token: tokens.access_token,
      token_type: tokens.token_type || 'bearer',
      bot_id: tokens.bot_id,
      workspace_name: tokens.workspace_name,
      workspace_icon: tokens.workspace_icon,
      workspace_id: tokens.workspace_id,
      owner: tokens.owner,
      duplicated_template_id: tokens.duplicated_template_id
    };
    
    await keytar.setPassword(SERVICE, NOTION_ACCOUNT, JSON.stringify(tokenData));
    console.log('✅ Notion tokens stored securely');
    return tokenData;
  } catch (error) {
    console.error('Error storing Notion tokens:', error);
    throw error;
  }
}

async function clearAllStoredData() {
  try {
    await keytar.deletePassword(SERVICE, GOOGLE_ACCOUNT);
    await keytar.deletePassword(SERVICE, NOTION_ACCOUNT);
    console.log('✅ All stored OAuth data cleared');
  } catch (error) {
    console.error('Error clearing stored data:', error);
    throw error;
  }
}

module.exports = {
  googleOAuth,
  googleOAuthViaProduction,
  notionOAuth,
  notionOAuthViaProduction,
  getGoogleToken,
  getNotionToken,
  storeGoogleTokens,
  storeNotionTokens,
  clearAllStoredData
};