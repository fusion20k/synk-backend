// src/config.js - Production-only configuration
require('dotenv').config();

function getGoogleConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI
  };
}

function getNotionConfig() {
  return {
    clientId: process.env.NOTION_CLIENT_ID,
    clientSecret: process.env.NOTION_CLIENT_SECRET,
    redirectUri: process.env.NOTION_REDIRECT_URI
  };
}

module.exports = {
  isProduction: () => true,
  isDevelopment: () => false,
  getGoogleConfig,
  getNotionConfig,
  get: (key) => {
    switch (key) {
      case 'MODE':
        return 'production';
      case 'NODE_ENV':
        return process.env.NODE_ENV || 'production';
      default:
        return process.env[key];
    }
  }
};