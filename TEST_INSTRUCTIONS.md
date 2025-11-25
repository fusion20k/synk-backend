# 🔍 DEBUGGING INSTRUCTIONS - Calendar Filtering Issue

## The Problem
Events from ALL Google Calendars are syncing, even though you only selected ONE calendar in the app.

## What We Need to Find Out

### Step 1: Close ALL instances of the app
1. Close the Synk app window if it's open
2. Open Task Manager (Ctrl+Shift+Esc)
3. Look for any processes named "Synk" or "electron"
4. End ALL of them
5. Wait 10 seconds

### Step 2: Start the app fresh and check console
1. Open PowerShell in the app folder: `c:\Users\david\Desktop\synk\synk-fixed`
2. Run: `npm start`
3. Watch the console output carefully

### Step 3: Look for these specific messages

**When the app starts, you should see:**
```
[DEBUG] 🚨 syncManager.js LOADED from: [path]
[DEBUG] 🔥 SyncManager singleton created - filtering logic ACTIVE
```

**When a sync happens, you should see:**
```
[DEBUG] 🎯 syncPair called with calendarId: [your-calendar-id]
[DEBUG] 🔍 CALENDAR FILTERING STARTING - X events to filter
[DEBUG] 🔍 Selected calendar ID: [your-calendar-id]
[CALENDAR FILTER] Sample event organizer: {...}
```

### Step 4: What to report back

**If you DON'T see these messages:**
- The old code is still running
- We need to rebuild or clear cache

**If you DO see these messages:**
- Copy the EXACT output showing:
  - What calendar ID was selected
  - What organizer emails were found
  - How many events were filtered

**If you see filtering messages but events still sync from other calendars:**
- The filtering logic needs adjustment
- We need to see the actual event data structure

### Step 5: Check what calendar ID you selected

1. In the app, go to the Sync tab
2. Look at your sync pair configuration
3. What is the EXACT calendar ID shown? (e.g., "primary", "work@gmail.com", etc.)
4. Report this back

### Step 6: Test with a new event

1. Create a NEW event in a DIFFERENT calendar (not the one you selected to sync)
2. Wait for sync to happen (or click refresh)
3. Check if that event appears in Notion
4. Report what happened

## Expected Behavior

✅ **CORRECT:** Only events from the selected calendar sync to Notion
❌ **WRONG:** Events from other calendars also sync to Notion

## Report Back

Please provide:
1. Console output from Step 3
2. Calendar ID from Step 5  
3. Test result from Step 6