/**
 * CustomSkin - Content Script
 * Supports multi-rule cascade (Domain -> Path Prefix -> Exact URL) and SPA navigation.
 * Injected at document_start to immediately apply custom styles without FOUC.
 */

(function () {
  const STYLE_ELEMENT_ID = 'customskin-theme-style';
  const STORAGE_KEY = 'customskin_themes';

  let currentAppliedUrl = '';

  /**
   * Evaluates all matching rules for the current URL and builds combined CSS.
   * Broadest rule comes first (Domain), then Path Prefix, then Exact Page.
   * @param {Record<string, any>} themes
   * @returns {{ combinedCss: string, matchedRules: Array<any> }}
   */
  function evaluateStyles(themes) {
    if (!themes || typeof themes !== 'object') {
      return { combinedCss: '', matchedRules: [] };
    }

    const currentUrl = window.location.href;
    const hostname = window.location.hostname.toLowerCase();
    let pathname = window.location.pathname || '/';
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    const exactKey = hostname + pathname + (window.location.search || '');

    const matchedRules = [];

    for (const [key, item] of Object.entries(themes)) {
      if (!item || item.enabled === false || !item.css) continue;

      const ruleScope = item.scope || (key.includes('/') ? 'prefix' : 'domain');
      const ruleDomain = (item.domain || key.split('/')[0]).toLowerCase();
      const rulePath = item.path || (key.includes('/') ? '/' + key.split('/').slice(1).join('/') : '/');

      // Check domain match
      const domainMatches = hostname === ruleDomain ||
        (hostname.startsWith('www.') && hostname.substring(4) === ruleDomain) ||
        (ruleDomain.startsWith('www.') && ruleDomain.substring(4) === hostname);

      if (!domainMatches) continue;

      if (ruleScope === 'domain') {
        matchedRules.push({ ...item, key, specificity: 10 });
      } else if (ruleScope === 'prefix') {
        const cleanRulePath = rulePath === '/' ? '/' : rulePath.replace(/\/$/, '');
        if (pathname === cleanRulePath || pathname.startsWith(cleanRulePath + '/') || cleanRulePath === '/') {
          matchedRules.push({
            ...item,
            key,
            specificity: 100 + cleanRulePath.length
          });
        }
      } else if (ruleScope === 'exact') {
        if (exactKey === key || (hostname + pathname) === key) {
          matchedRules.push({ ...item, key, specificity: 1000 });
        }
      }
    }

    // Sort ascending by specificity so higher specificity overrides earlier styles
    matchedRules.sort((a, b) => a.specificity - b.specificity);

    // Combine CSS with helpful header comments
    let combinedCss = '';
    for (const rule of matchedRules) {
      combinedCss += `\n/* [CustomSkin: ${rule.scope.toUpperCase()}] ${rule.key} */\n${rule.css}\n`;
    }

    return { combinedCss, matchedRules };
  }

  /**
   * Injects or updates the <style> element in the document.
   * @param {string} css 
   */
  function applyCSS(css) {
    let styleEl = document.getElementById(STYLE_ELEMENT_ID);

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ELEMENT_ID;
      styleEl.setAttribute('data-customskin', 'true');
      styleEl.type = 'text/css';

      const target = document.head || document.documentElement;
      if (target) {
        target.appendChild(styleEl);
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          (document.head || document.documentElement).appendChild(styleEl);
        }, { once: true });
      }
    }

    if (styleEl.textContent !== css) {
      styleEl.textContent = css || '';
    }
  }

  /**
   * Removes the custom <style> element from the document if present.
   */
  function removeCSS() {
    const styleEl = document.getElementById(STYLE_ELEMENT_ID);
    if (styleEl && styleEl.parentNode) {
      styleEl.parentNode.removeChild(styleEl);
    }
  }

  /**
   * Evaluates and applies matching themes from storage for the current page.
   */
  async function loadAndApplyTheme() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return;
      }

      const data = await chrome.storage.local.get(STORAGE_KEY);
      const themes = data[STORAGE_KEY] || {};
      const { combinedCss } = evaluateStyles(themes);

      if (combinedCss.trim()) {
        applyCSS(combinedCss);
      } else {
        removeCSS();
      }

      currentAppliedUrl = window.location.href;
    } catch (err) {
      console.warn('[CustomSkin] Failed to load themes from storage:', err);
    }
  }

  // 1. Initial application at document_start
  loadAndApplyTheme();

  // 2. SPA Navigation Detection (HTML5 History API + popstate)
  function handleUrlChange() {
    if (window.location.href !== currentAppliedUrl) {
      loadAndApplyTheme();
    }
  }

  window.addEventListener('popstate', handleUrlChange);

  // Monitor pushState and replaceState
  try {
    const origPushState = history.pushState;
    history.pushState = function () {
      origPushState.apply(this, arguments);
      handleUrlChange();
    };

    const origReplaceState = history.replaceState;
    history.replaceState = function () {
      origReplaceState.apply(this, arguments);
      handleUrlChange();
    };
  } catch (err) {
    // History API patching not available
  }

  // Fallback poller for hash-only and SPA frameworks
  setInterval(() => {
    if (window.location.href !== currentAppliedUrl) {
      handleUrlChange();
    }
  }, 1000);

  // 3. Storage changes in real time
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        const newThemes = changes[STORAGE_KEY].newValue || {};
        const { combinedCss } = evaluateStyles(newThemes);
        if (combinedCss.trim()) {
          applyCSS(combinedCss);
        } else {
          removeCSS();
        }
      }
    });
  }

  // 4. Listen for direct messages from popup
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.action) return false;

      switch (message.action) {
        case 'RELOAD_THEMES':
        case 'APPLY_STYLE':
          loadAndApplyTheme().then(() => {
            sendResponse({ success: true, status: 'applied' });
          });
          return true; // async response

        case 'REMOVE_STYLE':
          removeCSS();
          sendResponse({ success: true, status: 'removed' });
          break;

        case 'GET_PAGE_INFO':
          const hostname = window.location.hostname;
          const pathname = window.location.pathname;
          sendResponse({
            success: true,
            url: window.location.href,
            hostname: hostname,
            pathname: pathname,
            exactKey: hostname + (pathname || '/')
          });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }

      return false;
    });
  }
})();
