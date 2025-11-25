# User Settings - Quick Reference Card

## 🎯 Quick Start

### Backend Usage
```javascript
const userSettings = require('./userSettings');

// Check settings
if (userSettings.shouldSyncAllCalendars()) {
  // Sync all calendars
}

if (userSettings.isBackgroundSyncEnabled()) {
  // Start background sync
}

// Update settings
userSettings.setSyncAllCalendars(true);
userSettings.setBackgroundSync(false);
```

### Frontend Usage
```javascript
// Get settings
const { settings } = await window.electron.invoke('get-user-settings');

// Update setting
await window.electron.invoke('set-user-setting', 'sync_all_calendars', true);

// Update multiple
await window.electron.invoke('update-user-settings', {
  sync_all_calendars: true,
  background_sync_enabled: false
});
```

---

## 📋 Settings Reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `sync_all_calendars` | boolean | `false` | When true, sync all calendars; when false, sync only selected |
| `background_sync_enabled` | boolean | `true` | When true, background sync is active; when false, sync only on demand |

---

## 🔌 API Methods

### Backend Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `get(key)` | `key: string` | `any` | Get a setting value |
| `set(key, value)` | `key: string, value: any` | `void` | Set a setting value |
| `getAll()` | - | `object` | Get all settings |
| `updateMultiple(settings)` | `settings: object` | `void` | Update multiple settings |
| `resetToDefaults()` | - | `void` | Reset all to defaults |
| `shouldSyncAllCalendars()` | - | `boolean` | Check sync all calendars |
| `isBackgroundSyncEnabled()` | - | `boolean` | Check background sync |
| `setSyncAllCalendars(enabled)` | `enabled: boolean` | `void` | Set sync all calendars |
| `setBackgroundSync(enabled)` | `enabled: boolean` | `void` | Set background sync |

### IPC Handlers

| Handler | Parameters | Returns |
|---------|------------|---------|
| `get-user-settings` | - | `{ success: boolean, settings: object }` |
| `get-user-setting` | `key: string` | `{ success: boolean, value: any }` |
| `set-user-setting` | `key: string, value: any` | `{ success: boolean }` |
| `update-user-settings` | `settings: object` | `{ success: boolean }` |
| `reset-user-settings` | - | `{ success: boolean }` |

---

## 📁 File Locations

### Code Files
- `src/userSettings.js` - Core module
- `src/main.js` (lines 754-810) - IPC handlers

### Documentation
- `IMPLEMENTATION_SUMMARY.md` - Complete summary
- `USER_SETTINGS_MIGRATION.md` - Detailed migration guide
- `SQL_EQUIVALENT.md` - SQL reference
- `userSettingsExample.js` - Code examples
- `QUICK_REFERENCE.md` - This file

### Storage
- Windows: `%APPDATA%\synk-pro\user-settings.json`
- macOS: `~/Library/Application Support/synk-pro/user-settings.json`
- Linux: `~/.config/synk-pro/user-settings.json`

---

## 🧪 Testing

```bash
# Run test script
node test-user-settings.js

# Expected output: All tests pass ✅
```

---

## 🔄 Common Patterns

### Pattern 1: Check Before Sync
```javascript
const userSettings = require('./userSettings');

async function performSync(selectedCalendarId) {
  let calendarsToSync;
  
  if (userSettings.shouldSyncAllCalendars()) {
    calendarsToSync = await fetchAllCalendars();
  } else {
    calendarsToSync = [selectedCalendarId];
  }
  
  // Sync calendars...
}
```

### Pattern 2: Conditional Background Sync
```javascript
function initSync() {
  if (userSettings.isBackgroundSyncEnabled()) {
    setInterval(() => performSync(), 300000); // 5 min
  } else {
    console.log('Background sync disabled');
  }
}
```

### Pattern 3: Settings UI
```javascript
// Load settings into UI
async function loadSettings() {
  const { settings } = await window.electron.invoke('get-user-settings');
  
  document.getElementById('syncAll').checked = settings.sync_all_calendars;
  document.getElementById('bgSync').checked = settings.background_sync_enabled;
}

// Save settings from UI
async function saveSettings() {
  await window.electron.invoke('update-user-settings', {
    sync_all_calendars: document.getElementById('syncAll').checked,
    background_sync_enabled: document.getElementById('bgSync').checked
  });
}
```

---

## ⚡ Quick Commands

```javascript
// Backend
const userSettings = require('./userSettings');

userSettings.get('sync_all_calendars')              // Get value
userSettings.set('sync_all_calendars', true)        // Set value
userSettings.shouldSyncAllCalendars()               // Check sync all
userSettings.isBackgroundSyncEnabled()              // Check bg sync
userSettings.getAll()                               // Get all
userSettings.resetToDefaults()                      // Reset

// Frontend
await window.electron.invoke('get-user-settings')                           // Get all
await window.electron.invoke('get-user-setting', 'sync_all_calendars')    // Get one
await window.electron.invoke('set-user-setting', 'sync_all_calendars', true) // Set one
await window.electron.invoke('update-user-settings', {...})                // Update many
await window.electron.invoke('reset-user-settings')                        // Reset
```

---

## 🐛 Troubleshooting

### Settings not persisting?
- Check file permissions in app data directory
- Verify electron-store is installed: `npm list electron-store`

### Can't access from frontend?
- Ensure IPC handlers are registered in main.js
- Check preload script exposes `window.electron.invoke`

### Wrong default values?
- Run: `userSettings.resetToDefaults()`
- Or delete: `user-settings.json` file

### Need to debug?
- All operations are logged to console
- Check: `✓ User setting updated: key = value`

---

## 📚 Full Documentation

For complete details, see:
- **IMPLEMENTATION_SUMMARY.md** - Overview and summary
- **USER_SETTINGS_MIGRATION.md** - Detailed migration guide
- **SQL_EQUIVALENT.md** - SQL migration scripts
- **userSettingsExample.js** - Code examples

---

**Last Updated:** 2024  
**Version:** 1.0.0  
**Status:** ✅ Complete and Tested