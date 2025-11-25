# Manual Test Instructions for Sync All Toggle

## Prerequisites
- App must be running with Ultimate plan active
- Both Google Calendar and Notion should be connected (to see the lists)

## Test 1: Toggle Visibility ✅ PASSED
**Expected**: Toggle should be visible for Ultimate plan users
**Console Output**: `[Sync All] Toggle visible for Ultimate plan`
**Status**: ✅ CONFIRMED via console logs

## Test 2: Toggle ON - Lists Collapse
**Steps**:
1. Open the app (should be on Sync tab)
2. Locate the "Sync All Calendars" toggle
3. Click the toggle to turn it ON (should slide to the right and turn orange)

**Expected Results**:
- Toggle switch slides to the right
- Toggle background changes to Dragon's Breath gradient (orange/red)
- Calendar list smoothly collapses (0.4s animation)
- Notion database list smoothly collapses (0.4s animation)
- Google Calendar service box smoothly shrinks
- Notion service box smoothly shrinks
- Headers and connect buttons remain visible

**Console Output to Check**:
```
[Sync All] Toggle changed: true
[Sync All] Lists and sections hidden
[Sync All] State saved to localStorage: true
```

## Test 3: Toggle OFF - Lists Expand
**Steps**:
1. With toggle ON, click it again to turn it OFF

**Expected Results**:
- Toggle switch slides to the left
- Toggle background changes to gray
- Calendar list smoothly expands (0.4s animation)
- Notion database list smoothly expands (0.4s animation)
- Google Calendar service box smoothly expands
- Notion service box smoothly expands
- All calendars and databases are visible again

**Console Output to Check**:
```
[Sync All] Toggle changed: false
[Sync All] Lists and sections shown
[Sync All] State saved to localStorage: false
```

## Test 4: State Persistence
**Steps**:
1. Turn toggle ON
2. Close the app completely
3. Reopen the app

**Expected Results**:
- Toggle should still be ON
- Lists should still be collapsed
- Service boxes should still be collapsed

**Console Output to Check**:
```
[Sync All] State loaded from localStorage: true
[Sync All] Lists and sections hidden
```

## Test 5: Plan Switching - Pro Plan
**Steps**:
1. Switch account to Pro plan (or downgrade)
2. Check the Sync tab

**Expected Results**:
- Toggle should be completely hidden
- Lists should be visible (even if toggle was ON before)

**Console Output to Check**:
```
[Sync All] Toggle hidden - Plan type: pro
```

## Test 6: Plan Switching - Back to Ultimate
**Steps**:
1. Switch back to Ultimate plan
2. Check the Sync tab

**Expected Results**:
- Toggle should reappear
- Toggle state should be restored from saved state
- Lists visibility should match toggle state

**Console Output to Check**:
```
[Sync All] Toggle visible for Ultimate plan
[Sync All] State loaded from localStorage: [true/false]
```

## Visual Checks

### Toggle Switch Design
- [ ] OFF state: Gray background (#333), knob on left
- [ ] ON state: Orange/red gradient, knob on right, orange glow
- [ ] Smooth sliding animation (0.3s)

### List Animations
- [ ] Smooth collapse: max-height → 0, opacity → 0, margin-top → 0
- [ ] Smooth expand: max-height → 1000px, opacity → 1, margin-top → 20px
- [ ] Duration: 0.4s ease
- [ ] No jarring jumps or flickers

### Service Section Animations
- [ ] Boxes shrink when toggle ON
- [ ] Boxes expand when toggle OFF
- [ ] Duration: 0.4s ease (synchronized with lists)
- [ ] Headers and buttons always visible

### What Should Always Be Visible
- [ ] "Google Calendar" header
- [ ] "Notion" header
- [ ] Connect buttons (if not connected)
- [ ] OAuth status displays
- [ ] Sync All toggle (for Ultimate users)

## Debugging

If toggle is not visible:
1. Open DevTools (Ctrl+Shift+I)
2. Check console for: `[Sync All] Container not found`
3. Check console for plan type: `Plan display updated: [type]`
4. Verify element exists: `document.getElementById('sync-all-container')`

If toggle doesn't work:
1. Check console for: `[Sync All] Toggle event listener attached`
2. Check for JavaScript errors
3. Verify elements exist:
   - `document.getElementById('calendars-content')`
   - `document.getElementById('notion-content')`

If animations are choppy:
1. Check CSS transitions are applied
2. Verify `.sync-all-hidden` class exists
3. Verify `.sync-all-collapsed` class exists

## Success Criteria

✅ All tests pass
✅ No console errors
✅ Smooth animations
✅ State persists across app restarts
✅ Toggle only visible for Ultimate plan
✅ Headers and buttons remain visible when collapsed

---
**Current Status**: App is running, toggle is visible for Ultimate plan
**Next Step**: Perform manual interaction tests above