# Verification Guide: Confirm All Fixes Are Working

## Quick Test (60 seconds)

### Step 1: Close App Completely
- Click the X button to close the app
- Wait 2 seconds to ensure it's fully shut down
- Verify it's not running (check taskbar)

### Step 2: Open App & Watch Console
- Open the app
- Press `F12` to open developer console
- Look at the console output

### Step 3: Check for Success Messages

**✅ EXPECTED - Look for these messages:**

Within first 5 seconds:
```
[Token Check] Checking for existing OAuth tokens...
[Token Check] hasValidTokens: true
[Token Check] ✅ Found existing tokens
[Startup] ✅ Auto-sync registered
[Real-time Sync] ? ENABLED - Checking for changes every 5 seconds
[Real-time Sync] ?? Mode: INCREMENTAL (only modified events since last sync)
[Real-time Sync] ?? This polling runs while app window is OPEN (even if minimized)
```

**❌ WRONG - If you see these errors, fixes didn't work:**
```
[Startup] Error checking for existing tokens: Error: No handler registered for 'check-existing-tokens'
Error: Error invoking remote method 'set-app-visibility': Error: No handler registered for 'set-app-visibility'
Error checking for existing tokens
```

---

## Full Test (5 minutes)

### Test 1: Token Persistence ✅

**What to Test**: Tokens persist across app restart

1. Close the app
2. Reopen the app
3. **Verify** in console:
   ```
   [Token Check] ✅ Found existing tokens
   ```
4. **Verify** in UI:
   - Calendars appear in dropdown
   - Databases appear in dropdown
   - NO login screen appears
   - Status pills show "connected" or proper status

**✅ PASS**: Tokens loaded, calendars/databases visible, no login screen
**❌ FAIL**: See login screen or error messages

---

### Test 2: 5-Second Polling ✅

**What to Test**: App polls for changes every 5 seconds while open

1. After app opens, watch the console
2. Expand all messages so you can see them
3. Look for these messages appearing every ~5 seconds:
   ```
   [Real-time Sync] ?? Checking for changes...
   [Real-time Sync] ?? Incremental sync: X calendar(s), Y database(s) selected
   ```

**Timeline Check**:
- 0s: App opens
- 5s: First poll
- 10s: Second poll
- 15s: Third poll
- etc.

**✅ PASS**: See polling messages every 5 seconds
**❌ FAIL**: See polling every 2 minutes, or no polling at all

---

### Test 3: Visibility Doesn't Stop Polling ✅

**What to Test**: Minimizing app doesn't stop 5-second polling

1. App should be running with selections made
2. **Watch console** - see the 5-second polling
3. **Minimize the app** (click minimize button)
4. **Check console** - you should see:
   ```
   [Sync Manager] ??? App visibility changed: HIDDEN
   [Sync Manager] ?? Note: Polling continues at 5s interval while app window exists
   ```
5. **Keep watching console** - polling should CONTINUE every 5 seconds:
   ```
   [Real-time Sync] ?? Checking for changes...  ← After 5s
   [Real-time Sync] ?? Checking for changes...  ← After 10s
   [Real-time Sync] ?? Checking for changes...  ← After 15s
   ```

**✅ PASS**: Polling continues every 5 seconds even when minimized
**❌ FAIL**: Polling switches to 2 or 5 minute intervals, or stops

---

### Test 4: Sync Actually Works ✅

**What to Test**: Changes in Google/Notion are detected and synced

**Setup**:
- App is open with a calendar and database selected
- Have a second browser window/tab open to Google Calendar or Notion

**Test Steps**:

1. **Create event in Google Calendar**:
   - Open Google Calendar in browser
   - Create a new event
   - Return to app and watch console
   - **Within 10 seconds** should see:
   ```
   [Real-time Sync] ?? Syncing changes...
   [Sync Manager] ✅ Sync completed: Synced X events
   ```
   - Event should appear in Notion database

2. **Create item in Notion**:
   - Open Notion in browser
   - Add a new item to the synced database
   - Return to app and watch console
   - **Within 10 seconds** should see sync message
   - Item should appear in Google Calendar as event

**✅ PASS**: Changes sync within 5-10 seconds, appear in both places
**❌ FAIL**: Changes don't sync, or take many minutes, or show errors

---

## No-Error Checklist ✅

### On App Startup:
- [ ] NO: `Error: No handler registered for 'check-existing-tokens'`
- [ ] NO: `Error: No handler registered for 'set-app-visibility'`
- [ ] NO: `[Startup] Error checking for existing tokens`
- [ ] YES: `[Token Check] ✅ Found existing tokens`

### In Console Output:
- [ ] NO error messages with "handler" or "invoke"
- [ ] NO messages about missing OAuth tokens
- [ ] YES: Token check successful
- [ ] YES: Auto-sync started
- [ ] YES: Real-time sync enabled

### Window Events:
- [ ] NO: Polling stops when minimized
- [ ] NO: Polling slows down to 2+ minutes
- [ ] YES: Polling continues every 5 seconds while app is open

---

## Detailed Console Analysis

### Expected Console Pattern (Save Last 2 Minutes)

When you first open the app, console should show:
```
[Startup] Loading user selections...
[Startup] Loading subscription plan...
[Startup] Checking for auto-load tokens...
[Token Check] Checking for existing OAuth tokens...
[Token Check] hasValidTokens: true
[Token Check] ✅ Found existing tokens
[Startup] Auto-loading tokens...
[Startup] ✅ Fetching Google calendars...
[Startup] ✅ Fetching Notion databases...
[Startup] ✅ Restoring selections...
[Startup] ✅ Triggering auto-sync with saved selections
[Auto-Sync] Starting auto-sync with 1 pair(s)
[Auto-Sync] ✅ Auto-sync registered successfully
[Real-time Sync] ? ENABLED - Checking for changes every 5 seconds
[Real-time Sync] ?? Performing initial sync...
[Sync Manager] ??? Initial state: ENABLED
[Sync Manager] ??? App is currently: VISIBLE
[Real-time Sync] ? Next check scheduled in 5 seconds
[Real-time Sync] ?? Checking for changes...
[Real-time Sync] ?? Incremental sync: 1 calendar(s), 1 database(s) selected
```

Then every 5 seconds:
```
[Real-time Sync] ?? Checking for changes...
[Real-time Sync] ?? Incremental sync: 1 calendar(s), 1 database(s) selected
[Real-time Sync] ?? [sync details...]
```

### If You See Different Pattern:
- [ ] Different interval? Check `REALTIME_SYNC_INTERVAL_MS` value
- [ ] Missing handler error? Check main-production.js handlers
- [ ] Polling stops when minimized? Check visibility event listener

---

## Copy-Paste Test Commands

If you want to manually test via console, paste these commands:

```javascript
// Test 1: Check if handlers exist
console.log("Testing check-existing-tokens handler...");
window.electronAPI.checkExistingTokens().then(r => console.log("Result:", r));

// Test 2: Test visibility notification
console.log("Testing setAppVisibility handler...");
window.electronAPI.setAppVisibility(false).then(r => console.log("Result:", r));

// Test 3: Force sync
console.log("Testing force sync...");
window.electronAPI.forceSync().then(r => console.log("Sync result:", r));
```

All three should return `{ success: true }` or similar.

---

## Troubleshooting

### Issue: Still seeing 2-minute polling
**Solution**: 
- Check line 1259 in `src/js/index.js`
- Should be: `const REALTIME_SYNC_INTERVAL_MS = 5 * 1000;`
- NOT: `const REALTIME_SYNC_INTERVAL_MS = 2 * 60 * 1000;`

### Issue: Handler errors still appearing
**Solution**:
- Check `main-production.js` lines 635-665
- Ensure `check-existing-tokens` handler exists
- Ensure `set-app-visibility` handler exists
- Restart app completely

### Issue: Tokens not persisting
**Solution**:
- Check `src/token-storage.js` is using correct keychain service
- Should be: `serviceName: 'synk-app'`
- Not: `serviceName: 'synk-oauth-tokens'`

### Issue: No polling happening at all
**Solution**:
- Check if selections exist (calendars/databases)
- Verify connections show as connected in UI
- Check `isGoogleActuallyConnected()` and `isNotionActuallyConnected()` return true

---

## When to Report Issues

If after these fixes you still see:
1. IPC handler errors
2. Polling intervals different from 5 seconds
3. Polling switching based on window visibility
4. Token persistence failures

Then there may be other issues to investigate. Document:
- Exact console error messages
- Timing of when errors occur
- Whether minimizing affects polling
- Whether tokens persist after restart