/**
 * CustomSkin - Background Service Worker (Manifest V3)
 * Manages extension lifecycle, badge indicators for active domains & paths, and tab status.
 */

const STORAGE_KEY = 'customskin_themes';

/**
 * Checks whether any enabled custom style matches the tab's URL.
 * @param {string} url 
 * @param {Record<string, any>} themes 
 * @returns {boolean}
 */
function hasMatchingTheme(url, themes) {
  if (!url || typeof url !== 'string' || !themes) return false;
  if (url.startsWith('chrome://') || url.startsWith('edge://') || 
      url.startsWith('about:') || url.startsWith('chrome-extension://')) {
    return false;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  let pathname = parsed.pathname || '/';
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  const exactKey = hostname + pathname + (parsed.search || '');

  for (const [key, item] of Object.entries(themes)) {
    if (!item || item.enabled === false || !item.css) continue;

    const ruleScope = item.scope || (key.includes('/') ? 'prefix' : 'domain');
    const ruleDomain = (item.domain || key.split('/')[0]).toLowerCase();
    const rulePath = item.path || (key.includes('/') ? '/' + key.split('/').slice(1).join('/') : '/');

    const domainMatches = hostname === ruleDomain ||
      (hostname.startsWith('www.') && hostname.substring(4) === ruleDomain) ||
      (ruleDomain.startsWith('www.') && ruleDomain.substring(4) === hostname);

    if (!domainMatches) continue;

    if (ruleScope === 'domain') {
      return true;
    } else if (ruleScope === 'prefix') {
      const cleanRulePath = rulePath === '/' ? '/' : rulePath.replace(/\/$/, '');
      if (pathname === cleanRulePath || pathname.startsWith(cleanRulePath + '/') || cleanRulePath === '/') {
        return true;
      }
    } else if (ruleScope === 'exact') {
      if (exactKey === key || (hostname + pathname) === key) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Updates the action badge on a tab according to whether custom CSS is active.
 * @param {number} tabId 
 * @param {string} url 
 */
async function updateTabBadge(tabId, url) {
  if (!tabId || !url) return;

  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const themes = data[STORAGE_KEY] || {};
    const isActive = hasMatchingTheme(url, themes);

    if (isActive) {
      await chrome.action.setBadgeText({ tabId, text: 'ON' });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#6366f1' }); // Indigo
      await chrome.action.setTitle({ tabId, title: `CustomSkin: Custom styles active on this page` });
    } else {
      await chrome.action.setBadgeText({ tabId, text: '' });
      await chrome.action.setTitle({ tabId, title: `CustomSkin: Click to customize this page` });
    }
  } catch (err) {
    console.debug('[CustomSkin SW] Badge update error:', err);
  }
}

// Extension installation / update lifecycle
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[CustomSkin] Installed: reason=${details.reason}`);

  const existing = await chrome.storage.local.get(STORAGE_KEY);
  if (!existing[STORAGE_KEY]) {
    await chrome.storage.local.set({ [STORAGE_KEY]: {} });
  }
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
    // Tab closed
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

// Refresh badges when storage changes
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
