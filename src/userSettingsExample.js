/**
 * User Settings Usage Examples
 * 
 * This file demonstrates how to use the new user settings system
 * from both the backend (main process) and frontend (renderer process)
 */

// ============================================
// BACKEND USAGE (in main.js or other Node.js files)
// ============================================

const userSettings = require('./userSettings');

// Example 1: Get all settings
function getAllSettings() {
  const settings = userSettings.getAll();
  console.log('All settings:', settings);
  // Output: { sync_all_calendars: false, background_sync_enabled: true }
}

// Example 2: Get a specific setting
function checkSyncAllCalendars() {
  const syncAll = userSettings.get('sync_all_calendars');
  console.log('Sync all calendars:', syncAll);
  // Output: false (default)
}

// Example 3: Set a specific setting
function enableSyncAllCalendars() {
  userSettings.set('sync_all_calendars', true);
  console.log('Sync all calendars enabled');
}

// Example 4: Use helper methods
function useHelperMethods() {
  // Check if should sync all calendars
  if (userSettings.shouldSyncAllCalendars()) {
    console.log('Syncing all calendars');
  } else {
    console.log('Syncing only selected calendars');
  }

  // Check if background sync is enabled
  if (userSettings.isBackgroundSyncEnabled()) {
    console.log('Background sync is active');
  }

  // Toggle settings
  userSettings.setSyncAllCalendars(true);
  userSettings.setBackgroundSync(false);
}

// Example 5: Update multiple settings at once
function updateMultipleSettings() {
  userSettings.updateMultiple({
    sync_all_calendars: true,
    background_sync_enabled: false
  });
}

// Example 6: Reset to defaults
function resetSettings() {
  userSettings.resetToDefaults();
  console.log('Settings reset to defaults');
}

// ============================================
// FRONTEND USAGE (in index.html or renderer.js)
// ============================================

/*
// Example 1: Get all settings
async function loadUserSettings() {
  const result = await window.electron.invoke('get-user-settings');
  if (result.success) {
    console.log('User settings:', result.settings);
    // Update UI based on settings
    document.getElementById('syncAllCheckbox').checked = result.settings.sync_all_calendars;
    document.getElementById('backgroundSyncCheckbox').checked = result.settings.background_sync_enabled;
  }
}

// Example 2: Get a specific setting
async function getSyncAllCalendarsSetting() {
  const result = await window.electron.invoke('get-user-setting', 'sync_all_calendars');
  if (result.success) {
    console.log('Sync all calendars:', result.value);
    return result.value;
  }
}

// Example 3: Set a specific setting
async function toggleSyncAllCalendars(enabled) {
  const result = await window.electron.invoke('set-user-setting', 'sync_all_calendars', enabled);
  if (result.success) {
    console.log('Setting updated successfully');
  } else {
    console.error('Failed to update setting:', result.error);
  }
}

// Example 4: Update multiple settings
async function saveUserPreferences(formData) {
  const settings = {
    sync_all_calendars: formData.syncAll,
    background_sync_enabled: formData.backgroundSync
  };
  
  const result = await window.electron.invoke('update-user-settings', settings);
  if (result.success) {
    console.log('Preferences saved');
  }
}

// Example 5: Reset settings
async function resetToDefaults() {
  const result = await window.electron.invoke('reset-user-settings');
  if (result.success) {
    console.log('Settings reset to defaults');
    // Reload settings in UI
    await loadUserSettings();
  }
}

// Example 6: Settings form handler
document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const syncAll = document.getElementById('syncAllCheckbox').checked;
  const backgroundSync = document.getElementById('backgroundSyncCheckbox').checked;
  
  await window.electron.invoke('update-user-settings', {
    sync_all_calendars: syncAll,
    background_sync_enabled: backgroundSync
  });
  
  alert('Settings saved!');
});
*/

// ============================================
// INTEGRATION WITH SYNC LOGIC
// ============================================

/*
// In syncManager.js or wherever you handle calendar filtering:

const userSettings = require('./userSettings');

async function getCalendarsToSync(selectedCalendarId) {
  // Check if user wants to sync all calendars
  if (userSettings.shouldSyncAllCalendars()) {
    // Fetch and return all calendars
    const allCalendars = await fetchAllGoogleCalendars();
    return allCalendars;
  } else {
    // Return only the selected calendar
    return [selectedCalendarId];
  }
}

// In background sync logic:
function startBackgroundSync() {
  if (userSettings.isBackgroundSyncEnabled()) {
    // Start the background sync interval
    setInterval(() => {
      performSync();
    }, 300000); // 5 minutes
  } else {
    console.log('Background sync is disabled by user');
  }
}
*/

module.exports = {
  getAllSettings,
  checkSyncAllCalendars,
  enableSyncAllCalendars,
  useHelperMethods,
  updateMultipleSettings,
  resetSettings
};