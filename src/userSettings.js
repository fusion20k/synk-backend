const Store = require('electron-store');

/**
 * User Settings Manager
 * Manages user preferences and settings using electron-store
 */
class UserSettings {
  constructor() {
    this.store = new Store({
      name: 'user-settings',
      defaults: {
        // Calendar sync settings
        sync_all_calendars: false,  // Default: only sync selected calendars
        background_sync_enabled: true,  // Default: background sync is enabled
        
        // Future settings can be added here
        // sync_interval: 300000, // 5 minutes in ms
        // notification_enabled: true,
        // etc.
      }
    });
  }

  /**
   * Get a specific setting value
   * @param {string} key - The setting key
   * @returns {any} The setting value
   */
  get(key) {
    return this.store.get(key);
  }

  /**
   * Set a specific setting value
   * @param {string} key - The setting key
   * @param {any} value - The value to set
   */
  set(key, value) {
    this.store.set(key, value);
    console.log(`✓ User setting updated: ${key} = ${value}`);
  }

  /**
   * Get all user settings
   * @returns {object} All settings
   */
  getAll() {
    return this.store.store;
  }

  /**
   * Update multiple settings at once
   * @param {object} settings - Object with key-value pairs to update
   */
  updateMultiple(settings) {
    Object.entries(settings).forEach(([key, value]) => {
      this.store.set(key, value);
    });
    console.log('✓ Multiple user settings updated:', Object.keys(settings).join(', '));
  }

  /**
   * Reset all settings to defaults
   */
  resetToDefaults() {
    this.store.clear();
    console.log('✓ User settings reset to defaults');
  }

  /**
   * Check if sync all calendars is enabled
   * @returns {boolean}
   */
  shouldSyncAllCalendars() {
    return this.get('sync_all_calendars') === true;
  }

  /**
   * Check if background sync is enabled
   * @returns {boolean}
   */
  isBackgroundSyncEnabled() {
    return this.get('background_sync_enabled') === true;
  }

  /**
   * Enable/disable sync all calendars
   * @param {boolean} enabled
   */
  setSyncAllCalendars(enabled) {
    this.set('sync_all_calendars', enabled);
  }

  /**
   * Enable/disable background sync
   * @param {boolean} enabled
   */
  setBackgroundSync(enabled) {
    this.set('background_sync_enabled', enabled);
  }
}

module.exports = new UserSettings();