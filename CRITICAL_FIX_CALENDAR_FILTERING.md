# 🔒 CRITICAL FIX: Calendar Filtering Privacy Bug

## Issue Summary
**CRITICAL PRIVACY BUG**: The app was syncing events from ALL Google Calendars instead of only the calendars explicitly selected by the user in their sync pairs.

## Why This Matters

### User Expectation
- ✅ Users explicitly choose which calendars to sync
- ❌ Syncing everything is invasive and unexpected
- 🔐 People have personal vs work calendars for a reason

### Privacy Impact
- **Before Fix**: User selects "Work Calendar" → ALL calendars sync (including personal)
- **After Fix**: User selects "Work Calendar" → ONLY work calendar syncs

### Business Model
- **Pro Plan**: Selective sync (2-3 calendar pairs)
- **Ultimate Plan**: Unlimited selective sync
- Both plans respect user's explicit calendar selection

## The Fix

### Files Modified
1. `src/main.js` - Pass planManager to SyncManager
2. `src/syncManager.js` - Add strict calendar filtering for ALL users
3. `src/google.js` - Add debug logging for organizer emails

### Key Changes

#### 1. Calendar Filtering Logic (syncManager.js)
```javascript
// 🔒 CRITICAL PRIVACY FIX: ONLY sync events from the explicitly selected calendar
// This applies to ALL users (Pro, Ultimate, Trial)

googleEvents = googleEvents.filter(event => {
  // ONLY sync events where the organizer email matches the selected calendar ID
  if (event.organizer && event.organizer.email) {
    return event.organizer.email === googleCalendarId;
  }
  // If no organizer info, filter it out to be safe
  return false;
});
```

#### 2. How It Works
- When fetching events from Google Calendar API: `/calendars/{calendarId}/events`
- Filter events by checking `event.organizer.email === googleCalendarId`
- Events from other calendars (shared, subscribed, secondary) are **filtered out**
- Events without organizer information are **filtered out** for safety

#### 3. Logging Added
- Shows which events are being filtered and why
- Displays organizer emails for debugging
- Logs summary of filtered vs. kept events

## Testing Checklist

### Pro/Trial Users
- [ ] Connect one Google Calendar to one Notion Database
- [ ] Create event in the SYNCED calendar → Should sync ✅
- [ ] Create event in a DIFFERENT calendar → Should NOT sync ❌
- [ ] Check console logs to verify filtering

### Ultimate Users
- [ ] Connect multiple Google Calendars to multiple Notion Databases
- [ ] Each calendar should ONLY sync its own events
- [ ] Events from non-synced calendars should NOT appear

### Edge Cases
- [ ] Shared calendars (events organized by others)
- [ ] Subscribed calendars (read-only)
- [ ] Secondary calendars (user owns multiple)
- [ ] Events without organizer info

## Expected Behavior

### ✅ CORRECT (After Fix)
```
User Setup:
- Sync Pair 1: "Work Calendar" ↔ "Work DB"
- Sync Pair 2: "Personal Calendar" ↔ "Personal DB"

Result:
- Work events → Work DB only
- Personal events → Personal DB only
- Other calendars → NOT synced
```

### ❌ INCORRECT (Before Fix)
```
User Setup:
- Sync Pair 1: "Work Calendar" ↔ "Work DB"

Result:
- Work events → Work DB ✅
- Personal events → Work DB ❌ (PRIVACY BUG!)
- All other calendars → Work DB ❌ (PRIVACY BUG!)
```

## Plan Differences

### Pro Plan (2-3 Pairs)
- Can sync 2-3 calendar pairs
- Each pair ONLY syncs the selected calendar
- Enforced by plan limits elsewhere in the app

### Ultimate Plan (Unlimited Pairs)
- Can sync unlimited calendar pairs
- Each pair ONLY syncs the selected calendar
- No limit on number of pairs

**KEY POINT**: Both plans respect user's explicit calendar selection!

## Debug Logs to Watch For

```
[CALENDAR FILTER] Sample event organizer: { email: 'user@gmail.com', self: true, calendarId: 'user@gmail.com' }
✅ CALENDAR FILTER: All 5 events are from the selected calendar user@gmail.com

OR

[CALENDAR FILTER] ❌ Filtering out event "Team Meeting" - organizer: work@company.com, selected calendar: personal@gmail.com
🔒 CALENDAR FILTER: Filtered out 3 events from other calendars (keeping 5 from personal@gmail.com)
```

## Rollout Plan

1. ✅ Fix implemented in syncManager.js
2. ✅ Logging added for debugging
3. ⏳ Test with multiple calendar scenarios
4. ⏳ Verify no regressions in existing sync functionality
5. ⏳ Deploy to beta users
6. ⏳ Monitor logs for any edge cases

## Related Files
- `src/syncManager.js` - Main filtering logic
- `src/google.js` - Google Calendar API calls
- `src/main.js` - SyncManager initialization
- `src/planManager.js` - Plan type checking

## Notes
- This fix applies to ALL users regardless of plan
- The difference between plans is the NUMBER of pairs, not the filtering behavior
- Events are filtered by `organizer.email` matching the `calendarId`
- This prevents privacy leaks and respects user intent

---

**Status**: ✅ FIXED - Ready for testing
**Priority**: 🔴 CRITICAL - Privacy and usability issue
**Impact**: All users (Pro, Ultimate, Trial)