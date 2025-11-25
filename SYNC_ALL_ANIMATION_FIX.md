# Sync All Toggle - Service Box Animation Fix

## Issue Reported
The list containers were hiding correctly when Sync All toggle was enabled, but the outer service section boxes (containing the connect buttons) were not shrinking. The boxes should animate to only show the header area (title + connect button + divider line).

## Root Cause
The `.sync-all-collapsed` class only set `min-height: auto` and `padding-bottom: 24px`, but didn't actually constrain the height of the service section boxes. The boxes needed `max-height` and `overflow: hidden` to properly collapse.

## Solution Implemented

### CSS Changes (lines 363-377)

**Before:**
```css
.service-section.sync-all-collapsed {
    min-height: auto;
    padding-bottom: 24px;
}
```

**After:**
```css
/* Collapsed state for service sections when Sync All is enabled */
.service-section.sync-all-collapsed {
    max-height: 120px; /* Only show header area (title + button + padding) */
    overflow: hidden;
    padding-bottom: 24px;
}

/* Hide OAuth status when service section is collapsed */
.service-section.sync-all-collapsed .oauth-status {
    max-height: 0 !important;
    opacity: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden;
    transition: all 0.4s ease;
}
```

## What This Does

1. **Service Section Collapse**: Sets `max-height: 120px` to limit the box to only show the header area
2. **Overflow Hidden**: Prevents content from spilling outside the collapsed box
3. **OAuth Status Hide**: Also hides the OAuth status elements when collapsed
4. **Smooth Animation**: Uses the existing `transition: all 0.4s ease` from `.service-section`

## Expected Behavior

### When Sync All Toggle is ON:
- ✅ List containers (`.list-container`) collapse with `max-height: 0`
- ✅ OAuth status elements collapse with `max-height: 0`
- ✅ Service section boxes shrink to `max-height: 120px` (header only)
- ✅ All animations happen smoothly over 0.4 seconds

### When Sync All Toggle is OFF:
- ✅ List containers expand back to full height
- ✅ OAuth status elements expand back (if visible)
- ✅ Service section boxes expand to full height
- ✅ All animations happen smoothly over 0.4 seconds

## Service Section Structure

```
.service-section (outer box - now collapses to 120px)
├── .service-header (title + connect button + border-bottom divider)
├── .oauth-status (OAuth connection status - now hidden when collapsed)
└── .list-container (calendars/databases list - already hiding correctly)
```

## Animation Timing
- Service section: 0.4s ease (from existing transition)
- List containers: 0.4s ease
- OAuth status: 0.4s ease
- Toggle switch: 0.3s ease

## File Status
- ✅ File complete: 2951 lines
- ✅ CSS changes applied: lines 363-377
- ✅ Sync All functions restored
- ✅ File properly closes with `</script></body></html>`

## Testing Instructions

1. Launch the app with Ultimate plan
2. Verify Sync All toggle is visible
3. Click toggle ON:
   - Service boxes should shrink to only show header area
   - Lists should collapse smoothly
   - OAuth status should hide
   - Animation should be smooth (0.4s)
4. Click toggle OFF:
   - Service boxes should expand back to full height
   - Lists should expand smoothly
   - OAuth status should reappear (if was visible)
   - Animation should be smooth (0.4s)

## Notes
- The `max-height: 120px` value accounts for:
  - Top padding: 24px
  - Service header height: ~60-70px
  - Bottom padding: 24px
  - Total: ~108-118px (120px provides buffer)
- If the header content changes size, this value may need adjustment