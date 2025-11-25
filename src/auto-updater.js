const { autoUpdater } = require('electron-updater');
const { ipcMain, dialog } = require('electron');
const Store = require('electron-store');

const settings = new Store({
  name: 'settings',
  defaults: {
    'update-preference': 'prompt', // 'prompt' | 'auto' | 'manual'
    'update-skip-version': null,
    'update-remind-at': 0
  }
});

class AutoUpdater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.setupAutoUpdater();
    this.registerIpc();
  }

  getUpdateSummary(version) {
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = path.join(__dirname, 'update-log.json');
      const raw = fs.readFileSync(logPath, 'utf-8');
      const json = JSON.parse(raw);
      const entry = (json.updates || []).find(u => u.version === version);
      const parts = [];

      if (entry) {
        if (entry.features && entry.features.length) parts.push('Features:\n- ' + entry.features.join('\n- '));
        if (entry.improvements && entry.improvements.length) parts.push('Improvements:\n- ' + entry.improvements.join('\n- '));
        if (entry.fixes && entry.fixes.length) parts.push('Fixes:\n- ' + entry.fixes.join('\n- '));
      } else {
        parts.push('New improvements and fixes.');
      }

      // Append plan-specific highlights
      try {
        const { PlanManager } = require('./planManager');
        const pm = new PlanManager();
        const plan = pm.getCurrentPlan();
        const planType = (plan && plan.type) || 'pro';
        const planNotes = {
          pro: [
            'Advanced calendar filtering',
            'Custom sync intervals',
            'Priority support access'
          ],
          ultimate: [
            'Real-time collaboration',
            'Advanced analytics dashboard',
            'API access for developers',
            'Multi-workspace management'
          ]
        };
        const extras = planNotes[planType];
        if (extras && extras.length) {
          parts.push(`Plan highlights (${planType}):\n- ` + extras.join('\n- '));
        }
      } catch (_) {
        // Ignore plan note errors
      }

      return parts.join('\n\n');
    } catch (e) {
      return 'New improvements and fixes.';
    }
  }

  setupAutoUpdater() {
    // Optional single update channel override via environment
    try {
      const owner = process.env.UPDATE_REPO_OWNER;
      const repo = process.env.UPDATE_REPO_NAME;
      const channel = process.env.UPDATE_CHANNEL || 'latest';
      if (owner && repo) {
        autoUpdater.setFeedURL({ provider: 'github', owner, repo, channel });
      }
    } catch (e) {
      console.warn('Feed URL override not applied:', e && e.message ? e.message : e);
    }

    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;

    autoUpdater.on('update-available', (info) => {
      const skip = settings.get('update-skip-version');
      if (skip && skip === info.version) {
        return; // user chose to skip this version
      }
      this.mainWindow.webContents.send('update-available', info);

      const pref = settings.get('update-preference');
      if (pref === 'auto') {
        autoUpdater.autoDownload = true;
        autoUpdater.downloadUpdate();
      } else if (pref === 'prompt') {
        this.showUpdatePrompt(info);
      } else {
        // manual: do nothing until user clicks
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.mainWindow.webContents.send('update-downloaded', info);
      this.showUpdateReadyDialog(info);
    });

    autoUpdater.on('error', (err) => {
      this.mainWindow.webContents.send('update-error', err);
      console.error('Update error:', err);
    });

    autoUpdater.on('download-progress', (progress) => {
      this.mainWindow.webContents.send('download-progress', progress);
    });

    // ✅ FIXED: Only check for updates when BOTH calendars are connected
    // Initial check deferred until both services are connected (checked via periodic poll)
    console.log('[AutoUpdater] ✅ Initialized - will only check when both calendars connected');

    // Periodic checks every 24h, but ONLY if both calendars are connected
    // Use a setImmediate wrapper to ensure it runs on next event loop iteration
    this.checkTimer = setInterval(() => {
      setImmediate(() => this.checkForUpdatesIfConnected());
    }, 24 * 60 * 60 * 1000);
  }

  // ✅ NEW: Check if both calendars are connected before updating
  areBothCalendarsConnected() {
    try {
      const { syncManager } = require('./syncManager');
      if (!syncManager) return false;
      
      // Check if we have sync pairs (means both are connected and selected)
      const hasSyncPairs = syncManager.syncPairs && syncManager.syncPairs.length > 0;
      console.log('[AutoUpdater] Connection check: syncPairs =', hasSyncPairs ? 'YES' : 'NO');
      return hasSyncPairs;
    } catch (e) {
      console.log('[AutoUpdater] Could not check connection status:', e && e.message);
      return false;
    }
  }

  initialCheck() {
    const pref = settings.get('update-preference');
    if (pref === 'manual') return;

    // respect reminder schedule
    const remindAt = Number(settings.get('update-remind-at') || 0);
    if (Date.now() < remindAt) return;

    this.checkForUpdates();
  }

  // ✅ NEW: Only check for updates if both calendars are connected
  async checkForUpdatesIfConnected() {
    if (!this.areBothCalendarsConnected()) {
      console.log('[AutoUpdater] ⏭️  Skipping update check - both calendars not connected');
      return;
    }
    
    await this.checkForUpdates();
  }

  async checkForUpdates() {
    const pref = settings.get('update-preference');
    try {
      // PERFORMANCE: Add timeout to prevent hanging checks
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Update check timeout')), 10000)
      );
      
      if (pref === 'auto') {
        autoUpdater.autoDownload = true;
        await Promise.race([autoUpdater.checkForUpdates(), timeoutPromise]);
      } else if (pref === 'prompt') {
        autoUpdater.autoDownload = false;
        const result = await Promise.race([autoUpdater.checkForUpdates(), timeoutPromise]);
        // electron-updater returns UpdateCheckResult
        if (result && result.updateInfo && result.updateInfo.version) {
          const current = (require('electron').app.getVersion());
          const remoteV = result.updateInfo.version;
          if (remoteV !== current) {
            this.showUpdatePrompt(result.updateInfo);
          }
        }
      } else {
        // manual: only check when explicitly asked via IPC
      }
    } catch (e) {
      // Silently ignore timeout and other errors to avoid disrupting user experience
      if (e && e.message && e.message.includes('timeout')) {
        console.log('[Update Check] Timeout - skipping this check');
      } else {
        console.error('[Update Check] Error:', e && e.message ? e.message : e);
      }
    }
  }

  scheduleReminder(ms) {
    const when = Date.now() + Math.max(60 * 1000, Number(ms));
    settings.set('update-remind-at', when);
  }

  downloadUpdate() {
    autoUpdater.downloadUpdate();
  }

  showUpdatePrompt(info) {
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Available 🚀',
      message: `${require('electron').app.getName()} v${info.version} is available!`,
      detail: this.getUpdateSummary(info.version),
      buttons: ['Download Now', 'Remind Me Tomorrow', 'Skip This Version'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        this.downloadUpdate();
      } else if (result.response === 1) {
        this.scheduleReminder(24 * 60 * 60 * 1000);
      } else if (result.response === 2) {
        settings.set('update-skip-version', info.version);
      }
    });
  }

  showUpdateReadyDialog(info) {
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `${require('electron').app.getName()} v${info.version} is ready to install.`,
      detail: 'The update will be applied after you restart the application.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1}
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  }

  registerIpc() {
    ipcMain.handle('check-for-updates', async () => {
      await this.checkForUpdates();
      return { ok: true };
    });
    ipcMain.handle('set-update-preference', (e, pref) => {
      if (['prompt', 'auto', 'manual'].includes(pref)) {
        settings.set('update-preference', pref);
        return { ok: true };
      }
      return { ok: false };
    });
    ipcMain.handle('get-update-preference', () => {
      return settings.get('update-preference');
    });
  }
}

module.exports = AutoUpdater;