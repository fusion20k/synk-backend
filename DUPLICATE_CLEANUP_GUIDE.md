# 🧹 Duplicate Event Cleanup & Recovery Guide

## Overview
If you already have duplicate events from the previous bugs, here's how to fix it.

---

## Option A: Manual Cleanup (Recommended)

### Best for: Small number of duplicates (< 50 events)

#### Steps

1. **Open Google Calendar**
   - Look for events that appear multiple times
   - Example: "Team Meeting" appears 2-3 times on same date

2. **Identify Duplicates**
   - For each duplicate set, keep ONE and delete the rest
   - **Rule**: Keep the one that matches your Notion entry most closely
   - Delete any extras

3. **Let Synk Detect Deletion**
   - When you delete from Google, Synk detects it
   - Synk automatically deletes the corresponding Notion page
   - Or manual: Delete from Notion, Synk removes from Google

4. **Verify in Notion**
   - Check that deleted Notion pages are gone
   - Remaining pages should match Google Calendar

5. **Restart Syncing**
   - Close app: `Cmd+Q` (Mac) or close window (Windows)
   - Wait 5 seconds
   - Reopen Synk
   - New events will sync correctly (no duplicates)

---

## Option B: Smart Filter Cleanup (Advanced)

### Best for: Know exactly which events are duplicates

#### Identify Duplicates by Calendar

Run this in browser console or DevTools:

```javascript
// Find events with same title on same date
const duplicates = {};
document.querySelectorAll('[data-eventid]').forEach(el => {
  const title = el.textContent;
  const date = el.getAttribute('data-date');
  const key = `${title}|${date}`;
  if (!duplicates[key]) duplicates[key] = [];
  duplicates[key].push(el);
});

// Show duplicates
Object.entries(duplicates).forEach(([key, events]) => {
  if (events.length > 1) {
    console.log(`⚠️ DUPLICATE: ${key} (${events.length} times)`);
  }
});
```

Then delete manually as described above.

---

## Option C: Full Database Reset (Nuclear)

### Best for: Severe corruption, hundreds of duplicates

⚠️ **Warning**: This is drastic. Only use if duplicates are everywhere.

#### Steps

1. **Backup Your Data**
   - Export Google Calendar to file
   - Export Notion database to CSV
   - Save these files somewhere safe

2. **Disconnect All Calendars**
   - Open Synk
   - Settings → Synk Pairs
   - Click "Remove" for each pair
   - Confirm removal

3. **Wait & Verify**
   - Close Synk
   - Wait 10 seconds
   - All mappings should be cleared

4. **Delete Notion Pages (Optional)**
   - If you want complete clean slate:
     - Go to Notion database
     - Select all pages
     - Delete all
   - **Or** keep them and re-sync

5. **Delete Google Events (Optional)**
   - If you want complete clean slate:
     - In Google Calendar, delete all synced events
   - **Or** keep them and re-sync

6. **Reconnect**
   - Open Synk
   - Settings → Add Synk Pair
   - Select same Calendar and Database
   - App will sync as if first time
   - **Fresh mappings created**

7. **Let It Sync**
   - Wait 5 seconds
   - Check Console: "Full sync completed"
   - Verify events sync correctly

---

## How the App Now Prevents Duplicates

### Smart Deduplication (3-layer)

**Layer 1: ID Mapping**
```
Notion Page ID "page-123" → Google Event ID "event-456"
Stored in: notionToGoogleMap["calendar::database"]["page-123"] = "event-456"
```
✅ Fastest check: O(1) lookup

**Layer 2: Content Matching**
```
Title: "Team Meeting"
Date: "2024-01-15"
If found by ID fails, check if event with same title+date exists
```
✅ Catches renamed events: O(n) lookup

**Layer 3: Creation**
```
If not found by ID or content, create new event
Store mapping for future syncs
```
✅ Only creates if truly new

---

## Testing After Cleanup

### Smoke Test (5 minutes)

```
1. Create "Clean Test Event" in Notion
   └─ Wait 5 seconds
   
2. Verify in Google Calendar
   └─ Should appear exactly ONCE
   
3. Refresh/reload all views
   └─ Should still be exactly ONCE
   
4. Edit event in Notion
   └─ Wait 5 seconds
   
5. Check Google Calendar
   └─ Should be updated (not duplicated)
   
✅ If all steps pass: duplicates are fixed!
```

### Multi-Calendar Test (5 minutes)

```
IF you have multiple calendars syncing to same database:

1. Create event in Notion
   └─ Should appear in Calendar A (not B, not C)
   
2. Create event directly in Calendar B
   └─ Should NOT appear in Calendar A or C
   
3. Create event in Calendar C
   └─ Should NOT appear in Calendar A or B
   
✅ If all steps pass: calendar isolation working!
```

---

## Checking Mapping Status

### View Stored Mappings

In DevTools Console:

```javascript
// Get the sync data store
const syncStore = require('electron-store');
const store = new syncStore({ name: 'sync-data' });

// Check mappings
const maps = {
  googleToNotionMap: store.get('googleToNotionMap'),
  notionToGoogleMap: store.get('notionToGoogleMap')
};

console.log('MAPPINGS:', JSON.stringify(maps, null, 2));
```

Expected format:
```javascript
{
  "googleToNotionMap": {
    "calendar-id::database-id": {
      "event-abc": "page-123",
      "event-def": "page-456"
    }
  },
  "notionToGoogleMap": {
    "calendar-id::database-id": {
      "page-123": "event-abc",
      "page-456": "event-def"
    }
  }
}
```

✅ If composite keys exist: mapping is fixed!

---

## Troubleshooting

### Issue: Still Getting Duplicates After Restart

**Solution**:
1. Check console: `[DUPLICATE PREVENTION]` logs
2. If not seeing them: mappings not loading
3. Try full reset (Option C)

### Issue: Events Appearing in Wrong Calendar

**Solution**:
1. Disconnect one calendar
2. Wait 10 seconds
3. Reconnect
4. Check: events should stay in correct calendar now

### Issue: Events Disappearing

**Solution**:
1. Check both Google Calendar and Notion
2. If in Google but not Notion: manually create page
3. If in Notion but not Google: manually create event
4. Wait 5 seconds: should sync correctly

### Issue: Sync Taking Forever

**Solution**:
1. Close Synk
2. Delete oldest sync pair
3. Reconnect
4. Fresh mapping should be faster

---

## Prevention Going Forward

**With these fixes, you shouldn't see duplicates again because:**

✅ Consistent composite keys (calendar + database + event ID)
✅ Proper mapping lookup and storage
✅ Correct calendar filtering (no excluded events)
✅ Smart deduplication (ID → Content → Create)

**But if it ever happens again:**
1. Check logs for mapping errors
2. Review console for `[DUPLICATE PREVENTION]` logs
3. Try full reset if severe

---

## Quick Reference

| Issue | Solution | Time |
|-------|----------|------|
| Few duplicates | Manual delete | 5-10 min |
| Many duplicates | Smart filter + delete | 20-30 min |
| Severe corruption | Full reset | 10 min |

---

## Questions?

Review the detailed technical doc: `SYNC_DUPLICATE_FIX_DETAILED.md`

Or check the app logs (DevTools F12 → Console) for specific error messages.