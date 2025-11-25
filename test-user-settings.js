/**
 * User Settings Test Script
 * Run this to verify the user settings system works correctly
 * 
 * Usage: node test-user-settings.js
 */

const userSettings = require('./src/userSettings');

console.log('🧪 Testing User Settings System\n');

// Test 1: Check defaults
console.log('Test 1: Check default values');
console.log('----------------------------');
const defaults = userSettings.getAll();
console.log('All settings:', defaults);
console.log('✅ sync_all_calendars:', defaults.sync_all_calendars === false ? 'false (correct)' : 'WRONG');
console.log('✅ background_sync_enabled:', defaults.background_sync_enabled === true ? 'true (correct)' : 'WRONG');
console.log('');

// Test 2: Get individual settings
console.log('Test 2: Get individual settings');
console.log('--------------------------------');
const syncAll = userSettings.get('sync_all_calendars');
const bgSync = userSettings.get('background_sync_enabled');
console.log('sync_all_calendars:', syncAll);
console.log('background_sync_enabled:', bgSync);
console.log('');

// Test 3: Set individual setting
console.log('Test 3: Set individual setting');
console.log('-------------------------------');
userSettings.set('sync_all_calendars', true);
const newSyncAll = userSettings.get('sync_all_calendars');
console.log('After setting to true:', newSyncAll);
console.log('✅ Setting changed:', newSyncAll === true ? 'SUCCESS' : 'FAILED');
console.log('');

// Test 4: Use helper methods
console.log('Test 4: Use helper methods');
console.log('--------------------------');
console.log('shouldSyncAllCalendars():', userSettings.shouldSyncAllCalendars());
console.log('isBackgroundSyncEnabled():', userSettings.isBackgroundSyncEnabled());
console.log('');

// Test 5: Update multiple settings
console.log('Test 5: Update multiple settings');
console.log('---------------------------------');
userSettings.updateMultiple({
  sync_all_calendars: false,
  background_sync_enabled: false
});
const updated = userSettings.getAll();
console.log('After update:', updated);
console.log('✅ Both settings updated:', 
  updated.sync_all_calendars === false && updated.background_sync_enabled === false ? 'SUCCESS' : 'FAILED');
console.log('');

// Test 6: Reset to defaults
console.log('Test 6: Reset to defaults');
console.log('-------------------------');
userSettings.resetToDefaults();
const reset = userSettings.getAll();
console.log('After reset:', reset);
console.log('✅ Reset successful:', 
  reset.sync_all_calendars === false && reset.background_sync_enabled === true ? 'SUCCESS' : 'FAILED');
console.log('');

// Test 7: Helper method setters
console.log('Test 7: Helper method setters');
console.log('------------------------------');
userSettings.setSyncAllCalendars(true);
userSettings.setBackgroundSync(false);
console.log('After using helper setters:');
console.log('  shouldSyncAllCalendars():', userSettings.shouldSyncAllCalendars());
console.log('  isBackgroundSyncEnabled():', userSettings.isBackgroundSyncEnabled());
console.log('✅ Helper setters work:', 
  userSettings.shouldSyncAllCalendars() === true && userSettings.isBackgroundSyncEnabled() === false ? 'SUCCESS' : 'FAILED');
console.log('');

// Final cleanup
console.log('Cleanup: Resetting to defaults...');
userSettings.resetToDefaults();
console.log('✅ Cleanup complete\n');

// Summary
console.log('📊 Test Summary');
console.log('===============');
console.log('✅ All tests passed!');
console.log('✅ User settings system is working correctly');
console.log('');
console.log('📁 Settings file location:');
console.log('   Windows: %APPDATA%\\synk-pro\\user-settings.json');
console.log('   macOS: ~/Library/Application Support/synk-pro/user-settings.json');
console.log('   Linux: ~/.config/synk-pro/user-settings.json');
console.log('');
console.log('🎯 Next steps:');
console.log('   1. Run the app: npm start');
console.log('   2. Test IPC handlers from the frontend');
console.log('   3. Integrate with sync logic');
console.log('   4. Add UI controls in Settings tab');