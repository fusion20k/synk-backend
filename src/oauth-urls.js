const { isDemo } = require('./config');
const PKCEHelper = require('./pkce');

class OAuthURLBuilder {
  static buildGoogleAuthURL(pkceData) {
    // Select credentials based on demo mode
    const clientId = isDemo() ? process.env.GOOGLE_CLIENT_ID_DEMO : process.env.GOOGLE_CLIENT_ID;
    const redirectUri = isDemo() ? process.env.GOOGLE_REDIRECT_URI_DEMO : process.env.GOOGLE_REDIRECT_URI;
    
    if (!clientId) throw new Error('MISSING: GOOGLE_CLIENT_ID');
    if (!redirectUri) throw new Error('MISSING: GOOGLE_REDIRECT_URI');
    
    const scope = encodeURIComponent('openid email profile https://www.googleapis.com/auth/calendar.readonly');
    
    const authUrl = [
      'https://accounts.google.com/o/oauth2/v2/auth',
      `?client_id=${clientId}`,
      `&redirect_uri=${encodeURIComponent(redirectUri)}`,
      '&response_type=code',
      `&scope=${scope}`,
      '&access_type=offline',
      '&prompt=consent%20select_account',
      `&state=${pkceData.state}`,
      `&code_challenge=${pkceData.codeChallenge}`,
      '&code_challenge_method=S256'
    ].join('');
    
    // Critical logging for debugging redirect_uri_mismatch
    console.log('DEMO_MODE=', isDemo());
    console.log('Using Google Client ID:', clientId ? `${clientId.substring(0, 20)}...` : 'MISSING');
    console.log('Using GOOGLE_REDIRECT_URI=', redirectUri);
    console.log('Google Auth URL=', authUrl);
    
    return authUrl;
  }

  static buildNotionAuthURL(state) {
    // Select credentials based on demo mode
    const clientId = isDemo() ? process.env.NOTION_CLIENT_ID_DEMO : process.env.NOTION_CLIENT_ID;
    const redirectUri = isDemo() ? process.env.NOTION_REDIRECT_URI_DEMO : process.env.NOTION_REDIRECT_URI;
    
    if (!clientId) throw new Error('MISSING: NOTION_CLIENT_ID');
    if (!redirectUri) throw new Error('MISSING: NOTION_REDIRECT_URI');
    
    const notionAuthUrl = [
      'https://www.notion.com/oauth2/v2/auth',
      `?client_id=${clientId}`,
      `&redirect_uri=${encodeURIComponent(redirectUri)}`,
      '&response_type=code',
      '&owner=user',
      `&state=${state}`
    ].join('');
    
    // Logging for debugging
    console.log('DEMO_MODE=', isDemo());
    console.log('Using Notion Client ID:', clientId ? `${clientId.substring(0, 20)}...` : 'MISSING');
    console.log('Using NOTION_REDIRECT_URI=', redirectUri);
    console.log('Notion Auth URL=', notionAuthUrl);
    
    return notionAuthUrl;
  }

  static createGoogleOAuthFlow() {
    const pkceData = PKCEHelper.createPKCEPair();
    const authUrl = this.buildGoogleAuthURL(pkceData);
    
    return {
      authUrl,
      pkceData
    };
  }

  static createNotionOAuthFlow() {
    const state = PKCEHelper.generateState();
    const authUrl = this.buildNotionAuthURL(state);
    
    return {
      authUrl,
      state
    };
  }
}

module.exports = OAuthURLBuilder;