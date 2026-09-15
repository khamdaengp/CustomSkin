/**
 * CustomSkin - Popup Controller
 * Manages active tab detection, live CSS injection, enable/disable toggling,
 * storage synchronization, and syntax-highlighted editor interactions.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const currentDomainEl = document.getElementById('current-domain');
  const themeToggle = document.getElementById('theme-toggle');
  const toggleLabel = document.getElementById('toggle-label');
  const restrictedNotice = document.getElementById('restricted-notice');
  const editorSection = document.getElementById('editor-section');
  const btnApply = document.getElementById('btn-apply');
  const btnReset = document.getElementById('btn-reset');
  const btnQuickTemplate = document.getElementById('btn-quick-template');
  const btnOpenOptions = document.getElementById('btn-open-options');
  const toastEl = document.getElementById('toast');

  const cssTextarea = document.getElementById('css-textarea');
  const highlightCode = document.getElementById('highlight-code');
  const lineNumbers = document.getElementById('line-numbers');
  const editorStats = document.getElementById('editor-stats');

  let activeTab = null;
  let activeDomain = '';
  let editorInstance = null;
  let toastTimer = null;

  // 1. Initialize enhanced CSS editor
  editorInstance = new CSSEditor({
    textarea: cssTextarea,
    highlightElement: highlightCode,
    lineNumbersElement: lineNumbers,
    statsElement: editorStats
  });

  // 2. Show toast feedback helper
  function showToast(message, type = 'success') {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.className = `toast toast-${type}`;
    toastEl.classList.remove('hidden');

    toastTimer = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 2200);
  }

  // 3. Update toggle switch label UI
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

  // 4. Send message to tab content script with fallback injection
  async function sendTabMessage(tabId, messagePayload) {
    try {
      return await chrome.tabs.sendMessage(tabId, messagePayload);
    } catch (err) {
      // Content script may not be loaded yet if the tab was open before extension install
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content/content-script.js']
        });
        // Retry message after script injection
        return await chrome.tabs.sendMessage(tabId, messagePayload);
      } catch (fallbackErr) {
        console.warn('[CustomSkin] Could not inject content script:', fallbackErr);
        return null;
      }
    }
  }

  // 5. Detect active tab and domain
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab;

    if (!tab || !tab.url) {
      throw new Error('No active tab detected');
    }

    const url = tab.url;
    const isRestricted = url.startsWith('chrome://') || 
                         url.startsWith('edge://') || 
                         url.startsWith('about:') || 
                         url.startsWith('chrome-extension://') ||
                         url.startsWith('view-source:');

    if (isRestricted) {
      currentDomainEl.textContent = 'System / Restricted Page';
      restrictedNotice.classList.remove('hidden');
      themeToggle.disabled = true;
      btnApply.disabled = true;
      btnReset.disabled = true;
      cssTextarea.disabled = true;
      return;
    }

    activeDomain = CustomSkinStorage.normalizeDomain(url);
    currentDomainEl.textContent = activeDomain || 'Unknown domain';
    currentDomainEl.title = `${activeDomain} (${url})`;

    // Load existing theme for this domain
    const existingTheme = await CustomSkinStorage.getTheme(activeDomain);
    if (existingTheme) {
      editorInstance.setValue(existingTheme.css || '');
      updateToggleUI(existingTheme.enabled !== false);
    } else {
      editorInstance.setValue('');
      updateToggleUI(true);
    }

  } catch (err) {
    console.error('[CustomSkin] Initialization error:', err);
    currentDomainEl.textContent = 'Unable to detect site';
    showToast('Failed to detect website', 'danger');
  }

  // 6. Handle Apply Button click (Live update active tab + persist to storage)
  btnApply.addEventListener('click', async () => {
    if (!activeDomain) return;

    const css = editorInstance.getValue();
    const isEnabled = themeToggle.checked;

    btnApply.disabled = true;

    try {
      // Save in chrome.storage.local
      await CustomSkinStorage.saveTheme(activeDomain, css, isEnabled);

      // Send live message to active tab
      if (activeTab && activeTab.id) {
        await sendTabMessage(activeTab.id, {
          action: 'APPLY_STYLE',
          css: css,
          enabled: isEnabled
        });
      }

      showToast('Theme applied live!', 'success');
    } catch (err) {
      console.error('[CustomSkin] Apply failed:', err);
      showToast('Error applying styles', 'danger');
    } finally {
      btnApply.disabled = false;
    }
  });

  // 7. Handle Toggle switch change (Enable / Disable live)
  themeToggle.addEventListener('change', async () => {
    if (!activeDomain) return;

    const isEnabled = themeToggle.checked;
    updateToggleUI(isEnabled);

    try {
      // Update in storage
      await CustomSkinStorage.setThemeEnabled(activeDomain, isEnabled);

      // Update active tab live
      if (activeTab && activeTab.id) {
        const currentCss = editorInstance.getValue();
        await sendTabMessage(activeTab.id, {
          action: 'APPLY_STYLE',
          css: currentCss,
          enabled: isEnabled
        });
      }

      showToast(isEnabled ? 'Theme enabled' : 'Theme paused', 'success');
    } catch (err) {
      console.error('[CustomSkin] Toggle error:', err);
      showToast('Error updating theme state', 'danger');
    }
  });

  // 8. Handle Reset Button click (Clear styles for this domain)
  btnReset.addEventListener('click', async () => {
    if (!activeDomain) return;

    const currentVal = editorInstance.getValue().trim();
    if (!currentVal) {
      showToast('Nothing to reset', 'default');
      return;
    }

    const confirmed = confirm(`Are you sure you want to reset and delete custom styles for ${activeDomain}?`);
    if (!confirmed) return;

    try {
      await CustomSkinStorage.deleteTheme(activeDomain);
      editorInstance.setValue('');
      updateToggleUI(true);

      if (activeTab && activeTab.id) {
        await sendTabMessage(activeTab.id, { action: 'REMOVE_STYLE' });
      }

      showToast(`Styles cleared for ${activeDomain}`, 'success');
    } catch (err) {
      console.error('[CustomSkin] Reset error:', err);
      showToast('Error clearing styles', 'danger');
    }
  });

  // 9. Quick Dark Theme template
  btnQuickTemplate.addEventListener('click', () => {
    const template = 
`/* Custom Dark Theme for ${activeDomain || 'this site'} */
html, body {
  background-color: #12141a !important;
  color: #e2e8f0 !important;
}

/* Links & Accents */
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

  // 10. Open Options Page
  btnOpenOptions.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  });
});
