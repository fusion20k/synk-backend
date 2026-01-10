const fetch = require('node-fetch');

let cachedLatestVersion = '1.0.0';
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000;

async function fetchLatestVersion() {
  try {
    const headers = {
      'User-Agent': 'Synk-Backend'
    };
    
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    
    const response = await fetch('https://api.github.com/repos/fusion20k/synk-web/releases/latest', {
      headers
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        console.warn('[VersionConfig] GitHub API rate limit exceeded. Using cached version:', cachedLatestVersion);
      } else {
        console.warn('[VersionConfig] Failed to fetch latest release:', response.status);
      }
      return cachedLatestVersion;
    }
    
    const data = await response.json();
    const version = data.tag_name?.replace(/^v/, '') || cachedLatestVersion;
    
    cachedLatestVersion = version;
    lastFetchTime = Date.now();
    console.log('[VersionConfig] Updated latest version from GitHub:', version);
    
    return version;
  } catch (error) {
    console.error('[VersionConfig] Error fetching latest version:', error.message);
    return cachedLatestVersion;
  }
}

async function getLatestVersion() {
  if (Date.now() - lastFetchTime > CACHE_DURATION) {
    return await fetchLatestVersion();
  }
  return cachedLatestVersion;
}

fetchLatestVersion();

module.exports = {
  minSupportedVersion: '1.0.0',
  getLatestVersion,
  softUpdateMessage: 'A new version is available! Update for the latest features and improvements.'
};
