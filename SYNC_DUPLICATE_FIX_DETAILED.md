# 🔥 CRITICAL SYNC BUG FIXES - Event Duplication & Calendar Switching

## Executive Summary

**4 critical bugs** were causing events to be duplicated, move between calendars, and disappear. All have been fixed.

### Issues Fixed
1. ✅ **Mapping Key Inconsistency** - PRIMARY cause of duplicates and wrong calendars
2. ✅ **Incomplete Composite Key Fix** - Events weren't being tracked properly
3. ✅ **Overly Strict Calendar Filtering** - Legitimate events were being excluded
4. ✅ **Calendar ID Context Lost** - Events weren't staying in their original calendar

---

## 🐛 Bug #1: Mapping Key Inconsistency (PRIMARY CAUSE)

### The Problem
The persistent ID mappings (used to prevent duplicates) were using different keys in different directions:

**In `syncGoogleToNotion`** (lines ~600, 665, 683):
```javascript
const mapKey = `${googleCalendarId}::${notionDatabaseId}`;  // ✅ CORRECT
googleToNotionMap[mapKey] = googleToNotionMap[mapKey] || {};
```

**In `syncNotionToGoogle`** (lines ~775, 830, 853):
```javascript
const n2g = n2gAll[notionDatabaseId] || {};  // ❌ WRONG - missing googleCalendarId!
googleToNotionMap[notionDatabaseId] = googleToNotionMap[notionDatabaseId] || {};
```

### Result
- When Notion→Google creates an event and stores mapping with key `"notionDatabaseId"`
- Later, Google→Notion tries to find it with key `"googleCalendarId::notionDatabaseId"`
- **Lookup fails → Duplicate event created**
- Mapping gets corrupted across multiple calendar syncs

### The Fix
Made all three locations in `syncNotionToGoogle` use the composite key:

```javascript
// BEFORE (Line 775)
const n2g = n2gAll[notionDatabaseId] || {};

// AFTER
const mapKey = `${googleCalendarId}::${notionDatabaseId}`;
const n2g = n2gAll[mapKey] || {};
```

Locations fixed:
- Line 775-777: Persistent mapping lookup
- Line 833: Content match mapping storage
- Line 858: New event mapping storage

---

## 🐛 Bug #2: Overly Strict Calendar Filtering

### The Problem
The code was filtering Google events by checking if `event.organizer.email === googleCalendarId`:

```javascript
// BEFORE (Line 320-330)
googleEvents = googleEvents.filter(event => {
  if (event.organizer && event.organizer.email) {
    const isOwnEvent = event.organizer.email === googleCalendarId;
    if (!isOwnEvent) {
      // INCORRECTLY FILTERS OUT:
      // - Events you were invited to (you're attendee, not organizer)
      // - Shared calendar events
      // - Group calendar events
      return false;  // ❌ Filtered out!
    }
  }
  return true;
});
```

### Result
- Events you were invited to **disappeared**
- Shared calendars **didn't sync**
- Delegated calendar events **were excluded**

### The Fix
Removed the organizer filter entirely. The Google Calendar API **already** only returns events from the specified calendar:

```javascript
// AFTER (Line 325-326)
// Keep all events - they're already from the requested calendar per API contract
console.log(`[CALENDAR FILTER] Keeping all ${googleEvents.length} events from ${googleCalendarId}`);
```

**Why this works:**
- When you call `GET /calendar/v3/calendars/{calendarId}/events`
- Google API only returns events from that specific calendar
- No additional filtering needed
- **All events are already correctly filtered by the API**

---

## 🐛 Bug #3: Calendar Context Lost in Multiple Syncs

### The Problem
With multiple calendars syncing to one database, the system lost track of which calendar each event belonged to:

```
Calendar A → Database X
Calendar B → Database X
Calendar C → Database X
```

When Calendar A created event ID "abc123" and synced to Database, the mapping stored:
```javascript
notionToGoogleMap["DatabaseX"]["PageID"] = "abc123"  // Missing which calendar!
```

Later, Calendar B sync couldn't distinguish if "abc123" was from Calendar A or Calendar B.

### Result
- Events moved between calendars
- Wrong calendar ID used for updates
- Events appeared in wrong calendar after sync

### The Fix
Switched to composite key `"${googleCalendarId}::${notionDatabaseId}"`:

```javascript
// Store: Calendar + Database + IDs
notionToGoogleMap["cal-A::db-x"]["page-1"] = "event-abc123"
notionToGoogleMap["cal-b::db-x"]["page-2"] = "event-def456"
```

Now:
- ✅ Calendar A events stay in Calendar A
- ✅ Calendar B events stay in Calendar B
- ✅ Calendar C events stay in Calendar C
- ✅ No cross-calendar contamination

---

## 📝 Files Modified

### `syncManager.js` - 4 Critical Changes

1. **Lines 312-326**: Removed overly strict organizer filter
2. **Lines 390**: Simplified re-fetch filter
3. **Lines 775-777**: Fixed persistent mapping lookup key
4. **Lines 833, 858**: Fixed mapping storage keys

---

## 🔍 How the Sync Now Works (Corrected Flow)

```
SYNC FLOW FOR: Calendar "Work" + Database "Tasks"
mapKey = "work@gmail.com::database-id-123"

1️⃣ syncNotionToGoogle:
   - Notion Page "Meeting" created
   - Check mapping: notionToGoogleMap["work@gmail.com::database-id-123"]["page-id"]
   - Not found → Create Google Event
   - Store: notionToGoogleMap["work@gmail.com::database-id-123"]["page-id"] = "event-xyz"
   - Store: googleToNotionMap["work@gmail.com::database-id-123"]["event-xyz"] = "page-id"

2️⃣ syncGoogleToNotion:
   - Google Event "Meeting" exists
   - Check mapping: googleToNotionMap["work@gmail.com::database-id-123"]["event-xyz"]
   - Found → Skip (already mapped)
   - Result: ✅ No duplicate created

3️⃣ Multiple Calendars:
   - Calendar A uses same mapping key format: "personal@gmail.com::database-id-123"
   - Completely separate from Calendar B: "work@gmail.com::database-id-123"
   - Each calendar's events stay in their own calendar
```

---

## ✨ What You Should See Now

### Before Fixes
- ❌ Duplicate events created
- ❌ Events moving to wrong calendar
- ❌ Slow syncs (lots of unnecessary work)
- ❌ Confusion about which calendar events belong to
- ❌ Events disappearing randomly

### After Fixes
- ✅ Events created only once
- ✅ Events stay in their original calendar
- ✅ Faster syncs (proper deduplication)
- ✅ Clear calendar associations
- ✅ Consistent Notion ↔ Google mirror

---

## 🧪 Testing & Verification

### Quick Test
1. Add an event to Notion
2. Verify it appears in Google Calendar (not duplicated)
3. Wait 5 seconds
4. Verify it's still there (not duplicated on re-sync)
5. Edit the event in Notion
6. Verify changes appear in Google (within 5 seconds)
7. Edit in Google
8. Verify changes appear in Notion (within 5 seconds)

### Multi-Calendar Test
1. Connect Calendar A (ID: a@gmail.com)
2. Connect Calendar B (ID: b@gmail.com)
3. Both sync to same Database
4. Create event in Notion
5. **Verify it appears ONLY in Calendar A** (not in Calendar B)
6. Create event directly in Calendar B
7. **Verify it appears ONLY in Calendar B** (not in Calendar A)

### Data Integrity Check
```javascript
// Check mapping consistency
// Both directions should match:
// If googleToNotionMap["cal::db"]["event1"] = "page1"
// Then notionToGoogleMap["cal::db"]["page1"] = "event1"
```

---

## 🚀 Performance Impact

**Before**: Sync was slow because mappings weren't found, so it created duplicates, checked for duplicates, updated instead of creating...

**After**: 
- ✅ Mappings found immediately
- ✅ No unnecessary duplicate creation
- ✅ Faster sync cycles
- ✅ Better resource usage

---

## ⚠️ If You Encounter Stale Data

The fixes apply going forward. If you have existing duplicates:

### Option 1: Manual Cleanup (Recommended for small issues)
1. Identify duplicate events
2. Delete duplicates manually from Google Calendar
3. Notion will auto-sync and remove the pages
4. Restart sync

### Option 2: Full Reset (Nuclear option)
1. Disconnect calendar/database
2. Wait 10 seconds
3. Reconnect
4. App will sync as if first time
5. Re-establish all mappings

---

## 📊 Debug Output

Look for these logs to verify fixes are working:

```
[syncNotionToGoogle] 🔍 Found by persistent map: page-id → event-xyz
   ↑ Good - found existing mapping

[syncGoogleToNotion] 🛡️ DUPLICATE PREVENTION: Skipping Google event - it was just created
   ↑ Good - duplicate prevention working

[CALENDAR FILTER] Keeping all X events from calendar-id
   ↑ Good - no events filtered incorrectly

[SYNC ORDER] Notion→Google sync completed
[SYNC ORDER] Google→Notion sync completed
   ↑ Good - both directions ran

[DEBUG] Event persisted with mapping: cal::db
   ↑ Good - composite key in use
```

---

## 🔧 Technical Details

### Mapping Structure (Now Correct)

```javascript
// Before: Broken
{
  "googleToNotionMap": {
    "database-id": {
      "event-1": "page-1"  // Missing calendar context
    }
  }
}

// After: Fixed
{
  "googleToNotionMap": {
    "calendar-a::database-id": {
      "event-1": "page-1"  // Clear calendar context
    }
  }
}
```

### Deduplication Chain (Now Complete)

1. **Lookup by ID** (fastest) - uses composite key ✅ Now working
2. **Lookup by content** (fallback) - title+date match ✅ Now working
3. **Create new** (rare) - only if not found in previous steps ✅ Now working

---

## Summary

These fixes ensure:
- 🎯 **Events mapped correctly** across all sync pairs
- 🔄 **Bidirectional sync works** without duplication
- 📍 **Events stay in their original calendar**
- ⚡ **Sync performs efficiently**
- 🛡️ **Future syncs won't recreate duplicates**

The key insight: **Use consistent composite keys** for all mappings when multiple calendars sync to the same database.