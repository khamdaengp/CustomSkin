/**
 * CustomSkin - Content Script
 * Injected at document_start to immediately apply custom styles without FOUC.
 * Listens for live preview updates via chrome.runtime.onMessage and chrome.storage.onChanged.
 */

(function () {
  const STYLE_ELEMENT_ID = 'customskin-theme-style';
  const STORAGE_KEY = 'customskin_themes';

  /**
   * Finds the best matching theme for the current page hostname.
   * Checks exact hostname, then strips 'www.', then checks parent domain.
   * @param {Record<string, { css: string, enabled: boolean }>} themes 
   * @returns {{ domain: string, theme: { css: string, enabled: boolean } } | null}
   */
  function findThemeForCurrentHost(themes) {
    if (!themes || typeof themes !== 'object') return null;

    const hostname = window.location.hostname.toLowerCase();
    if (!hostname) return null;

    // 1. Exact match
    if (themes[hostname]) {
      return { domain: hostname, theme: themes[hostname] };
    }

    // 2. Strip www.
    if (hostname.startsWith('www.')) {
      const withoutWww = hostname.substring(4);
      if (themes[withoutWww]) {
        return { domain: withoutWww, theme: themes[withoutWww] };
      }
    }

    // 3. Parent domain match (e.g., m.facebook.com -> facebook.com)
    const parts = hostname.split('.');
    if (parts.length > 2) {
      const parentDomain = parts.slice(1).join('.');
      if (themes[parentDomain]) {
        return { domain: parentDomain, theme: themes[parentDomain] };
      }
    }

    return null;
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

      // Insert into documentElement immediately (document.head may not exist at document_start)
      const target = document.head || document.documentElement;
      if (target) {
        target.appendChild(styleEl);
      } else {
        // In rare cases if neither exists yet, wait for DOMContentLoaded
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
   * Evaluates and applies the theme from storage for this domain.
   */
  async function loadAndApplyTheme() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return;
      }

      const data = await chrome.storage.local.get(STORAGE_KEY);
      const themes = data[STORAGE_KEY] || {};
      const match = findThemeForCurrentHost(themes);

      if (match && match.theme && match.theme.enabled && match.theme.css) {
        applyCSS(match.theme.css);
      } else {
        removeCSS();
      }
    } catch (err) {
      console.warn('[CustomSkin] Failed to load theme from storage:', err);
    }
  }

  // Initial application at document_start
  loadAndApplyTheme();

  // Listen for storage changes in real time (e.g. from popup or options page)
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        const newThemes = changes[STORAGE_KEY].newValue || {};
        const match = findThemeForCurrentHost(newThemes);

        if (match && match.theme && match.theme.enabled && match.theme.css) {
          applyCSS(match.theme.css);
        } else {
          removeCSS();
        }
      }
    });
  }

  // Listen for direct messages from the popup (instant live preview)
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.action) return false;

      switch (message.action) {
        case 'APPLY_STYLE':
          if (message.enabled && message.css) {
            applyCSS(message.css);
            sendResponse({ success: true, status: 'applied' });
          } else {
            removeCSS();
            sendResponse({ success: true, status: 'disabled' });
          }
          break;

        case 'REMOVE_STYLE':
          removeCSS();
          sendResponse({ success: true, status: 'removed' });
          break;

        case 'GET_STATUS':
          const styleEl = document.getElementById(STYLE_ELEMENT_ID);
          sendResponse({
            success: true,
            isApplied: Boolean(styleEl && styleEl.parentNode),
            hostname: window.location.hostname
          });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }

      return false; // synchronous response
    });
  }
})();
