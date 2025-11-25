# User Settings Migration Guide

## Overview

This document describes the new user settings system added to the Synk application. Two new boolean columns have been added to the user settings storage:

1. **`sync_all_calendars`** - Controls whether to sync all calendars or only selected ones (default: `false`)
2. **`background_sync_enabled`** - Controls whether background sync is active (default: `true`)

## Database Structure

Since this application uses **electron-store** (not a traditional SQL database), the settings are stored as a JSON file in the user's application data directory.

### Storage Location

- **Windows**: `%APPDATA%\synk-pro\user-settings.json`
- **macOS**: `~/Library/Application Support/synk-pro/user-settings.json`
- **Linux**: `~/.config/synk-pro/user-settings.json`

### Default Schema

```json
{
  "sync_all_calendars": false,
  "background_sync_enabled": true
}
```

## Implementation Details

### 1. New Module: `userSettings.js`

A new module has been created at `src/userSettings.js` that provides:

- **Storage**: Uses electron-store with default values
- **Type Safety**: Boolean validation for the two settings
- **Helper Methods**: Convenience methods for common operations
- **Logging**: All changes are logged for debugging

### 2. IPC Handlers in `main.js`

Five new IPC handlers have been added:

| Handler | Purpose | Parameters | Returns |
|---------|---------|------------|---------|
| `get-user-settings` | Get all settings | None | `{ success: boolean, settings: object }` |
| `get-user-setting` | Get one setting | `key: string` | `{ success: boolean, value: any }` |
| `set-user-setting` | Set one setting | `key: string, value: any` | `{ success: boolean }` |
| `update-user-settings` | Update multiple | `settings: object` | `{ success: boolean }` |
| `reset-user-settings` | Reset to defaults | None | `{ success: boolean }` |

## Usage Examples

### Backend (Main Process)

```javascript
const userSettings = require('./userSettings');

// Get all settings
const settings = userSettings.getAll();
console.log(settings); // { sync_all_calendars: false, background_sync_enabled: true }

// Get specific setting
const syncAll = userSettings.get('sync_all_calendars');

// Set specific setting
userSettings.set('sync_all_calendars', true);

// Use helper methods
if (userSettings.shouldSyncAllCalendars()) {
  // Sync all calendars
}

if (userSettings.isBackgroundSyncEnabled()) {
  // Start background sync
}

// Update multiple settings
userSettings.updateMultiple({
  sync_all_calendars: true,
  background_sync_enabled: false
});

// Reset to defaults
userSettings.resetToDefaults();
```

### Frontend (Renderer Process)

```javascript
// Get all settings
const result = await window.electron.invoke('get-user-settings');
if (result.success) {
  console.log(result.settings);
}

// Get specific setting
const result = await window.electron.invoke('get-user-setting', 'sync_all_calendars');
if (result.success) {
  console.log(result.value); // true or false
}

// Set specific setting
await window.electron.invoke('set-user-setting', 'sync_all_calendars', true);

// Update multiple settings
await window.electron.invoke('update-user-settings', {
  sync_all_calendars: true,
  background_sync_enabled: false
});

// Reset to defaults
await window.electron.invoke('reset-user-settings');
```

## Integration with Existing Features

### Calendar Filtering (syncManager.js)

```javascript
const userSettings = require('./userSettings');

async function getCalendarsToSync(selectedCalendarId) {
  if (userSettings.shouldSyncAllCalendars()) {
    // Fetch all calendars from Google
    const allCalendars = await googleCalendar.listCalendars();
    return allCalendars.map(cal => cal.id);
  } else {
    // Use only the selected calendar
    return [selectedCalendarId];
  }
}
```

### Background Sync

```javascript
const userSettings = require('./userSettings');

function initializeBackgroundSync() {
  if (userSettings.isBackgroundSyncEnabled()) {
    setInterval(() => {
      performSync();
    }, 300000); // 5 minutes
  } else {
    console.log('Background sync disabled by user');
  }
}
```

## Migration Steps

### For Existing Users

1. **No action required** - The settings will be created with default values on first access
2. **Existing behavior preserved** - Default values maintain current functionality:
   - `sync_all_calendars: false` - Only selected calendars sync (current behavior)
   - `background_sync_enabled: true` - Background sync active (current behavior)

### For New Features

1. **Add UI controls** in the Settings tab to toggle these options
2. **Update sync logic** to check `shouldSyncAllCalendars()` before filtering
3. **Update background sync** to check `isBackgroundSyncEnabled()` before starting

## Testing

### Manual Testing

1. **Test default values**:
   ```javascript
   const settings = await window.electron.invoke('get-user-settings');
   console.log(settings); // Should show defaults
   ```

2. **Test setting updates**:
   ```javascript
   await window.electron.invoke('set-user-setting', 'sync_all_calendars', true);
   const result = await window.electron.invoke('get-user-setting', 'sync_all_calendars');
   console.log(result.value); // Should be true
   ```

3. **Test reset**:
   ```javascript
   await window.electron.invoke('reset-user-settings');
   const settings = await window.electron.invoke('get-user-settings');
   console.log(settings); // Should show defaults again
   ```

### Automated Testing

```javascript
// Test file: userSettings.test.js
const userSettings = require('./userSettings');

describe('User Settings', () => {
  beforeEach(() => {
    userSettings.resetToDefaults();
  });

  test('should have correct defaults', () => {
    expect(userSettings.get('sync_all_calendars')).toBe(false);
    expect(userSettings.get('background_sync_enabled')).toBe(true);
  });

  test('should update settings', () => {
    userSettings.set('sync_all_calendars', true);
    expect(userSettings.shouldSyncAllCalendars()).toBe(true);
  });

  test('should update multiple settings', () => {
    userSettings.updateMultiple({
      sync_all_calendars: true,
      background_sync_enabled: false
    });
    expect(userSettings.get('sync_all_calendars')).toBe(true);
    expect(userSettings.get('background_sync_enabled')).toBe(false);
  });
});
```

## Future Enhancements

The settings system is designed to be extensible. Future settings can be easily added:

```javascript
// In userSettings.js defaults:
defaults: {
  sync_all_calendars: false,
  background_sync_enabled: true,
  
  // Future settings:
  sync_interval: 300000, // 5 minutes in ms
  notification_enabled: true,
  auto_update_enabled: true,
  theme: 'dark',
  // etc.
}
```

## Rollback Plan

If issues arise, the settings can be reset:

1. **Via code**: Call `userSettings.resetToDefaults()`
2. **Via IPC**: `await window.electron.invoke('reset-user-settings')`
3. **Manually**: Delete the `user-settings.json` file from the app data directory

## Files Modified

1. ✅ **Created**: `src/userSettings.js` - Settings management module
2. ✅ **Modified**: `src/main.js` - Added IPC handlers (lines 754-810)
3. ✅ **Created**: `src/userSettingsExample.js` - Usage examples
4. ✅ **Created**: `USER_SETTINGS_MIGRATION.md` - This documentation

## Summary

✅ **Two new boolean columns added**:
- `sync_all_calendars` (default: `false`)
- `background_sync_enabled` (default: `true`)

✅ **Storage mechanism**: electron-store (JSON file in app data directory)

✅ **Backend API**: Complete module with helper methods

✅ **Frontend API**: Five IPC handlers for all operations

✅ **Backward compatible**: Existing users get defaults automatically

✅ **Extensible**: Easy to add more settings in the future

✅ **Well documented**: Examples and integration guides provided