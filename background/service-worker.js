/**
 * CustomSkin - Background Service Worker (Manifest V3)
 * Manages extension lifecycle, badge indicators for active domains, and tab status.
 */

const STORAGE_KEY = 'customskin_themes';

/**
 * Extracts normalized hostname from a URL.
 * @param {string} url 
 * @returns {string}
 */
function getHostname(url) {
  if (!url || typeof url !== 'string') return '';
  // Ignore browser internal schemes
  if (url.startsWith('chrome://') || url.startsWith('edge://') || 
      url.startsWith('about:') || url.startsWith('chrome-extension://')) {
    return '';
  }
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Updates the action badge on a tab according to whether custom CSS is active.
 * @param {number} tabId 
 * @param {string} url 
 */
async function updateTabBadge(tabId, url) {
  if (!tabId || !url) return;

  const hostname = getHostname(url);
  if (!hostname) {
    await chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }

  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const themes = data[STORAGE_KEY] || {};

    const hasActiveTheme = Boolean(
      (themes[hostname] && themes[hostname].enabled && themes[hostname].css) ||
      (hostname.startsWith('www.') && themes[hostname.substring(4)] && themes[hostname.substring(4)].enabled)
    );

    if (hasActiveTheme) {
      await chrome.action.setBadgeText({ tabId, text: 'ON' });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#6366f1' }); // Indigo
      await chrome.action.setTitle({ tabId, title: `CustomSkin: Active on ${hostname}` });
    } else {
      await chrome.action.setBadgeText({ tabId, text: '' });
      await chrome.action.setTitle({ tabId, title: `CustomSkin: Click to style ${hostname}` });
    }
  } catch (err) {
    console.debug('[CustomSkin SW] Badge update error:', err);
  }
}

// Extension installation / update lifecycle
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[CustomSkin] Installed: reason=${details.reason}`);

  // Ensure storage exists
  const existing = await chrome.storage.local.get(STORAGE_KEY);
  if (!existing[STORAGE_KEY]) {
    await chrome.storage.local.set({ [STORAGE_KEY]: {} });
  }

  // Set default badge background color
  await chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
});

// Update badge when switching active tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      await updateTabBadge(activeInfo.tabId, tab.url);
    }
  } catch (err) {
    // Tab may have closed before call completed
  }
});

// Update badge when a tab finishes loading or URL updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    if (tab && tab.url) {
      await updateTabBadge(tabId, tab.url);
    }
  }
});

// Listen for storage changes to refresh badges across all tabs
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes[STORAGE_KEY]) {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.url) {
          await updateTabBadge(tab.id, tab.url);
        }
      }
    } catch (err) {
      console.debug('[CustomSkin SW] Error updating tab badges on storage change:', err);
    }
  }
});
