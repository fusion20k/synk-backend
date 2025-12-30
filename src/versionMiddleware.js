const versionConfig = require('./versionConfig');

function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

async function versionCheckMiddleware(req, res, next) {
  const appVersion = req.headers['x-app-version'];
  
  if (!appVersion) {
    req.versionInfo = {
      forceUpdate: false,
      softUpdateMessage: null
    };
    return next();
  }
  
  const minVersion = versionConfig.minSupportedVersion;
  const latestVersion = await versionConfig.getLatestVersion();
  
  const isOutdated = compareVersions(appVersion, minVersion) < 0;
  const hasUpdate = compareVersions(appVersion, latestVersion) < 0;
  
  req.versionInfo = {
    forceUpdate: isOutdated,
    softUpdateMessage: hasUpdate && !isOutdated ? versionConfig.softUpdateMessage : null
  };
  
  next();
}

module.exports = versionCheckMiddleware;
