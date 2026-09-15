/**
 * CustomSkin - Popup Controller
 * Supports multi-scope targeting: Entire Site (Domain), Path Prefix, and Exact Page URL.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const currentDomainEl = document.getElementById('current-domain');
  const themeToggle = document.getElementById('theme-toggle');
  const toggleLabel = document.getElementById('toggle-label');
  const restrictedNotice = document.getElementById('restricted-notice');
  const scopeBar = document.getElementById('scope-bar');
  const activeRulesBadge = document.getElementById('active-rules-badge');
  const targetPatternText = document.getElementById('target-pattern-text');
  const editorHeading = document.getElementById('editor-heading');

  const scopeBtns = {
    domain: document.getElementById('scope-btn-domain'),
    prefix: document.getElementById('scope-btn-prefix'),
    exact: document.getElementById('scope-btn-exact')
  };

  const btnApply = document.getElementById('btn-apply');
  const btnReset = document.getElementById('btn-reset');
  const btnQuickTemplate = document.getElementById('btn-quick-template');
  const btnOpenOptions = document.getElementById('btn-open-options');
  const toastEl = document.getElementById('toast');

  const cssTextarea = document.getElementById('css-textarea');
  const highlightCode = document.getElementById('highlight-code');
  const lineNumbers = document.getElementById('line-numbers');
  const editorStats = document.getElementById('editor-stats');

  // State
  let activeTab = null;
  let tabParsedUrl = null;
  let currentScope = 'domain'; // 'domain' | 'prefix' | 'exact'
  let scopeTargets = { domain: '', prefix: '', exact: '' };
  let editorInstance = null;
  let toastTimer = null;

  // Initialize CSS editor
  editorInstance = new CSSEditor({
    textarea: cssTextarea,
    highlightElement: highlightCode,
    lineNumbersElement: lineNumbers,
    statsElement: editorStats
  });

  // Helper: Toast
  function showToast(message, type = 'success') {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.className = `toast toast-${type}`;
    toastEl.classList.remove('hidden');

    toastTimer = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 2200);
  }

  function updateToggleUI(enabled) {
    themeToggle.checked = enabled;
    if (enabled) {
      toggleLabel.textContent = 'Active';
      toggleLabel.classList.add('active');
    } else {
      toggleLabel.textContent = 'Disabled';
      toggleLabel.classList.remove('active');
    }
  }

  // Send message to tab content script with fallback injection
  async function sendTabMessage(tabId, messagePayload) {
    try {
      return await chrome.tabs.sendMessage(tabId, messagePayload);
    } catch (err) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content/content-script.js']
        });
        return await chrome.tabs.sendMessage(tabId, messagePayload);
      } catch (fallbackErr) {
        console.warn('[CustomSkin] Script injection fallback failed:', fallbackErr);
        return null;
      }
    }
  }

  // Refresh the "X rules active" badge
  async function refreshActiveRulesBadge() {
    if (!activeTab || !activeTab.url) return;
    try {
      const matches = await CustomSkinStorage.findMatchingThemesForUrl(activeTab.url);
      const activeCount = matches.filter(m => m.enabled && m.css && m.css.trim()).length;
      activeRulesBadge.textContent = `${activeCount} ${activeCount === 1 ? 'rule' : 'rules'} active`;
    } catch {
      activeRulesBadge.textContent = '0 rules active';
    }
  }

  // Load CSS for the currently selected scope
  async function loadScopeData(scope) {
    currentScope = scope;
    const targetKey = scopeTargets[scope];

    // Update active button state
    Object.keys(scopeBtns).forEach(s => {
      scopeBtns[s].classList.toggle('active', s === scope);
    });

    // Update target pill text
    if (scope === 'domain') {
      targetPatternText.textContent = `${targetKey}/* (all pages)`;
      editorHeading.textContent = `Site-Wide CSS (${targetKey})`;
    } else if (scope === 'prefix') {
      targetPatternText.textContent = `${targetKey}/* (section)`;
      editorHeading.textContent = `Section CSS (${targetKey}/*)`;
    } else {
      targetPatternText.textContent = `${targetKey} (exact page)`;
      editorHeading.textContent = `Page CSS (${targetKey})`;
    }

    // Fetch theme for this specific scope target
    const theme = await CustomSkinStorage.getTheme(targetKey);
    if (theme) {
      editorInstance.setValue(theme.css || '');
      updateToggleUI(theme.enabled !== false);
    } else {
      editorInstance.setValue('');
      updateToggleUI(true);
    }
  }

  // 1. Detect Active Tab and Initialize
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab;

    if (!tab || !tab.url) throw new Error('No active tab');

    const url = tab.url;
    const isRestricted = url.startsWith('chrome://') || 
                         url.startsWith('edge://') || 
                         url.startsWith('about:') || 
                         url.startsWith('chrome-extension://') ||
                         url.startsWith('view-source:');

    if (isRestricted) {
      currentDomainEl.textContent = 'System / Restricted Page';
      restrictedNotice.classList.remove('hidden');
      scopeBar.classList.add('hidden');
      themeToggle.disabled = true;
      btnApply.disabled = true;
      btnReset.disabled = true;
      cssTextarea.disabled = true;
      return;
    }

    tabParsedUrl = new URL(url);
    const hostname = tabParsedUrl.hostname.toLowerCase();
    let pathname = tabParsedUrl.pathname || '/';
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    // Determine first-level path prefix (e.g. /settings/profile -> /settings)
    const pathParts = pathname.split('/').filter(Boolean);
    const prefixPath = pathParts.length > 0 ? '/' + pathParts[0] : '/';

    // Compute target keys for the 3 scopes
    scopeTargets.domain = hostname;
    scopeTargets.prefix = hostname + (prefixPath === '/' ? '' : prefixPath);
    scopeTargets.exact = hostname + pathname + (tabParsedUrl.search || '');

    currentDomainEl.textContent = hostname;
    currentDomainEl.title = url;

    // Check if the page is just the root domain, or has subpaths
    const hasPath = pathname !== '/' && pathname.length > 1;
    if (!hasPath) {
      // If root page, disable prefix button (it's identical to domain)
      scopeBtns.prefix.title = 'Current page is root; identical to Entire Site';
    }

    // Check if user already has a more specific rule for this path or page
    const allMatches = await CustomSkinStorage.findMatchingThemesForUrl(url);
    const exactMatch = allMatches.find(m => m.scope === 'exact');
    const prefixMatch = allMatches.find(m => m.scope === 'prefix');

    if (exactMatch) {
      await loadScopeData('exact');
    } else if (prefixMatch) {
      await loadScopeData('prefix');
    } else {
      await loadScopeData('domain');
    }

    await refreshActiveRulesBadge();

  } catch (err) {
    console.error('[CustomSkin] Init error:', err);
    currentDomainEl.textContent = 'Unable to detect site';
    showToast('Failed to detect website', 'danger');
  }

  // 2. Scope Button Click Handlers
  Object.keys(scopeBtns).forEach(scope => {
    scopeBtns[scope].addEventListener('click', () => {
      loadScopeData(scope);
    });
  });

  // 3. Apply Button (Save & Live Inject for current scope)
  btnApply.addEventListener('click', async () => {
    const targetKey = scopeTargets[currentScope];
    if (!targetKey) return;

    const css = editorInstance.getValue();
    const isEnabled = themeToggle.checked;

    btnApply.disabled = true;

    try {
      await CustomSkinStorage.saveTheme(targetKey, css, isEnabled, currentScope);

      if (activeTab && activeTab.id) {
        await sendTabMessage(activeTab.id, { action: 'RELOAD_THEMES' });
      }

      await refreshActiveRulesBadge();
      showToast(`Applied to ${currentScope} (${targetKey})!`, 'success');
    } catch (err) {
      console.error('[CustomSkin] Apply failed:', err);
      showToast('Error applying styles', 'danger');
    } finally {
      btnApply.disabled = false;
    }
  });

  // 4. Toggle Switch Change
  themeToggle.addEventListener('change', async () => {
    const targetKey = scopeTargets[currentScope];
    if (!targetKey) return;

    const isEnabled = themeToggle.checked;
    updateToggleUI(isEnabled);

    try {
      await CustomSkinStorage.setThemeEnabled(targetKey, isEnabled);

      if (activeTab && activeTab.id) {
        await sendTabMessage(activeTab.id, { action: 'RELOAD_THEMES' });
      }

      await refreshActiveRulesBadge();
      showToast(isEnabled ? 'Style active' : 'Style paused', 'success');
    } catch (err) {
      console.error('[CustomSkin] Toggle error:', err);
      showToast('Error updating state', 'danger');
    }
  });

  // 5. Reset Button (Clears the selected scope)
  btnReset.addEventListener('click', async () => {
    const targetKey = scopeTargets[currentScope];
    if (!targetKey) return;

    const currentVal = editorInstance.getValue().trim();
    if (!currentVal) {
      showToast('Nothing to reset in this scope', 'default');
      return;
    }

    const confirmed = confirm(`Are you sure you want to reset styles for ${currentScope}: "${targetKey}"?`);
    if (!confirmed) return;

    try {
      await CustomSkinStorage.deleteTheme(targetKey);
      editorInstance.setValue('');
      updateToggleUI(true);

      if (activeTab && activeTab.id) {
        await sendTabMessage(activeTab.id, { action: 'RELOAD_THEMES' });
      }

      await refreshActiveRulesBadge();
      showToast(`Cleared styles for ${targetKey}`, 'success');
    } catch (err) {
      console.error('[CustomSkin] Reset error:', err);
      showToast('Error resetting styles', 'danger');
    }
  });

  // 6. Quick Dark Theme Template
  btnQuickTemplate.addEventListener('click', () => {
    const target = scopeTargets[currentScope] || 'this target';
    const template = 
`/* Custom Dark Theme for ${target} */
html, body {
  background-color: #12141a !important;
  color: #e2e8f0 !important;
}

/* Links & Highlights */
a {
  color: #6366f1 !important;
}
a:hover {
  color: #818cf8 !important;
}

/* Form Controls */
input, textarea, select, button {
  background-color: #1e2433 !important;
  color: #f1f5f9 !important;
  border-color: #334155 !important;
}

/* Cards & Containers */
header, nav, aside, [class*="card"], [class*="box"], [class*="panel"] {
  background-color: #181c26 !important;
  border-color: #283044 !important;
}
`;
    const existing = editorInstance.getValue().trim();
    if (existing) {
      const confirmReplace = confirm('Replace current CSS with the Dark Theme template?');
      if (!confirmReplace) return;
    }
    editorInstance.setValue(template);
    showToast('Template inserted! Click Apply to test.');
  });

  // 7. Open Options Page
  btnOpenOptions.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  });
});
