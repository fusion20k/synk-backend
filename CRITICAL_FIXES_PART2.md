# Critical Fixes - Part 2: IPC Handlers & Polling Logic

## Summary
Fixed **THREE critical issues** preventing the app from functioning:

### Issue 1: Missing IPC Handler - `check-existing-tokens` ❌
**Error**: `Error: No handler registered for 'check-existing-tokens'`

**Root Cause**: 
- The renderer (`index.js`) calls `window.electronAPI.checkExistingTokens()` during startup
- The preload (`preload.js`) exposed this API mapping to IPC channel `'check-existing-tokens'`
- But the main process (`main-production.js`) **never registered a handler** for it
- Result: App couldn't check for existing tokens on startup

**Fix Applied** ✅
Added handler in `main-production.js` (lines 635-657):
```javascript
ipcMain.handle('check-existing-tokens', async () => {
  const TokenStorage = require('./src/token-storage');
  const tokenStorage = new TokenStorage();
  
  if (tokenStorage.hasValidTokens()) {
    const tokens = tokenStorage.getTokens();
    return { success: true, hasTokens: true, tokens };
  }
  return { success: true, hasTokens: false, tokens: null };
});
```

---

### Issue 2: Missing IPC Handler - `set-app-visibility` ❌
**Error**: `Error: Error invoking remote method 'set-app-visibility': Error: No handler registered for 'set-app-visibility'`

**Root Cause**:
- The visibility change listener in `index.js` calls `window.electronAPI.setAppVisibility(isVisible)` to notify main process
- The preload exposes this API
- But main process doesn't have a handler for it
- Result: Visibility notifications fail silently

**Fix Applied** ✅
Added handler in `main-production.js` (lines 659-665):
```javascript
ipcMain.handle('set-app-visibility', async (event, isVisible) => {
  console.log(`[App Visibility] Window visibility: ${isVisible ? 'VISIBLE' : 'HIDDEN'}`);
  return { success: true };
});
```

---

### Issue 3: Wrong Polling Logic ❌
**Problem**: 
- App was switching to 2-minute (then 5-minute) background sync when window was minimized or unfocused
- This is WRONG - minimized/unfocused app should still poll frequently to detect changes
- Only when app is FULLY CLOSED should background sync run (handled by main process)

**Console Evidence**:
```
index.js:2180 📦 Window BACKGROUND - Switching to slow polling (2min)
index.js:2173 ⚡ Window FOCUSED - Switching to fast polling (5s)
```

**What Was Wrong**:
The `visibilitychange` event listener was switching between `startRealtimeSync()` and `startBackgroundSync()`. But `visibilitychange` fires when:
- Window is minimized (still part of app being open!)
- Window loses focus (still part of app being open!)
- User switches to another app (still part of app being open!)

These are NOT the same as the app being CLOSED.

**Fix Applied** ✅

1. **Updated Polling Intervals** (lines 1259-1260):
   - Changed `REALTIME_SYNC_INTERVAL_MS` from 2 minutes → **5 seconds** ✅
   - Clarified that background sync is only for when app is FULLY CLOSED

2. **Fixed Visibility Logic** (lines 1263-1281):
   - Removed the mode-switching logic from visibility change handler
   - Added comments explaining that minimized/unfocused ≠ closed
   - Kept notification to main process for future use
   - **Real-time polling continues at 5 seconds regardless of focus/minimized state**

3. **Updated Function Documentation**:
   - `startRealtimeSync()` now documents it runs while app window EXISTS (lines 1283-1293)
   - `startBackgroundSync()` now clarifies it's for when app is FULLY CLOSED (lines 1315-1325)
   - Updated messages to be clearer about polling intervals

---

## Expected Behavior After Fixes

### When App is OPEN (visible, minimized, or unfocused):
```
[Real-time Sync] ✅ ENABLED - Checking for changes every 5 seconds
[Real-time Sync] ✅ This polling runs while app window is OPEN (even if minimized)
```
- Polls every 5 seconds
- Detects changes quickly
- Syncs when changes found

### When Window Visibility Changes (minimized/unfocused):
```
[Sync Manager] ✅ App visibility changed: HIDDEN
[Sync Manager] ✅ Note: Polling continues at 5s interval while app window exists
```
- Still keeps 5-second polling
- User sees changes within 5 seconds
- No slowdown

### When App is FULLY CLOSED:
- Main process handles background sync (not visible in console during shutdown)
- Will check every 5 minutes when app is restarted
- Full sync scheduled on main process

---

## Files Modified

### 1. `main-production.js`
- Added `check-existing-tokens` handler (lines 635-657)
- Added `set-app-visibility` handler (lines 659-665)
- Updated console log message (line 667)

### 2. `src/js/index.js`
- Changed `REALTIME_SYNC_INTERVAL_MS` from 2 minutes to 5 seconds (line 1259)
- Removed incorrect mode-switching from visibility change listener (lines 1263-1281)
- Updated `startRealtimeSync()` documentation (lines 1283-1293)
- Updated `stopRealtimeSync()` message (line 1309)
- Updated `startBackgroundSync()` documentation (lines 1315-1325)

---

## Testing Checklist

✅ **Step 1**: Check for IPC handler errors
- Close app
- Open developer console (F12)
- Reopen app
- Look for these errors - they should NOT appear:
  - `No handler registered for 'check-existing-tokens'`
  - `No handler registered for 'set-app-visibility'`

✅ **Step 2**: Verify token persistence works
- Log in with OAuth
- Close app completely
- Reopen app
- Should see calendars/databases immediately (no login screen)
- Console should show: `[Token Check] ✅ Found existing tokens`

✅ **Step 3**: Verify polling works
- With selections made, watch the console
- Every 5 seconds should see: `[Real-time Sync] ?? Checking for changes...`
- Make changes in Google Calendar or Notion
- Should detect and sync within ~10 seconds

✅ **Step 4**: Minimize app and verify polling continues
- Minimize the app window
- Console should show: `[Sync Manager] ??? App visibility changed: HIDDEN`
- Console should show: `[Sync Manager] ?? Note: Polling continues at 5s interval...`
- Polling should continue every 5 seconds (NOT switch to 2-5 minute intervals)
- Make changes in Google/Notion while minimized
- Should still sync within ~10 seconds

---

## Key Technical Improvements

1. **IPC Handler Coverage** ✅
   - All APIs exposed in `preload.js` now have matching handlers in `main-production.js`
   - No more silent failures from missing handlers

2. **Correct Polling Logic** ✅
   - App open = 5 second polling (fast responsiveness)
   - App closed = Background sync (handled by main process)
   - Minimized/unfocused ≠ Closed (important distinction)

3. **Token Persistence** ✅
   - `check-existing-tokens` handler properly loads tokens from keychain
   - Works with fixed `TokenStorage` class from Part 1

4. **Clearer Documentation** ✅
   - Console messages now clearly explain app states
   - Comments explain why certain decisions were made
   - Future developers will understand the polling strategy

---

## Related Documentation

See also:
- `CRITICAL_BUGS_FIXED.md` - Part 1 (Token storage mismatch & auto-sync function)
- `FIXES_SUMMARY_FOR_USER.md` - User-friendly overview
- `EXACT_CODE_CHANGES.md` - Line-by-line diffs
- `VERIFY_FIXES_WORKING.md` - Comprehensive testing guide