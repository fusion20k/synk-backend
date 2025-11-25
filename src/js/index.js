        // ========== AUTO-SYNC TRIGGER FUNCTION ==========
        // This is called after tokens are auto-loaded and selections are restored
        async function triggerAutoSync() {
            try {
                if (!isGoogleActuallyConnected() || !isNotionActuallyConnected()) {
                    console.log('[Auto-Sync] Cannot sync: Google connected:', isGoogleActuallyConnected(), 'Notion connected:', isNotionActuallyConnected());
                    return;
                }
                
                const hasGoogleSelection = selected.google && selected.google.length > 0;
                const hasNotionSelection = selected.notion && selected.notion.length > 0;
                
                if (!hasGoogleSelection || !hasNotionSelection) {
                    console.log('[Auto-Sync] No selections made, skipping auto-sync');
                    return;
                }
                
                // Build sync pairs
                const syncPairs = [];
                for (const notionId of selected.notion) {
                    for (const googleId of selected.google) {
                        syncPairs.push({ notion: notionId, google: googleId });
                    }
                }
                
                console.log('[Auto-Sync] Starting auto-sync with', syncPairs.length, 'pair(s)');
                updateSyncStatus('Auto-syncing on startup...');
                
                // Register pairs and trigger sync
                const registerResult = await window.electronAPI.startSync(syncPairs);
                
                if (registerResult && registerResult.success) {
                    console.log('[Auto-Sync] ✅ Auto-sync registered successfully');
                    updateSyncStatus('Auto-sync completed');
                } else {
                    console.warn('[Auto-Sync] ⚠️ Failed to register auto-sync:', registerResult);
                }
            } catch (error) {
                console.error('[Auto-Sync] Error during auto-sync:', error);
            }
        }
        
        // ========== IMMEDIATE EVENT LISTENERS - SETUP FIRST ==========
        // These must run BEFORE anything else to ensure they catch OAuth events
        console.log('[Renderer Boot] Setting up OAuth event listeners immediately...');
        
        // Initialize global state that will be updated by OAuth listeners
        if (typeof window.synkGlobalState === 'undefined') {
            window.synkGlobalState = {
                isGoogleConnected: false,
                isNotionConnected: false
            };
            console.log('[Renderer Boot] ✅ Global state initialized:', window.synkGlobalState);
        }
        
        // ========== SYNC SELECTION STATE - GLOBAL SCOPE (MUST BE BEFORE SETUP) ==========
        // Multi-select state based on plan
        const selected = { notion: [], google: [] };
        let autoSyncTimer = null;
        let currentPlanData = { type: 'none' }; // Track current plan globally
        
        // ========== AUTOSAVE FOR CONNECTIONS ==========
        const AUTOSAVE_KEY = 'synk-saved-connections';
        const OAUTH_STATUS_KEY = 'synk-oauth-status';
        
        function saveConnectionsToStorage() {
            try {
                localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(selected));
                console.log('💾 Connections autosaved:', selected);
            } catch (error) {
                console.warn('⚠️ Failed to autosave connections:', error);
            }
        }
        
        function saveOAuthStatusToStorage() {
            try {
                const oauthStatus = {
                    isGoogleConnected: window.synkGlobalState?.isGoogleConnected || false,
                    isNotionConnected: window.synkGlobalState?.isNotionConnected || false
                };
                localStorage.setItem(OAUTH_STATUS_KEY, JSON.stringify(oauthStatus));
                console.log('💾 OAuth status autosaved:', oauthStatus);
            } catch (error) {
                console.warn('⚠️ Failed to autosave OAuth status:', error);
            }
        }
        
        function loadOAuthStatusFromStorage() {
            try {
                const saved = localStorage.getItem(OAUTH_STATUS_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    console.log('✅ OAuth status restored from storage:', parsed);
                    return parsed;
                }
            } catch (error) {
                console.warn('⚠️ Failed to load saved OAuth status:', error);
            }
            return null;
        }
        
        function loadConnectionsFromStorage() {
            try {
                const saved = localStorage.getItem(AUTOSAVE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    selected.notion = parsed.notion || [];
                    selected.google = parsed.google || [];
                    console.log('✅ Connections restored from storage:', selected);
                    return true;
                }
            } catch (error) {
                console.warn('⚠️ Failed to load saved connections:', error);
            }
            return false;
        }
        
        function resetConnections() {
            try {
                localStorage.removeItem(AUTOSAVE_KEY);
                selected.notion = [];
                selected.google = [];
                console.log('🔄 Connections reset');
                return true;
            } catch (error) {
                console.warn('⚠️ Failed to reset connections:', error);
                return false;
            }
        }
        
        // Helper function to safely display calendars
        async function _displayCalendarsOnOAuth(calendars) {
            console.log('[OAuth Event] Received Google calendars:', calendars);
            try {
                // Wait for tabs to load (up to 5 seconds)
                let attempts = 0;
                while (!document.getElementById('calendars-content') && attempts < 50) {
                    await new Promise(r => setTimeout(r, 100));
                    attempts++;
                }
                
                if (!document.getElementById('calendars-content')) {
                    console.error('[OAuth Event] calendars-content container never loaded');
                    return;
                }
                
                // Hide the connecting status UI
                const googleOAuthStatus = document.getElementById('google-oauth-status');
                if (googleOAuthStatus) {
                    googleOAuthStatus.style.display = 'none';
                }
                
                // Hide the connect button
                const googleConnectBtn = document.getElementById('google-connect');
                if (googleConnectBtn) {
                    googleConnectBtn.style.display = 'none';
                    console.log('[OAuth Event] ✅ Google connect button hidden');
                }
                
                // Update the status pill to show connected with dragon's breath glow
                updateConnectionPill('google', true);
                
                // Call the display function
                if (typeof displayCalendars === 'function') {
                    displayCalendars(calendars);
                    console.log('[OAuth Event] ✅ Calendars displayed successfully');
                } else {
                    console.error('[OAuth Event] displayCalendars function not available yet');
                }
            } catch (error) {
                console.error('[OAuth Event] Error displaying calendars:', error);
            }
        }
        
        // Helper function to safely display databases
        async function _displayDatabasesOnOAuth(databases) {
            console.log('[OAuth Event] Received Notion databases:', databases);
            try {
                // Wait for tabs to load (up to 5 seconds)
                let attempts = 0;
                while (!document.getElementById('notion-content') && attempts < 50) {
                    await new Promise(r => setTimeout(r, 100));
                    attempts++;
                }
                
                if (!document.getElementById('notion-content')) {
                    console.error('[OAuth Event] notion-content container never loaded');
                    return;
                }
                
                // Hide the connecting status UI
                const notionOAuthStatus = document.getElementById('notion-oauth-status');
                if (notionOAuthStatus) {
                    notionOAuthStatus.style.display = 'none';
                }
                
                // Hide the connect button
                const notionConnectBtn = document.getElementById('notion-connect');
                if (notionConnectBtn) {
                    notionConnectBtn.style.display = 'none';
                    console.log('[OAuth Event] ✅ Notion connect button hidden');
                }
                
                // Update the status pill to show connected with dragon's breath glow
                updateConnectionPill('notion', true);
                
                // Call the display function
                if (typeof displayDatabases === 'function') {
                    displayDatabases(databases);
                    console.log('[OAuth Event] ✅ Databases displayed successfully');
                } else {
                    console.error('[OAuth Event] displayDatabases function not available yet');
                }
            } catch (error) {
                console.error('[OAuth Event] Error displaying databases:', error);
            }
        }
        
        // Register listeners with retry mechanism
        function setupOAuthListeners() {
            if (!window.electronAPI) {
                console.warn('[OAuth Setup] window.electronAPI not ready, retrying in 100ms...');
                setTimeout(setupOAuthListeners, 100);
                return;
            }
            
            if (!window.electronAPI.on) {
                console.warn('[OAuth Setup] window.electronAPI.on not available, retrying in 100ms...');
                setTimeout(setupOAuthListeners, 100);
                return;
            }
            
            console.log('[OAuth Setup] ✅ window.electronAPI.on is available, registering listeners');
            
            // ========== RESTORE TOKENS ON APP STARTUP ==========
            // Store token info globally so we can use it after functions are defined
            window.synkTokenRestoreInfo = null;
            
            // Check if we have existing tokens and restore them
            (async () => {
                try {
                    console.log('[Startup] 🔍 Checking for existing OAuth tokens...');
                    
                    // ✅ First, restore saved OAuth status from localStorage
                    const savedOAuthStatus = loadOAuthStatusFromStorage();
                    if (savedOAuthStatus) {
                        console.log('[Startup] 📌 Restoring saved OAuth status:', savedOAuthStatus);
                        window.synkGlobalState.isGoogleConnected = savedOAuthStatus.isGoogleConnected;
                        window.synkGlobalState.isNotionConnected = savedOAuthStatus.isNotionConnected;
                    }
                    
                    const tokenCheck = await window.electronAPI.invoke('check-existing-tokens');
                    console.log('[Startup] Token check result:', tokenCheck);
                    
                    if (tokenCheck && (tokenCheck.hasGoogle || tokenCheck.hasNotion)) {
                        console.log('[Startup] ✅ Found existing tokens! Will restore after tabs load...');
                        console.log(`  - Google: ${tokenCheck.hasGoogle ? '✓' : '✗'}`);
                        console.log(`  - Notion: ${tokenCheck.hasNotion ? '✓' : '✗'}`);
                        
                        // Store for later use
                        window.synkTokenRestoreInfo = tokenCheck;
                        
                        // Update global state immediately (override with token check)
                        window.synkGlobalState.isGoogleConnected = tokenCheck.hasGoogle;
                        window.synkGlobalState.isNotionConnected = tokenCheck.hasNotion;
                        
                        // Schedule restoration after tabs load
                        const restoreAfterTabsLoad = () => {
                            console.log('[Startup] Tabs loaded - Now restoring calendars and databases');
                            
                            // Update connection pills
                            if (tokenCheck.hasGoogle) {
                                updateConnectionPill('google', true);
                                console.log('[Startup] Google connection pill updated');
                            }
                            if (tokenCheck.hasNotion) {
                                updateConnectionPill('notion', true);
                                console.log('[Startup] Notion connection pill updated');
                            }
                            
                            // Load calendars and databases
                            if (tokenCheck.hasGoogle && typeof displayCalendars === 'function') {
                                (async () => {
                                    try {
                                        console.log('[Startup] 📅 Fetching Google calendars...');
                                        const calendars = await window.electronAPI.invoke('list-google-calendars');
                                        if (calendars && calendars.allCalendars) {
                                            displayCalendars(calendars);
                                            console.log('[Startup] ✅ Google calendars restored:', calendars.allCalendars.length);
                                        }
                                    } catch (e) {
                                        console.error('[Startup] ❌ Failed to fetch Google calendars:', e);
                                    }
                                })();
                            }
                            
                            if (tokenCheck.hasNotion && typeof displayDatabases === 'function') {
                                (async () => {
                                    try {
                                        console.log('[Startup] 📊 Fetching Notion databases...');
                                        const databases = await window.electronAPI.invoke('list-notion-databases');
                                        if (databases && databases.databases) {
                                            displayDatabases(databases.databases);
                                            console.log('[Startup] ✅ Notion databases restored:', databases.databases.length);
                                        } else if (Array.isArray(databases)) {
                                            displayDatabases(databases);
                                            console.log('[Startup] ✅ Notion databases restored:', databases.length);
                                        }
                                    } catch (e) {
                                        console.error('[Startup] ❌ Failed to fetch Notion databases:', e);
                                    }
                                })();
                            }
                            
                            console.log('[Startup] ✅ All tokens and data restored!');
                        };
                        
                        // Wait for tabs to be fully loaded
                        window.addEventListener('tabs-loaded', restoreAfterTabsLoad, { once: true });
                        
                        // Also check if tabs are already loaded
                        if (document.getElementById('calendars-content')) {
                            console.log('[Startup] Tabs already loaded, restoring immediately');
                            restoreAfterTabsLoad();
                        }
                    } else {
                        console.log('[Startup] No existing tokens found - user will need to connect');
                    }
                } catch (error) {
                    console.error('[Startup] Error checking for tokens:', error);
                    // Continue anyway - user can manually connect
                }
            })();
            
            
            // Google OAuth success
            window.electronAPI.on('google-oauth-success', (event, calendars) => {
                console.log('[OAuth Event] 🔵 google-oauth-success fired with data:', calendars);
                try {
                    // UPDATE CONNECTION STATE - THIS IS CRITICAL!
                    console.log('[OAuth Event] About to update global state, current state:', window.synkGlobalState);
                    if (typeof window.synkGlobalState === 'undefined') {
                        window.synkGlobalState = {};
                    }
                    console.log('[OAuth Event] Before assignment - global state object:', window.synkGlobalState);
                    window.synkGlobalState.isGoogleConnected = true;
                    console.log('[OAuth Event] ✅ Google connection state updated to true, new state:', window.synkGlobalState);
                    // ✅ Save OAuth status to persistent storage
                    saveOAuthStatusToStorage();
                    
                    // Reset button state
                    isGoogleConnecting = false;
                    const btn = document.getElementById('google-connect');
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Connect Google Calendar';
                    }
                    showSuccessToast('Successfully connected to Google Calendar');
                    
                    _displayCalendarsOnOAuth(calendars);
                } catch (error) {
                    console.error('[OAuth Event] ERROR in Google handler:', error);
                }
            });
            
            // Notion OAuth success
            window.electronAPI.on('notion-oauth-success', (event, data) => {
                console.log('[OAuth Event] 🟣 notion-oauth-success fired with data:', data);
                try {
                    // UPDATE CONNECTION STATE - THIS IS CRITICAL!
                    console.log('[OAuth Event] About to update global state, current state:', window.synkGlobalState);
                    if (typeof window.synkGlobalState === 'undefined') {
                        window.synkGlobalState = {};
                    }
                    console.log('[OAuth Event] Before assignment - global state object:', window.synkGlobalState);
                    window.synkGlobalState.isNotionConnected = true;
                    console.log('[OAuth Event] ✅ Notion connection state updated to true, new state:', window.synkGlobalState);
                    // ✅ Save OAuth status to persistent storage
                    saveOAuthStatusToStorage();
                    
                    // Reset button state
                    isNotionConnecting = false;
                    const btn = document.getElementById('notion-connect');
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Connect Notion';
                    }
                    showSuccessToast('Successfully connected to Notion');
                    
                    if (data && data.databases) {
                        _displayDatabasesOnOAuth(data.databases);
                    } else if (data && Array.isArray(data)) {
                        _displayDatabasesOnOAuth(data);
                    } else {
                        console.warn('[OAuth Event] Unexpected data format:', data);
                    }
                } catch (error) {
                    console.error('[OAuth Event] ERROR in Notion handler:', error);
                }
            });
            
            // Google OAuth failed
            window.electronAPI.on('google-oauth-failed', (event, error) => {
                console.error('[OAuth Event] 🔴 google-oauth-failed:', error);
                if (typeof window.synkGlobalState === 'undefined') {
                    window.synkGlobalState = {};
                }
                window.synkGlobalState.isGoogleConnected = false;
                // ✅ Save OAuth status to persistent storage
                saveOAuthStatusToStorage();
                
                // Reset button state
                isGoogleConnecting = false;
                const btn = document.getElementById('google-connect');
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Connect Google Calendar';
                }
                hideGoogleOAuthStatus();
                showErrorToast(`Google connection failed: ${error}`);
            });
            
            // Notion OAuth failed
            window.electronAPI.on('notion-oauth-failed', (event, error) => {
                console.error('[OAuth Event] 🔴 notion-oauth-failed:', error);
                if (typeof window.synkGlobalState === 'undefined') {
                    window.synkGlobalState = {};
                }
                window.synkGlobalState.isNotionConnected = false;
                // ✅ Save OAuth status to persistent storage
                saveOAuthStatusToStorage();
                
                // Reset button state
                isNotionConnecting = false;
                const btn = document.getElementById('notion-connect');
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Connect Notion';
                }
                hideNotionOAuthStatus();
                showErrorToast(`Notion connection failed: ${error}`);
            });
            
            console.log('[OAuth Setup] ✅ All OAuth event listeners registered successfully');
        }
        
        // Start setup immediately
        setupOAuthListeners();
        
        // ========== END IMMEDIATE EVENT LISTENERS ==========

        // ========== HELPER FUNCTIONS ==========
        function restoreSavedSelectionsForType(type, availableIds) {
            // Check if we have saved selections for this type
            if (!selected[type] || selected[type].length === 0) {
                return; // Nothing to restore
            }
            
            // Filter saved selections to only include those that are still available
            const validSelections = selected[type].filter(id => availableIds.includes(id));
            
            if (validSelections.length !== selected[type].length) {
                console.log(`⚠️ Filtering ${type} selections: ${selected[type].length} saved → ${validSelections.length} valid`);
                selected[type] = validSelections;
            }
            
            // Update UI to mark items as selected
            renderSelectionUI();
            
            if (validSelections.length > 0) {
                console.log(`✅ Restored ${validSelections.length} ${type} selection(s)`);
            }
        }

        // Get max selections based on plan
        function getMaxSelectionsPerSide() {
            const planType = currentPlanData.type;
            if (planType === 'ultimate') {
                console.log('[Plan Limit] Ultimate plan detected - returning Infinity (unlimited)');
                return Infinity;
            }
            if (planType === 'pro' || planType === 'trial') {
                console.log('[Plan Limit] Pro/Trial plan detected - returning 3');
                return 3;
            }
            console.log('[Plan Limit] No plan (type=' + planType + ') - returning 0');
            return 0; // No plan - no selections allowed
        }

        function updateDisabledStates() {
            const maxSelections = getMaxSelectionsPerSide();
            
            // Skip if limit is infinite (Ultimate plan) or if there are no items to update
            if (maxSelections === Infinity) return;
            
            // Update Google calendars disabled state
            document.querySelectorAll('.calendar-item').forEach(item => {
                const isSelected = selected.google.includes(item.dataset.id);
                const isAtLimit = selected.google.length >= maxSelections;
                
                if (isAtLimit && !isSelected) {
                    item.classList.add('disabled');
                    item.style.pointerEvents = 'none';
                    item.style.opacity = '0.5';
                } else {
                    item.classList.remove('disabled');
                    item.style.pointerEvents = 'auto';
                    item.style.opacity = '1';
                }
            });
            
            // Update Notion databases disabled state
            document.querySelectorAll('.database-item').forEach(item => {
                const isSelected = selected.notion.includes(item.dataset.id);
                const isAtLimit = selected.notion.length >= maxSelections;
                
                if (isAtLimit && !isSelected) {
                    item.classList.add('disabled');
                    item.style.pointerEvents = 'none';
                    item.style.opacity = '0.5';
                } else {
                    item.classList.remove('disabled');
                    item.style.pointerEvents = 'auto';
                    item.style.opacity = '1';
                }
            });
        }

        function toggleSelect(id, type) {
            const maxSelections = getMaxSelectionsPerSide();
            const selectedArray = selected[type];
            const index = selectedArray.indexOf(id);
            
            console.log(`[Selection] Attempting to ${index > -1 ? 'deselect' : 'select'} ${type}. Current: ${selectedArray.length}, Max: ${maxSelections}, Plan: ${currentPlanData.type}`);
            
            if (index > -1) {
                // Already selected, remove it
                selectedArray.splice(index, 1);
            } else {
                // Not selected
                if (selectedArray.length < maxSelections) {
                    // We have room, add it
                    selectedArray.push(id);
                    console.log(`[Selection] ✅ Added ${id} to ${type}. New count: ${selectedArray.length}`);
                } else {
                    // Max reached, show warning
                    const planName = currentPlanData.type === 'ultimate' ? 'Ultimate' : 'Pro';
                    const limit = getMaxSelectionsPerSide();
                    console.warn(`⚠️ [Selection] ${planName} plan limited to ${limit} ${type} ${limit === 1 ? 'selection' : 'selections'} per side. Current: ${selectedArray.length}`);
                    updateSyncStatus(`${planName} plan: Max ${limit} ${type} ${limit === 1 ? 'selection' : 'selections'} allowed`);
                    return;
                }
            }
            
            renderSelectionUI();
            updateDisabledStates();
            saveConnectionsToStorage(); // ✅ AUTOSAVE connections after change
            checkAndTriggerAutoSync();
        }

        function renderSelectionUI() {
            // Update Google calendar selection UI
            document.querySelectorAll('.calendar-item').forEach(item => {
                if (selected.google.includes(item.dataset.id)) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });

            // Update Notion database selection UI
            document.querySelectorAll('.database-item').forEach(item => {
                if (selected.notion.includes(item.dataset.id)) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });

            // Update inline sync status
            updateSyncStatus();
            
            // Update disabled states based on plan limits
            updateDisabledStates();
        }

        function checkAndTriggerAutoSync() {
            const hasNotionSelection = selected.notion && selected.notion.length > 0;
            const hasGoogleSelection = selected.google && selected.google.length > 0;
            
            if (hasNotionSelection && hasGoogleSelection) {
                clearTimeout(autoSyncTimer);
                // ✅ FIX #2: Reduced debounce from 1200ms to 300ms for faster sync response
                autoSyncTimer = setTimeout(async () => {
                    try {
                        // Build sync pairs (each notion db syncs with each google calendar)
                        const syncPairs = [];
                        for (const notionId of selected.notion) {
                            for (const googleId of selected.google) {
                                syncPairs.push({ notion: notionId, google: googleId });
                            }
                        }
                        
                        updateSyncStatus('Syncing...');
                        const result = await window.electronAPI.startSync(syncPairs);
                        
                        if (result && result.success) {
                            // Wait a moment for sync to complete, then update status
                            setTimeout(async () => {
                                await updateSyncStats();
                                const now = new Date();
                                const timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit' });
                                updateSyncStatus(`Last synced at ${timeStr}`);
                            }, 2000);
                        } else {
                            updateSyncStatus('Sync failed - will retry automatically');
                        }
                    } catch (error) {
                        console.error('Sync error:', error);
                        updateSyncStatus('Sync failed - will retry automatically');
                    }
                }, 300);  // ✅ OPTIMIZED: Faster response to selection changes
            }
        }

        function updateSyncStatus(status) {
            const syncStatusText = document.getElementById('sync-status-text');
            const syncDot = document.getElementById('sync-dot');
            const syncDetails = document.getElementById('sync-details');
            const syncSource = document.getElementById('sync-source');
            const syncTarget = document.getElementById('sync-target');
            const lastSync = document.getElementById('last-sync');
            const syncCount = document.getElementById('sync-count');
            
            if (!syncStatusText || !syncDot) return;
            
            if (status) {
                // Manual status update (e.g., "Syncing...", "Last synced at 14:30")
                syncStatusText.textContent = status;
                
                if (status.includes('Syncing')) {
                    syncDot.className = 'sync-dot syncing';
                } else if (status.includes('failed') || status.includes('error')) {
                    syncDot.className = 'sync-dot error';
                } else if (status.includes('synced at')) {
                    syncDot.className = 'sync-dot ready';
                } else {
                    syncDot.className = 'sync-dot ready';
                }
            } else {
                // Show current selection status
                const hasNotionSelection = selected.notion && selected.notion.length > 0;
                const hasGoogleSelection = selected.google && selected.google.length > 0;
                const maxPerSide = getMaxSelectionsPerSide();
                const pluralDb = selected.notion.length !== 1 ? 'databases' : 'database';
                const pluralCal = selected.google.length !== 1 ? 'calendars' : 'calendar';
                
                if (hasNotionSelection && hasGoogleSelection) {
                    const pairCount = selected.notion.length * selected.google.length;
                    const pairWord = pairCount === 1 ? 'pair' : 'pairs';
                    syncStatusText.textContent = `Ready to sync - ${pairCount} sync ${pairWord} active`;
                    syncDot.className = 'sync-dot ready';
                    
                    // Show sync details
                    syncDetails.style.display = 'block';
                    syncSource.textContent = `${selected.notion.length} ${pluralDb}`;
                    syncTarget.textContent = `${selected.google.length} ${pluralCal}`;
                    
                    // Update sync stats from backend
                    updateSyncStats();
                    
                } else if (hasNotionSelection || hasGoogleSelection) {
                    const selectionMsg = maxPerSide === Infinity ? 
                        'Select one item from each side to sync' :
                        `Select up to ${maxPerSide} from each side`;
                    syncStatusText.textContent = selectionMsg;
                    syncDot.className = 'sync-dot idle';
                    syncDetails.style.display = 'none';
                } else {
                    const selectMsg = maxPerSide === 1 ? 'Select one Notion database and one Google calendar to sync' :
                                     maxPerSide === 3 ? 'Select up to 3 databases and 3 calendars to sync' :
                                     'Select databases and calendars to sync';
                    syncStatusText.textContent = selectMsg;
                    syncDot.className = 'sync-dot idle';
                    syncDetails.style.display = 'none';
                }
            }
        }

        async function updateSyncStats() {
            try {
                const res = await window.electronAPI.getSyncStats();
                const stats = res && (res.stats || res);
                const lastSync = document.getElementById('last-sync');
                const syncCount = document.getElementById('sync-count');
                
                if (lastSync && syncCount) {
                    // Update last sync time
                    if (stats && stats.lastSyncTimes && Object.keys(stats.lastSyncTimes).length > 0) {
                        const lastSyncTime = Object.values(stats.lastSyncTimes)[0];
                        const date = new Date(lastSyncTime);
                        const timeStr = date.toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit' });
                        lastSync.textContent = `Last synced at ${timeStr}`;
                    } else {
                        lastSync.textContent = 'Never synced';
                    }
                    
                    // Update sync count
                    const count = (stats && (stats.successfulSyncs || stats.syncStats?.successfulSyncs)) || 0;
                    syncCount.textContent = `${count} syncs`;
                }
            } catch (error) {
                console.error('Error fetching sync stats:', error);
            }
        }
        // ========== END SYNC SELECTION STATE ==========

        // Plan detection and display (prefer backend /me when logged in)
        let __planPoller = null;
        async function loadUserPlan() {
            try {
                console.log('?? Loading user plan...');
                const base = (window.electronAPI && window.electronAPI.backendUrl) ? window.electronAPI.backendUrl : 'https://synk-web.onrender.com';
                const token = localStorage.getItem('auth_token');

                if (token) {
                    try {
                        const meResp = await fetch(base + '/me', { headers: { 'Authorization': 'Bearer ' + token } });
                        const me = await meResp.json().catch(() => ({ success: false }));
                        if (me && me.success) {
                            updatePlanDisplay({
                                type: me.plan?.type || 'none',
                                billingCycle: me.plan?.billingCycle || me.billing_period || null,
                                description: me.plan?.description || undefined,
                                is_trial: !!me.is_trial,
                                trial_end: me.trial_end || null
                            });
                            return;
                        }
                    } catch (e) {
                        console.warn('?? /me fetch failed, falling back to local plan file:', e.message);
                    }
                }

                // If no token or /me failed, show "no current plan" (do NOT use local file when logged out)
                updatePlanDisplay({
                    type: 'none',
                    name: 'No current plan',
                    description: 'No current plan. Log in and purchase a plan to enable premium features.',
                    features: [],
                    status: 'none'
                });
            } catch (error) {
                console.error('? Error loading user plan:', error);
                updatePlanDisplay({
                    type: 'none',
                    name: 'No current plan',
                    description: 'No current plan. Log in and purchase a plan to enable premium features.',
                    features: [],
                    status: 'none'
                });
            }
        }

        // Start simple polling of /me to reflect Supabase changes quickly
        function startPlanPolling() {
            if (__planPoller) clearInterval(__planPoller);
            __planPoller = setInterval(() => {
                const token = localStorage.getItem('auth_token');
                if (!token) return; // only poll when logged in
                const base = (window.electronAPI && window.electronAPI.backendUrl) ? window.electronAPI.backendUrl : 'https://synk-web.onrender.com';
                fetch(base + '/me', { headers: { 'Authorization': 'Bearer ' + token } })
                    .then(r => r.json())
                    .then(me => {
                        if (me && me.success) {
                            updatePlanDisplay({
                                type: me.plan?.type || 'none',
                                billingCycle: me.plan?.billingCycle || me.billing_period || null,
                                description: me.plan?.description || undefined,
                                is_trial: !!me.is_trial,
                                trial_end: me.trial_end || null
                            });
                        }
                    })
                    .catch(() => {});
            }, 60000);
        }
        
        function updateTabVisibilityBasedOnPlan() {
            // Hide sync and settings tabs if user has no plan, only show about tab
            const noPlan = !currentPlanData || !currentPlanData.type || currentPlanData.type === 'none' || currentPlanData.type === 'unknown' || currentPlanData.type === null;
            const syncNavItem = document.querySelector('[data-tab="sync"]');
            const settingsNavItem = document.querySelector('[data-tab="settings"]');
            const aboutNavItem = document.querySelector('[data-tab="about"]');
            
            if (noPlan) {
                // Hide sync and settings tabs
                if (syncNavItem) syncNavItem.style.display = 'none';
                if (settingsNavItem) settingsNavItem.style.display = 'none';
                
                // Force switch to about tab
                if (aboutNavItem) {
                    switchTab('about');
                }
            } else {
                // Show all tabs when user has a plan
                if (syncNavItem) syncNavItem.style.display = 'flex';
                if (settingsNavItem) settingsNavItem.style.display = 'flex';
            }
        }
        
        function updatePlanLimitsDisplay() {
            // Update the plan limits badge in sync tab
            const badge = document.getElementById('plan-limits-badge');
            const badgeText = document.getElementById('plan-limits-text');
            if (!badge || !badgeText) return;
            
            const maxSelections = getMaxSelectionsPerSide();
            if (maxSelections === Infinity) {
                badge.style.display = 'none';
            } else if (maxSelections === 3) {
                badge.style.display = 'none';
            } else {
                badge.style.display = 'block';
                badgeText.textContent = 'Select 1 database and 1 calendar';
            }
        }

        function updatePlanDisplay(planData) {
            // Store plan data globally for selection limits
            // IMPORTANT: Normalize plan type to lowercase to avoid case mismatch issues
            currentPlanData = { ...planData, type: (planData.type || '').toLowerCase() };
            console.log('[Plan Update] Current plan:', currentPlanData.type, '- Max selections per side:', getMaxSelectionsPerSide());
            
            // Update plan limits badge
            updatePlanLimitsDisplay();
            
            // Update tab visibility based on plan status
            updateTabVisibilityBasedOnPlan();
            
            const planTitle = document.getElementById('plan-title');
            const planCycle = document.getElementById('plan-cycle');
            const planTrialTitle = document.getElementById('plan-trial-title');
            const planTrial = document.getElementById('plan-trial');
            const planDescriptionElement = document.getElementById('plan-description');
            const trialBadge = document.getElementById('trial-badge');

            // Dragon's breath orange styling helper
            const setDragonOrange = (el) => {
                if (!el) return;
                el.style.color = '#ff4500';
                el.style.textShadow = '0 0 8px rgba(255,69,0,0.7), 0 0 16px rgba(255,69,0,0.4)';
            };
            
            if (planTitle && planCycle && planDescriptionElement) {
                // Detect states
                const noPlan = !planData || !planData.type || planData.type === 'none' || planData.type === 'unknown' || planData.type === null;
                const isTrial = !!(planData && (planData.is_trial === true || planData.type === 'trial'));

                // Badge visibility
                if (trialBadge) {
                    trialBadge.style.display = isTrial ? 'inline-block' : 'none';
                }

                // Title
                let titleText = 'No current plan';
                if (!noPlan) {
                    if (planData.type === 'ultimate') titleText = 'Ultimate';
                    else if (planData.type === 'pro' || isTrial) titleText = 'Pro';
                    else if (planData.type === 'expired') titleText = 'Trial expired';
                }
                planTitle.textContent = titleText;

                // Cycle (only for paid plans and non-trial, and only if billingCycle is provided and not null)
                if (!noPlan && !isTrial && (planData.type === 'pro' || planData.type === 'ultimate') && planData.billingCycle && planData.billingCycle !== null && planData.billingCycle !== 'null') {
                    const cycle = planData.billingCycle.toLowerCase();
                    planCycle.textContent = cycle.includes('year') ? 'Yearly' : 'Monthly';
                } else {
                    planCycle.textContent = '';
                }

                // Trial days line (from real backend: trial_end or fallback trialDaysRemaining)
                if (planTrial && planTrialTitle) {
                    let daysLeft = null;
                    if (planData && planData.trial_end) {
                        const ms = new Date(planData.trial_end) - new Date();
                        daysLeft = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
                    } else if (planData && typeof planData.trialDaysRemaining === 'number') {
                        daysLeft = planData.trialDaysRemaining;
                    }

                    if (isTrial && daysLeft !== null) {
                        planTrialTitle.style.display = 'none';
                        planTrial.style.display = 'block';
                        planTrial.textContent = `${daysLeft} days left`;
                        setDragonOrange(planTrial);
                    } else {
                        planTrialTitle.style.display = 'none';
                        planTrial.style.display = 'none';
                        planTrial.textContent = '';
                    }
                }

                // Description (specific per state)
                if (noPlan) {
                    planDescriptionElement.textContent = 'No current plan. Log in and purchase a plan to enable premium features.';
                    planTitle.textContent = 'No current plan';
                    planCycle.textContent = '';
                    // Gray for no plan
                    planTitle.style.color = '#9e9e9e';
                    planTitle.style.textShadow = 'none';
                } else if (isTrial) {
                    planDescriptionElement.textContent = 'Pro trial active.';
                    // Dragon's breath orange for trial state
                    planTitle.style.color = '#ff4500';
                    planTitle.style.textShadow = '0 0 8px rgba(255,69,0,0.7), 0 0 16px rgba(255,69,0,0.4)';
                } else if (planData.type === 'pro') {
                    if (planData.billingCycle && planData.billingCycle !== null && planData.billingCycle !== 'null') {
                        const cycleText = planData.billingCycle.toLowerCase().includes('year') ? 'Yearly billing' : 'Monthly billing';
                        planDescriptionElement.textContent = `Pro plan active ? ${cycleText}.`;
                    } else {
                        planDescriptionElement.textContent = 'Pro plan active.';
                    }
                    // Dragon breath orange for plan title
                    planTitle.style.color = '#ff4500';
                    planTitle.style.textShadow = '0 0 8px rgba(255,69,0,0.7), 0 0 16px rgba(255,69,0,0.4)';
                } else if (planData.type === 'ultimate') {
                    if (planData.billingCycle && planData.billingCycle !== null && planData.billingCycle !== 'null') {
                        const cycleText = planData.billingCycle.toLowerCase().includes('year') ? 'Yearly billing' : 'Monthly billing';
                        planDescriptionElement.textContent = `Ultimate plan active ? ${cycleText}.`;
                    } else {
                        planDescriptionElement.textContent = 'Ultimate plan active.';
                    }
                    // Dragon breath orange for plan title
                    planTitle.style.color = '#ff4500';
                    planTitle.style.textShadow = '0 0 8px rgba(255,69,0,0.7), 0 0 16px rgba(255,69,0,0.4)';
                } else if (planData.type === 'expired') {
                    planDescriptionElement.textContent = 'Your trial has expired. Please upgrade to continue using Synk.';
                    planTitle.style.color = '#f44336';
                    planTitle.style.textShadow = 'none';
                } else {
                    planDescriptionElement.textContent = 'Plan status unknown.';
                    planTitle.style.color = '#9e9e9e';
                    planTitle.style.textShadow = 'none';
                }

                console.log('? Plan display updated:', titleText, { isTrial });
            }
            
            // Update disabled states based on the new plan limits
            updateDisabledStates();
        }

        
        // Start trial when both services are connected
        async function startTrialIfEligible() {
            try {
                const result = await window.electronAPI.startTrial();
                if (result.success) {
                    console.log('? Trial started');
                    updatePlanDisplay(result.plan);
                    showSuccessToast('Your 14-day free trial has started!');
                }
            } catch (error) {
                console.error('? Error starting trial:', error);
            }
        }
        
        // Check if user has access to a feature
        async function checkFeatureAccess(feature) {
            try {
                const result = await window.electronAPI.checkFeatureAccess(feature);
                return result.hasAccess;
            } catch (error) {
                console.error('? Error checking feature access:', error);
                return false;
            }
        }
        
        // Show feature restriction message
        function showFeatureRestriction(featureName) {
            showErrorToast(`${featureName} is only available in Ultimate plan. Please upgrade to access this feature.`);
        }
        
        // Success toast function
        function showSuccessToast(message) {
            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 14px;
                max-width: 300px;
                animation: slideIn 0.3s ease-out;
            `;
            toast.textContent = message;
            
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }, 3000);
        }
        
        // Titlebar Controls
        document.addEventListener('DOMContentLoaded', async () => {
            // ✅ AUTORESTORE: Load previously saved connections on app startup
            loadConnectionsFromStorage();
            
            // Load user plan information
            await loadUserPlan();

            // ✅ FIX #1: Check for existing OAuth tokens and auto-load calendars/databases
            // This prevents users from having to re-authenticate on every app restart
            async function autoLoadExistingTokens() {
                try {
                    console.log('[Startup] Checking for existing OAuth tokens...');
                    const tokenStatus = await window.electronAPI.checkExistingTokens();
                    
                    if (tokenStatus.hasGoogle || tokenStatus.hasNotion) {
                        console.log('[Startup] ✅ Found existing tokens:', tokenStatus);
                        
                        // Wait for tabs to load
                        let attempts = 0;
                        while (!document.getElementById('sync-tab') && attempts < 50) {
                            await new Promise(r => setTimeout(r, 100));
                            attempts++;
                        }
                        
                        let loadedGoogle = false;
                        let loadedNotion = false;
                        
                        // Auto-load Google calendars if token exists
                        if (tokenStatus.hasGoogle) {
                            try {
                                console.log('[Startup] Fetching Google calendars...');
                                const calendars = await window.electronAPI.listGoogleCalendars();
                                if (calendars && calendars.length > 0) {
                                    console.log('[Startup] ✅ Auto-loaded', calendars.length, 'Google calendars');
                                    await renderGoogleCalendars(calendars);
                                    loadedGoogle = true;
                                    // Hide connect button since we're already connected
                                    const googleBtn = document.getElementById('google-connect');
                                    if (googleBtn) googleBtn.style.display = 'none';
                                }
                            } catch (error) {
                                console.error('[Startup] Failed to load Google calendars:', error);
                            }
                        }
                        
                        // Auto-load Notion databases if token exists
                        if (tokenStatus.hasNotion) {
                            try {
                                console.log('[Startup] Fetching Notion databases...');
                                const databases = await window.electronAPI.listNotionDatabases();
                                if (databases && databases.length > 0) {
                                    console.log('[Startup] ✅ Auto-loaded', databases.length, 'Notion databases');
                                    await renderNotionDatabases(databases);
                                    loadedNotion = true;
                                    // Hide connect button since we're already connected
                                    const notionBtn = document.getElementById('notion-connect');
                                    if (notionBtn) notionBtn.style.display = 'none';
                                }
                            } catch (error) {
                                console.error('[Startup] Failed to load Notion databases:', error);
                            }
                        }
                        
                        // ✅ CRITICAL FIX: After both are loaded, trigger auto-sync if selections exist
                        if ((loadedGoogle || loadedNotion) && selected.google.length > 0 && selected.notion.length > 0) {
                            console.log('[Startup] ✅ Triggering auto-sync with saved selections');
                            setTimeout(() => triggerAutoSync(), 300);
                        }
                    } else {
                        console.log('[Startup] No existing OAuth tokens found - user needs to authenticate');
                    }
                } catch (error) {
                    console.error('[Startup] Error checking for existing tokens:', error);
                }
            }
            
            // Run auto-load in background (don't block UI)
            autoLoadExistingTokens();
            
            // ✅ NEW: Restore previously active sync pairs from storage
            console.log('[Startup] Attempting to restore sync pairs from storage...');
            try {
                const restoreResult = await window.electronAPI.restoreSyncPairs();
                if (restoreResult && restoreResult.success && restoreResult.syncPairs && restoreResult.syncPairs.length > 0) {
                    console.log('[Startup] ✅ Restored', restoreResult.syncPairs.length, 'sync pair(s)');
                } else {
                    console.log('[Startup] ℹ️ No sync pairs to restore');
                }
            } catch (error) {
                console.warn('[Startup] ⚠️ Error restoring sync pairs:', error);
            }

            // Update account UI state based on token
            const tokenPresent = !!localStorage.getItem('auth_token');
            const authOverlay = document.getElementById('auth-overlay');
            const loggedInContainer = document.getElementById('logged-in-container');
            const loggedInEmail = document.getElementById('logged-in-email');

            if (tokenPresent) {
                // Fetch email from /me for display
                try {
                    const base = (window.electronAPI && window.electronAPI.backendUrl) ? window.electronAPI.backendUrl : 'https://synk-web.onrender.com';
                    const resp = await fetch(base + '/me', { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') } });
                    const me = await resp.json().catch(() => ({}));
                    console.log('[About Tab] /me response:', me);
                    if (me && me.email && loggedInEmail) {
                        loggedInEmail.textContent = me.email;
                        console.log('[About Tab] Email set to:', me.email);
                    } else {
                        console.warn('[About Tab] Email not found in /me response');
                    }
                } catch (err) {
                    console.error('[About Tab] Error fetching email:', err);
                }

                // Hide auth overlay (no transition needed on initial load)
                if (authOverlay) {
                    authOverlay.style.display = 'none';
                    authOverlay.style.opacity = '0';
                }
                if (loggedInContainer) loggedInContainer.style.display = 'flex';
                startPlanPolling();
            } else {
                // Show auth overlay with initial state (no animation on first load)
                if (authOverlay) {
                    authOverlay.style.display = 'flex';
                    authOverlay.style.opacity = '1';
                    const innerCard = authOverlay.querySelector('div');
                    if (innerCard) innerCard.style.transform = 'scale(1)';
                }
                if (loggedInContainer) loggedInContainer.style.display = 'none';
            }
            
            // Initially hide sync status panel (dashboard is default tab)
            const syncStatusPanel = document.getElementById('sync-status-panel');
            if (syncStatusPanel) {
                syncStatusPanel.style.display = 'none';
            }
            

            const minimizeBtn = document.getElementById('minimize-btn');
            const maximizeBtn = document.getElementById('maximize-btn');
            const closeBtn = document.getElementById('close-btn');

            if (minimizeBtn) minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.electronAPI && window.electronAPI.minimize) window.electronAPI.minimize();
            });
            if (maximizeBtn) maximizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.electronAPI && window.electronAPI.maximize) window.electronAPI.maximize();
            });
            if (closeBtn) closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.electronAPI && window.electronAPI.close) window.electronAPI.close();
            });

            // Refresh Plan button
            const refreshBtn = document.getElementById('refresh-plan-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', async () => {
                    // Add loading animation to Refresh Plan button
                    const originalHtml = refreshBtn.innerHTML;
                    refreshBtn.disabled = true;
                    refreshBtn.innerHTML = '<span class="spinner" style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.2);border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite;margin-right:8px;"></span>Refreshing...';
                    try {
                        // On refresh, require login first (token)
                        const token = localStorage.getItem('auth_token');
                        if (!token) {
                            showErrorToast('Please log in first to refresh your plan.');
                            return;
                        }
                        const base = (window.electronAPI && window.electronAPI.backendUrl) ? window.electronAPI.backendUrl : 'https://synk-web.onrender.com';
                        const resp = await fetch(base + '/me', { headers: { 'Authorization': 'Bearer ' + token } });
                        const data = await resp.json();
                        if (data && data.success) {
                            updatePlanDisplay({
                                type: data.plan?.type || 'none',
                                billingCycle: data.plan?.billingCycle || data.billing_period || null,
                                description: data.plan?.description || undefined,
                                is_trial: !!data.is_trial,
                                trial_end: data.trial_end || null
                            });
                            showSuccessToast('Plan refreshed');
                            return;
                        }
                        showErrorToast('Failed to refresh plan: ' + (data && data.error ? data.error : 'unknown error'));
                    } catch (err) {
                        showErrorToast('Refresh failed: ' + err.message);
                    } finally {
                        // Restore button state
                        refreshBtn.disabled = false;
                        refreshBtn.innerHTML = originalHtml;
                    }
                });
            }

            // Auth handlers
            const loginBtn = document.getElementById('login-btn');
            const authStatus = document.getElementById('auth-status');
            const authEmailInput = document.getElementById('auth-email');
            const authPasswordInput = document.getElementById('auth-password');
            
            function setAuthStatus(msg, ok = true) {
                if (authStatus) {
                    // Dragon's breath orange for any status unless it is an error
                    authStatus.style.color = ok ? '#ff4500' : '#ef5350';
                    authStatus.textContent = msg;
                }
            }

            // Smooth auth overlay show/hide with transitions
            function showAuthOverlay() {
                const authOverlay = document.getElementById('auth-overlay');
                if (authOverlay) {
                    authOverlay.style.display = 'flex';
                    // Trigger reflow to enable transition
                    authOverlay.offsetHeight;
                    authOverlay.style.opacity = '1';
                    const innerCard = authOverlay.querySelector('div');
                    if (innerCard) innerCard.style.transform = 'scale(1)';
                }
            }

            function hideAuthOverlay() {
                const authOverlay = document.getElementById('auth-overlay');
                if (authOverlay) {
                    authOverlay.style.opacity = '0';
                    const innerCard = authOverlay.querySelector('div');
                    if (innerCard) innerCard.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        authOverlay.style.display = 'none';
                    }, 300); // Match transition duration
                }
            }

            async function doLogin() {
                const email = (authEmailInput||{}).value;
                const password = (authPasswordInput||{}).value;
                if (!email || !password) { 
                    setAuthStatus('Email and password required', false); 
                    return; 
                }
                const base = (window.electronAPI && window.electronAPI.backendUrl) ? window.electronAPI.backendUrl : 'https://synk-web.onrender.com';
                try {
                    // Dragons breath orange
                    setAuthStatus('Logging in...', true);
                    if (authStatus) authStatus.style.color = '#ff4500';
                    
                    const resp = await fetch(base + '/login', { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify({ email, password }) 
                    });
                    const data = await resp.json().catch(() => ({ success: false, error: 'invalid_response' }));
                    
                    if (data && data.success && data.token) {
                        localStorage.setItem('auth_token', data.token);
                        setAuthStatus('Logged in successfully!', true);
                        
                        // Immediately fetch plan via /me
                        const meResp = await fetch(base + '/me', { 
                            headers: { 'Authorization': 'Bearer ' + data.token } 
                        });
                        const me = await meResp.json().catch(() => ({ success: false }));
                        
                        if (me && me.success) {
                            updatePlanDisplay({
                                type: me.plan?.type || 'none',
                                billingCycle: me.plan?.billingCycle || me.billing_period || null,
                                description: me.plan?.description || undefined,
                                is_trial: !!me.is_trial,
                                trial_end: me.trial_end || null
                            });
                            
                            // Hide auth overlay with smooth transition
                            hideAuthOverlay();
                            
                            // Show logged in container
                            setTimeout(() => {
                                document.getElementById('logged-in-container').style.display = 'flex';
                                if (me.email) document.getElementById('logged-in-email').textContent = me.email;
                            }, 150);
                            
                            startPlanPolling();
                        }
                    } else {
                        setAuthStatus((data && data.error) ? data.error : 'Login failed', false);
                    }
                } catch (e) {
                    setAuthStatus('Network error. Check connection and try again.', false);
                }
            }

            // Login button click handler
            if (loginBtn) {
                loginBtn.addEventListener('click', doLogin);
            }
            
            // Enter key support for login form
            if (authEmailInput) {
                authEmailInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') doLogin();
                });
            }
            if (authPasswordInput) {
                authPasswordInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') doLogin();
                });
            }

            // Logout
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async () => {
                    // Clear token and stop polling
                    localStorage.removeItem('auth_token');
                    if (typeof __planPoller !== 'undefined' && __planPoller) { clearInterval(__planPoller); __planPoller = null; }
                    
                    // UI swap back with smooth transition
                    document.getElementById('logged-in-container').style.display = 'none';
                    showAuthOverlay();
                    
                    // Clear form fields
                    if (authEmailInput) authEmailInput.value = '';
                    if (authPasswordInput) authPasswordInput.value = '';
                    setAuthStatus('');
                    
                    // Reset plan to no current plan (gray)
                    updatePlanDisplay({ type: 'none' });
                    showSuccessToast('Logged out');
                });
            }

            // About page link handlers
            const homepageLink = document.getElementById('homepage-link');
            if (homepageLink) {
                homepageLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.electronAPI.openExternal('https://synk-official.com');
                });
            }

            // Support email is handled by default mailto: behavior
            
            // Tab Navigation
            document.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', () => {
                    const tabId = item.dataset.tab;
                    switchTab(tabId);
                });
            });
            
            // OAuth Connection Handler Functions
            async function handleGoogleConnect() {
                if (isGoogleConnecting) {
                    console.log('[Renderer] Google OAuth already in progress');
                    return;
                }
                
                isGoogleConnecting = true;
                const btn = document.getElementById('google-connect');
                if (btn) {
                    btn.disabled = true;
                    btn.textContent = 'Connecting...';
                }
                
                showGoogleOAuthStatus();
                
                try {
                    console.log('[Renderer] Starting Google OAuth...');
                    const result = await window.electronAPI.startGoogleOAuth();
                    console.log('[Renderer] Google OAuth result:', result);
                    
                    if (result && result.success) {
                        console.log('[Renderer] ✅ Google OAuth successful, waiting for calendars to display...');
                        // Success event will be received and handled by the 'google-oauth-success' listener
                        // Button will be hidden and calendars displayed automatically
                    } else {
                        // Error occurred
                        isGoogleConnecting = false;
                        if (btn) {
                            btn.disabled = false;
                            btn.textContent = 'Connect Google Calendar';
                        }
                        hideGoogleOAuthStatus();
                        showErrorToast(result?.error || 'Failed to authenticate with Google');
                    }
                } catch (error) {
                    console.error('[Renderer] Google OAuth error:', error);
                    isGoogleConnecting = false;
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Connect Google Calendar';
                    }
                    hideGoogleOAuthStatus();
                    showErrorToast('Failed to start Google authentication');
                }
            }
            
            async function handleNotionConnect() {
                if (isNotionConnecting) {
                    console.log('[Renderer] Notion OAuth already in progress');
                    return;
                }
                
                isNotionConnecting = true;
                const btn = document.getElementById('notion-connect');
                if (btn) {
                    btn.disabled = true;
                    btn.textContent = 'Connecting...';
                }
                
                showNotionOAuthStatus();
                
                try {
                    console.log('[Renderer] Starting Notion OAuth...');
                    const result = await window.electronAPI.startNotionOAuth();
                    console.log('[Renderer] Notion OAuth result:', result);
                    
                    if (result && result.success) {
                        console.log('[Renderer] ✅ Notion OAuth successful, waiting for databases to display...');
                        // Success event will be received and handled by the 'notion-oauth-success' listener
                        // Button will be hidden and databases displayed automatically
                    } else {
                        // Error occurred
                        isNotionConnecting = false;
                        if (btn) {
                            btn.disabled = false;
                            btn.textContent = 'Connect Notion';
                        }
                        hideNotionOAuthStatus();
                        showErrorToast(result?.error || 'Failed to authenticate with Notion');
                    }
                } catch (error) {
                    console.error('[Renderer] Notion OAuth error:', error);
                    isNotionConnecting = false;
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Connect Notion';
                    }
                    hideNotionOAuthStatus();
                    showErrorToast('Failed to start Notion authentication');
                }
            }
            
            // OAuth Connection Handlers - Wait for tabs to load first
            // These buttons are in the dynamically-loaded sync-tab, so we can't attach listeners yet
            function attachOAuthHandlers() {
                const googleBtn = document.getElementById('google-connect');
                const notionBtn = document.getElementById('notion-connect');
                
                if (googleBtn) {
                    googleBtn.addEventListener('click', handleGoogleConnect);
                    console.log('[OAuth] ✅ Google connect button handler attached');
                } else {
                    console.warn('[OAuth] ⚠️ Google connect button not found in DOM');
                }
                
                if (notionBtn) {
                    notionBtn.addEventListener('click', handleNotionConnect);
                    console.log('[OAuth] ✅ Notion connect button handler attached');
                } else {
                    console.warn('[OAuth] ⚠️ Notion connect button not found in DOM');
                }
            }
            
            // Try to attach immediately, but fall back to tabs-loaded event
            setTimeout(() => {
                if (document.getElementById('google-connect')) {
                    attachOAuthHandlers();
                } else {
                    console.log('[OAuth] Tabs not loaded yet, will attach handlers on tabs-loaded event');
                    window.addEventListener('tabs-loaded', attachOAuthHandlers, { once: true });
                }
            }, 100);
            
            // ========================================
            // REAL-TIME & BACKGROUND SYNC SYSTEM
            // ========================================
            // When app is OPEN: Real-time sync with incremental updates (only modified events)
            // When app is CLOSED: Background sync runs on schedule (handled by main process)
            
            let realtimeSyncInterval = null;
            let backgroundSyncInterval = null;
            const REALTIME_SYNC_INTERVAL_MS = 5 * 1000; // 5 seconds while app is OPEN (regardless of focus)
            const BACKGROUND_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes for background when app is FULLY CLOSED
            let lastSyncTimestamp = null;
            let isAppVisible = !document.hidden; // Initialize with current visibility state
            
            // Track app visibility for logging purposes only
            // NOTE: Visibility change (minimized/unfocused) does NOT stop polling
            // Only when app is FULLY CLOSED should background sync take over (handled by main process)
            document.addEventListener('visibilitychange', async () => {
                isAppVisible = !document.hidden;
                console.log(`[Sync Manager] ??? App visibility changed: ${isAppVisible ? 'VISIBLE' : 'HIDDEN'}`);
                console.log('[Sync Manager] ?? Note: Polling continues at 5s interval while app window exists (even if minimized/unfocused)');
                
                // Notify main process about visibility change (for future use)
                if (window.electronAPI && window.electronAPI.setAppVisibility) {
                    try {
                        await window.electronAPI.setAppVisibility(isAppVisible);
                        console.log(`[Sync Manager] ?? Notified main process: app is ${isAppVisible ? 'VISIBLE' : 'HIDDEN'}`);
                    } catch (error) {
                        console.error('[Sync Manager] ? Failed to notify main process:', error);
                    }
                }
                // We do NOT switch sync modes here - keep 5s polling while app is open
            });
            
            // Real-time sync (when app is OPEN - visible, minimized, or unfocused)
            // This runs with 5-second polling to detect changes frequently
            function startRealtimeSync() {
                if (realtimeSyncInterval) {
                    console.log('[Real-time Sync] Already running, skipping start');
                    return;
                }
                
                console.log('[Real-time Sync] ? ENABLED - Checking for changes every 5 seconds');
                console.log('[Real-time Sync] ?? Mode: INCREMENTAL (only modified events since last sync)');
                console.log('[Real-time Sync] ?? This polling runs while app window is OPEN (even if minimized)');
                
                // Perform initial sync
                performIncrementalSync();
                
                realtimeSyncInterval = setInterval(async () => {
                    await performIncrementalSync();
                }, REALTIME_SYNC_INTERVAL_MS);
                
                console.log('[Real-time Sync] ? Next check scheduled in 5 seconds');
            }
            
            function stopRealtimeSync() {
                if (realtimeSyncInterval) {
                    clearInterval(realtimeSyncInterval);
                    realtimeSyncInterval = null;
                    console.log('[Real-time Sync] ? STOPPED - Polling interval cleared');
                } else {
                    console.log('[Real-time Sync] Already stopped');
                }
            }
            
            // Background sync (when app is FULLY CLOSED) - handled by main process
            // This function is kept for potential future use
            function startBackgroundSync() {
                if (backgroundSyncInterval) {
                    console.log('[Background Sync] Already running, skipping start');
                    return;
                }
                
                console.log('[Background Sync] ? ENABLED - Running full sync every 5 minutes');
                console.log('[Background Sync] ?? Mode: SCHEDULED (for when app is FULLY CLOSED)');
                console.log('[Background Sync] ?? Note: Main process handles background sync when window is closed');
                
                backgroundSyncInterval = setInterval(async () => {
                    await performFullSync();
                }, BACKGROUND_SYNC_INTERVAL_MS);
                
                console.log('[Background Sync] ? Next sync scheduled in 5 minutes');
            }
            
            function stopBackgroundSync() {
                if (backgroundSyncInterval) {
                    clearInterval(backgroundSyncInterval);
                    backgroundSyncInterval = null;
                    console.log('[Background Sync] ? DISABLED - Automatic sync stopped');
                } else {
                    console.log('[Background Sync] Already stopped');
                }
            }
            
            // Incremental sync - only syncs events modified since last sync
            async function performIncrementalSync() {
                try {
                    console.log('[Real-time Sync] ?? Checking for changes...');
                    
                    // Check if user is connected to both services
                    if (!isGoogleActuallyConnected() || !isNotionActuallyConnected()) {
                        console.log('[Real-time Sync] ?? Skipping - not connected to both services', {
                            google: isGoogleActuallyConnected(),
                            notion: isNotionActuallyConnected()
                        });
                        return;
                    }
                    
                    // Get selected calendars and databases
                    const selectedCalendars = Array.from(document.querySelectorAll('.calendar-item input[type="checkbox"]:checked'))
                        .map(cb => cb.value);
                    const selectedDatabases = Array.from(document.querySelectorAll('.database-item input[type="checkbox"]:checked'))
                        .map(cb => cb.value);
                    
                    if (selectedCalendars.length === 0 || selectedDatabases.length === 0) {
                        console.log('[Real-time Sync] ?? Skipping - no calendars or databases selected', {
                            calendars: selectedCalendars.length,
                            databases: selectedDatabases.length
                        });
                        return;
                    }
                    
                    // Get last sync timestamp
                    const lastSync = lastSyncTimestamp || localStorage.getItem('last-sync-timestamp');
                    const timeSinceLastSync = lastSync ? Math.round((Date.now() - new Date(lastSync).getTime()) / 1000) : null;
                    
                    console.log('[Real-time Sync] ?? Incremental sync:', {
                        calendars: selectedCalendars.length,
                        databases: selectedDatabases.length,
                        lastSync: lastSync ? new Date(lastSync).toLocaleString() : 'Never',
                        timeSinceLastSync: timeSinceLastSync ? `${timeSinceLastSync}s ago` : 'N/A'
                    });
                    
                    // Perform incremental sync via Electron API
                    if (window.electronAPI && window.electronAPI.forceSync) {
                        const result = await window.electronAPI.forceSync();
                        
                        if (result.success) {
                            // Update last sync timestamp
                            lastSyncTimestamp = new Date().toISOString();
                            localStorage.setItem('last-sync-timestamp', lastSyncTimestamp);
                            
                            console.log('[Real-time Sync] ? Incremental sync completed', {
                                timestamp: new Date(lastSyncTimestamp).toLocaleString()
                            });
                            
                            // Update UI if sync stats are available
                            if (window.electronAPI.getSyncStats) {
                                const stats = await window.electronAPI.getSyncStats();
                                updateSyncStatsUI(stats);
                            }
                        } else {
                            console.error('[Real-time Sync] ? Sync failed:', result.error);
                        }
                    } else {
                        console.log('[Real-time Sync] ?? Sync API not available (running in browser mode)');
                    }
                    
                } catch (error) {
                    console.error('[Real-time Sync] ? ERROR during incremental sync:', error);
                }
            }
            
            // Full sync - syncs all events (used when app is closed/minimized)
            async function performFullSync() {
                try {
                    console.log('[Background Sync] ?? Running full sync...');
                    
                    // Check if user is connected to both services
                    if (!isGoogleActuallyConnected() || !isNotionActuallyConnected()) {
                        console.log('[Background Sync] ?? Skipping - not connected to both services', {
                            google: isGoogleActuallyConnected(),
                            notion: isNotionActuallyConnected()
                        });
                        return;
                    }
                    
                    // Get selected calendars and databases
                    const selectedCalendars = Array.from(document.querySelectorAll('.calendar-item input[type="checkbox"]:checked'))
                        .map(cb => cb.value);
                    const selectedDatabases = Array.from(document.querySelectorAll('.database-item input[type="checkbox"]:checked'))
                        .map(cb => cb.value);
                    
                    if (selectedCalendars.length === 0 || selectedDatabases.length === 0) {
                        console.log('[Background Sync] ?? Skipping - no calendars or databases selected', {
                            calendars: selectedCalendars.length,
                            databases: selectedDatabases.length
                        });
                        return;
                    }
                    
                    console.log('[Background Sync] ?? Full sync:', {
                        calendars: selectedCalendars.length,
                        databases: selectedDatabases.length
                    });
                    
                    // Perform full sync via Electron API
                    if (window.electronAPI && window.electronAPI.forceSync) {
                        const result = await window.electronAPI.forceSync();
                        
                        if (result.success) {
                            // Update last sync timestamp
                            lastSyncTimestamp = new Date().toISOString();
                            localStorage.setItem('last-sync-timestamp', lastSyncTimestamp);
                            
                            console.log('[Background Sync] ? Full sync completed', {
                                timestamp: new Date(lastSyncTimestamp).toLocaleString()
                            });
                            
                            // Update UI if sync stats are available
                            if (window.electronAPI.getSyncStats) {
                                const stats = await window.electronAPI.getSyncStats();
                                updateSyncStatsUI(stats);
                            }
                        } else {
                            console.error('[Background Sync] ? Sync failed:', result.error);
                        }
                    } else {
                        console.log('[Background Sync] ?? Sync API not available (running in browser mode)');
                    }
                    
                } catch (error) {
                    console.error('[Background Sync] ? ERROR during full sync:', error);
                }
            }
            
            // Update sync stats in UI
            function updateSyncStatsUI(stats) {
                try {
                    const lastSyncElement = document.getElementById('last-sync');
                    const syncCountElement = document.getElementById('sync-count');
                    
                    if (lastSyncElement && lastSyncTimestamp) {
                        const date = new Date(lastSyncTimestamp);
                        const timeStr = date.toLocaleTimeString();
                        lastSyncElement.textContent = `Last synced at ${timeStr}`;
                    }
                    
                    if (syncCountElement && stats && stats.totalSyncs) {
                        syncCountElement.textContent = `${stats.totalSyncs} syncs completed`;
                    }
                } catch (error) {
                    console.error('[Sync Manager] ? Error updating UI:', error);
                }
            }
            
            // Background Sync Toggle Handler
            const backgroundSyncToggle = document.getElementById('background-sync-toggle');
            if (backgroundSyncToggle) {
                // Load saved state from localStorage
                const savedState = localStorage.getItem('background-sync-enabled');
                const isEnabled = savedState === null ? true : savedState === 'true'; // Default to enabled
                backgroundSyncToggle.checked = isEnabled;
                
                console.log('[Sync Manager] ?? Initial state:', isEnabled ? 'ENABLED' : 'DISABLED');
                console.log('[Sync Manager] ??? App is currently:', isAppVisible ? 'VISIBLE' : 'HIDDEN');
                
                // Start appropriate sync mode based on app visibility
                if (isEnabled) {
                    if (isAppVisible) {
                        startRealtimeSync();
                    } else {
                        startBackgroundSync();
                    }
                }
                
                // Toggle event listener
                backgroundSyncToggle.addEventListener('change', (e) => {
                    const enabled = e.target.checked;
                    
                    console.log('[Sync Manager] ?? Toggle changed:', enabled ? 'ENABLED' : 'DISABLED');
                    
                    if (enabled) {
                        // Check if user has Pro plan or higher for background sync
                        if (currentPlanData.type === 'free') {
                            e.target.checked = false;
                            localStorage.setItem('background-sync-enabled', 'false');
                            showErrorToast('Background sync requires a Pro plan or higher. Please upgrade to enable this feature.');
                            console.log('[Sync Manager] ❌ Background sync denied: Free plan');
                            return;
                        }
                        
                        // Save state to localStorage
                        localStorage.setItem('background-sync-enabled', 'true');
                        
                        // Start appropriate sync mode based on app visibility
                        if (isAppVisible) {
                            startRealtimeSync();
                            showSuccessToast('Real-time sync enabled');
                        } else {
                            startBackgroundSync();
                            showSuccessToast('Background sync enabled');
                        }
                    } else {
                        // Save state to localStorage
                        localStorage.setItem('background-sync-enabled', 'false');
                        
                        // Stop both sync modes
                        stopRealtimeSync();
                        stopBackgroundSync();
                        showSuccessToast('Sync disabled');
                    }
                });
            } else {
                console.error('[Sync Manager] ? ERROR: Toggle element not found');
            }
        });

        // UI State Management
        let isGoogleConnecting = false;
        let isNotionConnecting = false;
        let isGoogleConnected = false;
        let isNotionConnected = false;
        let currentTab = 'dashboard';
        
        // Helper to check connection status from global state (OAuth listeners set this)
        function isGoogleActuallyConnected() {
            const result = !!(window.synkGlobalState && window.synkGlobalState.isGoogleConnected);
            console.log('[Connection Check] Google connected?', result, '| Global state:', window.synkGlobalState);
            return result;
        }
        
        function isNotionActuallyConnected() {
            const result = !!(window.synkGlobalState && window.synkGlobalState.isNotionConnected);
            console.log('[Connection Check] Notion connected?', result, '| Global state:', window.synkGlobalState);
            return result;
        }
        
        // Production mode only - no demo mode detection needed
        
        // Notion OAuth Status Helper Functions
        function showGoogleOAuthStatus() {
            // Show Google OAuth loading status
            const googleOAuthStatus = document.getElementById('google-oauth-status');
            if (googleOAuthStatus) {
                googleOAuthStatus.style.display = 'flex';
                const googleLoading = document.getElementById('google-loading');
                if (googleLoading) {
                    googleLoading.style.display = 'flex';
                }
                const googleError = document.getElementById('google-error');
                if (googleError) {
                    googleError.style.display = 'none';
                }
                console.log('[Renderer] Google OAuth status: Showing');
            }
        }
        
        function hideGoogleOAuthStatus() {
            // Hide Google OAuth loading status
            const googleOAuthStatus = document.getElementById('google-oauth-status');
            if (googleOAuthStatus) {
                googleOAuthStatus.style.display = 'none';
                console.log('[Renderer] Google OAuth status: Hidden');
            }
        }

        function showNotionOAuthStatus() {
            // Show Notion OAuth loading status
            const notionOAuthStatus = document.getElementById('notion-oauth-status');
            if (notionOAuthStatus) {
                notionOAuthStatus.style.display = 'flex';
                const notionLoading = document.getElementById('notion-loading');
                if (notionLoading) {
                    notionLoading.style.display = 'flex';
                }
                const notionError = document.getElementById('notion-error');
                if (notionError) {
                    notionError.style.display = 'none';
                }
                console.log('[Renderer] Notion OAuth status: Showing');
            }
        }
        
        function hideNotionOAuthStatus() {
            // Hide Notion OAuth loading status
            const notionOAuthStatus = document.getElementById('notion-oauth-status');
            if (notionOAuthStatus) {
                notionOAuthStatus.style.display = 'none';
                console.log('[Renderer] Notion OAuth status: Hidden');
            }
        }

        function switchTab(tabId) {
            // Update navigation
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

            // Update content
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabId}-tab`).classList.add('active');

            // Show/hide sync status panel only on sync tab
            const syncStatusPanel = document.getElementById('sync-status-panel');
            if (syncStatusPanel) {
                if (tabId === 'sync') {
                    syncStatusPanel.style.display = 'block';
                } else {
                    syncStatusPanel.style.display = 'none';
                }
            }

            // Update header title
            const titles = {
                dashboard: 'Dashboard',
                sync: 'Sync',
                settings: 'Settings',
                logs: 'Activity Logs',
                about: 'About'
            };
            document.getElementById('header-title').textContent = titles[tabId];
            currentTab = tabId;
        }

        // Update UI Management
        (function initUpdateUI(){
            const checkBtn = document.getElementById('check-updates');
            const status = document.getElementById('update-status');
            const msg = document.getElementById('update-message');
            const prompt = document.getElementById('pref-prompt');
            const auto = document.getElementById('pref-auto');
            const manual = document.getElementById('pref-manual');

            function showMessage(html, type){
                if (!status || !msg) return;
                msg.innerHTML = html;
                status.style.display = 'block';
                status.className = `update-${type}`;
            }

            if (checkBtn) {
                checkBtn.addEventListener('click', () => {
                    window.electronAPI.checkForUpdates();
                    showMessage('Checking for updates...', 'info');
                });
            }

            // set initial preference
            if (window.electronAPI.getUpdatePreference) {
                window.electronAPI.getUpdatePreference().then(pref => {
                    if (pref === 'auto' && auto) auto.checked = true;
                    else if (pref === 'manual' && manual) manual.checked = true;
                    else if (prompt) prompt.checked = true;
                });
            }

            // handle preference changes
            [prompt, auto, manual].forEach(input => {
                if (!input) return;
                input.addEventListener('change', () => {
                    if (input.checked) window.electronAPI.setUpdatePreference(input.value);
                });
            });

            // listeners from main
            if (window.electronAPI.onUpdateAvailable) {
                window.electronAPI.onUpdateAvailable((_e, info) => {
                    showMessage(`Version ${info.version} available!\n\nDownloading update automatically...`, 'info');
                });
            }
            if (window.electronAPI.onDownloadProgress) {
                window.electronAPI.onDownloadProgress((_e, p) => {
                    const pct = (p && p.percent) ? p.percent.toFixed(0) : '';
                    showMessage(`Downloading update... ${pct}%`, 'info');
                });
            }
            if (window.electronAPI.onUpdateDownloaded) {
                window.electronAPI.onUpdateDownloaded((_e, info) => {
                    showMessage(`Update ready to install!\n\nRestart Synk to apply version ${info.version}`, 'success');
                });
            }

            // what's new
            (async function loadLog(){
                try {
                    const resp = await fetch('update-log.json');
                    const data = await resp.json();
                    const container = document.getElementById('update-entries');
                    if (!container || !Array.isArray(data.updates)) return;
                    container.innerHTML = data.updates.map(u => `
                        <div style="background:#0f0f0f; border:1px solid #333; border-radius:10px; padding:12px;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                                <strong>v${u.version}</strong>
                                <span style="color:#888;">${u.date || ''}</span>
                            </div>
                            ${u.features && u.features.length ? `<div style='margin-top:6px;'><em>New Features:</em><br>${u.features.map(f=>`? ${f}`).join('<br>')}</div>`: ''}
                            ${u.improvements && u.improvements.length ? `<div style='margin-top:6px;'><em>Improvements:</em><br>${u.improvements.map(f=>`? ${f}`).join('<br>')}</div>`: ''}
                            ${u.fixes && u.fixes.length ? `<div style='margin-top:6px;'><em>Fixes:</em><br>${u.fixes.map(f=>`? ${f}`).join('<br>')}</div>`: ''}
                        </div>
                    `).join('');
                } catch {}
            })();
            
            // New Refresh Button Handler
            // Wait for tabs to load, then setup refresh button
            window.addEventListener('tabs-loaded', () => {
                const refreshBtn = document.getElementById('refresh-sync-btn');
                if (!refreshBtn) {
                    console.warn('⚠️ Refresh button not found');
                    return;
                }
                
                refreshBtn.addEventListener('click', async () => {
                    const btn = document.getElementById('refresh-sync-btn');
                    
                    // SAVE current selections BEFORE refresh
                    const savedSelection = { google: selected.google, notion: selected.notion };
                    
                    try {
                        btn.disabled = true;
                        btn.classList.add('spinning');
                        
                        // Refresh Google calendars if connected
                        if (isGoogleActuallyConnected()) {
                            console.log('Refreshing Google calendars...');
                            const gcRes = await window.electronAPI.listGoogleCalendars();
                            const calendars = (gcRes && (gcRes.calendars ?? gcRes)) || [];
                            if ((Array.isArray(calendars) && calendars.length > 0) || calendars?.allCalendars?.length > 0 || calendars?.items?.length > 0 || calendars?.myCalendars?.length > 0) {
                                await renderGoogleCalendars(calendars);
                                // RESTORE selection after rendering
                                if (savedSelection.google) {
                                    selected.google = savedSelection.google;
                                    console.log('✅ Restored Google selection:', savedSelection.google);
                                }
                            }
                        }
                        
                        // Refresh Notion databases if connected
                        if (isNotionActuallyConnected()) {
                            console.log('Refreshing Notion databases...');
                            const dbRes = await window.electronAPI.listDatabases();
                            const databases = (dbRes && (dbRes.databases ?? dbRes)) || [];
                            if (Array.isArray(databases) && databases.length > 0) {
                                await renderNotionDatabases(databases);
                                // RESTORE selection after rendering
                                if (savedSelection.notion) {
                                    selected.notion = savedSelection.notion;
                                    console.log('✅ Restored Notion selection:', savedSelection.notion);
                                }
                            }
                        }
                        
                        // RE-APPLY selection UI highlighting after both renders are done
                        renderSelectionUI();
                        
                        // Force immediate sync if both are connected and selections made
                        const hasGoogleSelection = selected.google && selected.google.length > 0;
                        const hasNotionSelection = selected.notion && selected.notion.length > 0;
                        
                        if (isGoogleActuallyConnected() && isNotionActuallyConnected() && hasGoogleSelection && hasNotionSelection) {
                            // Build sync pairs
                            const syncPairs = [];
                            for (const notionId of selected.notion) {
                                for (const googleId of selected.google) {
                                    syncPairs.push({ notion: notionId, google: googleId });
                                }
                            }
                            
                            console.log('🔄 Initiating manual sync with', syncPairs.length, 'pair(s)');
                            updateSyncStatus('Syncing...');
                            
                            try {
                                // ✅ FIX #3: Add retry logic for better sync reliability
                                const MAX_RETRIES = 2;
                                let syncSuccess = false;
                                
                                for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                                    try {
                                        if (attempt > 1) {
                                            console.log(`📝 Sync retry attempt ${attempt} of ${MAX_RETRIES}...`);
                                            updateSyncStatus(`Retrying sync (attempt ${attempt} of ${MAX_RETRIES})...`);
                                            // Wait 500ms before retry
                                            await new Promise(resolve => setTimeout(resolve, 500));
                                        } else {
                                            console.log('📝 Registering', syncPairs.length, 'sync pair(s)...');
                                        }
                                        
                                        // CRITICAL: Register pairs FIRST via startSync (this also queues the sync)
                                        const registerResult = await window.electronAPI.startSync(syncPairs);
                                        
                                        if (!registerResult || !registerResult.success) {
                                            if (attempt === MAX_RETRIES) {
                                                throw new Error('Failed to register sync pairs after ' + MAX_RETRIES + ' attempt(s)');
                                            }
                                            continue; // Retry
                                        }
                                        
                                        console.log('✅', syncPairs.length, 'sync pair(s) registered and queued');
                                        syncSuccess = true;
                                        break; // Success, exit retry loop
                                    } catch (e) {
                                        if (attempt === MAX_RETRIES) throw e;
                                        console.warn(`⚠️ Sync attempt ${attempt} failed, will retry...`);
                                    }
                                }
                                
                                if (!syncSuccess) {
                                    throw new Error('Sync registration failed after all retries');
                                }
                                
                                // Wait for the queued sync to complete
                                await new Promise(resolve => setTimeout(resolve, 2000));
                                
                                // Refresh all selected calendars
                                for (const googleId of selected.google) {
                                    try {
                                        console.log('📅 Refreshing Google Calendar:', googleId);
                                        const events = await window.electronAPI.getCalendarEvents(googleId);
                                        console.log('✅ Calendar refreshed with', events?.length || 0, 'events');
                                    } catch (e) {
                                        console.warn('⚠️ Could not refresh Google Calendar:', e);
                                    }
                                }
                                
                                // Refresh all selected databases
                                for (const notionId of selected.notion) {
                                    try {
                                        console.log('📊 Refreshing Notion database:', notionId);
                                        const pages = await window.electronAPI.getDatabasePages(notionId);
                                        console.log('✅ Database refreshed with', pages?.length || 0, 'pages');
                                    } catch (e) {
                                        console.warn('⚠️ Could not refresh Notion database:', e);
                                    }
                                }
                                
                                updateSyncStatus('Sync completed! Check both services for updates.');
                            } catch (error) {
                                console.error('❌ Manual sync failed:', error);
                                updateSyncStatus('Sync failed: ' + (error.message || 'Unknown error'));
                            }
                        } else {
                            console.log('⚠️ Sync requirements not met:', {
                                googleConnected: isGoogleActuallyConnected(),
                                notionConnected: isNotionActuallyConnected(),
                                googleSelected: hasGoogleSelection,
                                notionSelected: hasNotionSelection
                            });
                            
                            // Provide helpful error message
                            let errorMsg = 'Please ';
                            if (!isGoogleActuallyConnected()) errorMsg += 'connect Google, ';
                            if (!isNotionActuallyConnected()) errorMsg += 'connect Notion, ';
                            if (!hasGoogleSelection && isGoogleActuallyConnected()) errorMsg += 'select a Google calendar, ';
                            if (!hasNotionSelection && isNotionActuallyConnected()) errorMsg += 'select a Notion database, ';
                            errorMsg = errorMsg.replace(/, $/, '.').replace(/, ([^,]+)$/, ' and $1.');
                            
                            updateSyncStatus(errorMsg);
                        }
                        
                        setTimeout(() => {
                            btn.disabled = false;
                            btn.classList.remove('spinning');
                        }, 1000);
                        
                    } catch (error) {
                        console.error('Refresh failed:', error);
                        updateSyncStatus('Refresh failed: ' + error.message);
                        btn.disabled = false;
                        btn.classList.remove('spinning');
                    }
                });
            });
            
            })();

        // Status Update Functions
        function updateGoogleStatus(type, message) {
            const status = document.getElementById('google-status');
            if (status) {
                status.className = `status ${type}`;
                status.textContent = message;
            }
        }

        function updateNotionStatus(type, message) {
            const status = document.getElementById('notion-status');
            if (status) {
                status.className = `status ${type}`;
                status.textContent = message;
            }
        }

        function updateConnectionPill(service, connected) {
            const pill = document.getElementById(`${service}-pill`);
            
            if (!pill) {
                console.warn(`[UI] Connection pill element missing for ${service}`);
                return;
            }
            
            // Get the service display name
            const serviceName = service.charAt(0).toUpperCase() + service.slice(1);
            
            if (connected) {
                pill.classList.remove('disconnected');
                pill.classList.add('connected');
                console.log(`[UI] ${serviceName} pill set to connected with dragon's breath glow`);
            } else {
                pill.classList.remove('connected');
                pill.classList.add('disconnected');
                console.log(`[UI] ${serviceName} pill set to disconnected (gray)`);
            }
        }

        // Ensure tabs are loaded before displaying data
        async function ensureTabsLoaded() {
            const container = document.getElementById('calendars-content');
            if (container) {
                console.log('✅ Tabs already loaded');
                return true;
            }
            
            console.log('⏳ Waiting for tabs to load...');
            return new Promise(resolve => {
                const checkExist = setInterval(() => {
                    const container = document.getElementById('calendars-content');
                    if (container) {
                        console.log('✅ Tabs now available');
                        clearInterval(checkExist);
                        resolve(true);
                    }
                }, 100);
                
                // Timeout after 5 seconds
                setTimeout(() => {
                    clearInterval(checkExist);
                    console.warn('⚠️ Tabs failed to load within 5 seconds, attempting anyway...');
                    resolve(false);
                }, 5000);
            });
        }

        // Safe wrappers that wait for tabs
        async function safeDisplayCalendars(calendarData) {
            await ensureTabsLoaded();
            displayCalendars(calendarData);
        }

        async function safeDisplayDatabases(databases) {
            await ensureTabsLoaded();
            displayDatabases(databases);
        }

        // Display Functions
        function displayCalendars(calendarData) {
            console.log('[Frontend] Received calendars:', calendarData);
            const container = document.getElementById('calendars-content');
            
            if (!container) {
                console.error('❌ calendars-content container not found in DOM');
                return;
            }
            
            // Flatten all calendars into a single list (like Notion databases)
            let allCalendars = [];
            
            if (Array.isArray(calendarData)) {
                // Old format - already an array
                allCalendars = calendarData;
            } else if (calendarData) {
                // New format - combine myCalendars and otherCalendars
                const myCalendars = calendarData.myCalendars || [];
                const otherCalendars = calendarData.otherCalendars || [];
                allCalendars = [...myCalendars, ...otherCalendars];
            }
            
            if (!allCalendars || allCalendars.length === 0) {
                container.innerHTML = '<div class="empty-state"><h3>No calendars found</h3><p>No calendars available in your account</p></div>';
                return;
            }

            // Simple list format like Notion databases
            container.innerHTML = allCalendars.map(cal => `
                <button class="sync-item calendar-item ${cal.primary ? 'primary' : ''}" data-id="${cal.id}" onclick="toggleSelect('${cal.id}', 'google')" aria-label="Select ${cal.name} calendar">
                    <div class="item-title">${cal.name}</div>
                    <div class="item-meta">${cal.primary ? 'Primary Calendar • ' : ''}${cal.accessRole || 'reader'} • ${cal.timeZone || 'UTC'}</div>
                </button>
            `).join('');
            
            // ✅ AUTORESTORE: Apply selection UI and disabled states
            renderSelectionUI();
            updateDisabledStates();
        }

        // Alias for backward compatibility (with tab-loading safety)
        async function renderGoogleCalendars(calendars) {
            return await safeDisplayCalendars(calendars);
        }

        async function renderNotionDatabases(databases) {
            return await safeDisplayDatabases(databases);
        }

        function displayDatabases(databases) {
            console.log('[Frontend] Received databases:', databases);
            const container = document.getElementById('notion-content');
            
            if (!container) {
                console.error('❌ notion-content container not found in DOM');
                return;
            }
            
            if (!databases || databases.length === 0) {
                container.innerHTML = '<div class="empty-state"><h3>No databases found</h3><p>No databases available in your workspace</p></div>';
                return;
            }

            container.innerHTML = databases.map(db => `
                <button class="sync-item database-item" data-id="${db.id}" onclick="toggleSelect('${db.id}', 'notion')" aria-label="Select ${db.title} database">
                    <div class="item-title">
                        ${db.title}
                    </div>
                    <div class="item-meta">
                        ${db.dateProperties && db.dateProperties.length > 0 ? 
                          `Date fields: ${db.dateProperties.join(', ')}` : 
                          `Properties: ${db.properties ? db.properties.join(', ') : 'None'}`} • ${db.last_edited_time ? new Date(db.last_edited_time).toLocaleDateString() : 'Unknown date'}
                    </div>
                </button>
            `).join('');
            
            // ✅ AUTORESTORE: Apply selection UI and disabled states
            renderSelectionUI();
            updateDisabledStates();
        }

        // Settings Handlers - Initialize only after tabs are loaded
        async function initializeSettingsHandlers() {
            // Wait for tabs to load
            await ensureTabsLoaded();
            
            // Now safely add event listeners
            // Reset Connections Handler
            const resetConnectionsBtn = document.getElementById('reset-connections-btn');
            if (resetConnectionsBtn) {
                resetConnectionsBtn.addEventListener('click', async () => {
                    if (confirm('Clear saved Google and Notion selections? You can select them again anytime.')) {
                        if (resetConnections()) {
                            // Re-render UI to clear selections
                            renderSelectionUI();
                            updateSyncStatus('Selections cleared - choose your calendars and databases again');
                            showSuccessToast('Selections cleared');
                            console.log('✅ Connection selections reset');
                        } else {
                            showErrorToast('Failed to reset connections');
                        }
                    }
                });
            }

            const clearDataBtn = document.getElementById('clear-data-btn');
            if (clearDataBtn) {
                clearDataBtn.addEventListener('click', async () => {
                    if (confirm('Are you sure you want to clear all data? This will disconnect all services.')) {
                        try {
                            await window.electronAPI.clearAllData();
                            // Reset UI
                            updateConnectionPill('google', false);
                            updateConnectionPill('notion', false);
                            // Guard legacy status elements (they may not exist)
                            const googleStatusEl = document.getElementById('google-status');
                            if (googleStatusEl) googleStatusEl.textContent = '';
                            const notionStatusEl = document.getElementById('notion-status');
                            if (notionStatusEl) notionStatusEl.textContent = '';
                            const calendarsContent = document.getElementById('calendars-content');
                            if (calendarsContent) calendarsContent.innerHTML = '<div class="empty-state"><h3>Connect Google to get started</h3><p>Your calendars will appear here</p></div>';
                            const notionContent = document.getElementById('notion-content');
                            if (notionContent) notionContent.innerHTML = '<div class="empty-state"><h3>Connect Notion to get started</h3><p>Your databases and pages will appear here</p></div>';
                        } catch (error) {
                            console.error('Failed to clear data:', error);
                        }
                    }
                });
            }

            // Hide properties panel by default as specified in Fix #4
            const propertiesPanel = document.getElementById('properties-panel');
            if (propertiesPanel) {
                propertiesPanel.style.display = 'none';
            }
        }
        
        // Call settings initialization
        initializeSettingsHandlers().catch(err => console.error('Failed to initialize settings:', err));

        // Error toast functions - expose to window for HTML onclick handlers
        window.showErrorToast = function(message) {
            const toast = document.getElementById('error-toast');
            const messageSpan = document.getElementById('error-message');
            if (toast && messageSpan) {
                messageSpan.textContent = message;
                toast.style.display = 'flex';
                toast.style.animation = 'slideInRight 0.3s ease-out';
                // Auto-hide after 6 seconds
                setTimeout(() => window.hideErrorToast(), 6000);
            }
        };

        window.hideErrorToast = function() {
            const toast = document.getElementById('error-toast');
            if (toast) {
                toast.style.display = 'none';
            }
        };

        window.showSuccessToast = function(message) {
            console.log('[Success]', message);
        };

        async function fetchNotionDatabases() {
            try {
                console.log('[Frontend] Fetching Notion databases...');
                const result = await window.electronAPI.getDatabases();
                console.log('[Frontend] Raw result from getDatabases:', result);
                
                // Handle the result structure - it might be an array or an object with databases property
                let databases;
                if (Array.isArray(result)) {
                    databases = result;
                } else if (result && result.databases) {
                    databases = result.databases;
                } else {
                    databases = [];
                }
                
                console.log('[Frontend] Processed databases:', databases);
                await renderNotionDatabases(databases);
            } catch (error) {
                console.error('[Frontend] Error fetching Notion databases:', error);
                // updateNotionStatus('error', 'Failed to fetch databases'); // Removed status div
            }
        }

        // Production mode only - no sample data needed

        // Event listeners for OAuth success and demo timeout
        if (window.electronAPI) {
            // ⚠️ CONFLICTING OAUTH HANDLERS REMOVED
            // These were using onOAuthSuccess() and onGoogleCalendars() instead of on() listeners
            // They were updating LOCAL variables (isGoogleConnected, isNotionConnected) instead of window.synkGlobalState
            // The correct handlers using window.electronAPI.on() are registered at the top of the script


            // ⚠️ DUPLICATE OAUTH FAILURE HANDLER REMOVED
            // This was using window.electronAPI.onOAuthFailed() instead of window.electronAPI.on('google-oauth-failed')
            // The correct handlers using window.electronAPI.on() are registered at lines 142-158
            // Those handlers correctly update window.synkGlobalState
        }
        
        // ========== SMART SYNC - WINDOW FOCUS DETECTION ==========
        // Adaptive polling based on window focus only (no UI changes)
        
        window.addEventListener('focus', () => {
            console.log('⚡ Window FOCUSED - Switching to fast polling (5s)');
            if (window.electronAPI && window.electronAPI.notifySyncManagerFocus) {
                window.electronAPI.notifySyncManagerFocus(true);
            }
        });
        
        window.addEventListener('blur', () => {
            console.log('📦 Window BACKGROUND - Switching to slow polling (2min)');
            if (window.electronAPI && window.electronAPI.notifySyncManagerFocus) {
                window.electronAPI.notifySyncManagerFocus(false);
            }
        });
        
        // Notify initial window focus state
        console.log('📍 Initial window focus state:', document.hasFocus());
        if (window.electronAPI && window.electronAPI.notifySyncManagerFocus) {
            window.electronAPI.notifySyncManagerFocus(document.hasFocus());
        }
        
        // ========== APP LIFECYCLE - SAVE STATE ON CLOSE ==========
        // Listen for app-closing event to ensure all state is saved
        if (window.electronAPI && window.electronAPI.on) {
            window.electronAPI.on('app-closing', (event, data) => {
                console.log('💾 App closing - saving all state to localStorage');
                saveConnectionsToStorage(); // Final save of calendar/database selections
                console.log('✅ State saved before app close');
            });
        }
