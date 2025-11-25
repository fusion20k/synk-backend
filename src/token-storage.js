const keytar = require('keytar');
const Store = require('electron-store');

class TokenStorage {
  constructor() {
    this.store = new Store();
    // ✅ CRITICAL FIX: Use SAME keychain service as oauth.js to ensure tokens can be found
    this.serviceName = 'synk-app';
    this.googleAccount = 'google-oauth';
    this.notionAccount = 'notion-oauth';
  }

  async saveTokens(service, tokens) {
    try {
      const accountKey = service === 'google' ? this.googleAccount : this.notionAccount;
      
      console.log(`[Token Save] 📝 Saving ${service} tokens to keytar (service: ${this.serviceName}, account: ${accountKey})`);
      
      // Store tokens in keytar (system keychain) with SAME keys as oauth.js uses
      const tokenData = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type || (service === 'notion' ? 'bearer' : 'Bearer'),
        scope: tokens.scope
      };
      
      // Add service-specific fields
      if (service === 'google') {
        tokenData.email = tokens.email;
        tokenData.name = tokens.name;
      } else if (service === 'notion') {
        tokenData.bot_id = tokens.bot_id;
        tokenData.workspace_name = tokens.workspace_name;
        tokenData.workspace_icon = tokens.workspace_icon;
        tokenData.workspace_id = tokens.workspace_id;
        tokenData.owner = tokens.owner;
        tokenData.duplicated_template_id = tokens.duplicated_template_id;
      }
      
      // Store as JSON string (same format as oauth.js)
      await keytar.setPassword(this.serviceName, accountKey, JSON.stringify(tokenData));
      console.log(`✅ ${service} tokens SAVED to keytar with access_token: ${tokenData.access_token ? '✓' : '✗'}`);
      
    } catch (error) {
      console.error(`❌ Failed to save ${service} tokens:`, error.message, error.stack);
      throw error;
    }
  }

  async getTokens(service) {
    try {
      const accountKey = service === 'google' ? this.googleAccount : this.notionAccount;
      
      // Get tokens from keytar with SAME keys as oauth.js uses
      const tokenString = await keytar.getPassword(this.serviceName, accountKey);
      
      if (!tokenString) {
        console.log(`[Token Check] No ${service} token found in keytar (service: ${this.serviceName}, account: ${accountKey})`);
        return null;
      }
      
      const tokenData = JSON.parse(tokenString);
      
      if (!tokenData || !tokenData.access_token) {
        console.log(`[Token Check] Invalid ${service} token structure in keytar`);
        return null;
      }
      
      return tokenData;
      
    } catch (error) {
      console.error(`✗ Failed to retrieve ${service} tokens:`, error.message);
      return null;
    }
  }

  async deleteTokens(service) {
    try {
      const accountKey = service === 'google' ? this.googleAccount : this.notionAccount;
      
      await keytar.deletePassword(this.serviceName, accountKey);
      console.log(`✓ ${service} tokens deleted from keytar (service: ${this.serviceName}, account: ${accountKey})`);
      
    } catch (error) {
      console.error(`✗ Failed to delete ${service} tokens:`, error.message);
      throw error;
    }
  }

  async hasValidTokens(service) {
    // Check if tokens exist for a specific service or either service
    if (service === 'google') {
      return (await this.getTokensFromKeytar('google')) !== null;
    } else if (service === 'notion') {
      return (await this.getTokensFromKeytar('notion')) !== null;
    } else {
      // Check if ANY tokens exist (both Google and Notion)
      const hasGoogle = (await this.getTokensFromKeytar('google')) !== null;
      const hasNotion = (await this.getTokensFromKeytar('notion')) !== null;
      return hasGoogle || hasNotion;
    }
  }

  getTokensSync(service) {
    // Note: This must be async to use keytar properly
    // Use async version instead
    return null;
  }

  async getTokensFromKeytar(service) {
    // Async method to get tokens from keytar (used at startup)
    try {
      const accountKey = service === 'google' ? this.googleAccount : this.notionAccount;
      console.log(`[Token Check] 🔍 Looking for ${service} tokens in keytar (service: ${this.serviceName}, account: ${accountKey})`);
      
      const tokenString = await keytar.getPassword(this.serviceName, accountKey);
      
      if (!tokenString) {
        console.log(`[Token Check] ❌ ${service}: No token string found in keytar`);
        return null;
      }
      
      console.log(`[Token Check] 📦 ${service}: Found token string, parsing...`);
      const tokenData = JSON.parse(tokenString);
      
      if (!tokenData || !tokenData.access_token) {
        console.log(`[Token Check] ❌ ${service}: Token data invalid or no access_token`);
        return null;
      }
      
      console.log(`[Token Check] ✅ ${service}: Successfully retrieved token with access_token`);
      return tokenData;
    } catch (error) {
      console.error(`[Token Check] 💥 Error getting ${service} tokens from keytar:`, error.message);
      return null;
    }
  }

  async getAllTokens() {
    // Get both Google and Notion tokens
    const googleTokens = await this.getTokensFromKeytar('google');
    const notionTokens = await this.getTokensFromKeytar('notion');
    
    return {
      googleAccessToken: googleTokens?.access_token || null,
      notionAccessToken: notionTokens?.access_token || null,
      google: googleTokens,
      notion: notionTokens
    };
  }

  async refreshGoogleToken(refreshToken) {
    const config = require('./config');
    
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
    
    try {
      const googleConfig = config.getGoogleConfig();
      
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: googleConfig.clientId,
          client_secret: googleConfig.clientSecret
        })
      });
      
      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }
      
      const tokens = await response.json();
      
      // Update stored tokens
      await this.saveTokens('google', {
        ...tokens,
        refresh_token: refreshToken // Keep the original refresh token if not provided
      });
      
      console.log('✓ Google token refreshed successfully');
      return tokens;
      
    } catch (error) {
      console.error('✗ Google token refresh failed:', error.message);
      throw error;
    }
  }

  async clearAllTokens() {
    try {
      // Clear Google tokens
      await this.deleteTokens('google');
      
      // Clear Notion tokens
      await this.deleteTokens('notion');
      
      // Clear all stored data
      this.store.clear();
      
      console.log('✓ All tokens and data cleared');
      
    } catch (error) {
      console.error('✗ Failed to clear all tokens:', error.message);
      throw error;
    }
  }
}

module.exports = new TokenStorage();