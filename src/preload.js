const { contextBridge, ipcRenderer } = require('electron');
// Avoid Node built-ins here; preload can run in a sandboxed bundle in production.
// BACKEND_URL is provided by main via process.env or additionalArguments.

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // OAuth connections (FIXED version)
  startGoogleOAuth: () => ipcRenderer.invoke('start-google-oauth'),
  startNotionOAuth: (options) => ipcRenderer.invoke('start-notion-oauth', options),
  checkExistingTokens: () => ipcRenderer.invoke('check-existing-tokens'),

  // Data fetching
  listGoogleCalendars: () => ipcRenderer.invoke('list-google-calendars'),
  listDatabases: () => ipcRenderer.invoke('list-databases'),
  listNotionDatabases: () => ipcRenderer.invoke('list-notion-databases'),
  getGoogleUserInfo: () => ipcRenderer.invoke('get-google-user-info'),
  getCalendarEvents: (calendarId) => ipcRenderer.invoke('get-calendar-events', calendarId),
  getDatabasePages: (databaseId) => ipcRenderer.invoke('get-database-pages', databaseId),

  // Settings
  clearAllData: () => ipcRenderer.invoke('clear-all-data'),
  getUserSetting: (key) => ipcRenderer.invoke('get-user-setting', key),
  saveUserSetting: (key, value) => ipcRenderer.invoke('save-user-setting', key, value),

  setBackgroundSync: (enabled) => ipcRenderer.invoke('set-background-sync', enabled),


  // Sync management
  startSync: (syncPairs) => ipcRenderer.invoke('start-sync', syncPairs),
  stopSync: () => ipcRenderer.invoke('stop-sync'),
  restoreSyncPairs: () => ipcRenderer.invoke('restore-sync-pairs'),
  forceSync: () => ipcRenderer.invoke('force-sync'),
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
  getSyncStats: async () => {
    const res = await ipcRenderer.invoke('get-sync-stats');
    return res && (res.stats || res);
  },
  setAppVisibility: (isVisible) => ipcRenderer.invoke('set-app-visibility', isVisible),
  
  // Smart Sync - Adaptive Polling
  notifySyncManagerFocus: (isFocused) => ipcRenderer.invoke('notify-sync-manager-focus', isFocused),

  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Expose server env to renderer (prefer process.env, fallback to argv)
  backendUrl: process.env.BACKEND_URL || (Array.isArray(process.argv) ? (process.argv.find(a => a.startsWith('BACKEND_URL=')) || '').split('=')[1] : undefined),

  // Plan management
  // Normalize return values so renderer receives plan object directly
  getUserPlan: async () => {
    const res = await ipcRenderer.invoke('get-user-plan');
    return res && res.plan ? res.plan : null;
  },
  setUserPlan: (planData) => ipcRenderer.invoke('set-user-plan', planData),
  startTrial: async () => {
    const res = await ipcRenderer.invoke('start-trial');
    return { success: !!(res && res.success), plan: res && (res.result || res.plan) };
  },
  checkFeatureAccess: (feature) => ipcRenderer.invoke('check-feature-access', feature),
  getPlanLimits: () => ipcRenderer.invoke('get-plan-limits'),
  refreshPlanFromBackend: ({ userId }) => ipcRenderer.invoke('refresh-plan-from-backend', { userId }),
  startPlanAutoRefresh: ({ userId, intervalMs }) => ipcRenderer.invoke('start-plan-auto-refresh', { userId, intervalMs }),
  stopPlanAutoRefresh: () => ipcRenderer.invoke('stop-plan-auto-refresh'),

  // Billing & Subscription
  openCustomerPortal: () => ipcRenderer.invoke('open-customer-portal'),
  openPricingPage: () => ipcRenderer.invoke('open-pricing-page'),

  // Auto-update disabled in BETA build
  checkForUpdates: async () => ({ ok: false, disabled: true }),
  setUpdatePreference: async () => ({ ok: false, disabled: true }),
  getUpdatePreference: async () => 'disabled',
  onUpdateAvailable: () => {},
  onUpdateDownloaded: () => {},
  onDownloadProgress: () => {},

  // Event listeners for OAuth
  onOAuthSuccess: (callback) => ipcRenderer.on('oauth-success', callback),
  onOAuthFailed: (callback) => ipcRenderer.on('oauth-failed', callback),
  onGoogleCalendars: (callback) => ipcRenderer.on('google:calendars', callback),
  onConnectionsCleared: (callback) => ipcRenderer.on('connections-cleared', callback),
  onConnectionError: (callback) => ipcRenderer.on('connection-error', callback),
  
  // Generic IPC event listener for google-oauth-success
  on: (channel, callback) => ipcRenderer.on(channel, callback),

  // Environment detection
  // Production mode only - no demo mode check needed

  // Logging (for debugging)
  log: (message) => console.log('[Renderer]', message)
});