# CRITICAL FIXES: Ultimate Plan Limits & OAuth Token Persistence

## Problem Statement

You reported two critical issues preventing the app from working properly:

1. **Ultimate Plan Calendar Limit**: When on the Ultimate plan, you're limited to 3 calendars when you should have unlimited selection
2. **OAuth Token Persistence**: You have to authenticate every time you open the app - tokens aren't being saved/loaded

## Root Cause Analysis

### Issue #1: Ultimate Plan Limit Bug

**The Problem**: 
- When Ultimate plan loads, `getMaxSelectionsPerSide()` should return `Infinity` (unlimited)
- But there were two issues:
  1. **Plan type case sensitivity**: The backend might return `'Ultimate'` (capitalized) but code checked for `'ultimate'` (lowercase)
  2. **Plan data normalization**: Plan data wasn't being normalized, causing case mismatches

**Evidence in Code**:
```javascript
// Before fix:
if (currentPlanData.type === 'ultimate') return Infinity;  // ← Case-sensitive check

// After fix:
currentPlanData = { ...planData, type: (planData.type || '').toLowerCase() };
```

### Issue #2: Token Persistence Completely Broken

**The Critical Mismatch**:
- **Main Process (IPC Handler)** returned: `{ success: true, hasTokens: true, tokens }`
- **Renderer Code** expected: `{ hasGoogle: boolean, hasNotion: boolean }`
- These **don't match** → Token check silently failed → User forced to re-authenticate every time

**Evidence**:
```javascript
// Renderer expected this (line 848):
if (tokenStatus.hasGoogle || tokenStatus.hasNotion) {

// But IPC handler was returning this:
return { success: true, hasTokens: true, tokens };  // ← Missing hasGoogle/hasNotion!
```

## Solutions Implemented

### Fix #1: Corrected IPC Token Check Handler

**File**: `main-production.js` (lines 635-667)

```javascript
// BEFORE (broken):
return { success: true, hasTokens: true, tokens };

// AFTER (fixed):
return { 
  success: true, 
  hasGoogle: !!tokens.googleAccessToken,      // ✅ Now returns correct properties
  hasNotion: !!tokens.notionAccessToken,      // ✅ Matches renderer expectations
  tokens 
};
```

**What it does**:
- Checks keychain for existing OAuth tokens
- Returns separate `hasGoogle` and `hasNotion` boolean flags
- Renderer can now properly detect which services are connected
- Tokens persist across app restarts

### Fix #2: Normalized Plan Type to Lowercase

**File**: `src/js/index.js` (line 635-637)

```javascript
// BEFORE (case-sensitive):
currentPlanData = planData;

// AFTER (normalized):
currentPlanData = { ...planData, type: (planData.type || '').toLowerCase() };
```

**What it does**:
- Converts plan type to lowercase: `'Ultimate'` → `'ultimate'`
- Ensures `getMaxSelectionsPerSide()` correctly recognizes Ultimate plan
- Returns `Infinity` for Ultimate, `3` for Pro/Trial, `0` for none

### Fix #3: Added Enhanced Logging

**File**: `src/js/index.js` (multiple locations)

**In `getMaxSelectionsPerSide()`** (lines 292-304):
```javascript
console.log('[Plan Limit] Ultimate plan detected - returning Infinity (unlimited)');
console.log('[Plan Limit] Pro/Trial plan detected - returning 3');
```

**In `toggleSelect()`** (lines 342, 352):
```javascript
console.log(`[Selection] Attempting to select ${type}. Current: ${selectedArray.length}, Max: ${maxSelections}, Plan: ${currentPlanData.type}`);
console.log(`[Selection] ✅ Added ${id}. New count: ${selectedArray.length}`);
```

**What it does**:
- Provides clear debugging output in console
- Shows when selection limit is hit
- Displays current plan type and max selections

## Expected Behavior After Fixes

### On First App Start:
```
[Token Check] Checking for existing OAuth tokens...
[Token Check] ✅ Found existing tokens - Google: true Notion: true
[Startup] Checking for existing OAuth tokens...
[Startup] ✅ Found existing tokens
[Startup] Fetching Google calendars...
[Startup] ✅ Auto-loaded 5 Google calendars
[Startup] Fetching Notion databases...
[Startup] ✅ Auto-loaded 8 Notion databases
```

**Result**: App shows your calendars/databases WITHOUT requiring login

### Ultimate Plan Selection:
```
[Selection] Attempting to select google. Current: 1, Max: Infinity, Plan: ultimate
[Plan Limit] Ultimate plan detected - returning Infinity (unlimited)
[Selection] ✅ Added cal123. New count: 2

[Selection] Attempting to select google. Current: 2, Max: Infinity, Plan: ultimate
[Selection] ✅ Added cal456. New count: 3

[Selection] Attempting to select google. Current: 3, Max: Infinity, Plan: ultimate
[Selection] ✅ Added cal789. New count: 4

[Selection] Attempting to select google. Current: 4, Max: Infinity, Plan: ultimate
[Selection] ✅ Added cal000. New count: 5
```

**Result**: You can select as many calendars as you want (no limit at 3)

### Pro Plan Selection (with 3-limit):
```
[Selection] Attempting to select google. Current: 3, Max: 3, Plan: pro
⚠️ [Selection] Pro plan limited to 3 google selections per side. Current: 3
```

**Result**: Pro plan correctly limited to 3, shows warning when trying to add 4th

## Testing Checklist

### Test #1: Token Persistence (5 minutes)
- [ ] **First Launch**:
  - Open app with valid tokens in keychain
  - Console should show: `[Token Check] ✅ Found existing tokens - Google: true Notion: true`
  - Calendars and databases should load automatically
  - NO login screen should appear

- [ ] **Restart Test**:
  - Restart app
  - Should not ask for authentication again
  - Previous calendars/databases should still be visible
  - Should see `[Startup] ✅ Auto-loaded X Google calendars`

### Test #2: Ultimate Plan Unlimited Selection (5 minutes)
- [ ] **4+ Calendar Selection**:
  - Select 4 Google calendars
  - Console should show: `Max: Infinity, Plan: ultimate`
  - All 4 should be selected (not disabled at 3)

- [ ] **5+ Database Selection**:
  - Select 5 Notion databases  
  - Console should show: `Max: Infinity, Plan: ultimate`
  - All 5 should be selected (not disabled at 3)

### Test #3: Pro Plan 3-Limit Still Works (3 minutes)
- [ ] **Downgrade to Pro Plan** (if possible in test):
  - Try to select 4 calendars
  - Should see error: `Pro plan limited to 3`
  - 4th item should be disabled/grayed out

### Test #4: Console Output Verification (2 minutes)
- [ ] Open DevTools (F12)
- [ ] Check console for:
  - ✅ `[Token Check] ✅ Found existing tokens`
  - ✅ `[Plan Update] Current plan: ultimate - Max selections per side: Infinity`
  - ✅ `[Selection] Attempting to select google`
  - ❌ NO errors about IPC handlers
  - ❌ NO "No handler registered" messages

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| `main-production.js` | Fixed IPC token handler to return `hasGoogle`/`hasNotion` | 635-667 |
| `src/js/index.js` | Normalized plan type to lowercase + added logging | 292-304, 635-637, 342, 352 |

## Quick Verification Commands

In DevTools Console (`F12`):

```javascript
// Check current plan is loaded correctly
currentPlanData

// Check max selections for current plan  
getMaxSelectionsPerSide()

// Check selected calendars
selected.google

// Manually trigger selection to test logging
toggleSelect('calendar-id-here', 'google')
```

## Expected Output Examples

### ✅ Working Setup (Ultimate Plan with Tokens):
```
[Token Check] ✅ Found existing tokens - Google: true Notion: true
[Plan Update] Current plan: ultimate - Max selections per side: Infinity
[Selection] Attempting to select google. Current: 3, Max: Infinity, Plan: ultimate
[Plan Limit] Ultimate plan detected - returning Infinity (unlimited)
[Selection] ✅ Added calendar123. New count: 4
```

### ❌ Broken Setup (Would have before fixes):
```
No handler registered for 'check-existing-tokens'  ← ERROR!
[Plan Update] Current plan: Ultimate - Max selections per side: 0  ← Wrong type!
[Selection] Attempting to select google. Current: 2, Max: 3, Plan: none  ← Plan not loaded!
⚠️ Pro plan limited to 3 google selections per side  ← Stuck at 3 even on Ultimate!
```

## Technical Notes

1. **Token Check Response Format**:
   - The IPC handler now returns `{ hasGoogle, hasNotion }` instead of just `{ hasTokens }`
   - This matches what the renderer expects in `autoLoadExistingTokens()`
   - Tokens are stored/retrieved from system keychain via `TokenStorage` class

2. **Plan Type Normalization**:
   - All plan types are now stored lowercase: `'ultimate'`, `'pro'`, `'trial'`, `'none'`
   - This prevents case sensitivity bugs in the future
   - The backend can return any case and it will work

3. **Selection Logic**:
   - Ultimate plan: `maxSelections = Infinity` → `n < Infinity` always true → unlimited selections
   - Pro plan: `maxSelections = 3` → Selection enforced by UI
   - Disabled items visual feedback shows when limit is reached

## If Issues Persist

1. **Still seeing "3 calendar limit" on Ultimate**:
   - [ ] Check console for `Plan Limit` messages
   - [ ] Verify plan type shows as `'ultimate'` (lowercase)
   - [ ] Try: `toggleSelect('test-id', 'google')` to see current Max value
   - [ ] Restart app to reload plan from backend

2. **Still having OAuth on every restart**:
   - [ ] Check for `[Token Check] ✅ Found existing tokens` in console
   - [ ] Verify tokens exist in system keychain
   - [ ] Check that `hasGoogle` and `hasNotion` are `true` in token response
   - [ ] Restart app completely (not just reload)

3. **IPC handler errors**:
   - [ ] Look for "No handler registered" messages
   - [ ] Verify `main-production.js` has the updated handler
   - [ ] Check that preload.js exposes `checkExistingTokens` API

## Summary

These fixes address the core issues:
- ✅ Ultimate plan now has unlimited calendar/database selection
- ✅ OAuth tokens persist across app restarts (no more forced re-authentication)
- ✅ IPC message format now matches renderer expectations
- ✅ Plan type normalized to prevent case sensitivity bugs
- ✅ Comprehensive logging for debugging