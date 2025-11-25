/**
 * Tabs Loader - Dynamically loads tab content from separate HTML files
 * This helps avoid truncation issues and keeps code organized
 */

// Global event to signal when tabs are ready
let tabsLoadedPromise = new Promise(resolve => {
    window.onTabsReady = resolve;
});

async function loadTabContent() {
    console.log('📂 Loading tab content files...');
    
    const tabs = [
        { id: 'sync-tab', file: './tabs/sync-tab.html' },
        { id: 'settings-tab', file: './tabs/settings-tab.html' },
        { id: 'about-tab', file: './tabs/about-tab.html' }
    ];
    
    for (const tab of tabs) {
        try {
            const response = await fetch(tab.file);
            if (!response.ok) {
                console.error(`❌ Failed to load ${tab.file}: ${response.status}`);
                continue;
            }
            
            const html = await response.text();
            const tabElement = document.getElementById(tab.id);
            
            if (tabElement) {
                // Clear existing content and insert new
                tabElement.innerHTML = html;
                console.log(`✅ Loaded tab content: ${tab.id}`);
            } else {
                console.warn(`⚠️ Tab element not found: ${tab.id}`);
            }
        } catch (error) {
            console.error(`❌ Error loading ${tab.file}:`, error);
        }
    }
    
    console.log('✅ Tab content loading complete');
    
    // Fire event to notify that tabs are ready
    window.dispatchEvent(new Event('tabs-loaded'));
    if (window.onTabsReady) {
        window.onTabsReady();
    }
}

// Load tabs when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTabContent);
} else {
    loadTabContent();
}