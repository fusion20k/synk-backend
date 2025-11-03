console.log('[DEBUG] 🚨 syncManager.js LOADED from:', __filename);
console.log('[DEBUG] 🚨 syncManager.js directory:', __dirname);
const Store = require('electron-store');

// Helper function for sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class SyncManager {
  constructor(planManager = null) {
    this.queue = new Set(); // list of sync jobs (unique by pair)
    this.debounceTimer = null;
    this.syncInProgress = false;
    // Use SYNC_INTERVAL from .env, fallback to 5 seconds
    this.pollIntervalMs = parseInt(process.env.SYNC_INTERVAL) || 5000;
    this.backoffMs = 1000;
    this.pollTimer = null;
    this.planManager = planManager; // Store plan manager reference
    
    // Smart sync configuration
    this.intervalActive = parseInt(process.env.SYNC_INTERVAL_ACTIVE) || 5000;      // 5 sec when focused + changes
    this.intervalIdle = parseInt(process.env.SYNC_INTERVAL_IDLE) || 150000;         // 2.5 min when idle
    this.intervalBackground = parseInt(process.env.SYNC_INTERVAL_BACKGROUND) || 120000; // 2 min in background
    this.currentInterval = this.intervalActive;
    
    // Activity tracking for smart syncing
    this.lastSyncHadChanges = false;
    this.lastActivityTime = Date.now();
    this.isWindowFocused = true;
    this.lastSyncTime = 0;
    this.activityTimeout = 60000; // Consider idle if no activity for 60 seconds
    
    // Persistent storage for sync diagnostics
    this.store = new Store({
      name: 'sync-data',
      defaults: {
        lastSyncAt: {},
        syncStats: {
          totalSyncs: 0,
          successfulSyncs: 0,
          failedSyncs: 0
        },
        // Timestamp when a given pair was connected; used to filter events "from now forward"
        // Keyed by `${googleCalendarId}::${notionDatabaseId}` => ISO timestamp string
        connectionTimes: {},
        // Persistent ID mappings to prevent duplicates even without schema properties
        googleToNotionMap: {}, // { '<notionDbId>': { '<googleEventId>': '<notionPageId>' } }
        notionToGoogleMap: {}  // { '<notionDbId>': { '<notionPageId>': '<googleEventId>' } }
      }
    });

    console.log('🔄 SyncManager initialized with smart syncing');
    console.log(`   ⚡ Active interval: ${this.intervalActive}ms | Idle: ${this.intervalIdle}ms | Background: ${this.intervalBackground}ms`);
  }

  // called whenever a user creates/edits/deletes an item locally
  onLocalChange(syncKey) {
    console.log('📝 Local change detected:', syncKey);
    this.queue.add(syncKey);
    this.recordActivity(); // Track activity for smart syncing
    
    // small buffer so rapid multi-changes collapse
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.flushQueue(), 1200); // 1.2s buffer
  }
  
  // Record user activity for smart syncing
  recordActivity() {
    this.lastActivityTime = Date.now();
    this.updateSyncInterval(); // Adjust polling interval immediately
  }
  
  // Set window focus state (called from renderer)
  setWindowFocused(focused) {
    this.isWindowFocused = focused;
    console.log(`🪟 Window focus changed: ${focused ? '✅ FOCUSED' : '❌ BACKGROUND'}`);
    this.updateSyncInterval(); // Adjust interval based on focus
  }
  
  // Record if last sync found changes
  setSyncHadChanges(hadChanges) {
    this.lastSyncHadChanges = hadChanges;
    console.log(`📊 Sync had changes: ${hadChanges ? '✅ YES' : '❌ NO'}`);
    this.updateSyncInterval(); // Adjust interval based on activity level
  }
  
  // Calculate the next sync interval based on current state
  // ✅ FIXED: Always use active interval (7 seconds) regardless of window focus
  calculateNextInterval() {
    // Always sync at the active interval (7 seconds) regardless of window focus
    // This ensures continuous syncing even when app is in background
    return this.intervalActive;
  }
  
  // Update polling interval based on current activity state
  updateSyncInterval() {
    const nextInterval = this.calculateNextInterval();
    
    if (nextInterval !== this.currentInterval) {
      console.log(`🔄 Sync interval changed: ${this.currentInterval}ms → ${nextInterval}ms`);
      console.log(`   State: Focused=${this.isWindowFocused} | Changes=${this.lastSyncHadChanges} | Idle=${Date.now() - this.lastActivityTime > this.activityTimeout}`);
      
      this.currentInterval = nextInterval;
      
      // Restart polling with new interval
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.startPeriodicPoll(); // Restart with new interval
      }
    }
  }

  // flush queue and run sync worker
  async flushQueue() {
    if (this.syncInProgress || this.queue.size === 0) return;
    
    console.log(`🚀 Starting sync batch with ${this.queue.size} jobs`);
    this.syncInProgress = true;
    const jobs = Array.from(this.queue);
    this.queue.clear();
    
    try {
      for (const job of jobs) {
        await this.performSync(job); // implement actual sync logic
      }
      this.backoffMs = 1000; // reset backoff on success
      
      // Update success stats
      const stats = this.store.get('syncStats');
      stats.successfulSyncs += jobs.length;
      stats.totalSyncs += jobs.length;
      this.store.set('syncStats', stats);
      
      console.log('✅ Sync batch completed successfully');
      
    } catch (err) {
      console.error('❌ Sync failed', err);
      
      // push failed jobs back in queue
      jobs.forEach(j => this.queue.add(j));
      
      // Update failure stats
      const stats = this.store.get('syncStats');
      stats.failedSyncs += jobs.length;
      stats.totalSyncs += jobs.length;
      this.store.set('syncStats', stats);
      
      // exponential backoff before next attempt
      console.log(`⏳ Backing off for ${this.backoffMs}ms before retry`);
      await sleep(this.backoffMs);
      this.backoffMs = Math.min(this.backoffMs * 2, 60_000);
      
    } finally {
      this.syncInProgress = false;
    }
  }

  async performSync(job) {
    console.log('🔄 Performing sync for job:', job);
    
    try {
      if (job === 'full-poll') {
        // Full sync - check for remote changes
        await this.performFullSync();
      } else {
        // Individual sync job
        await this.performIndividualSync(job);
      }
      
      // Update lastSyncAt for this job
      const lastSyncData = this.store.get('lastSyncAt');
      lastSyncData[job] = new Date().toISOString();
      this.store.set('lastSyncAt', lastSyncData);
      
    } catch (error) {
      console.error(`❌ Sync failed for job ${job}:`, error.message);
      throw error; // Re-throw to trigger backoff logic
    }
  }

    async performFullSync() {
    console.log('🔄 Performing full sync (checking remote changes)');
    
    try {
      // Get all active sync pairs from storage
      let activeSyncPairs = this.store.get('activeSyncPairs', []);
      
      if (activeSyncPairs.length === 0) {
        console.log('📭 No active sync pairs configured');
        return;
      }
      
      // ✅ SAFETY VALIDATION: Ensure all pairs have required fields
      const validatedPairs = activeSyncPairs.filter(pair => {
        const googleId = pair.google || pair.googleCalendarId;
        const notionId = pair.notion || pair.notionDatabaseId;
        
        if (!googleId || !notionId) {
          console.warn(`[performFullSync] ⚠️ Skipping invalid pair:`, pair);
          return false;
        }
        return true;
      });
      
      if (validatedPairs.length === 0) {
        console.error('❌ [performFullSync] No valid sync pairs after validation');
        return;
      }
      
      if (validatedPairs.length < activeSyncPairs.length) {
        console.warn(`[performFullSync] ⚠️ Filtered from ${activeSyncPairs.length} to ${validatedPairs.length} valid pairs`);
        // Update store with validated pairs
        this.store.set('activeSyncPairs', validatedPairs);
      }
      
      // Check sync_all_calendars setting
      const userSettings = require('./userSettings');
      const syncAllCalendars = userSettings.shouldSyncAllCalendars();
      
      if (!syncAllCalendars) {
        // Filter to only sync selected calendars (pairs that were explicitly added)
        console.log('🎯 Sync All Calendars is OFF - syncing only selected calendars');
        // validatedPairs already contains only selected pairs, so no filtering needed
      } else {
        console.log('🌐 Sync All Calendars is ON - syncing all calendars');
        // Future: could fetch all available calendars and sync them all
      }
      
      for (const pair of validatedPairs) {
        const googleId = pair.google || pair.googleCalendarId;
        const notionId = pair.notion || pair.notionDatabaseId;
        await this.syncPair(googleId, notionId);
      }
      
      console.log('✅ Full sync completed successfully');
    } catch (error) {
      console.error('❌ Full sync failed:', error);
      throw error;
    }
  }


  async performIndividualSync(syncKey) {
    console.log('🔄 Performing individual sync for:', syncKey);
    try {
      // Accept either a normalized key string or an object
      let googleCalendarId, notionDatabaseId;
      if (typeof syncKey === 'string') {
        // Safe split on the last hyphen to handle IDs containing hyphens
        const lastDash = syncKey.lastIndexOf('-');
        if (lastDash > 0) {
          googleCalendarId = syncKey.slice(0, lastDash);
          notionDatabaseId = syncKey.slice(lastDash + 1);
        }
      } else if (syncKey && typeof syncKey === 'object') {
        googleCalendarId = syncKey.google || syncKey.googleCalendarId;
        notionDatabaseId = syncKey.notion || syncKey.notionDatabaseId;
      }

      if (!googleCalendarId || !notionDatabaseId) {
        throw new Error(`Invalid sync key: ${JSON.stringify(syncKey)}`);
      }

      await this.syncPair(googleCalendarId, notionDatabaseId);
      console.log(`✅ Individual sync completed: ${googleCalendarId}-${notionDatabaseId}`);
    } catch (error) {
      console.error(`❌ Individual sync failed for ${syncKey}:`, error);
      throw error;
    }
  }

  // Lines 173-310 in syncManager.js
async syncPair(googleCalendarId, notionDatabaseId) {
    console.log(`🔄 Syncing ${googleCalendarId} ↔ ${notionDatabaseId}`);
    console.log(`[DEBUG] 🎯 syncPair called with calendarId: ${googleCalendarId}`);
    
    const googleApi = require('./google');
    const notionApi = require('./notion');

    // Track IDs created during this sync to prevent false deletions AND DUPLICATE LOOPS
    this._createdGoogleIdsThisRun = [];
    this._createdNotionIdsThisRun = [];
    this._notionPagesSyncedToGoogleThisRun = new Set(); // Track Notion pages we just synced TO Google
    this._googleEventsSyncedFromNotionThisRun = new Set(); // Track Google events just created from Notion pages
    this._pairBeingSynced = `${googleCalendarId}::${notionDatabaseId}`; // Track which pair is being synced
    
    try {
      // 'Sync From Now Forward' timeframe based on connection time for this pair
      const pairKey = `${googleCalendarId}::${notionDatabaseId}`;
      const connectionTimes = this.store.get('connectionTimes', {}) || {};
      const isFirstSync = !connectionTimes[pairKey];
      
      if (isFirstSync) {
        // On first sync, include items from far past (to sync existing data)
        connectionTimes[pairKey] = new Date('2020-01-01').toISOString();
        this.store.set('connectionTimes', connectionTimes);
        console.log(`[syncPair] 🆕 First sync detected - will include existing data from 2020 onwards`);
      }
      
      const connectionTimeIso = connectionTimes[pairKey];
      const connectionTime = new Date(connectionTimeIso);
      const timeMin = connectionTime.toISOString();
      const timeMax = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      
      console.log(`[syncPair] ⏰ Using connectionTime: ${connectionTime.toISOString()} (isFirstSync=${isFirstSync})`);
      
      // Fetch schema first, then pages and Google events in parallel
      const notionSchema = await notionApi.getDatabaseSchema(notionDatabaseId);
      const [rawGoogleEvents, rawNotionPages] = await Promise.all([
        googleApi.getCalendarEvents(googleCalendarId, timeMin, timeMax),
        notionApi.getDatabasePages(notionDatabaseId)
      ]);
      
      // Get user's plan to determine filtering rules
      const userPlan = this.planManager ? this.planManager.getCurrentPlan() : { type: 'ultimate' };
      const isPro = userPlan.type === 'pro' || userPlan.type === 'trial';
      const isUltimate = userPlan.type === 'ultimate';
      
      // Filter by created/updated >= connection time
      let googleEvents = (rawGoogleEvents || []).filter(e => {
        const updated = e.updated ? new Date(e.updated) : null;
        const created = e.created ? new Date(e.created) : null;
        return (updated && updated >= connectionTime) || (created && created >= connectionTime);
      });
      
      // CRITICAL PRIVACY FIX: ONLY sync events from the explicitly selected calendar
      // The Google Calendar API already returns only events from the requested calendar,
      // so we trust that. We only filter to catch shared/delegated calendar edge cases.
      console.log(`[CALENDAR FILTER] Processing Google events from calendar: ${googleCalendarId}`);
      const initialGoogleEventCount = googleEvents.length;
      
      // Note: Google Calendar API's events endpoint already filters by calendar.
      // We don't need to filter by organizer since the API did that for us.
      // Filtering by organizer would incorrectly remove:
      // - Events you've been invited to (you're attendee, not organizer)
      // - Shared calendar events from other calendars delegated to you
      // - Events from group calendars
      
      // Keep all events - they're already from the requested calendar per API contract
      console.log(`[CALENDAR FILTER] Keeping all ${googleEvents.length} events from ${googleCalendarId}`);
      
      // Find the date and title properties in Notion database FIRST
      const dateProperty = this.findDateProperty(notionSchema.properties);
      const titleProperty = this.findTitleProperty(notionSchema.properties);
      
      console.log(`[Filter] Raw: ${(rawNotionPages || []).length} Notion pages fetched`);
      const notionPages = (rawNotionPages || []).filter(p => {
        const edited = p.last_edited_time ? new Date(p.last_edited_time) : null;
        const created = p.created_time ? new Date(p.created_time) : null;
        const included = (edited && edited >= connectionTime) || (created && created >= connectionTime);
        
        if (!included && p.id) {
          const title = p.properties?.Name?.title?.[0]?.plain_text || p.properties?.Title?.title?.[0]?.plain_text || 'Untitled';
            console.log(`[NOTION TIME FILTER] ⏰ Excluding: "${title}" - created=${created?.toISOString()}, edited=${edited?.toISOString()}, connectionTime=${connectionTime.toISOString()}`);
        }
        return included;
      });
      
      console.log(`📊 Sync data (filtered): ${googleEvents.length} Google events, ${notionPages.length} Notion pages`);
      
      // DEBUG: Show details about pages that passed the filter
      if (notionPages.length > 0) {
        console.log(`[NOTION PAGES PASSED FILTER] ${notionPages.length} pages to process:`);
        notionPages.forEach((p, i) => {
          const title = this.extractNotionTitle(p.properties) || this.extractTitleBySchema(p.properties);
          const dateValue = p.properties[dateProperty]?.date;
            console.log(`  [${i+1}] title="${title}", hasDate=${!!dateValue}, dateProperty="${dateProperty}"`);
        });
      } else {
        console.log(`[NOTION PAGES PASSED FILTER] 0 pages - checking why...`);
        if ((rawNotionPages || []).length > 0) {
            console.log(`[DEBUG] Raw Notion pages but all filtered by time. First page:`, JSON.stringify((rawNotionPages || [])[0], null, 2).slice(0, 500));
        }
      }
      if (!dateProperty) {
        throw new Error('No date property found in Notion database');
      }
      
      // ⚠️ CRITICAL: Sync Notion→Google FIRST to prevent duplicate loop
      // This ensures that when Google→Notion runs, it can properly deduplicate
      console.log(`🔄 [SYNC ORDER] 1️⃣ Starting Notion→Google sync...`);
      await this.syncNotionToGoogle(
        notionPages,
        googleEvents,
        googleCalendarId,
        dateProperty,
        titleProperty,
        notionDatabaseId,
        notionSchema
      );

      // ⚠️ CRITICAL: Re-fetch Google events after creating new ones
      // This ensures Google→Notion sees the newly created events with proper metadata
      console.log(`🔄 [SYNC ORDER] 🔄 Re-fetching Google events to capture newly created ones...`);
      const updatedGoogleEvents = await require('./google').getCalendarEvents(googleCalendarId, timeMin, timeMax);
      const filteredUpdatedGoogleEvents = updatedGoogleEvents.filter(event => {
        // Apply same time filter as before
        const updated = event.updated ? new Date(event.updated) : null;
        const created = event.created ? new Date(event.created) : null;
        return (updated && updated >= connectionTime) || (created && created >= connectionTime);
      });
      
      // Keep all events - they're already from the requested calendar per API contract
      let googleEventsForN2G = filteredUpdatedGoogleEvents;

      // 🔥 CRITICAL FIX: Re-fetch Notion pages after creating new ones
      // This ensures the deduplication logic can find newly created pages
      console.log(`🔄 [SYNC ORDER] 🔄 Re-fetching Notion pages to capture newly created ones...`);
      const updatedRawNotionPages = await notionApi.getDatabasePages(notionDatabaseId);
      let updatedNotionPages = (updatedRawNotionPages || []).filter(p => {
        const edited = p.last_edited_time ? new Date(p.last_edited_time) : null;
        const created = p.created_time ? new Date(p.created_time) : null;
        return (edited && edited >= connectionTime) || (created && created >= connectionTime);
      });
      console.log(`[SYNC ORDER] Re-fetched Notion pages: ${updatedNotionPages.length} pages (was ${notionPages.length})`);

      // 2️⃣ Now sync Google→Notion with the updated events AND pages lists
      console.log(`🔄 [SYNC ORDER] 2️⃣ Starting Google→Notion sync...`);
      await this.syncGoogleToNotion(googleEventsForN2G, updatedNotionPages, notionDatabaseId, googleCalendarId, dateProperty, titleProperty, notionSchema);

      // Reconcile deletions in both directions using persistent maps
      await this.deleteReconcile(
        googleEventsForN2G,
        updatedNotionPages,
        googleCalendarId,
        notionDatabaseId,
        dateProperty,
        timeMax
      );
      
      console.log(`✅ Sync pair completed: ${googleCalendarId} ↔ ${notionDatabaseId}`);
      
      // Update sync statistics
      this.updateSyncStats(`${googleCalendarId}-${notionDatabaseId}`, true);
    } catch (error) {
      console.error(`❌ Sync pair failed: ${googleCalendarId} ↔ ${notionDatabaseId}`, error);
      this.updateSyncStats(`${googleCalendarId}-${notionDatabaseId}`, false);
      throw error;
    }
  }


  findDateProperty(properties) {
    // Find the first date property in the Notion database
    for (const [name, property] of Object.entries(properties)) {
      if (property.type === 'date') {
        return name;
      }
    }
    return null;
  }

  findTitleProperty(properties) {
    // Find the title property name from the Notion database schema
    for (const [name, property] of Object.entries(properties)) {
      if (property.type === 'title') {
        return name;
      }
    }
    return null;
  }

  // Helper: Find an existing Google event that matches a Notion page's content
  findMatchingGoogleEventByContent(notionPage, googleEvents, dateProperty, titleProperty) {
    // Extract Notion page details
    const notionTitle = this.extractNotionTitle(notionPage.properties) || this.extractTitleBySchema(notionPage.properties);
    const notionDate = notionPage.properties[dateProperty]?.date?.start;
    const notionDesc = notionPage.properties['Description']?.rich_text?.[0]?.plain_text?.trim() || '';
    
    if (!notionTitle || !notionDate) return null;

    // Search for a matching Google event
    for (const googleEvent of googleEvents) {
      // Must match: title AND date
      if (googleEvent.summary === notionTitle && 
          (googleEvent.start.dateTime || googleEvent.start.date) === notionDate) {
        
        // Optional: also compare description/notes for extra confidence
        const googleDesc = googleEvent.description?.trim() || '';
        const descMatch = !notionDesc || googleDesc.includes(notionDesc) || notionDesc.includes(googleDesc);
        
        // If description exists on both, they must match or one must contain the other
        if (notionDesc && !descMatch) {
          continue; // Skip if descriptions don't align
        }
        
        console.log(`[DEDUP] Found matching Google event by content: "${notionTitle}" (date: ${notionDate})`);
        return googleEvent;
      }
    }
    return null;
  }

  // Helper: Find an existing Notion page that matches a Google event's content
  findMatchingNotionPageByContent(googleEvent, notionPages, dateProperty, titleProperty) {
    // Extract Google event details
    const googleTitle = googleEvent.summary;
    const googleDate = googleEvent.start.dateTime || googleEvent.start.date;
    const googleDesc = googleEvent.description?.trim() || '';
    
    console.log(`[DEDUP] Searching for content match: title="${googleTitle}", date="${googleDate}"`);
    
    if (!googleTitle || !googleDate) {
      console.log(`[DEDUP] ❌ Skipping - missing title or date`);
      return null;
    }

    // Search for a matching Notion page
    for (const page of notionPages) {
      // Extract page details
      const pageTitle = this.extractNotionTitle(page.properties) || this.extractTitleBySchema(page.properties);
      const pageDate = page.properties[dateProperty]?.date?.start;
      const pageDesc = page.properties['Description']?.rich_text?.[0]?.plain_text?.trim() || '';
      
      if (!pageTitle || !pageDate) {
        console.log(`[DEDUP]   ⏭️ Skipping page - missing title="${pageTitle}" or date="${pageDate}"`);
        continue;
      }
      
      // Must match: title AND date
      if (pageTitle === googleTitle && pageDate === googleDate) {
        console.log(`[DEDUP]   ✅ Title+date match: "${pageTitle}" / "${pageDate}"`);
        
        // Optional: also compare description/notes for extra confidence
        const descMatch = !googleDesc || pageDesc.includes(googleDesc) || googleDesc.includes(pageDesc);
        
        // If description exists on both, they must match or one must contain the other
        if (googleDesc && !descMatch) {
          console.log(`[DEDUP]   ⚠️ Desc mismatch: Google has "${googleDesc.substring(0, 50)}..." but page has "${pageDesc.substring(0, 50)}..."`);
          continue; // Skip if descriptions don't align
        }
        
        console.log(`[DEDUP] ✅ Found matching Notion page by content: "${googleTitle}" (date: ${googleDate})`);
        return page;
      } else {
        console.log(`[DEDUP]   ⏭️ No match: page="${pageTitle}"|"${pageDate}" vs google="${googleTitle}"|"${googleDate}"`);
      }
    }
    console.log(`[DEDUP] ❌ No content match found after checking ${notionPages.length} pages`);
    return null;
  }

  async syncGoogleToNotion(googleEvents, notionPages, notionDatabaseId, googleCalendarId, dateProperty, titleProperty, notionSchema) {
    const notionApi = require('./notion');

    // Build multiple lookup maps for duplicate prevention
    const pagesByGoogleId = new Map();
    const pagesByTitleAndDate = new Map();
    
    for (const page of notionPages) {
      // Map 1: By Google Event ID property
      const gid = page.properties['Google Event ID']?.rich_text?.[0]?.plain_text?.trim();
      if (gid) pagesByGoogleId.set(gid, page);
      
      // Map 2: By title + date (for fallback matching)
      const title = this.extractNotionTitle(page.properties) || this.extractTitleBySchema(page.properties);
      const dateValue = page.properties[dateProperty]?.date?.start;
      if (title && dateValue) {
        pagesByTitleAndDate.set(`${title}|${dateValue}`, page);
      }
    }

    console.log(`[syncGoogleToNotion] 🔍 Duplicate prevention: ${pagesByGoogleId.size} by Google Event ID, ${pagesByTitleAndDate.size} by title+date`);
    console.log(`[syncGoogleToNotion] 📋 Title+date map contents:`, Array.from(pagesByTitleAndDate.keys()));
    console.log(`[syncGoogleToNotion] 🆔 Google ID map size:`, pagesByGoogleId.size);

    for (const event of googleEvents) {
      try {
        console.log(`[syncGoogleToNotion] 📊 Processing event: "${event.summary}" (ID: ${event.id}, date: ${event.start?.dateTime || event.start?.date})`);
        
        // ⚠️ CRITICAL: Skip events that were JUST created from Notion pages in THIS sync run
        // This is the PRIMARY defense against duplicate creation
        if (this._googleEventsSyncedFromNotionThisRun?.has(event.id)) {
            console.log(`[syncGoogleToNotion] 🛡️ DUPLICATE PREVENTION: Skipping Google event ${event.id} - it was just created from a Notion page in this sync run`);
          continue;
        }

        // Skip events without start time or that are cancelled
        if (!event.start || event.status === 'cancelled') {
            console.log(`[syncGoogleToNotion] ⏭️ Skipping cancelled/incomplete: ${event.summary}`);
          continue;
        }

        let existingPage = null;

        // 1) Try by Google Event ID property (primary method)
        existingPage = pagesByGoogleId.get(event.id);
        if (existingPage) {
            console.log(`[syncGoogleToNotion] 🔗 Found by Google Event ID: ${event.id}`);
          
          // ⚠️ CRITICAL: Skip this page if we just synced it FROM Notion to Google
          // This prevents the duplicate loop where we create a Google event from a Notion page,
          // then immediately create a duplicate Notion page from that Google event
          if (this._notionPagesSyncedToGoogleThisRun?.has(existingPage.id)) {
            console.log(`[syncGoogleToNotion] ⚠️ BLOCKING DUPLICATE: This Google event (${event.id}) was just created from Notion page ${existingPage.id} - skipping re-sync`);
            continue;
          }
        }

        // 2) If not found by ID, try persistent map
        if (!existingPage) {
            const googleToNotionMap = this.store.get('googleToNotionMap', {});
          // CRITICAL FIX: Use composite key to support multiple calendars syncing to same database
          const mapKey = `${googleCalendarId}::${notionDatabaseId}`;
          const pairMap = googleToNotionMap[mapKey] || {};
          const mappedPageId = pairMap[event.id];
          if (mappedPageId) {
            existingPage = notionPages.find(p => p.id === mappedPageId) || null;
            if (existingPage) {
              console.log(`[syncGoogleToNotion] 🔗 Found by persistent map: ${event.id} → ${mappedPageId}`);
              
              // ⚠️ CRITICAL: Skip this page if we just synced it FROM Notion to Google
              if (this._notionPagesSyncedToGoogleThisRun?.has(existingPage.id)) {
                console.log(`[syncGoogleToNotion] ⚠️ BLOCKING DUPLICATE: This page was just synced to Google - skipping`);
                continue;
              }
            } else {
              console.log(`[syncGoogleToNotion] ⏭️ Skipping - mapped page ${mappedPageId} not in fetch`);
              continue;
            }
          }
        }

        // 3) Fallback: match by title + date
        if (!existingPage && event.summary) {
          const eventDate = event.start.dateTime || event.start.date;
          const lookupKey = `${event.summary}|${eventDate}`;
          console.log(`[syncGoogleToNotion] 🔍 Trying title+date lookup: "${lookupKey}"`);
          existingPage = pagesByTitleAndDate.get(lookupKey);
          if (existingPage) {
            console.log(`[syncGoogleToNotion] 🔗 Found by title+date: ${event.summary}`);
            
            // ⚠️ CRITICAL: Skip this page if we just synced it FROM Notion to Google
            if (this._notionPagesSyncedToGoogleThisRun?.has(existingPage.id)) {
              console.log(`[syncGoogleToNotion] ⚠️ BLOCKING DUPLICATE: This page was just synced to Google - skipping`);
              continue;
            }
          } else {
            console.log(`[syncGoogleToNotion] ⚠️ Title+date NOT found in map. Available keys:`, Array.from(pagesByTitleAndDate.keys()).slice(0, 5));
          }
        }

        const eventProperties = this.convertGoogleEventToNotionProperties(event, dateProperty, titleProperty, notionSchema);

        if (existingPage) {
          // Update existing page if Google event is newer
          const googleUpdated = new Date(event.updated);
          const notionUpdated = new Date(existingPage.last_edited_time);
          if (googleUpdated > notionUpdated) {
            await notionApi.updateDatabasePage(existingPage.id, eventProperties);
            console.log(`📝 Updated Notion page for event: ${event.summary}`);
          }
        } else {
          // ⚠️ SMART DEDUP: Before creating, check if a matching page exists by content (title + date + description)
          console.log(`[syncGoogleToNotion] 🎯 No direct match found - trying SMART DEDUP by content...`);
          console.log(`[syncGoogleToNotion] 📄 Checking ${notionPages.length} Notion pages for content match...`);
          const contentMatch = this.findMatchingNotionPageByContent(event, notionPages, dateProperty, titleProperty);
          
          if (contentMatch) {
            // Found a matching page by content - this is a duplicate, update instead
            console.log(`🔄 [SMART DEDUP] Found existing Notion page by content match - updating instead of creating duplicate`);
            await notionApi.updateDatabasePage(contentMatch.id, eventProperties);
            
            // Record the mapping
            const googleToNotionMap = this.store.get('googleToNotionMap', {});
            const notionToGoogleMap = this.store.get('notionToGoogleMap', {});
            // CRITICAL FIX: Use composite key to support multiple calendars syncing to same database
            const mapKey = `${googleCalendarId}::${notionDatabaseId}`;
            googleToNotionMap[mapKey] = googleToNotionMap[mapKey] || {};
            notionToGoogleMap[mapKey] = notionToGoogleMap[mapKey] || {};
            googleToNotionMap[mapKey][event.id] = contentMatch.id;
            notionToGoogleMap[mapKey][contentMatch.id] = event.id;
            this.store.set('googleToNotionMap', googleToNotionMap);
            this.store.set('notionToGoogleMap', notionToGoogleMap);
          } else {
            // Create new page and record mapping
            console.log(`[syncGoogleToNotion] ⚠️ 🚨 CREATING DUPLICATE NOTION PAGE - No match found for: "${event.summary}" (${event.id})`);
            console.log(`[syncGoogleToNotion]    Event date: ${event.start?.dateTime || event.start?.date}`);
            console.log(`[syncGoogleToNotion]    Available pages in this run: ${notionPages.length}`);
            const created = await notionApi.createDatabasePage(notionDatabaseId, eventProperties);
            // Record mapping in store so subsequent polls don't create duplicates
            const googleToNotionMap = this.store.get('googleToNotionMap', {});
            const notionToGoogleMap = this.store.get('notionToGoogleMap', {});
            // We don’t reliably have calendarId on list items; key by DB only is sufficient within selected pair
            // CRITICAL FIX: Use composite key to support multiple calendars syncing to same database
            const mapKey = `${googleCalendarId}::${notionDatabaseId}`;
            googleToNotionMap[mapKey] = googleToNotionMap[mapKey] || {};
            notionToGoogleMap[mapKey] = notionToGoogleMap[mapKey] || {};
            googleToNotionMap[mapKey][event.id] = created.id;
            notionToGoogleMap[mapKey][created.id] = event.id;
            this.store.set('googleToNotionMap', googleToNotionMap);
            this.store.set('notionToGoogleMap', notionToGoogleMap);
            // Track created IDs in this run to avoid false deletion
            this._createdNotionIdsThisRun.push(created.id);
            console.log(`➕ Created Notion page for event: ${event.summary}`);
          }
        }
      } catch (error) {
        console.error(`❌ Failed to sync Google event ${event.id}:`, error);
      }
    }
  }

  async syncNotionToGoogle(
    notionPages,
    googleEvents,
    googleCalendarId,
    dateProperty,
    titleProperty,
    notionDatabaseId,
    notionSchema
  ) {
    const googleApi = require('./google');
    const notionApi = require('./notion');

    console.log(`[syncNotionToGoogle] 🔍 Starting sync with ${notionPages.length} Notion pages, ${googleEvents.length} Google events`);
    
    // Build lookup map of Google events by title + date for fallback matching
    const eventsByTitleAndDate = new Map();
    // Also track ALL events by title+date (not just the last one) for better duplicate detection
    const eventsByTitleAndDateList = new Map();
    for (const event of googleEvents) {
      if (event.summary) {
        const eventDate = event.start.dateTime || event.start.date;
        const key = `${event.summary}|${eventDate}`;
        eventsByTitleAndDate.set(key, event); // Keep last one for easy lookup
        
        // Also track all events with this title+date
        if (!eventsByTitleAndDateList.has(key)) {
          eventsByTitleAndDateList.set(key, []);
        }
        eventsByTitleAndDateList.get(key).push(event);
      }
    }
    
    for (const page of notionPages) {
      try {
        // Skip pages without date or title
        const dateValue = page.properties[dateProperty]?.date;
        
        // ⚠️ CRITICAL: Use the titleProperty from schema if available, don't guess it
        let title = null;
        if (titleProperty && page.properties[titleProperty]) {
          const titleProp = page.properties[titleProperty];
          if (titleProp?.title?.[0]?.plain_text) {
            title = titleProp.title[0].plain_text;
          } else if (titleProp?.rich_text?.[0]?.plain_text) {
            title = titleProp.rich_text[0].plain_text;
          }
        }
        
        // Fall back to guessing if titleProperty method didn't work
        if (!title) {
          title = this.extractNotionTitle(page.properties) || this.extractTitleBySchema(page.properties);
        }
        
        if (!dateValue || !title) {
            console.log(`[syncNotionToGoogle] ⏭️ Skipping page: title="${title || 'MISSING'}", hasDate=${!!dateValue}, titleProperty="${titleProperty}"`);
          continue;
        }
        
        console.log(`[syncNotionToGoogle] 📄 Processing page: "${title}" (date: ${dateValue?.start}, titleProperty: "${titleProperty}")`);

        // Prefer exact match by Google Event ID on the Notion page
        const googleEventIdProp = page.properties['Google Event ID']?.rich_text?.[0]?.plain_text?.trim();
        let existingEvent = null;

        // 1) Try by stored Google Event ID property
        if (googleEventIdProp) {
          existingEvent = googleEvents.find(e => e.id === googleEventIdProp) || null;
          if (existingEvent) {
            console.log(`[syncNotionToGoogle] 🔗 Found by Google Event ID property: ${googleEventIdProp}`);
          }
        }

        // 2) Try by persistent mapping
        if (!existingEvent) {
          const n2gAll = this.store.get('notionToGoogleMap', {}) || {};
          // 🔥 CRITICAL FIX: Use composite key to match Google→Notion mapping structure
          const mapKey = `${googleCalendarId}::${notionDatabaseId}`;
          const n2g = n2gAll[mapKey] || {};
          const mappedGoogleId = n2g[page.id];
          if (mappedGoogleId) {
            existingEvent = googleEvents.find(e => e.id === mappedGoogleId) || null;
            if (existingEvent) {
              console.log(`[syncNotionToGoogle] 🔗 Found by persistent map: ${page.id} → ${mappedGoogleId}`);
            } else {
              console.log(`[syncNotionToGoogle] ⏭️ Skipping - mapped event ${mappedGoogleId} not in current fetch`);
              continue;
            }
          }
        }

        // 3) Fallback: match by title + date
        if (!existingEvent) {
          existingEvent = eventsByTitleAndDate.get(`${title}|${dateValue.start}`) || null;
          if (existingEvent) {
            console.log(`[syncNotionToGoogle] 🔗 Found by title+date fallback`);
          }
        }

        // 4) Last resort: match by Notion page ID in description (legacy)
        if (!existingEvent) {
          existingEvent = googleEvents.find(e => e.description && e.description.includes(page.id)) || null;
          if (existingEvent) {
            console.log(`[syncNotionToGoogle] 🔗 Found by description fallback`);
          }
        }

        const eventData = this.convertNotionPageToGoogleEvent(page, dateProperty, title);

        if (existingEvent) {
          // Update existing event if Notion page is newer
          const notionUpdated = new Date(page.last_edited_time);
          const googleUpdated = new Date(existingEvent.updated);
          if (notionUpdated > googleUpdated) {
            await googleApi.updateCalendarEvent(googleCalendarId, existingEvent.id, eventData);
            console.log(`✏️ Updated Google event: ${title}`);
          } else {
            console.log(`⏭️ Skipping update - Google event is newer: ${title}`);
          }
          // Mark this page as synced to prevent re-sync in Google→Notion
          this._notionPagesSyncedToGoogleThisRun.add(page.id);
        } else {
          // ⚠️ SMART DEDUP: Before creating, check if a matching event exists by content (title + date + description)
          const contentMatch = this.findMatchingGoogleEventByContent(page, googleEvents, dateProperty, titleProperty);
          
          if (contentMatch) {
            // Found a matching event by content - this is a duplicate, update instead
            console.log(`🔄 [SMART DEDUP] Found existing Google event by content match - updating instead of creating duplicate`);
            await googleApi.updateCalendarEvent(googleCalendarId, contentMatch.id, eventData);
            
            // Record the mapping with composite key
            const googleToNotionMap = this.store.get('googleToNotionMap', {});
            const notionToGoogleMap = this.store.get('notionToGoogleMap', {});
            // 🔥 CRITICAL FIX: Use composite key to match Google→Notion mapping structure
            const mapKey = `${googleCalendarId}::${notionDatabaseId}`;
            googleToNotionMap[mapKey] = googleToNotionMap[mapKey] || {};
            notionToGoogleMap[mapKey] = notionToGoogleMap[mapKey] || {};
            googleToNotionMap[mapKey][contentMatch.id] = page.id;
            notionToGoogleMap[mapKey][page.id] = contentMatch.id;
            this.store.set('googleToNotionMap', googleToNotionMap);
            this.store.set('notionToGoogleMap', notionToGoogleMap);
            
            this._notionPagesSyncedToGoogleThisRun.add(page.id);
          } else {
            // Create new Google event
            console.log(`✨ Creating new Google event: ${title}`);
            const created = await googleApi.createCalendarEvent(googleCalendarId, eventData);
            
            // Write back the actual Google ID if schema supports it
            if (notionSchema?.properties?.['Google Event ID']?.type === 'rich_text') {
              await notionApi.updateDatabasePage(page.id, {
                'Google Event ID': { rich_text: [{ text: { content: created.id } }] }
              });
            }
            
            // Persist bidirectional mapping for future syncs with composite key
            const googleToNotionMap = this.store.get('googleToNotionMap', {});
            const notionToGoogleMap = this.store.get('notionToGoogleMap', {});
            // 🔥 CRITICAL FIX: Use composite key to match Google→Notion mapping structure
            const mapKey = `${googleCalendarId}::${notionDatabaseId}`;
            googleToNotionMap[mapKey] = googleToNotionMap[mapKey] || {};
            notionToGoogleMap[mapKey] = notionToGoogleMap[mapKey] || {};
            googleToNotionMap[mapKey][created.id] = page.id;
            notionToGoogleMap[mapKey][page.id] = created.id;
            this.store.set('googleToNotionMap', googleToNotionMap);
            this.store.set('notionToGoogleMap', notionToGoogleMap);
            
            this._createdGoogleIdsThisRun.push(created.id);
            // ⚠️ CRITICAL: Mark this page as synced to prevent Google→Notion from creating a duplicate!
            this._notionPagesSyncedToGoogleThisRun.add(page.id);
            // Also track the Google event ID so we can identify it when it syncs back
            this._googleEventsSyncedFromNotionThisRun.add(created.id);
            console.log(`➕ Created Google event: ${title} (mapped ${page.id} → ${created.id})\n[DUPLICATE PREVENTION] Marked Notion page ${page.id} and Google event ${created.id} as synced this run`);
          }
        }
      } catch (error) {
        console.error(`❌ Failed to sync Notion page ${page.id}:`, error);
      }
    }
  }

  convertGoogleEventToNotionProperties(event, dateProperty, titleProperty, notionSchema) {
    const properties = {};
    
    // Title (use the actual title property from schema)
    if (event.summary && titleProperty) {
      properties[titleProperty] = {
        title: [{ text: { content: event.summary } }]
      };
    }
    
    // Date
    if (event.start) {
      const startDate = event.start.dateTime || event.start.date;
      const endDate = event.end?.dateTime || event.end?.date;
      
      properties[dateProperty] = {
        date: {
          start: startDate,
          end: endDate || startDate
        }
      };
    }
    
    // Description (only if property exists in schema)
    if (event.description && notionSchema?.properties?.['Description']?.type === 'rich_text') {
      properties['Description'] = {
        rich_text: [{ text: { content: event.description } }]
      };
    }
    
    // Google Event ID for tracking (only if property exists)
    if (notionSchema?.properties?.['Google Event ID']?.type === 'rich_text') {
      properties['Google Event ID'] = {
        rich_text: [{ text: { content: event.id } }]
      };
    }
    
    return properties;
  }

  convertNotionPageToGoogleEvent(page, dateProperty, title) {
    const dateValue = page.properties[dateProperty]?.date;

    // Extract user-entered description from Notion if present
    let userDescription = '';
    const descProp = page.properties?.['Description'];
    if (descProp?.rich_text?.length) {
      userDescription = descProp.rich_text.map(rt => rt.plain_text || '').join('');
    }
    const metadata = `Synced from Notion\nPage ID: ${page.id}\nPage URL: ${page.url}`;

    const event = {
      summary: title || 'Untitled',
      description: userDescription ? `${userDescription}\n\n${metadata}` : metadata,
    };
    
    if (dateValue) {
      if (dateValue.start.includes('T')) {
        // DateTime event
        event.start = { dateTime: dateValue.start };
        event.end = { dateTime: dateValue.end || dateValue.start };
      } else {
        // All-day event
        event.start = { date: dateValue.start };
        event.end = { date: dateValue.end || dateValue.start };
      }
    }
    
    return event;
  }

  extractNotionTitle(properties) {
    // Try common title property names
    const titleProps = ['Name', 'Title', 'Task', 'Event'];
    
    for (const propName of titleProps) {
      const prop = properties[propName];
      if (prop?.title?.[0]?.plain_text) {
        return prop.title[0].plain_text;
      }
      if (prop?.rich_text?.[0]?.plain_text) {
        return prop.rich_text[0].plain_text;
      }
    }
    
    // Fallback: detect the title property dynamically
    for (const [key, prop] of Object.entries(properties)) {
      if (prop?.title?.length) {
        return prop.title[0]?.plain_text || 'Untitled';
      }
    }
    
    return 'Untitled';
  }

  extractTitleBySchema(properties) {
    for (const [key, prop] of Object.entries(properties)) {
      if (prop?.title?.length) {
        return prop.title[0]?.plain_text || 'Untitled';
      }
    }
    return 'Untitled';
  }

  async deleteReconcile(googleEvents, notionPages, googleCalendarId, notionDatabaseId, dateProperty, timeMax) {
    const googleApi = require('./google');
    const notionApi = require('./notion');

    // CRITICAL FIX: Use composite key to prevent conflicts when multiple calendars sync to same database
    const mapKey = `${googleCalendarId}::${notionDatabaseId}`;
    const googleToNotionMap = this.store.get('googleToNotionMap', {}) || {};
    const notionToGoogleMap = this.store.get('notionToGoogleMap', {}) || {};
    const g2n = { ...(googleToNotionMap[mapKey] || {}) };
    const n2g = { ...(notionToGoogleMap[mapKey] || {}) };

    // Build sets of currently present IDs within the filtered window
    const presentGoogleIds = new Set((googleEvents || []).map(e => e.id));
    const presentNotionIds = new Set((notionPages || []).map(p => p.id));

    // 1) If Google event missing but mapped → delete Notion page (archive)
    for (const [googleId, notionId] of Object.entries(g2n)) {
      const googleStillPresent = presentGoogleIds.has(googleId);
      // Skip if this Google event was just created in this run
      if (this._createdGoogleIdsThisRun?.includes(googleId)) continue;

      if (!googleStillPresent) {
        try {
          // Only delete if the page actually exists in Notion (unfiltered list may not include old pages)
          // If not in the filtered notionPages, try to fetch/patch blindly. Here we attempt archive; if 404, just remove mapping.
          await notionApi.deletePage(notionId).catch(() => null);
          // Remove mapping regardless
          delete g2n[googleId];
          delete n2g[notionId];
            console.log(`🗑️ Deleted Notion page for missing Google event: ${googleId} → ${notionId}`);
        } catch (e) {
          console.warn(`⚠️ Failed to delete Notion page for Google event ${googleId}:`, e.message);
        }
      }
    }

    // 2) If Notion page missing but mapped → delete Google event
    for (const [notionId, googleId] of Object.entries(n2g)) {
      const notionStillPresent = presentNotionIds.has(notionId);
      // Skip if this Notion page was just created in this run
      if (this._createdNotionIdsThisRun?.includes(notionId)) continue;

      if (!notionStillPresent) {
        try {
          await googleApi.deleteCalendarEvent(googleCalendarId, googleId).catch(() => null);
          delete n2g[notionId];
          delete g2n[googleId];
            console.log(`🗑️ Deleted Google event for missing Notion page: ${notionId} → ${googleId}`);
        } catch (e) {
          console.warn(`⚠️ Failed to delete Google event for Notion page ${notionId}:`, e.message);
        }
      }
    }

    // Persist updated maps
    googleToNotionMap[mapKey] = g2n;
    notionToGoogleMap[mapKey] = n2g;
    this.store.set('googleToNotionMap', googleToNotionMap);
    this.store.set('notionToGoogleMap', notionToGoogleMap);
  }

  // Method to add/update active sync pairs
  addSyncPair(googleCalendarId, notionDatabaseId) {
    const activePairs = this.store.get('activeSyncPairs', []);
    const existingIndex = activePairs.findIndex(pair => 
      pair.googleCalendarId === googleCalendarId && pair.notionDatabaseId === notionDatabaseId
    );
    
    if (existingIndex === -1) {
      activePairs.push({ googleCalendarId, notionDatabaseId });
      this.store.set('activeSyncPairs', activePairs);
      console.log(`➕ Added sync pair: ${googleCalendarId} ↔ ${notionDatabaseId}`);
    }
  }

  removeSyncPair(googleCalendarId, notionDatabaseId) {
    const activePairs = this.store.get('activeSyncPairs', []);
    const filteredPairs = activePairs.filter(pair => 
      !(pair.googleCalendarId === googleCalendarId && pair.notionDatabaseId === notionDatabaseId)
    );
    
    this.store.set('activeSyncPairs', filteredPairs);
    console.log(`➖ Removed sync pair: ${googleCalendarId} ↔ ${notionDatabaseId}`);
  }

  getStats() {
    const syncStatsObj = this.store.get('syncStats') || {};
    const topSuccessful = this.store.get('successfulSyncs', 0);
    const topFailed = this.store.get('failedSyncs', 0);
    const topTotal = this.store.get('totalSyncs', 0);
    return {
      successfulSyncs: (syncStatsObj.successfulSyncs ?? topSuccessful) || 0,
      totalSyncs: (syncStatsObj.totalSyncs ?? topTotal) || 0,
      failedSyncs: (syncStatsObj.failedSyncs ?? topFailed) || 0,
      lastSyncTimes: this.store.get('lastSyncTimes') || {},
      activeSyncPairs: this.store.get('activeSyncPairs', [])
    };
  }

  updateSyncStats(syncKey, success = true) {
    if (success) {
      const currentCount = this.store.get('successfulSyncs', 0);
      this.store.set('successfulSyncs', currentCount + 1);
      
      const lastSyncTimes = this.store.get('lastSyncTimes', {});
      lastSyncTimes[syncKey] = new Date().toISOString();
      this.store.set('lastSyncTimes', lastSyncTimes);
    }
  }

  startPeriodicPoll() {
    // ✅ CRITICAL FIX: Prevent multiple simultaneous polling timers
    if (this.pollTimer) {
      console.log('[SyncManager] ⚠️ Polling already active, skipping duplicate startPeriodicPoll()');
      return;
    }
    
    console.log(`⚡ Starting CONTINUOUS periodic sync poll`);
    console.log(`   ✅ FIXED: Always syncing at 7 seconds (regardless of window focus)`);
    console.log(`   Active: ${this.intervalActive}ms (7 sec) | Idle: ${this.intervalIdle}ms (2.5 min) | Background: ${this.intervalBackground}ms (2 min)`);
    
    this.pollTimer = setInterval(() => {
      const syncStartTime = Date.now();
      const userSettings = require('./userSettings');
      
      // ✅ OPTIMIZATION: Get active sync pairs first to avoid unnecessary work
      let activeSyncPairs = this.store.get('activeSyncPairs', []);
      
      // ✅ SAFETY VALIDATION: Ensure all pairs are valid before syncing
      if (activeSyncPairs && activeSyncPairs.length > 0) {
        const validatedPairs = activeSyncPairs.filter(pair => {
          const googleId = pair.google || pair.googleCalendarId;
          const notionId = pair.notion || pair.notionDatabaseId;
          return !!(googleId && notionId);
        });
        
        if (validatedPairs.length < activeSyncPairs.length) {
          console.warn(`[Poll] ⚠️ Filtered invalid pairs: ${activeSyncPairs.length} → ${validatedPairs.length}`);
          this.store.set('activeSyncPairs', validatedPairs);
          activeSyncPairs = validatedPairs;
        }
      }
      
      const hasActivePairs = activeSyncPairs && activeSyncPairs.length > 0;
      
      // Run if: background sync is enabled OR there are active sync pairs (auto-enable)
      const shouldSync = userSettings.isBackgroundSyncEnabled() || hasActivePairs;
      
      if (shouldSync && hasActivePairs) {
        const syncStatus = this.syncInProgress ? '🔄(IN_PROGRESS)' : '⚡';
        console.log(`${syncStatus} Sync poll #${this.store.get('syncStats', {}).totalSyncs || 0} (${activeSyncPairs.length} pair${activeSyncPairs.length !== 1 ? 's' : ''}, interval: ${this.currentInterval}ms)`);
        
        // Enqueue a full sync job that checks for remote changes
        this.queue.add('full-poll');
        
        // Track sync performance
        this.flushQueue().then(() => {
          const syncDuration = Date.now() - syncStartTime;
          if (syncDuration > 1000) {
            console.log(`⏱️ Sync took ${syncDuration}ms - consider checking API response times`);
          }
        }).catch(err => {
          console.error(`❌ Sync poll error:`, err);
        });
      } else if (!hasActivePairs) {
        console.log('⏰ Sync poll skipped (no active pairs)');
      } else {
        console.log('⏰ Sync poll skipped (background sync disabled)');
      }
    }, this.currentInterval);
  }

  stop() {
    console.log('🛑 Stopping SyncManager');
    clearInterval(this.pollTimer);
    clearTimeout(this.debounceTimer);
    this.pollTimer = null;
  }

  // Get sync statistics for diagnostics
  getSyncStats() {
    return {
      ...this.store.get('syncStats'),
      lastSyncTimes: this.store.get('lastSyncAt'),
      queueSize: this.queue.size,
      syncInProgress: this.syncInProgress,
      backoffMs: this.backoffMs,
      smartSyncStatus: this.getSmartSyncStatus()
    };
  }
  
  // Get smart sync status for UI
  getSmartSyncStatus() {
    const timeSinceActivity = Date.now() - this.lastActivityTime;
    const isIdle = timeSinceActivity > this.activityTimeout;
    
    return {
      currentInterval: this.currentInterval,
      isWindowFocused: this.isWindowFocused,
      lastSyncHadChanges: this.lastSyncHadChanges,
      isIdle: isIdle,
      timeSinceActivity: timeSinceActivity,
      syncState: this.isWindowFocused 
        ? (isIdle ? 'idle' : 'active')
        : 'background'
    };
  }

  // Clear sync data (for settings/reset)
  clearSyncData() {
    console.log('🗑️ Clearing sync data');
    this.store.clear();
    this.queue.clear();
    clearTimeout(this.debounceTimer);
  }

  // Force immediate full sync (for refresh button)
  async performForceSync() {
    console.log('🔄 Performing force FULL sync...');
    try {
      await this.performFullSync();
      return { success: true, message: 'Force full sync completed' };
    } catch (e) {
      console.error('❌ Force full sync failed:', e);
      return { success: false, message: e?.message || 'Force full sync failed' };
    }
  }
  
  // Manual sync triggered by "Sync Now" button
  async syncNow() {
    console.log('🚀 Manual SYNC NOW triggered by user');
    this.recordActivity(); // Treat as activity
    
    const activeSyncPairs = this.store.get('activeSyncPairs', []);
    if (!activeSyncPairs || activeSyncPairs.length === 0) {
      console.log('⚠️ No active sync pairs to sync');
      return { success: false, message: 'No sync pairs configured' };
    }
    
    try {
      // Queue full poll sync
      this.queue.add('full-poll-manual');
      await this.flushQueue();
      this.setSyncHadChanges(true); // Assume changes to keep sync active
      return { success: true, message: 'Sync completed successfully' };
    } catch (e) {
      console.error('❌ Manual sync failed:', e);
      return { success: false, message: e?.message || 'Manual sync failed' };
    }
  }

  // Start sync with specific pairs
  async startSync(syncPairs) {
    console.log('🚀 Starting sync with pairs:', syncPairs);
    if (Array.isArray(syncPairs) && syncPairs.length > 0) {
      const active = this.store.get('activeSyncPairs', []);
      const connectionTimes = this.store.get('connectionTimes', {}) || {};
      for (const pair of syncPairs) {
        const googleCalendarId = pair.google || pair.googleCalendarId;
        const notionDatabaseId = pair.notion || pair.notionDatabaseId;
        if (!googleCalendarId || !notionDatabaseId) continue;
        // persist pair if not present
        if (!active.find(p => p.googleCalendarId === googleCalendarId && p.notionDatabaseId === notionDatabaseId)) {
          active.push({ googleCalendarId, notionDatabaseId });
          // set connection time for new pair
          const key = `${googleCalendarId}::${notionDatabaseId}`;
          if (!connectionTimes[key]) connectionTimes[key] = new Date().toISOString();
        }
        // enqueue as object to avoid hyphen-split issues
        this.queue.add({ google: googleCalendarId, notion: notionDatabaseId });
      }
      this.store.set('connectionTimes', connectionTimes);
      this.store.set('activeSyncPairs', active);
      await this.flushQueue();
    }
    return { success: true, message: 'Sync started' };
  }

  // Stop sync
  async stopSync() {
    console.log('🛑 Stopping sync...');
    this.stop();
    return { success: true, message: 'Sync stopped' };
  }
}

// Export singleton instance
const syncManager = new SyncManager();

console.log('[DEBUG] 🔥 SyncManager singleton created - filtering logic ACTIVE');

// Export singleton instance only (avoid function re-exports that can shadow methods)
module.exports = syncManager;

