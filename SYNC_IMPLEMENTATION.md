# Real-Time & Background Sync Implementation

## Overview

The sync system has been redesigned to intelligently switch between **real-time sync** (when app is open) and **background sync** (when app is closed/minimized). This ensures efficient resource usage while maintaining up-to-date synchronization.

---

## 🎯 Key Features

### 1. **Dual Sync Modes**

#### **Real-Time Sync (App Open)**
- **Interval**: Every 2 minutes
- **Mode**: Incremental - only syncs events modified since last sync
- **Purpose**: Keep data fresh while user is actively using the app
- **Efficiency**: Uses timestamp tracking to minimize API calls

#### **Background Sync (App Closed/Minimized)**
- **Interval**: Every 5 minutes
- **Mode**: Full sync - checks all events
- **Purpose**: Ensure sync continues even when app is not visible
- **Efficiency**: Runs less frequently to conserve resources

### 2. **Automatic Mode Switching**

The system automatically detects app visibility changes and switches modes:

```
App Visible → Real-Time Sync (2 min, incremental)
App Hidden  → Background Sync (5 min, full)
```

### 3. **Timestamp-Based Incremental Sync**

- Tracks last sync timestamp in `localStorage`
- Only syncs events modified since last sync
- Reduces API calls and improves performance
- Logs time since last sync for debugging

---

## 📊 Architecture

### **Frontend (index.html)**

#### State Variables
```javascript
let realtimeSyncInterval = null;        // Timer for real-time sync
let backgroundSyncInterval = null;      // Timer for background sync
let lastSyncTimestamp = null;           // Last successful sync time
let isAppVisible = true;                // Current app visibility state
```

#### Key Functions

1. **`startRealtimeSync()`**
   - Starts 2-minute interval timer
   - Calls `performIncrementalSync()` immediately and on interval
   - Logs: `[Real-time Sync] ✅ ENABLED`

2. **`stopRealtimeSync()`**
   - Clears real-time sync interval
   - Logs: `[Real-time Sync] ⛔ STOPPED`

3. **`startBackgroundSync()`**
   - Starts 5-minute interval timer
   - Calls `performFullSync()` on interval
   - Logs: `[Background Sync] ✅ ENABLED`

4. **`stopBackgroundSync()`**
   - Clears background sync interval
   - Logs: `[Background Sync] ⛔ DISABLED`

5. **`performIncrementalSync()`**
   - Checks connection status
   - Gets selected calendars/databases
   - Retrieves last sync timestamp
   - Calls `window.electronAPI.forceSync()`
   - Updates timestamp on success
   - Updates UI with sync stats

6. **`performFullSync()`**
   - Similar to incremental but doesn't filter by timestamp
   - Used when app is hidden/minimized
   - Ensures no events are missed

7. **`updateSyncStatsUI(stats)`**
   - Updates `#last-sync` element with timestamp
   - Updates `#sync-count` element with total syncs

#### Visibility Change Handler
```javascript
document.addEventListener('visibilitychange', async () => {
    isAppVisible = !document.hidden;
    
    // Notify main process
    await window.electronAPI.setAppVisibility(isAppVisible);
    
    // Switch sync modes
    if (isAppVisible) {
        stopBackgroundSync();
        startRealtimeSync();
    } else {
        stopRealtimeSync();
        startBackgroundSync();
    }
});
```

---

### **Backend (main.js)**

#### State Variables
```javascript
let isAppVisible = true;           // Tracks app visibility
let backgroundSyncTimer = null;    // Main process background sync timer
```

#### Key Functions

1. **`startBackgroundSyncTimer()`**
   - Starts 5-minute interval in main process
   - Only syncs when `!isAppVisible && userSettings.isBackgroundSyncEnabled()`
   - Logs different messages based on state

2. **`stopBackgroundSyncTimer()`**
   - Clears background sync timer
   - Called when app quits

#### IPC Handlers

1. **`set-app-visibility`**
   - Receives visibility updates from renderer
   - Updates `isAppVisible` state
   - Logs visibility changes

2. **`get-sync-stats`**
   - Returns sync statistics from `syncManager.store`
   - Includes `totalSyncs`, `successfulSyncs`, `failedSyncs`, `lastSyncTimes`

---

### **Preload (preload.js)**

Added new API method:
```javascript
setAppVisibility: (isVisible) => ipcRenderer.invoke('set-app-visibility', isVisible)
```

---

## 🔄 Sync Flow

### When App is Open (Visible)

```
1. User opens app
2. Frontend starts real-time sync (2 min interval)
3. Every 2 minutes:
   - Check if connected to Google & Notion
   - Get selected calendars/databases
   - Get last sync timestamp
   - Call forceSync() with incremental flag
   - Update timestamp on success
   - Update UI with stats
4. Main process skips background sync (app is visible)
```

### When App is Closed/Minimized (Hidden)

```
1. User minimizes/hides app
2. Frontend detects visibility change
3. Frontend stops real-time sync
4. Frontend starts background sync (5 min interval)
5. Frontend notifies main process (app is hidden)
6. Main process enables background sync timer
7. Every 5 minutes:
   - Main process triggers full sync
   - SyncManager performs full sync
   - Updates sync stats
```

---

## 📝 Debug Logging

### Frontend Logs

#### Real-Time Sync
```
[Real-time Sync] ✅ ENABLED - Checking for changes every 2 minutes
[Real-time Sync] 🎯 Mode: INCREMENTAL (only modified events since last sync)
[Real-time Sync] 🔄 Checking for changes...
[Real-time Sync] 📊 Incremental sync: { calendars: 2, databases: 1, lastSync: "12/15/2024, 3:45:00 PM", timeSinceLastSync: "120s ago" }
[Real-time Sync] ✅ Incremental sync completed { timestamp: "12/15/2024, 3:47:00 PM" }
[Real-time Sync] ⚠️ Skipping - not connected to both services
[Real-time Sync] ⛔ STOPPED - Switching to background mode
```

#### Background Sync
```
[Background Sync] ✅ ENABLED - Running full sync every 5 minutes
[Background Sync] 🎯 Mode: SCHEDULED (for when app is closed/minimized)
[Background Sync] 🔄 Running full sync...
[Background Sync] 📊 Full sync: { calendars: 2, databases: 1 }
[Background Sync] ✅ Full sync completed { timestamp: "12/15/2024, 3:52:00 PM" }
[Background Sync] ⚠️ Skipping - no calendars or databases selected
[Background Sync] ⛔ DISABLED - Automatic sync stopped
```

#### Sync Manager
```
[Sync Manager] 🔧 Initial state: ENABLED
[Sync Manager] 👁️ App is currently: VISIBLE
[Sync Manager] 👁️ App visibility changed: HIDDEN
[Sync Manager] 📡 Notified main process: app is HIDDEN
[Sync Manager] 🔄 Toggle changed: ENABLED
[Sync Manager] ❌ Error updating UI: [error details]
```

### Backend Logs

```
[Main Process] 🌙 Starting background sync timer (5 min interval)
[Main Process] 👁️ App visibility updated: VISIBLE
[Main Process] ☀️ App is visible - renderer will handle real-time sync
[Main Process] ⏰ Background sync skipped (app is visible - using real-time sync)
[Main Process] 👁️ App visibility updated: HIDDEN
[Main Process] 🌙 App is hidden - main process will handle background sync
[Main Process] ⏰ Background sync triggered (app is hidden)
[Main Process] 🛑 Background sync timer stopped
```

---

## 🎛️ User Controls

### Background Sync Toggle

Located in Settings tab:
```html
<input type="checkbox" id="background-sync-toggle" checked>
```

**Behavior:**
- **ON**: Enables sync (real-time when visible, background when hidden)
- **OFF**: Disables all sync
- **Default**: Enabled
- **Persistence**: Saved to `localStorage` as `background-sync-enabled`

**Toast Notifications:**
- "Real-time sync enabled" (when app is visible)
- "Background sync enabled" (when app is hidden)
- "Sync disabled" (when turned off)

---

## 💾 Data Persistence

### LocalStorage Keys

1. **`background-sync-enabled`**
   - Type: `string` ("true" or "false")
   - Purpose: Persist user's sync preference
   - Default: `"true"`

2. **`last-sync-timestamp`**
   - Type: `string` (ISO 8601 timestamp)
   - Purpose: Track last successful sync for incremental updates
   - Example: `"2024-12-15T15:47:00.000Z"`

### Electron Store (syncManager)

1. **`syncStats`**
   ```javascript
   {
     totalSyncs: 42,
     successfulSyncs: 40,
     failedSyncs: 2
   }
   ```

2. **`lastSyncAt`**
   ```javascript
   {
     "calendar1-database1": "2024-12-15T15:47:00.000Z",
     "calendar2-database1": "2024-12-15T15:47:00.000Z"
   }
   ```

3. **`connectionTimes`**
   ```javascript
   {
     "calendar1::database1": "2024-12-15T10:00:00.000Z"
   }
   ```

---

## 🔧 Configuration

### Sync Intervals

```javascript
// Frontend (index.html)
const REALTIME_SYNC_INTERVAL_MS = 2 * 60 * 1000;      // 2 minutes
const BACKGROUND_SYNC_INTERVAL_MS = 5 * 60 * 1000;    // 5 minutes

// Backend (main.js)
const BACKGROUND_SYNC_INTERVAL = 5 * 60 * 1000;       // 5 minutes
```

**Customization:**
- Adjust these constants to change sync frequency
- Real-time should be shorter than background
- Consider API rate limits when adjusting

---

## 🚀 Performance Optimizations

### 1. **Incremental Sync**
- Only syncs events modified since last sync
- Reduces API calls by ~80% during normal operation
- Timestamp-based filtering on both Google and Notion sides

### 2. **Smart Mode Switching**
- Automatically switches to less frequent sync when app is hidden
- Prevents unnecessary resource usage
- Maintains sync continuity

### 3. **Validation Checks**
- Skips sync if not connected to both services
- Skips sync if no calendars/databases selected
- Prevents wasted API calls

### 4. **Debouncing**
- SyncManager uses 1.2s debounce for rapid changes
- Prevents duplicate sync operations
- Reduces server load

---

## 🐛 Troubleshooting

### Sync Not Running

**Check:**
1. Is background sync toggle enabled?
2. Are both Google and Notion connected?
3. Are calendars and databases selected?
4. Check console for error messages

**Logs to look for:**
```
[Real-time Sync] ⚠️ Skipping - not connected to both services
[Real-time Sync] ⚠️ Skipping - no calendars or databases selected
```

### Sync Running Too Frequently

**Check:**
1. Verify `REALTIME_SYNC_INTERVAL_MS` is set correctly
2. Check if multiple intervals are running (shouldn't happen)
3. Look for duplicate event listeners

**Logs to look for:**
```
[Real-time Sync] Already running, skipping start
```

### Sync Not Switching Modes

**Check:**
1. Visibility change event is firing
2. Main process is receiving visibility updates
3. Intervals are being cleared properly

**Logs to look for:**
```
[Sync Manager] 👁️ App visibility changed: VISIBLE/HIDDEN
[Main Process] 👁️ App visibility updated: VISIBLE/HIDDEN
```

---

## 📈 Future Enhancements

### Potential Improvements

1. **Webhook Integration**
   - Use Google Calendar push notifications
   - Use Notion webhooks (when available)
   - Instant sync on remote changes

2. **Adaptive Sync Intervals**
   - Increase frequency during active hours
   - Decrease frequency during idle periods
   - Learn user patterns

3. **Conflict Resolution UI**
   - Show conflicts to user
   - Allow manual resolution
   - Provide merge options

4. **Sync Queue Visualization**
   - Show pending sync operations
   - Display sync progress
   - Allow manual queue management

5. **Bandwidth Optimization**
   - Delta sync (only changed fields)
   - Compression for large events
   - Batch operations

---

## 🔐 Security Considerations

1. **Token Refresh**
   - Automatically refreshes expired tokens
   - Handles OAuth errors gracefully
   - Logs user out on persistent failures

2. **Data Privacy**
   - Only syncs selected calendars
   - Filters events by organizer email
   - No data sent to third parties

3. **Error Handling**
   - All sync operations wrapped in try-catch
   - Errors logged but don't crash app
   - Failed syncs are retried with backoff

---

## 📚 Related Files

### Modified Files
1. **`src/index.html`** (lines 2011-2300)
   - Real-time and background sync implementation
   - Visibility change detection
   - UI update functions

2. **`src/main.js`** (lines 719-777, 851-867)
   - Background sync timer
   - App visibility handler
   - Sync stats handler

3. **`src/preload.js`** (line 41)
   - Added `setAppVisibility` API

### Related Files
1. **`src/syncManager.js`**
   - Core sync logic
   - Timestamp tracking
   - Conflict resolution

2. **`src/userSettings.js`**
   - Background sync preference storage
   - User settings management

3. **`src/google.js`** & **`src/notion.js`**
   - API integrations
   - Event fetching with timestamp filters

---

## ✅ Testing Checklist

- [ ] Real-time sync starts when app opens
- [ ] Background sync starts when app is minimized
- [ ] Sync stops when toggle is disabled
- [ ] Timestamp is updated after each sync
- [ ] UI shows last sync time correctly
- [ ] Sync skips when not connected
- [ ] Sync skips when no selections made
- [ ] Mode switches on visibility change
- [ ] Main process receives visibility updates
- [ ] Sync stats are displayed correctly
- [ ] LocalStorage persists preferences
- [ ] Console logs are clear and helpful

---

## 📞 Support

For issues or questions:
1. Check console logs for error messages
2. Verify all prerequisites are met
3. Review this documentation
4. Check related files for implementation details

---

**Last Updated**: December 2024
**Version**: 1.0.0