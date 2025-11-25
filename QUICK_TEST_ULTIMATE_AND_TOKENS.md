# Quick Test Guide: Ultimate Plan & Token Fixes

## 60-Second Test

### Step 1: Completely Close App (10 seconds)
1. Close Synk app completely
2. Make sure it's not in taskbar or system tray
3. Wait 2 seconds

### Step 2: Reopen App (15 seconds)
1. Launch Synk
2. **IMPORTANT**: Do NOT enter credentials
3. Watch the console (DevTools F12)

### Step 3: Check Console Output (20 seconds)

You should see these messages **in order** (copy-paste format):

```
[Token Check] Checking for existing OAuth tokens...
[Token Check] ✅ Found existing tokens - Google: true Notion: true
[Startup] Checking for existing OAuth tokens...
[Startup] ✅ Found existing tokens
```

### Step 4: Verify Calendars/Databases Load (15 seconds)
- Wait 3-5 seconds
- You should see your calendars and databases listed
- If you see login screen → **Token fix didn't work**
- If you see calendars → **✅ Token fix working!**

---

## 5-Minute Full Test

### Part A: Token Persistence (2 min)

**Console check**:
1. Press F12 to open DevTools
2. Go to Console tab
3. Type: `currentPlanData`
4. Press Enter
5. Should see: `{ type: 'ultimate', ... }` or `{ type: 'pro', ... }`

**Expected output**:
```javascript
> currentPlanData
{type: 'ultimate', billingCycle: 'monthly', ...}
```

### Part B: Ultimate Plan - Unlimited Selection (2 min)

**Try selecting 4 calendars** (Ultimate plan):
1. Click 4 different Google calendars
2. After 3 selections, check console for: `Max: Infinity`
3. **Should allow all 4** (no "limit reached" message)
4. Verify console shows: `[Selection] ✅ Added calendar...`

**Console output you expect**:
```
[Selection] Attempting to select google. Current: 1, Max: Infinity, Plan: ultimate
[Plan Limit] Ultimate plan detected - returning Infinity (unlimited)
[Selection] ✅ Added calendar1. New count: 1

[Selection] Attempting to select google. Current: 2, Max: Infinity, Plan: ultimate
[Plan Limit] Ultimate plan detected - returning Infinity (unlimited)
[Selection] ✅ Added calendar2. New count: 2

[Selection] Attempting to select google. Current: 3, Max: Infinity, Plan: ultimate
[Plan Limit] Ultimate plan detected - returning Infinity (unlimited)
[Selection] ✅ Added calendar3. New count: 3

[Selection] Attempting to select google. Current: 4, Max: Infinity, Plan: ultimate
[Plan Limit] Ultimate plan detected - returning Infinity (unlimited)
[Selection] ✅ Added calendar4. New count: 4
```

### Part C: Restart Test (1 min)

1. Close app
2. Reopen app
3. **Should NOT show login screen**
4. Calendars should appear automatically
5. Your 4 selections should still be there

---

## What to Look For

### ✅ Signs It's Working

| Sign | Location | Example |
|------|----------|---------|
| Tokens loaded | Console | `[Token Check] ✅ Found existing tokens` |
| Ultimate plan | DevTools | `type: 'ultimate'` |
| No limit | Console | `Max: Infinity` |
| Selections saved | UI | Same 4+ calendars after restart |
| No login | UI | Bypasses login screen |

### ❌ Signs It's Broken

| Problem | Location | Example |
|---------|----------|---------|
| No tokens | Console | `[Token Check] No existing tokens found` |
| Wrong plan type | DevTools | `type: 'Ultimate'` (uppercase) or `type: 'none'` |
| Limited to 3 | Console | `Max: 3` when on Ultimate |
| Login required | UI | Auth screen appears on restart |
| IPC error | Console | `No handler registered for 'check-existing-tokens'` |

---

## Manual Console Tests

### Test 1: Check Current Plan
```javascript
// In DevTools Console, type:
currentPlanData.type

// Should output:
"ultimate"  // ← lowercase!
```

### Test 2: Check Max Selections
```javascript
// In DevTools Console, type:
getMaxSelectionsPerSide()

// Should output (if Ultimate):
Infinity

// Should output (if Pro):
3
```

### Test 3: Check Saved Selections
```javascript
// In DevTools Console, type:
selected.google.length
selected.notion.length

// Should show number of selections:
4
5
```

### Test 4: Trigger Selection Logging
```javascript
// In DevTools Console, type (replace with real calendar ID):
toggleSelect('example-calendar-id', 'google')

// Should see in console:
[Selection] Attempting to select google. Current: 4, Max: Infinity, Plan: ultimate
[Selection] ✅ Added example-calendar-id. New count: 5
```

---

## Failure Scenarios to Avoid

### ❌ Scenario 1: Login Screen on Restart
**Symptom**: App asks for login after restart  
**Cause**: Tokens not being persisted  
**Fix**: Check console for: `[Token Check] ✅ Found existing tokens`

### ❌ Scenario 2: Limited to 3 on Ultimate
**Symptom**: Can't select more than 3 calendars  
**Cause**: Plan type not recognized as 'ultimate'  
**Fix**: Check console output from `getMaxSelectionsPerSide()` - should say `Infinity`

### ❌ Scenario 3: IPC Handler Errors
**Symptom**: Console shows "No handler registered for 'check-existing-tokens'"  
**Cause**: Main process handler not updated  
**Fix**: Verify `main-production.js` lines 635-667 have the handler

### ❌ Scenario 4: Plan Shows as Uppercase
**Symptom**: `currentPlanData.type = 'Ultimate'` instead of `'ultimate'`  
**Cause**: Plan normalization not applied  
**Fix**: Verify `updatePlanDisplay` normalizes type to lowercase (line 637)

---

## What Changed (Summary)

### Before Fixes:
```
X Tokens not persisted - forced OAuth every restart
X Ultimate plan limited to 3 calendars
X Console errors: "No handler registered for 'check-existing-tokens'"
```

### After Fixes:
```
✅ Tokens persist across restarts
✅ Ultimate plan: unlimited calendars
✅ No console errors about handlers
✅ Plan type normalized (case-insensitive)
```

---

## Quick Fix Checklist

- [ ] Tokens load on restart (no login required)
- [ ] Console shows `[Token Check] ✅ Found existing tokens`
- [ ] Ultimate plan shows `Max: Infinity` in console
- [ ] Can select 4+ calendars/databases
- [ ] `getMaxSelectionsPerSide()` returns `Infinity` for Ultimate
- [ ] `currentPlanData.type` is lowercase `'ultimate'`
- [ ] No "No handler registered" errors
- [ ] Selections persist after app restart

---

## If You Still See Issues

1. **Capture console output** (screenshot or copy-paste from F12)
2. **Check if plan loaded**: `console.log(currentPlanData)`
3. **Force refresh**: Ctrl+Shift+R in DevTools
4. **Restart app**: Completely close and reopen
5. **Check backend connection**: Verify internet connection to backend

---

## Files to Verify

- ✅ `main-production.js` lines 635-667: IPC handler
- ✅ `src/js/index.js` line 637: Plan normalization  
- ✅ `src/js/index.js` lines 292-304: Selection logic
- ✅ `src/preload.js`: exposes `checkExistingTokens` API
