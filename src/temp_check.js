
        // Plan detection and display (prefer backend /me when logged in)
        let __planPoller = null;
        async function loadUserPlan() {
            try {
                console.log('🔍 Loading user plan...');
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
                        console.warn('⚠️ /me fetch failed, falling back to local plan file:', e.message);
                    }
                }

                // If no token or /me failed, show "no current plan" (do NOT use local file when logged out)
                updatePlanDisplay({
                    type: 'none',
                    name: 'No current plan',
                    description: 'No current plan. Sign up or log in, then purchase a plan to enable premium features.',
                    features: [],
                    status: 'none'
                });
            } catch (error) {
                console.error('❌ Error loading user plan:', error);
                updatePlanDisplay({
                    type: 'none',
                    name: 'No current plan',
                    description: 'No current plan. Sign up or log in, then purchase a plan to enable premium features.',
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
        
        function updatePlanDisplay(planData) {
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

                // Cycle (only for paid plans and non-trial)
                if (!noPlan && !isTrial && (planData.type === 'pro' || planData.type === 'ultimate') && planData.billingCycle) {
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
                    planDescriptionElement.textContent = 'No current plan. Sign up or log in, then purchase a plan to enable premium features.';
                    planTitle.textContent = 'No current plan';
                    planCycle.textContent = '';
                    // Gray for no plan
                    planTitle.style.color = '#9e9e9e';
                    planTitle.style.textShadow = 'none';
                } else if (isTrial) {
                    planDescriptionElement.textContent = 'Free trial active.';
                    // Dragon's breath orange for trial state
                    planTitle.style.color = '#ff4500';
                    planTitle.style.textShadow = '0 0 8px rgba(255,69,0,0.7), 0 0 16px rgba(255,69,0,0.4)';
                } else if (planData.type === 'pro') {
                    const cycleText = planData.billingCycle && planData.billingCycle.toLowerCase().includes('year') ? 'Yearly billing' : 'Monthly billing';
                    planDescriptionElement.textContent = `Pro plan active — ${cycleText}.`;
                    // Dragon breath orange for plan title
                    planTitle.style.color = '#ff4500';
                    planTitle.style.textShadow = '0 0 8px rgba(255,69,0,0.7), 0 0 16px rgba(255,69,0,0.4)';
                } else if (planData.type === 'ultimate') {
                    const cycleText = planData.billingCycle && planData.billingCycle.toLowerCase().includes('year') ? 'Yearly billing' : 'Monthly billing';
                    planDescriptionElement.textContent = `Ultimate plan active — ${cycleText}.`;
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

                console.log('✅ Plan display updated:', titleText, { isTrial });
            }
        }
        
        // Start trial when both services are connected
        async function startTrialIfEligible() {
            try {
                const result = await window.electronAPI.startTrial();
                if (result.success) {
                    console.log('✅ Trial started');
                    updatePlanDisplay(result.plan);
                    showSuccessToast('Your 14-day free trial has started!');
                }
            } catch (error) {
                console.error('❌ Error starting trial:', error);
            }
        }
        
        // Check if user has access to a feature
        async function checkFeatureAccess(feature) {
            try {
                const result = await window.electronAPI.checkFeatureAccess(feature);
                return result.hasAccess;
            } catch (error) {
                console.error('❌ Error checking feature access:', error);
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
            // Load user plan information
            await loadUserPlan();

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
                    if (me && me.success && me.email && loggedInEmail) {
                        loggedInEmail.textContent = me.email;
                    }
                } catch (_) {}

                if (authOverlay) authOverlay.style.display = 'none';
                if (loggedInContainer) loggedInContainer.style.display = 'flex';
                startPlanPolling();
            } else {
                if (authOverlay) authOverlay.style.display = 'flex';
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
            const signupBtn = document.getElementById('signup-btn');
            const loginBtn = document.getElementById('login-btn');
            const authStatus = document.getElementById('auth-status');
            function setAuthStatus(msg, ok = true) {
                if (authStatus) {
                    // Dragon's breath orange for any status unless it is an error
                    authStatus.style.color = ok ? '#ff4500' : '#ef5350';
                    authStatus.textContent = msg;
                }
            }

            async function doAuth(path) {
                const email = (document.getElementById('auth-email')||{}).value;
                const password = (document.getElementById('auth-password')||{}).value;
                if (!email || !password) { setAuthStatus('Email and password required', false); return; }
                const base = (window.electronAPI && window.electronAPI.backendUrl) ? window.electronAPI.backendUrl : 'https://synk-web.onrender.com';
                try {
                    // Dragons breath orange
                    setAuthStatus('Working...', true);
                    if (authStatus) authStatus.style.color = '#ff4500';
                    const resp = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
                    const data = await resp.json().catch(() => ({ success: false, error: 'invalid_response' }));
                    if (data && data.success && data.token) {
                        localStorage.setItem('auth_token', data.token);
                        setAuthStatus(path === '/signup' ? 'Signed up successfully' : 'Logged in successfully', true);
                        // Immediately fetch plan via /me
                        const meResp = await fetch(base + '/me', { headers: { 'Authorization': 'Bearer ' + data.token } });
                        const me = await meResp.json().catch(() => ({ success: false }));
                        if (me && me.success) {
                            updatePlanDisplay({
                                type: me.plan?.type || 'none',
                                billingCycle: me.plan?.billingCycle || me.billing_period || null,
                                description: me.plan?.description || undefined,
                                is_trial: !!me.is_trial,
                                trial_end: me.trial_end || null
                            });
                        }
                    } else {
                        setAuthStatus((data && data.error) ? data.error : 'Auth failed', false);
                    }
                } catch (e) {
                    setAuthStatus('Network error. Check BACKEND_URL and try again.', false);
                }
            }

            if (signupBtn) signupBtn.addEventListener('click', async () => {
                await doAuth('/signup');
                // Swap UI to logged in
                const base = (window.electronAPI && window.electronAPI.backendUrl) ? window.electronAPI.backendUrl : 'https://synk-web.onrender.com';
                try {
                    const resp = await fetch(base + '/me', { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') } });
                    const me = await resp.json().catch(() => ({}));
                    if (me && me.success) {
                        const authOverlay = document.getElementById('auth-overlay');
                        if (authOverlay) authOverlay.style.display = 'none';
                        document.getElementById('logged-in-container').style.display = 'flex';
                        if (me.email) document.getElementById('logged-in-email').textContent = me.email;
                    }
                } catch (_) {}
                startPlanPolling();
            });
            if (loginBtn) loginBtn.addEventListener('click', async () => {
                await doAuth('/login');
                const base = (window.electronAPI && window.electronAPI.backendUrl) ? window.electronAPI.backendUrl : 'https://synk-web.onrender.com';
                try {
                    const resp = await fetch(base + '/me', { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') } });
                    const me = await resp.json().catch(() => ({}));
                    if (me && me.success) {
                        const authOverlay = document.getElementById('auth-overlay');
                        if (authOverlay) authOverlay.style.display = 'none';
                        document.getElementById('logged-in-container').style.display = 'flex';
                        if (me.email) document.getElementById('logged-in-email').textContent = me.email;
                    }
                } catch (_) {}
                startPlanPolling();
            });

            // Logout
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async () => {
                    // Clear token and stop polling
                    localStorage.removeItem('auth_token');
                    if (typeof __planPoller !== 'undefined' && __planPoller) { clearInterval(__planPoller); __planPoller = null; }
                    // UI swap back
                    document.getElementById('logged-in-container').style.display = 'none';
                    const authOverlay = document.getElementById('auth-overlay'); if (authOverlay) authOverlay.style.display = 'flex';
                    // Reset plan to no current plan (gray)
                    updatePlanDisplay({ type: 'none' });
                    showSuccessToast('Logged out');
                });
            }

            // About page link handlers
            document.getElementById('homepage-link').addEventListener('click', (e) => {
                e.preventDefault();
                window.electronAPI.openExternal('https://synk-official.com');
            });

            // Support email is handled by default mailto: behavior
        });

        // UI State Management
        let isGoogleConnecting = false;
        let isNotionConnecting = false;
        let isGoogleConnected = false;
        let isNotionConnected = false;
        let currentTab = 'dashboard';
        
        // Production mode only - no demo mode detection needed

        // Tab Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const tabId = item.dataset.tab;
                switchTab(tabId);
            });
        });

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

        // OAuth Connection Handlers
        document.getElementById('google-connect').addEventListener('click', handleGoogleConnect);
        document.getElementById('notion-connect').addEventListener('click', handleNotionConnect);

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
                            ${u.features && u.features.length ? `<div style='margin-top:6px;'><em>New Features:</em><br>${u.features.map(f=>`• ${f}`).join('<br>')}</div>`: ''}
                            ${u.improvements && u.improvements.length ? `<div style='margin-top:6px;'><em>Improvements:</em><br>${u.improvements.map(f=>`• ${f}`).join('<br>')}</div>`: ''}
                            ${u.fixes && u.fixes.length ? `<div style='margin-top:6px;'><em>Fixes:</em><br>${u.fixes.map(f=>`• ${f}`).join('<br>')}</div>`: ''}
                        </div>
                    `).join('');
                } catch {}
            })();
        })();
        
        // New Refresh Button Handler
        document.getElementById('refresh-sync-btn').addEventListener('click', async () => {
            const btn = document.getElementById('refresh-sync-btn');
            
            try {
                btn.disabled = true;
                btn.classList.add('spinning');
                
                // Refresh Google calendars if connected
                if (isGoogleConnected) {
                    console.log('Refreshing Google calendars...');
                    const gcRes = await window.electronAPI.listGoogleCalendars();
                    const calendars = (gcRes && (gcRes.calendars ?? gcRes)) || [];
                    if ((Array.isArray(calendars) && calendars.length > 0) || calendars?.allCalendars?.length > 0 || calendars?.items?.length > 0 || calendars?.myCalendars?.length > 0) {
                        renderGoogleCalendars(calendars);
                    }
                }
                
                // Refresh Notion databases if connected
                if (isNotionConnected) {
                    console.log('Refreshing Notion databases...');
                    const dbRes = await window.electronAPI.listDatabases();
                    const databases = (dbRes && (dbRes.databases ?? dbRes)) || [];
                    if (Array.isArray(databases) && databases.length > 0) {
                        renderNotionDatabases(databases);
                    }
                }
                
                // Force immediate sync if both are connected and selections made
                if (isGoogleConnected && isNotionConnected && selected.google && selected.notion) {
                    console.log('Forcing immediate sync...');
                    updateSyncStatus('Syncing...');
                    
                    const result = await window.electronAPI.forceSync();
                    if (result.success) {
                        updateSyncStatus('Sync completed successfully');
                        // Start automatic sync for real-time updates
                        await window.electronAPI.startSync([{ notion: selected.notion, google: selected.google }]);
                    } else {
                        updateSyncStatus('Sync failed: ' + (result.error || 'Unknown error'));
                    }
                } else {
                    updateSyncStatus('Please select both a calendar and database first');
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
            const dot = document.getElementById(`${service}-status-dot`);
            const text = document.getElementById(`${service}-status-text`);
            
            // Apply pill classes even if dot/text elements are missing
            if (!pill) {
                console.warn(`[UI] Connection pill element missing for ${service}`);
                return;
            }
            
            if (connected) {
                pill.classList.remove('disconnected');
                pill.classList.add('connected');
                if (dot) {
                    dot.classList.remove('disconnected');
                    dot.classList.add('connected');
                }
                if (text) {
                    text.textContent = 'Connected';
                }
            } else {
                pill.classList.remove('connected');
                pill.classList.add('disconnected');
                if (dot) {
                    dot.classList.remove('connected');
                    dot.classList.add('disconnected');
                }
                if (text) {
                    text.textContent = 'Not connected';
                }
            }
        }

        // Display Functions
        function displayCalendars(calendarData) {
            console.log('[Frontend] Received calendars:', calendarData);
            const container = document.getElementById('calendars-content');
            
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
                    <div class="item-meta">${cal.primary ? 'Primary Calendar • ' : ''}${cal.accessRole} • ${cal.timeZone || 'No timezone'}</div>
                </button>
            `).join('');
        }

        // Alias for backward compatibility
        function renderGoogleCalendars(calendars) {
            displayCalendars(calendars);
        }

        function renderNotionDatabases(databases) {
            displayDatabases(databases);
        }

        function displayDatabases(databases) {
            console.log('[Frontend] Received databases:', databases);
            const container = document.getElementById('notion-content');
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
                          `Properties: ${db.properties ? db.properties.join(', ') : 'None'}`} • 
                        ${db.last_edited_time ? new Date(db.last_edited_time).toLocaleDateString() : 'Unknown date'}
                    </div>
                </button>
            `).join('');
        }

        // Settings Handlers

        document.getElementById('clear-data-btn').addEventListener('click', async () => {
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
                    document.getElementById('calendars-content').innerHTML = '<div class="empty-state"><h3>Connect Google to get started</h3><p>Your calendars will appear here</p></div>';
                    document.getElementById('notion-content').innerHTML = '<div class="empty-state"><h3>Connect Notion to get started</h3><p>Your databases and pages will appear here</p></div>';
                } catch (error) {
                    console.error('Failed to clear data:', error);
                }
            }
        });

        // Sync Selection State - Fix #4 implementation
        const selected = { notion: null, google: null };
        let autoSyncTimer = null;

        function toggleSelect(id, type) {
            // toggle selection; for this app we want exactly one selected per side:
            selected[type] = selected[type] === id ? null : id;
            renderSelectionUI();
            checkAndTriggerAutoSync();
        }

        function renderSelectionUI() {
            // Update Google calendar selection UI
            document.querySelectorAll('.calendar-item').forEach(item => {
                if (item.dataset.id === selected.google) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });

            // Update Notion database selection UI
            document.querySelectorAll('.database-item').forEach(item => {
                if (item.dataset.id === selected.notion) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });

            // Update inline sync status
            updateSyncStatus();
        }

        function checkAndTriggerAutoSync() {
            if (selected.notion && selected.google) {
                // Start trial only when user purchases a plan with a trial (not on first sync)
                // startTrialIfEligible();
                
                clearTimeout(autoSyncTimer);
                autoSyncTimer = setTimeout(async () => {
                    try {
                        // call IPC: sync now
                        updateSyncStatus('Syncing...');
                        const result = await window.electronAPI.startSync([{ notion: selected.notion, google: selected.google }]);
                        
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
                }, 1200);
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
                const hasNotionSelection = selected.notion !== null;
                const hasGoogleSelection = selected.google !== null;
                
                if (hasNotionSelection && hasGoogleSelection) {
                    syncStatusText.textContent = 'Ready to sync - Auto-sync enabled';
                    syncDot.className = 'sync-dot ready';
                    
                    // Show sync details
                    syncDetails.style.display = 'block';
                    syncSource.textContent = selected.notion.title || 'Notion Database';
                    syncTarget.textContent = selected.google.name || 'Google Calendar';
                    
                    // Update sync stats from backend
                    updateSyncStats();
                    
                } else if (hasNotionSelection || hasGoogleSelection) {
                    syncStatusText.textContent = 'Select one item from each side to sync';
                    syncDot.className = 'sync-dot idle';
                    syncDetails.style.display = 'none';
                } else {
                    syncStatusText.textContent = 'Select one Notion database and one Google calendar to sync';
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

        // Hide properties panel by default as specified in Fix #4
        const propertiesPanel = document.getElementById('properties-panel');
        if (propertiesPanel) {
            propertiesPanel.style.display = 'none';
        }

        // Error toast functions
        function showErrorToast(message) {
            const toast = document.getElementById('error-toast');
            const messageSpan = document.getElementById('error-message');
            if (toast && messageSpan) {
                messageSpan.textContent = message;
                toast.style.display = 'block';
                // Auto-hide after 5 seconds
                setTimeout(() => hideErrorToast(), 5000);
            }
        }

        function hideErrorToast() {
            const toast = document.getElementById('error-toast');
            if (toast) {
                toast.style.display = 'none';
            }
        }

        function showSuccessToast(message) {
            console.log('[Success]', message);
            // For now, just log to console. You can add a success toast UI later if needed.
        }

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
                displayDatabases(databases);
            } catch (error) {
                console.error('[Frontend] Error fetching Notion databases:', error);
                // updateNotionStatus('error', 'Failed to fetch databases'); // Removed status div
            }
        }

        // Production mode only - no sample data needed

        // Event listeners for OAuth success and demo timeout
        if (window.electronAPI) {
            // OAuth success handler - hide connect button
            window.electronAPI.onOAuthSuccess((event, payload) => {
                // Ignore invalid/empty payloads to prevent crashes
                if (!payload || typeof payload !== 'object') {
                    console.warn('OAuth success received with invalid payload, ignoring:', payload);
                    return;
                }
                console.log('OAuth success received:', payload);
                console.log('Payload details:', {
                    provider: payload.provider,
                    account: payload.account,
                    calendars: payload.calendars?.allCalendars?.length || payload.calendars?.length || 0,
                    databases: payload.databases?.length || 0
                });
                
                // Update connection state and hide button
                if (payload.provider === 'notion') {
                    isNotionConnected = true;
                    isNotionConnecting = false;
                    const btn = document.getElementById('notion-connect');
                    if (btn) {
                        btn.style.display = 'none'; // Hide button
                        console.log('✅ Notion connect button hidden');
                    }
                    updateConnectionPill('notion', true);
                    if (payload.databases) {
                        displayDatabases(payload.databases);
                    }
                } else if (payload.provider === 'google') {
                    isGoogleConnected = true;
                    isGoogleConnecting = false;
                    const btn = document.getElementById('google-connect');
                    if (btn) {
                        btn.style.display = 'none';
                    }
                    updateConnectionPill('google', true);
                    if (payload.calendars && (payload.calendars.allCalendars?.length > 0 || payload.calendars.length > 0)) {
                        console.log('Displaying calendars:', payload.calendars);
                        displayCalendars(payload.calendars);
                    } else {
                        console.log('Warning: No calendars received in payload');
                    }
                }
            });

            // Google calendars handler - receives calendars directly from OAuth server
            window.electronAPI.onGoogleCalendars((event, calendars) => {
                console.log('Google calendars received:', calendars);
                console.log('Calendar details:', {
                    myCalendars: calendars.myCalendars?.length || 0,
                    otherCalendars: calendars.otherCalendars?.length || 0,
                    allCalendars: calendars.allCalendars?.length || 0,
                    items: calendars.items?.length || 0,
                    kind: calendars.kind
                });
                
                // Update Google connection state
                isGoogleConnected = true;
                isGoogleConnecting = false;
                
                // Hide connect button
                const btn = document.getElementById('google-connect');
                if (btn) {
                    btn.style.display = 'none';
                }
                
                // Update status and display calendars
                
                if (calendars && (calendars.allCalendars?.length > 0 || calendars.items?.length > 0)) {
                    console.log('Displaying calendars:', calendars);
                    displayCalendars(calendars);
                } else {
                    console.log('Warning: No calendar items found');
                    updateGoogleStatus('warning', 'Connected but no calendars found');
                }
                

                
                // Show success toast
                const totalCount = calendars.allCalendars?.length || calendars.items?.length || 0;
                showSuccessToast(`Connected to Google Calendar! Found ${totalCount} calendars.`);
            });

            // FIXED OAuth success handler - stops spinner, shows calendars
            if (window.electronAPI.onOAuthSuccess) {
                window.electronAPI.onOAuthSuccess((event, data) => {
                    console.log('✅ OAuth success received:', data);

                    // Ignore null/invalid payloads and non-Google providers
                    if (!data || (data.provider && data.provider !== 'google')) {
                        return;
                    }

                    // Stop infinite loading immediately (Google only)
                    isGoogleConnected = true;
                    isGoogleConnecting = false;

                    // Hide connect button (Google only)
                    const btn = document.getElementById('google-connect');
                    if (btn) {
                        btn.style.display = 'none';
                    }

                    // Update status and display calendars
                    updateConnectionPill('google', true);

                    // Handle calendar data (could be in data.calendars or directly in data)
                    const calendars = data.calendars || data;

                    if (calendars && (calendars.allCalendars?.length > 0 || calendars.items?.length > 0)) {
                        displayCalendars(calendars);
                        window.googleCalendars = calendars.allCalendars || calendars.items || calendars;
                        updateSyncSelectionUI();
                    } else {
                        // updateGoogleStatus('warning', 'Connected but no calendars found'); // Removed status div
                    }

                    const totalCount = calendars.allCalendars?.length || calendars.items?.length || 0;
                    showSuccessToast(`Connected to Google! Found ${totalCount} calendars.`);
                });
            }

            // FIXED OAuth failure handler - stops spinner, resets button
            if (window.electronAPI.onOAuthFailed) {
                window.electronAPI.onOAuthFailed((event, error) => {
                    console.error('❌ OAuth failed:', error);
                    
                    // Stop infinite loading immediately
                    isGoogleConnecting = false;
                    isGoogleConnected = false;
                    
                    // Show connect button again
                    const btn = document.getElementById('google-connect');
                    if (btn) {
                        btn.style.display = 'block';
                        btn.textContent = 'Connect Google';
                        btn.disabled = false;
                    }
                    
                    updateGoogleStatus('error', 'Connection failed');
                    showErrorToast(`Google connection failed: ${error}`);
                });
            }

            // Google OAuth success handler - receives calendars array directly
            console.log("[Renderer] 🔧 Setting up event listeners...");
            console.log("[Renderer] 🔧 window.electronAPI.on available:", !!window.electronAPI.on);
            if (window.electronAPI.on) {
                console.log("[Renderer] 🔧 Inside electronAPI.on block");
                window.electronAPI.on('google-oauth-success', (event, calendars) => {
                    console.log("[Renderer] Calendars received:", calendars);
                    
                    // Stop loading state
                    isGoogleConnected = true;
                    isGoogleConnecting = false;
                    
                    // Hide connect button
                    const btn = document.getElementById('google-connect');
                    if (btn) {
                        btn.style.display = 'none';
                        btn.disabled = false;
                        btn.textContent = 'Connect Google';
                    }
                    
                    // Update status and display calendars
                    // updateGoogleStatus('success', 'Connected to Google Calendar'); // Removed status div
                    updateConnectionPill('google', true);
                    
                    if (calendars && (calendars.allCalendars?.length > 0 || calendars.length > 0)) {
                        console.log('Displaying calendars:', calendars);
                        displayCalendars(calendars);
        
                        const totalCount = calendars.allCalendars?.length || calendars.length || 0;
                        showSuccessToast(`Connected to Google Calendar! Found ${totalCount} calendars.`);
                    } else {
                        console.log('Warning: No calendars found');
                        // updateGoogleStatus('warning', 'Connected but no calendars found'); // Removed status div
                    }
                });

                // Notion OAuth success handler
                console.log("[Renderer] Registering notion-oauth-success event listener...");
                window.electronAPI.on('notion-oauth-success', async (event, result) => {
                    console.log("[Renderer] NOTION OAUTH SUCCESS EVENT RECEIVED!");
                    console.log("[Renderer] Notion OAuth success:", result);
                    console.log("[Renderer] About to call listDatabases...");
                    
                    // Stop loading state
                    isNotionConnected = true;
                    isNotionConnecting = false;
                    
                    // Hide connect button
                    const btn = document.getElementById('notion-connect');
                    if (btn) {
                        btn.style.display = 'none';
                        btn.disabled = false;
                        btn.textContent = 'Connect Notion';
                    }
                    
                    // Update status
                    updateNotionStatus('success', 'Connected successfully');
                    updateConnectionPill('notion', true);
                    
                    // Hide OAuth status
                    hideNotionOAuthStatus();
                    
                    // Fetch and display databases
                    try {
                        console.log('[Renderer] Fetching Notion databases...');
                        const listFn = window.electronAPI.listNotionDatabases || window.electronAPI.listDatabases;
                        const resp = await listFn();
                        const databases = resp?.databases ?? resp ?? [];
                        console.log('[Renderer] Notion databases received:', databases);
                        displayDatabases(databases);
                        
                        // Show workspace name in success message (robust to string or object payloads)
                        const workspaceName = (typeof result === 'string' && result)
                            || result?.workspace
                            || result?.data?.workspace
                            || result?.data?.workspaceName
                            || 'your workspace';
                        showSuccessToast(`Connected to Notion workspace: ${workspaceName}!`);
                    } catch (error) {
                        console.error('[Renderer] Error fetching Notion databases:', error);
                        showErrorToast('Connected to Notion but failed to load databases');
                    }
                });

                // Google OAuth failed handler
                window.electronAPI.on('google-oauth-failed', (event, error) => {
                    console.error("[Renderer] OAuth failed:", error);
                    
                    // Stop loading state
                    isGoogleConnecting = false;
                    isGoogleConnected = false;
                    
                    // Show connect button again
                    const btn = document.getElementById('google-connect');
                    if (btn) {
                        btn.style.display = 'block';
                        btn.disabled = false;
                        btn.textContent = 'Connect Google';
                    }
                    
                    // Update status and show error
                    updateGoogleStatus('error', 'Connection failed');
                    showErrorToast(`Google OAuth failed: ${error || 'Unknown error'}`);
                });

                // Notion OAuth failed handler
                window.electronAPI.on('notion-oauth-failed', (event, error) => {
                    console.error("[Renderer] Notion OAuth failed:", error);
                    
                    // Stop loading state
                    isNotionConnected = false;
                    isNotionConnecting = false;
                    
                    // Show connect button again
                    const btn = document.getElementById('notion-connect');
                    if (btn) {
                        btn.style.display = 'block';
                        btn.textContent = 'Connect Notion';
                        btn.disabled = false;
                    }
                    
                    // Hide OAuth status and show error
                    hideNotionOAuthStatus();
                    updateNotionStatus('error', 'Connection failed');
                    showErrorToast(`Notion OAuth failed: ${error || 'Unknown error'}`);
                });

                // Plan auto-update event from main process
                window.electronAPI.on('plan-updated', (event, plan) => {
                    try {
                        if (plan) updatePlanDisplay(plan);
                    } catch (e) {
                        console.warn('[Renderer] failed to update plan from event:', e.message);
                    }
                });
            }

            // Production mode only - no demo timeout handler needed

            // Connections cleared handler - reset UI
            window.electronAPI.onConnectionsCleared(() => {
                console.log('Connections cleared - resetting UI');
                resetUiToDisconnectedState();
            });

            // Connection error handler (for real mode)
            window.electronAPI.onConnectionError((event, payload) => {
                console.log('Connection error received:', payload);
                showErrorToast(`${payload.provider} connection failed: ${payload.error}`);
                
                // Re-enable the connect button
                if (payload.provider === 'google') {
                    isGoogleConnecting = false;
                    const btn = document.getElementById('google-connect');
                    const text = document.getElementById('google-text');
                    if (btn && text) {
                        btn.disabled = false;
                        text.textContent = 'Connect Google';
                    }
                    updateGoogleStatus('error', `Connection failed: ${payload.error}`);
                } else if (payload.provider === 'notion') {
                    isNotionConnecting = false;
                    const btn = document.getElementById('notion-connect');
                    const text = document.getElementById('notion-text');
                    if (btn && text) {
                        btn.disabled = false;
                        text.textContent = 'Connect Notion';
                    }
                    // updateNotionStatus('error', `Connection failed: ${payload.error}`); // Removed status div
                }
            });
        }

        // Reset UI to disconnected state
        function resetUiToDisconnectedState() {
            // Reset connection states
            isGoogleConnected = false;
            isNotionConnected = false;
            isGoogleConnecting = false;
            isNotionConnecting = false;
            
            // Show connect buttons again
            const notionBtn = document.getElementById('notion-connect');
            const googleBtn = document.getElementById('google-connect');
            
            if (notionBtn) {
                notionBtn.style.display = 'block';
                notionBtn.disabled = false;
                const text = document.getElementById('notion-text');
                if (text) text.textContent = 'Connect Notion';
            }
            
            if (googleBtn) {
                googleBtn.style.display = 'block';
                googleBtn.disabled = false;
                const text = document.getElementById('google-text');
                if (text) text.textContent = 'Connect Google';
            }
            
            // Clear status messages - removed status divs
            // updateNotionStatus('', '');
            // updateGoogleStatus('', '');
            
            // Reset connection pills
            updateConnectionPill('notion', false);
            updateConnectionPill('google', false);
            
            // Clear displayed data
            document.getElementById('notion-content').innerHTML = '<div class="empty-state"><h3>Connect Notion to get started</h3><p>Your databases and pages will appear here</p></div>';
            document.getElementById('calendars-content').innerHTML = '<div class="empty-state"><h3>Connect Google to get started</h3><p>Your calendars will appear here</p></div>';
        }

        // Clear data button handler
        document.getElementById('clear-data-btn').addEventListener('click', async () => {
            try {
                console.log('Clearing all data...');
                await window.electronAPI.clearAllData();
                console.log('✅ Data cleared successfully');
            } catch (error) {
                console.error('❌ Failed to clear data:', error);
                showErrorToast('Reset failed: ' + error.message);
            }
        });

        // Connect handlers with enhanced OAuth UI states
        async function handleGoogleConnect() {
            if (isGoogleConnecting || isGoogleConnected) return;
            
            isGoogleConnecting = true;
            showGoogleOAuthStatus('loading');
            
            try {
                console.log('[Renderer] Starting Google OAuth...');
                
                const result = await window.electronAPI.startGoogleOAuth();
                
                console.log('[Renderer] OAuth result:', {
                    success: result.success,
                    hasError: !!result.error,
                    hasCalendars: !!result.calendars,
                    calendarCount: result.calendars?.allCalendars?.length || result.calendars?.length
                });
                
                if (result.error) {
                    console.error('[Renderer] OAuth error:', result.error);
                    showGoogleOAuthStatus('error', result.error);
                    
                    if (result.error.includes('redirect_uri') || result.error.includes('client_id') || result.error.includes('403')) {
                        showErrorToast('OAuth misconfigured: check redirect URIs and client IDs');
                    }
                    
                    isGoogleConnecting = false;
                } else if (result.success && result.calendars) {
                    // Show success state briefly, then hide OAuth status
                    showGoogleOAuthStatus('success');
                    
                    setTimeout(() => {
                        const totalCount = result.calendars.allCalendars?.length || result.calendars.length || 0;
                        console.log(`[Renderer] SUCCESS: Processing ${totalCount} calendars`);
                        
                        isGoogleConnected = true;
                        isGoogleConnecting = false;
                        
                        // Hide OAuth status and update button
                        hideGoogleOAuthStatus();
                        updateGoogleButton('connected');
                        updateConnectionPill('google', true);
                        
                        displayCalendars(result.calendars);
                        console.log('[Renderer] OAuth flow completed successfully');
                    }, 1500); // Show success for 1.5 seconds
                } else if (result.success) {
                    console.log('[Renderer] OAuth succeeded but no calendars');
                    showGoogleOAuthStatus('success');
                    
                    setTimeout(() => {
                        isGoogleConnected = true;
                        isGoogleConnecting = false;
                        hideGoogleOAuthStatus();
                        updateGoogleButton('connected');
                        updateConnectionPill('google', true);
                    }, 1500);
                } else {
                    // Keep loading state - success will be handled by oauth-success event
                    console.log('[Renderer] OAuth in progress...');
                }
            } catch (error) {
                console.error('[Renderer] OAuth exception:', error);
                showGoogleOAuthStatus('error', error.message);
                showErrorToast(`Google connection failed: ${error.message}`);
                isGoogleConnecting = false;
            }
        }

        async function handleNotionConnect() {
            if (isNotionConnecting || isNotionConnected) return;
            
            isNotionConnecting = true;
            showNotionOAuthStatus('loading');
            
            try {
                console.log('[Renderer] Starting Notion OAuth...');
                
                const result = await window.electronAPI.startNotionOAuth();
                
                console.log('[Renderer] Notion OAuth result:', {
                    success: result.success,
                    hasError: !!result.error,
                    hasData: !!result.data
                });
                
                if (result.error) {
                    console.error('[Renderer] Notion OAuth error:', result.error);
                    showNotionOAuthStatus('error', result.error);
                    
                    if (result.error.includes('redirect_uri') || result.error.includes('client_id') || result.error.includes('403')) {
                        showErrorToast('OAuth misconfigured: check redirect URIs and client IDs');
                    }
                    
                    isNotionConnecting = false;
                } else if (result.success && result.data) {
                    // Show success state briefly, then hide OAuth status
                    showNotionOAuthStatus('success');
                    
                    setTimeout(() => {
                        console.log('[Renderer] SUCCESS: Notion connected successfully');
                        
                        isNotionConnected = true;
                        isNotionConnecting = false;
                        
                        hideNotionOAuthStatus();
                        // updateNotionStatus('success', 'Connected to Notion'); // Removed status div
                        
                        const btn = document.getElementById('notion-connect');
                        const text = document.getElementById('notion-text');
                        if (btn) {
                            btn.disabled = true;
                            btn.classList.add('connected');
                        }
                        if (text) {
                            text.textContent = 'Connected';
                        }
                        
                        // Fetch and display Notion databases
                        console.log('[Frontend] About to fetch Notion databases...');
                        fetchNotionDatabases();
                        
                        showSuccessToast('Notion connected successfully!');
                    }, 2000);
                } else {
                    console.log('[Renderer] Notion OAuth in progress...');
                }
            } catch (error) {
                console.error('[Renderer] Notion OAuth exception:', error);
                showNotionOAuthStatus('error', error.message);
                showErrorToast(`Notion connection failed: ${error.message}`);
                isNotionConnecting = false;
            }
        }

        // OAuth Status UI Helper Functions
        function showGoogleOAuthStatus(state, message = '') {
            const statusContainer = document.getElementById('google-oauth-status');
            const loadingDiv = document.getElementById('google-loading');

            const errorDiv = document.getElementById('google-error');
            const errorMessage = document.getElementById('google-error-message');
            
            // Hide all states first
            loadingDiv.style.display = 'none';
            errorDiv.style.display = 'none';
            
            // Show the container
            statusContainer.style.display = 'block';
            
            // Show the appropriate state
            switch (state) {
                case 'loading':
                    loadingDiv.style.display = 'flex';
                    updateGoogleButton('loading');
                    break;
                case 'success':
                    // Just hide the status container for success
                    statusContainer.style.display = 'none';
                    break;
                case 'error':
                    errorDiv.style.display = 'flex';
                    if (message) {
                        errorMessage.textContent = message;
                    }
                    updateGoogleButton('error');
                    break;
            }
        }
        
        function hideGoogleOAuthStatus() {
            const statusContainer = document.getElementById('google-oauth-status');
            statusContainer.style.display = 'none';
        }
        
        function updateGoogleButton(state) {
            const btn = document.getElementById('google-connect');
            let text = document.getElementById('google-text');
            
            // Auto-create missing text span to avoid warnings
            if (btn && !text) {
                text = document.createElement('span');
                text.id = 'google-text';
                text.style.display = 'none';
                text.textContent = 'Connect Google';
                btn.appendChild(text);
            }
            
            if (!btn || !text) {
                // DOM not ready yet; skip silently
                return;
            }
            
            console.log('[updateGoogleButton] Setting state:', state);
            switch (state) {
                case 'loading':
                    btn.style.display = 'none';
                    console.log('[updateGoogleButton] Hidden button for loading');
                    break;
                case 'connected':
                    // Hide button after successful connection (match Notion behavior)
                    btn.style.display = 'none';
                    console.log('[updateGoogleButton] Hidden button for connected');
                    break;
                case 'error':
                    btn.style.display = 'block';
                    btn.disabled = false;
                    text.textContent = 'Connect Google';
                    btn.style.background = '';
                    console.log('[updateGoogleButton] Shown button for error');
                    break;
                default:
                    btn.style.display = 'block';
                    btn.disabled = false;
                    text.textContent = 'Connect Google';
                    btn.style.background = '';
                    console.log('[updateGoogleButton] Shown button for default');
            }
        }
        
        // Add retry button functionality
        document.addEventListener('DOMContentLoaded', () => {
            const retryBtn = document.getElementById('google-retry');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    console.log('[Renderer] Retry button clicked');
                    hideGoogleOAuthStatus();
                    handleGoogleConnect();
                });
            }
        });

        // Notion OAuth Status UI Helper Functions
        function showNotionOAuthStatus(state, message = '') {
            const statusContainer = document.getElementById('notion-oauth-status');
            const loadingDiv = document.getElementById('notion-loading');

            const errorDiv = document.getElementById('notion-error');
            const errorMessage = document.getElementById('notion-error-message');
            
            // Hide all states first
            loadingDiv.style.display = 'none';
            errorDiv.style.display = 'none';
            
            // Show the container
            statusContainer.style.display = 'block';
            
            // Show the appropriate state
            switch (state) {
                case 'loading':
                    loadingDiv.style.display = 'flex';
                    updateNotionButton('loading');
                    break;
                case 'success':
                    // Just hide the status container for success
                    statusContainer.style.display = 'none';
                    updateNotionButton('connected');
                    break;
                case 'error':
                    errorDiv.style.display = 'flex';
                    errorMessage.textContent = message || 'Connection failed';
                    updateNotionButton('error');
                    break;
            }
        }
        
        function hideNotionOAuthStatus() {
            const statusContainer = document.getElementById('notion-oauth-status');
            statusContainer.style.display = 'none';
        }
        
        function updateNotionButton(state) {
            const btn = document.getElementById('notion-connect');
            const text = document.getElementById('notion-text');
            
            console.log('[updateNotionButton] Setting state:', state);
            switch (state) {
                case 'loading':
                    btn.style.display = 'none';
                    console.log('[updateNotionButton] Hidden button for loading');
                    break;
                case 'connected':
                    btn.style.display = 'none';
                    console.log('[updateNotionButton] Hidden button for connected');
                    break;
                case 'error':
                    btn.style.display = 'block';
                    btn.disabled = false;
                    text.textContent = 'Connect Notion';
                    btn.style.background = '';
                    console.log('[updateNotionButton] Shown button for error');
                    break;
                default:
                    btn.style.display = 'block';
                    btn.disabled = false;
                    text.textContent = 'Connect Notion';
                    btn.style.background = '';
                    console.log('[updateNotionButton] Shown button for default');
            }
        }
        
        // Add Notion retry button functionality
        document.addEventListener('DOMContentLoaded', () => {
            const retryBtn = document.getElementById('notion-retry');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    console.log('[Renderer] Notion retry button clicked');
                    hideNotionOAuthStatus();
                    handleNotionConnect();
                });
            }
        });

        // Initialize the app
        console.log('Synk app initialized with enhanced OAuth UI');
    
