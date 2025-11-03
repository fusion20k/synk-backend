# Troubleshooting Sync Delays - Quick Guide

## If Sync Still Seems Slow

### Step 1: Check the Console Logs
```
1. Run: npm start
2. Press: Ctrl + Shift + I (open DevTools)
3. Look for lines like:
   "⏱️ Sync took 450ms - consider checking API response times"
```

### Step 2: Analyze Sync Duration

**Normal Performance:**
- < 500ms: ✅ Excellent
- 500-1000ms: ✅ Good
- 1000-2000ms: ⚠️ Acceptable but slow
- > 2000ms: ❌ Too slow - investigate

### Step 3: Identify the Bottleneck

If sync takes a long time, it's likely:

#### API Response Time (Most Common)
- **Google Calendar API is slow**
  - Check: Do you have many calendars? (>100 events?)
  - Fix: Consider filtering to fewer events
  - Monitor: https://status.cloud.google.com/

- **Notion API is slow**
  - Check: Do you have large databases? (>500 pages?)
  - Fix: Add filters or pagination limits
  - Monitor: https://status.notion.so/

#### Network Issues
- Run: `ping 8.8.8.8` in terminal
- If high latency (>100ms), network is issue
- Solution: Check ISP, router, or use wired connection

#### Local Machine Performance
- Check Task Manager (Ctrl+Shift+Esc)
- Look for:
  - CPU > 80%: Machine too busy
  - RAM > 90%: Not enough memory
  - Disk > 100%: I/O bottleneck

---

## Quick Diagnostics

### Enable Verbose Logging
Edit `src/syncManager.js` and add before the interval loop:

```javascript
// Add at line 1111, after "const syncStartTime = Date.now();"
const requestTimings = {
  googleStart: null,
  notionStart: null,
  processStart: null
};
```

### Check API Quotas

**Google Calendar:**
```
1. Go to: https://console.cloud.google.com/
2. Select your project
3. APIs & Services → Quotas
4. Search for "Calendar API"
5. Check requests/day and requests/min
```

**Notion:**
```
1. Notion integrations: https://www.notion.so/my-integrations
2. Select your integration
3. Check rate limit info in settings
```

---

## Common Fixes

### Fix 1: Reduce Event Range
Edit `.env`:
```env
# Current: Full year
NOTION_SYNC_DAYS=365

# Try: Last 30 days only
NOTION_SYNC_DAYS=30
```

### Fix 2: Batch Smaller Syncs
Edit `src/syncManager.js` line 320:
```javascript
// Current: Fetch all events at once
const rawGoogleEvents = await googleApi.getCalendarEvents(googleCalendarId, timeMin, timeMax);

// Better: Paginate in chunks
const batchSize = 50;
let rawGoogleEvents = [];
for (let i = 0; i < eventIds.length; i += batchSize) {
  const batch = await googleApi.getCalendarEvents(
    googleCalendarId, 
    timeMin, 
    timeMax,
    { pageSize: batchSize }
  );
  rawGoogleEvents = rawGoogleEvents.concat(batch);
  await sleep(100); // Rate limiting
}
```

### Fix 3: Cache Results
Edit `src/syncManager.js` line 192:
```javascript
// Current: Always fetch fresh
const notionSchema = await notionApi.getDatabaseSchema(notionDatabaseId);

// Better: Cache for 60 seconds
const schemaCacheKey = `schema_${notionDatabaseId}`;
const cachedSchema = this.schemaCache?.[schemaCacheKey];
if (cachedSchema && Date.now() - cachedSchema.timestamp < 60000) {
  const notionSchema = cachedSchema.data;
} else {
  const notionSchema = await notionApi.getDatabaseSchema(notionDatabaseId);
  this.schemaCache[schemaCacheKey] = {
    data: notionSchema,
    timestamp: Date.now()
  };
}
```

---

## Performance Baseline

Expected performance with typical setup:
- **1 Google Calendar + 1 Notion DB:**
  - Sync duration: 200-400ms
  - CPU usage: < 10%
  - Memory: < 50MB

- **5 Google Calendars + 3 Notion DBs:**
  - Sync duration: 800-1500ms
  - CPU usage: 15-25%
  - Memory: 100-150MB

---

## When to Adjust Intervals

If you see consistent delays > 2000ms:

**Option 1: Increase interval to 15 seconds**
Edit `.env`:
```env
SYNC_INTERVAL_ACTIVE=15000  # 15 seconds instead of 7
```

**Option 2: Add exponential backoff**
This is handled automatically, but you can adjust:
Edit `src/syncManager.js` line 162:
```javascript
// Current: Double backoff up to 60 seconds
this.backoffMs = Math.min(this.backoffMs * 2, 60_000);

// Make it more aggressive: 
this.backoffMs = Math.min(this.backoffMs * 1.5, 30_000);
```

---

## Debug Commands

### Check Sync Stats
Open DevTools console and run:
```javascript
// If accessible:
window.electronAPI?.getSyncStats?.()
```

### Force Sync Now
```javascript
window.electronAPI?.forceSync?.()
```

### Check Active Sync Pairs
```javascript
localStorage.getItem('activeSyncPairs')
```

---

## Get Help

If problems persist, collect this info:

1. **Sync logs** (from DevTools console):
   - Copy 20+ lines of sync output
   
2. **System info:**
   - CPU: `wmic cpu get name`
   - RAM: `wmic OS get totalvisiblememorysizem`
   - Network: `ping 8.8.8.8 -t` (show avg latency)

3. **API quotas:**
   - Screenshots of Google Cloud console
   - Screenshots of Notion integration page

4. **Error messages:**
   - Any red errors in console
   - Error details from logs

---

**Last Updated:** 2024
**Version:** 1.0