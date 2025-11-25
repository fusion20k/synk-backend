// Use Node.js built-in fetch (available in Node 18+)
let fetch;
if (typeof globalThis.fetch === 'undefined') {
  try {
    fetch = require('node-fetch');
  } catch (e) {
    console.error('Warning: node-fetch not available');
  }
} else {
  fetch = globalThis.fetch;
}

const config = require('./config');

class TokenExchangeManager {
  static async exchangeGoogleCode(code, pkceData) {
    const googleConfig = config.getGoogleConfig();
    
    console.log('Exchanging Google authorization code for tokens...');
    
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          code,
          client_id: googleConfig.clientId,
          client_secret: googleConfig.clientSecret,
          redirect_uri: googleConfig.redirectUri,
          grant_type: 'authorization_code',
          code_verifier: pkceData.codeVerifier
        })
      });
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorText}`);
      }
      
      const tokens = await tokenResponse.json();
      
      if (!tokens.access_token) {
        throw new Error('No access token received from Google');
      }
      
      console.log('✓ Google tokens received successfully');
      return tokens;
      
    } catch (error) {
      console.error('✗ Google token exchange failed:', error.message);
      throw error;
    }
  }

  static async exchangeNotionCode(code) {
    const notionConfig = config.getNotionConfig();
    
    console.log('Exchanging Notion authorization code for tokens...');
    
    try {
      const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: notionConfig.redirectUri,
          client_id: notionConfig.clientId,
          client_secret: notionConfig.clientSecret
        })
      });
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorText}`);
      }
      
      const tokens = await tokenResponse.json();
      
      if (!tokens.access_token) {
        throw new Error('No access token received from Notion');
      }
      
      console.log('✓ Notion tokens received successfully');
      return tokens;
      
    } catch (error) {
      console.error('✗ Notion token exchange failed:', error.message);
      throw error;
    }
  }

  static async fetchGoogleProfile(accessToken) {
    console.log('Fetching Google user profile...');
    
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Profile fetch failed: ${response.status}`);
      }
      
      const profile = await response.json();
      console.log('✓ Google profile fetched successfully');
      return profile;
      
    } catch (error) {
      console.error('✗ Google profile fetch failed:', error.message);
      throw error;
    }
  }

  static async fetchGoogleCalendars(accessToken) {
    console.log('Fetching Google calendars...');
    
    try {
      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Calendar fetch failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✓ Fetched ${data.items?.length || 0} Google calendars`);
      return data.items || [];
      
    } catch (error) {
      console.error('✗ Google calendar fetch failed:', error.message);
      throw error;
    }
  }

  static async fetchNotionDatabases(accessToken) {
    console.log('Fetching Notion databases...');
    
    try {
      const response = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          filter: {
            property: 'object',
            value: 'database'
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Database fetch failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✓ Fetched ${data.results?.length || 0} Notion databases`);
      return data.results || [];
      
    } catch (error) {
      console.error('✗ Notion database fetch failed:', error.message);
      throw error;
    }
  }
}

module.exports = TokenExchangeManager;