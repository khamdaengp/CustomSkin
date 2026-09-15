/**
 * CustomSkin - Options Page Controller
 * Manages domain & path themes dashboard, scope filtering, modal editor,
 * single-domain export/delete, and bulk JSON backup import/export.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const domainsContainer = document.getElementById('domains-container');
  const emptyState = document.getElementById('empty-state');
  const noResultsState = document.getElementById('no-results');
  const statsCounter = document.getElementById('stats-counter');
  const searchInput = document.getElementById('search-input');
  const btnClearSearch = document.getElementById('btn-clear-search');
  const filterTabs = document.getElementById('filter-tabs');

  const countAll = document.getElementById('count-all');
  const countDomain = document.getElementById('count-domain');
  const countPrefix = document.getElementById('count-prefix');
  const countExact = document.getElementById('count-exact');

  const btnAddDomain = document.getElementById('btn-add-domain');
  const btnEmptyAdd = document.getElementById('btn-empty-add');
  const btnExportAll = document.getElementById('btn-export-all');
  const importFileInput = document.getElementById('import-file-input');

  // Editor Modal Elements
  const editorModal = document.getElementById('editor-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalTargetInput = document.getElementById('modal-target-input');
  const modalTargetLabel = document.getElementById('modal-target-label');
  const modalInputHint = document.getElementById('modal-input-hint');
  const modalToggle = document.getElementById('modal-toggle');
  const modalToggleLabel = document.getElementById('modal-toggle-label');
  const modalCssTextarea = document.getElementById('modal-css-textarea');
  const modalHighlightCode = document.getElementById('modal-highlight-code');
  const modalLineNumbers = document.getElementById('modal-line-numbers');
  const modalEditorStats = document.getElementById('modal-editor-stats');
  const btnModalTemplate = document.getElementById('btn-modal-template');
  const btnModalWrap = document.getElementById('btn-modal-wrap');
  const modalHighlightBackdrop = document.getElementById('modal-highlight-backdrop');
  const modalEditorWrapper = document.querySelector('.modal-editor-wrapper');
  const btnSaveModal = document.getElementById('btn-save-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');

  // Import Modal Elements
  const importModal = document.getElementById('import-modal');
  const importSummaryText = document.getElementById('import-summary-text');
  const btnConfirmImport = document.getElementById('btn-confirm-import');
  const btnCancelImport = document.getElementById('btn-cancel-import');
  const btnCloseImportModal = document.getElementById('btn-close-import-modal');

  const toastEl = document.getElementById('toast');

  // State
  let currentThemes = {};
  let activeFilter = 'all'; // 'all' | 'domain' | 'prefix' | 'exact'
  let editingOriginalKey = null; // null if adding new theme
  let modalEditorInstance = null;
  let pendingImportContent = null;
  let toastTimer = null;

  // Initialize CSS Editor in Modal
  modalEditorInstance = new CSSEditor({
    textarea: modalCssTextarea,
    highlightElement: modalHighlightCode,
    highlightBackdrop: modalHighlightBackdrop,
    lineNumbersElement: modalLineNumbers,
    statsElement: modalEditorStats
  });

  // Modal word wrap toggle
  if (btnModalWrap && modalEditorWrapper) {
    let isModalWrapped = false;
    btnModalWrap.addEventListener('click', () => {
      isModalWrapped = !isModalWrapped;
      modalEditorWrapper.classList.toggle('wrap-mode', isModalWrapped);
      btnModalWrap.textContent = isModalWrapped ? 'Wrap: On' : 'Wrap: Off';
      modalEditorInstance.syncScroll();
    });
  }

  // Helper: Toast notification
  function showToast(message, type = 'success') {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.className = `toast toast-${type}`;
    toastEl.classList.remove('hidden');

    toastTimer = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 2400);
  }

  function formatDate(timestamp) {
    if (!timestamp) return 'Recently';
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function downloadFile(filename, content, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // 1. Load Themes & Render Cards
  async function loadThemes() {
    try {
      currentThemes = await CustomSkinStorage.getAllThemes();
      renderDomainCards();
    } catch (err) {
      console.error('[CustomSkin] Failed to load themes:', err);
      showToast('Error loading themes', 'danger');
    }
  }

  // 2. Render Cards based on current list, active tab filter, and search query
  function renderDomainCards() {
    const allKeys = Object.keys(currentThemes);
    const totalCount = allKeys.length;

    // Compute scope counts
    let domainCount = 0;
    let prefixCount = 0;
    let exactCount = 0;

    allKeys.forEach(k => {
      const scope = currentThemes[k].scope || (k.includes('/') ? 'prefix' : 'domain');
      if (scope === 'domain') domainCount++;
      else if (scope === 'prefix') prefixCount++;
      else if (scope === 'exact') exactCount++;
    });

    countAll.textContent = totalCount;
    countDomain.textContent = domainCount;
    countPrefix.textContent = prefixCount;
    countExact.textContent = exactCount;

    statsCounter.textContent = `${totalCount} ${totalCount === 1 ? 'rule' : 'rules'} total`;

    if (totalCount === 0) {
      domainsContainer.innerHTML = '';
      emptyState.classList.remove('hidden');
      noResultsState.classList.add('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    const query = searchInput.value.trim().toLowerCase();

    // Filter by Scope & Search Query
    const filteredKeys = allKeys.filter(k => {
      const item = currentThemes[k];
      const scope = item.scope || (k.includes('/') ? 'prefix' : 'domain');

      // Scope Tab Filter
      if (activeFilter !== 'all' && scope !== activeFilter) {
        return false;
      }

      // Search Query Filter
      if (query) {
        const matchKey = k.toLowerCase().includes(query);
        const matchDomain = (item.domain || '').toLowerCase().includes(query);
        const matchPath = (item.path || '').toLowerCase().includes(query);
        if (!matchKey && !matchDomain && !matchPath) return false;
      }

      return true;
    });

    if (filteredKeys.length === 0) {
      domainsContainer.innerHTML = '';
      noResultsState.classList.remove('hidden');
      return;
    }
    noResultsState.classList.add('hidden');

    // Sort alphabetically
    filteredKeys.sort((a, b) => a.localeCompare(b));

    domainsContainer.innerHTML = '';

    filteredKeys.forEach(key => {
      const item = currentThemes[key] || { css: '', enabled: true };
      const isEnabled = item.enabled !== false;
      const scope = item.scope || (key.includes('/') ? 'prefix' : 'domain');
      const cssLength = (item.css || '').length;
      const linesCount = (item.css || '').split('\n').length;
      const dateStr = formatDate(item.updatedAt);

      // Scope Badge Info
      let badgeClass = 'scope-tag-domain';
      let badgeLabel = 'DOMAIN';
      if (scope === 'prefix') {
        badgeClass = 'scope-tag-prefix';
        badgeLabel = 'PATH';
      } else if (scope === 'exact') {
        badgeClass = 'scope-tag-exact';
        badgeLabel = 'EXACT';
      }

      const card = document.createElement('div');
      card.className = `domain-card ${isEnabled ? '' : 'disabled'}`;
      card.dataset.key = key;

      const previewLines = (item.css || '/* No custom CSS rules */')
        .split('\n')
        .slice(0, 5)
        .join('\n');

      card.innerHTML = `
        <div class="card-header">
          <div class="card-domain-info">
            <span class="domain-globe">${scope === 'domain' ? '🌐' : (scope === 'prefix' ? '📁' : '🎯')}</span>
            <span class="card-domain-title" title="${escapeHtml(key)}">${escapeHtml(key)}</span>
            <span class="scope-tag ${badgeClass}">${badgeLabel}</span>
          </div>
          <label class="switch" title="${isEnabled ? 'Disable theme' : 'Enable theme'}">
            <input type="checkbox" class="card-toggle" ${isEnabled ? 'checked' : ''} data-key="${escapeHtml(key)}">
            <span class="slider"></span>
          </label>
        </div>

        <div class="card-body">
          <div class="code-preview"><code>${escapeHtml(previewLines)}</code></div>
          <div class="card-meta">
            <div class="meta-stats">
              <span>${linesCount} ${linesCount === 1 ? 'line' : 'lines'}</span>
              <span>•</span>
              <span>${cssLength} chars</span>
            </div>
            <span>${dateStr}</span>
          </div>
        </div>

        <div class="card-footer">
          <button class="btn btn-secondary btn-edit" data-key="${escapeHtml(key)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <div class="card-actions">
            <button class="btn btn-secondary btn-export-css" data-key="${escapeHtml(key)}" title="Export as .css file">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              CSS
            </button>
            <button class="btn btn-danger btn-delete" data-key="${escapeHtml(key)}" title="Delete theme">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      `;

      domainsContainer.appendChild(card);
    });

    attachCardListeners();
  }

  // 3. Card Event Delegation
  function attachCardListeners() {
    domainsContainer.querySelectorAll('.card-toggle').forEach(chk => {
      chk.addEventListener('change', async (e) => {
        const key = e.target.dataset.key;
        const isChecked = e.target.checked;
        await CustomSkinStorage.setThemeEnabled(key, isChecked);

        const card = e.target.closest('.domain-card');
        if (card) {
          card.classList.toggle('disabled', !isChecked);
        }
        if (currentThemes[key]) {
          currentThemes[key].enabled = isChecked;
        }
        showToast(`${key} ${isChecked ? 'enabled' : 'disabled'}`);
      });
    });

    domainsContainer.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = e.currentTarget.dataset.key;
        openEditModal(key);
      });
    });

    domainsContainer.querySelectorAll('.btn-export-css').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = e.currentTarget.dataset.key;
        const item = currentThemes[key];
        if (item) {
          const safeFilename = key.replace(/[^a-zA-Z0-9._-]/g, '_') + '.css';
          downloadFile(safeFilename, item.css || '', 'text/css');
          showToast(`Exported ${safeFilename}`);
        }
      });
    });

    domainsContainer.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const key = e.currentTarget.dataset.key;
        const confirmed = confirm(`Are you sure you want to delete custom styles for "${key}"?`);
        if (!confirmed) return;

        await CustomSkinStorage.deleteTheme(key);
        delete currentThemes[key];
        renderDomainCards();
        showToast(`Deleted theme for ${key}`);
      });
    });
  }

  // 4. Scope Filter Tab Handlers
  filterTabs.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderDomainCards();
    });
  });

  // Search Filter Handlers
  searchInput.addEventListener('input', () => {
    const hasText = searchInput.value.length > 0;
    btnClearSearch.classList.toggle('hidden', !hasText);
    renderDomainCards();
  });

  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    btnClearSearch.classList.add('hidden');
    searchInput.focus();
    renderDomainCards();
  });

  // 5. Open Modal for Create or Edit
  function updateModalScopeLabels(scope) {
    if (scope === 'domain') {
      modalTargetLabel.textContent = 'Website Domain';
      modalTargetInput.placeholder = 'example.com';
      modalInputHint.innerHTML = 'Applies to all pages on this domain (e.g. <code>github.com</code>)';
    } else if (scope === 'prefix') {
      modalTargetLabel.textContent = 'Target Path Prefix';
      modalTargetInput.placeholder = 'example.com/settings';
      modalInputHint.innerHTML = 'Applies to this path and all subpages (e.g. <code>github.com/settings/*</code>)';
    } else {
      modalTargetLabel.textContent = 'Exact Page URL';
      modalTargetInput.placeholder = 'example.com/settings/profile';
      modalInputHint.innerHTML = 'Applies strictly to this single page URL';
    }
  }

  // Modal radio change listener
  document.querySelectorAll('input[name="modal-scope"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      updateModalScopeLabels(e.target.value);
    });
  });

  function openEditModal(key = null) {
    editingOriginalKey = key;

    if (key) {
      const item = currentThemes[key] || { css: '', enabled: true, scope: 'domain' };
      const scope = item.scope || (key.includes('/') ? 'prefix' : 'domain');

      modalTitle.textContent = `Edit Style: ${key}`;
      modalTargetInput.value = key;
      modalTargetInput.disabled = true; // Lock key during edit

      // Select scope radio
      const radio = document.querySelector(`input[name="modal-scope"][value="${scope}"]`);
      if (radio) radio.checked = true;
      document.querySelectorAll('input[name="modal-scope"]').forEach(r => r.disabled = true);

      updateModalScopeLabels(scope);
      modalEditorInstance.setValue(item.css || '');
      modalToggle.checked = item.enabled !== false;
    } else {
      modalTitle.textContent = 'Add Custom Theme or Path';
      modalTargetInput.value = '';
      modalTargetInput.disabled = false;
      document.querySelectorAll('input[name="modal-scope"]').forEach(r => r.disabled = false);

      const domainRadio = document.querySelector('input[name="modal-scope"][value="domain"]');
      if (domainRadio) domainRadio.checked = true;
      updateModalScopeLabels('domain');

      modalEditorInstance.setValue('');
      modalToggle.checked = true;
    }

    updateModalToggleLabel();
    editorModal.classList.remove('hidden');

    if (!key) {
      setTimeout(() => modalTargetInput.focus(), 50);
    } else {
      setTimeout(() => modalCssTextarea.focus(), 50);
    }
  }

  function closeEditModal() {
    editorModal.classList.add('hidden');
    editingOriginalKey = null;
  }

  function updateModalToggleLabel() {
    modalToggleLabel.textContent = modalToggle.checked ? 'Theme Enabled' : 'Theme Disabled';
  }

  modalToggle.addEventListener('change', updateModalToggleLabel);

  btnAddDomain.addEventListener('click', () => openEditModal());
  btnEmptyAdd.addEventListener('click', () => openEditModal());
  btnCloseModal.addEventListener('click', closeEditModal);
  btnCancelModal.addEventListener('click', closeEditModal);

  editorModal.addEventListener('click', (e) => {
    if (e.target === editorModal) closeEditModal();
  });

  // Save Modal
  async function handleSaveModal() {
    const rawTarget = modalTargetInput.value.trim();
    const selectedScope = document.querySelector('input[name="modal-scope"]:checked').value;

    const parsed = CustomSkinStorage.parseTarget(rawTarget, selectedScope);
    if (!parsed.key || !parsed.domain) {
      alert('Please enter a valid domain or path (e.g. example.com or example.com/blog).');
      modalTargetInput.focus();
      return;
    }

    const css = modalEditorInstance.getValue();
    const enabled = modalToggle.checked;

    btnSaveModal.disabled = true;

    try {
      await CustomSkinStorage.saveTheme(rawTarget, css, enabled, selectedScope);
      await loadThemes();
      closeEditModal();
      showToast(`Saved theme for ${parsed.key}!`);
    } catch (err) {
      console.error('[CustomSkin] Save error:', err);
      showToast('Error saving theme', 'danger');
    } finally {
      btnSaveModal.disabled = false;
    }
  }

  btnSaveModal.addEventListener('click', handleSaveModal);

  editorModal.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSaveModal();
    } else if (e.key === 'Escape') {
      closeEditModal();
    }
  });

  btnModalTemplate.addEventListener('click', () => {
    const target = modalTargetInput.value.trim() || 'this site';
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

/* Forms & Inputs */
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
    const existing = modalEditorInstance.getValue().trim();
    if (existing) {
      const confirmReplace = confirm('Replace current CSS with the Dark Theme template?');
      if (!confirmReplace) return;
    }
    modalEditorInstance.setValue(template);
  });

  // 6. Bulk Export All to JSON
  btnExportAll.addEventListener('click', async () => {
    try {
      const jsonString = await CustomSkinStorage.exportThemesJSON();
      const dateTag = new Date().toISOString().split('T')[0];
      const filename = `customskin-backup-${dateTag}.json`;
      downloadFile(filename, jsonString, 'application/json');
      showToast('Backup exported successfully!');
    } catch (err) {
      console.error('[CustomSkin] Export error:', err);
      showToast('Failed to export backup', 'danger');
    }
  });

  // 7. Bulk Import from JSON
  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target.result;
        const parsed = JSON.parse(content);
        const themesMap = parsed.themes || parsed;
        const count = Object.keys(themesMap).filter(k => 
          !['app', 'version', 'exportDate', 'themeCount'].includes(k)
        ).length;

        if (count === 0) {
          alert('No valid themes found in the selected JSON file.');
          return;
        }

        pendingImportContent = content;
        importSummaryText.textContent = `Found ${count} customized ${count === 1 ? 'rule' : 'rules'} in this backup file. Choose how you would like to import:`;
        importModal.classList.remove('hidden');
      } catch (err) {
        alert('Could not parse file. Please select a valid JSON backup file.');
      } finally {
        importFileInput.value = '';
      }
    };
    reader.readAsText(file);
  });

  function closeImportModal() {
    importModal.classList.add('hidden');
    pendingImportContent = null;
  }

  btnCloseImportModal.addEventListener('click', closeImportModal);
  btnCancelImport.addEventListener('click', closeImportModal);

  btnConfirmImport.addEventListener('click', async () => {
    if (!pendingImportContent) return;

    const selectedMode = document.querySelector('input[name="import-mode"]:checked').value;
    btnConfirmImport.disabled = true;

    try {
      const result = await CustomSkinStorage.importThemesJSON(pendingImportContent, selectedMode);
      await loadThemes();
      closeImportModal();
      showToast(`Imported ${result.importedCount} rules successfully!`);
    } catch (err) {
      console.error('[CustomSkin] Import failed:', err);
      alert('Import failed: ' + err.message);
    } finally {
      btnConfirmImport.disabled = false;
    }
  });

  // Initial load
  loadThemes();
});
