const crypto = require('crypto');

class PKCEHelper {
  static generateCodeVerifier() {
    // Generate a cryptographically random string of 43-128 characters
    return crypto.randomBytes(32).toString('base64url');
  }

  static generateCodeChallenge(codeVerifier) {
    // Create SHA256 hash of the code verifier and encode as base64url
    return crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
  }

  static generateState() {
    // Generate a random state parameter for CSRF protection
    return crypto.randomBytes(16).toString('base64url');
  }

  static createPKCEPair() {
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const state = this.generateState();
    
    return {
      codeVerifier,
      codeChallenge,
      state
    };
  }
}

module.exports = PKCEHelper;