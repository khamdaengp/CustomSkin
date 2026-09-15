/**
 * CustomSkin - Options Page Controller
 * Manages domain themes dashboard, search filtering, modal editor,
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

  const btnAddDomain = document.getElementById('btn-add-domain');
  const btnEmptyAdd = document.getElementById('btn-empty-add');
  const btnExportAll = document.getElementById('btn-export-all');
  const importFileInput = document.getElementById('import-file-input');

  // Editor Modal Elements
  const editorModal = document.getElementById('editor-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalDomainInput = document.getElementById('modal-domain-input');
  const modalToggle = document.getElementById('modal-toggle');
  const modalToggleLabel = document.getElementById('modal-toggle-label');
  const modalCssTextarea = document.getElementById('modal-css-textarea');
  const modalHighlightCode = document.getElementById('modal-highlight-code');
  const modalLineNumbers = document.getElementById('modal-line-numbers');
  const modalEditorStats = document.getElementById('modal-editor-stats');
  const btnModalTemplate = document.getElementById('btn-modal-template');
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
  let editingOriginalDomain = null; // null if adding new domain
  let modalEditorInstance = null;
  let pendingImportContent = null;
  let toastTimer = null;

  // Initialize CSS Editor in Modal
  modalEditorInstance = new CSSEditor({
    textarea: modalCssTextarea,
    highlightElement: modalHighlightCode,
    lineNumbersElement: modalLineNumbers,
    statsElement: modalEditorStats
  });

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

  // Helper: Format Date
  function formatDate(timestamp) {
    if (!timestamp) return 'Recently';
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Helper: Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // Helper: Trigger File Download
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

  // 2. Render Cards based on current list and search filter
  function renderDomainCards() {
    const domains = Object.keys(currentThemes);
    const totalCount = domains.length;
    const query = searchInput.value.trim().toLowerCase();

    // Update stats counter
    statsCounter.textContent = `${totalCount} ${totalCount === 1 ? 'domain' : 'domains'} customized`;

    // Empty state check
    if (totalCount === 0) {
      domainsContainer.innerHTML = '';
      emptyState.classList.remove('hidden');
      noResultsState.classList.add('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    // Filter domains
    const filteredDomains = domains.filter(d => d.toLowerCase().includes(query));

    if (filteredDomains.length === 0) {
      domainsContainer.innerHTML = '';
      noResultsState.classList.remove('hidden');
      return;
    }
    noResultsState.classList.add('hidden');

    // Sort alphabetically
    filteredDomains.sort((a, b) => a.localeCompare(b));

    // Build Cards HTML
    domainsContainer.innerHTML = '';

    filteredDomains.forEach(domain => {
      const item = currentThemes[domain] || { css: '', enabled: true };
      const isEnabled = item.enabled !== false;
      const cssLength = (item.css || '').length;
      const linesCount = (item.css || '').split('\n').length;
      const dateStr = formatDate(item.updatedAt);

      const card = document.createElement('div');
      card.className = `domain-card ${isEnabled ? '' : 'disabled'}`;
      card.dataset.domain = domain;

      // Extract first 4 lines for snippet preview
      const previewLines = (item.css || '/* No custom CSS rules */')
        .split('\n')
        .slice(0, 5)
        .join('\n');

      card.innerHTML = `
        <div class="card-header">
          <div class="card-domain-info">
            <span class="domain-globe">🌐</span>
            <span class="card-domain-title" title="${escapeHtml(domain)}">${escapeHtml(domain)}</span>
          </div>
          <label class="switch" title="${isEnabled ? 'Disable theme' : 'Enable theme'}">
            <input type="checkbox" class="card-toggle" ${isEnabled ? 'checked' : ''} data-domain="${escapeHtml(domain)}">
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
          <button class="btn btn-secondary btn-edit" data-domain="${escapeHtml(domain)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <div class="card-actions">
            <button class="btn btn-secondary btn-export-css" data-domain="${escapeHtml(domain)}" title="Export as .css file">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              CSS
            </button>
            <button class="btn btn-danger btn-delete" data-domain="${escapeHtml(domain)}" title="Delete theme">
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

    // Attach Event Listeners to Card buttons
    attachCardListeners();
  }

  // 3. Card Event Delegation
  function attachCardListeners() {
    // Card Toggle switch
    domainsContainer.querySelectorAll('.card-toggle').forEach(chk => {
      chk.addEventListener('change', async (e) => {
        const domain = e.target.dataset.domain;
        const isChecked = e.target.checked;
        await CustomSkinStorage.setThemeEnabled(domain, isChecked);

        const card = e.target.closest('.domain-card');
        if (card) {
          card.classList.toggle('disabled', !isChecked);
        }
        if (currentThemes[domain]) {
          currentThemes[domain].enabled = isChecked;
        }
        showToast(`${domain} ${isChecked ? 'enabled' : 'disabled'}`);
      });
    });

    // Edit button
    domainsContainer.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const domain = e.currentTarget.dataset.domain;
        openEditModal(domain);
      });
    });

    // Export single domain CSS
    domainsContainer.querySelectorAll('.btn-export-css').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const domain = e.currentTarget.dataset.domain;
        const item = currentThemes[domain];
        if (item) {
          downloadFile(`${domain}.css`, item.css || '', 'text/css');
          showToast(`Exported ${domain}.css`);
        }
      });
    });

    // Delete button
    domainsContainer.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const domain = e.currentTarget.dataset.domain;
        const confirmed = confirm(`Are you sure you want to delete custom styles for "${domain}"?`);
        if (!confirmed) return;

        await CustomSkinStorage.deleteTheme(domain);
        delete currentThemes[domain];
        renderDomainCards();
        showToast(`Deleted theme for ${domain}`);
      });
    });
  }

  // 4. Search Filter Handlers
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
  function openEditModal(domain = null) {
    editingOriginalDomain = domain;

    if (domain) {
      modalTitle.textContent = `Edit Theme: ${domain}`;
      modalDomainInput.value = domain;
      modalDomainInput.disabled = true; // Lock domain name when editing existing
      const existing = currentThemes[domain] || { css: '', enabled: true };
      modalEditorInstance.setValue(existing.css || '');
      modalToggle.checked = existing.enabled !== false;
    } else {
      modalTitle.textContent = 'Add Custom Theme';
      modalDomainInput.value = '';
      modalDomainInput.disabled = false;
      modalEditorInstance.setValue('');
      modalToggle.checked = true;
    }

    updateModalToggleLabel();
    editorModal.classList.remove('hidden');

    if (!domain) {
      setTimeout(() => modalDomainInput.focus(), 50);
    } else {
      setTimeout(() => modalCssTextarea.focus(), 50);
    }
  }

  function closeEditModal() {
    editorModal.classList.add('hidden');
    editingOriginalDomain = null;
  }

  function updateModalToggleLabel() {
    modalToggleLabel.textContent = modalToggle.checked ? 'Theme Enabled' : 'Theme Disabled';
  }

  modalToggle.addEventListener('change', updateModalToggleLabel);

  // Modal Actions
  btnAddDomain.addEventListener('click', () => openEditModal());
  btnEmptyAdd.addEventListener('click', () => openEditModal());
  btnCloseModal.addEventListener('click', closeEditModal);
  btnCancelModal.addEventListener('click', closeEditModal);

  // Close modal when clicking backdrop
  editorModal.addEventListener('click', (e) => {
    if (e.target === editorModal) closeEditModal();
  });

  // Save Modal
  async function handleSaveModal() {
    const rawDomain = modalDomainInput.value;
    const cleanDomain = CustomSkinStorage.normalizeDomain(rawDomain);

    if (!cleanDomain) {
      alert('Please enter a valid website domain (e.g. example.com).');
      modalDomainInput.focus();
      return;
    }

    const css = modalEditorInstance.getValue();
    const enabled = modalToggle.checked;

    btnSaveModal.disabled = true;

    try {
      await CustomSkinStorage.saveTheme(cleanDomain, css, enabled);
      await loadThemes();
      closeEditModal();
      showToast(`Saved theme for ${cleanDomain}!`);
    } catch (err) {
      console.error('[CustomSkin] Save error:', err);
      showToast('Error saving theme', 'danger');
    } finally {
      btnSaveModal.disabled = false;
    }
  }

  btnSaveModal.addEventListener('click', handleSaveModal);

  // Keyboard shortcut Ctrl+S / Cmd+S in modal
  editorModal.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSaveModal();
    } else if (e.key === 'Escape') {
      closeEditModal();
    }
  });

  // Modal Dark Mode Template button
  btnModalTemplate.addEventListener('click', () => {
    const domain = modalDomainInput.value.trim() || 'this site';
    const template = 
`/* Custom Dark Theme for ${domain} */
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

  // 6. Bulk Export All Themes to JSON
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

  // 7. Bulk Import Themes from JSON
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
        importSummaryText.textContent = `Found ${count} customized ${count === 1 ? 'domain' : 'domains'} in this backup file. Choose how you would like to import:`;
        importModal.classList.remove('hidden');
      } catch (err) {
        alert('Could not parse file. Please select a valid JSON backup file.');
      } finally {
        importFileInput.value = ''; // Reset file input
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
      showToast(`Imported ${result.importedCount} themes successfully!`);
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
