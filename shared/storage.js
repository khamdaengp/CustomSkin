/**
 * CustomSkin - Shared Storage Management
 * Handles chrome.storage.local operations for domain themes and settings.
 */

const STORAGE_KEY = 'customskin_themes';

/**
 * Normalizes a URL or raw domain string down to a clean hostname.
 * e.g., "https://Sub.Example.com:8080/path?query=1#hash" -> "sub.example.com"
 * @param {string} input 
 * @returns {string} Clean lowercase domain or empty string if invalid
 */
function normalizeDomain(input) {
  if (!input || typeof input !== 'string') return '';
  let trimmed = input.trim();
  
  // If it doesn't contain a protocol, prepend https:// for URL parser
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }
  
  try {
    const parsed = new URL(trimmed);
    return parsed.hostname.toLowerCase();
  } catch (err) {
    // Fallback: strip paths and ports manually
    return input.toLowerCase()
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .split(':')[0]
      .trim();
  }
}

/**
 * Retrieves all saved themes from chrome.storage.local.
 * @returns {Promise<Record<string, { css: string, enabled: boolean, updatedAt: number }>>}
 */
async function getAllThemes() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return {};
  }
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || {};
}

/**
 * Retrieves a single theme for a specific domain.
 * @param {string} domain 
 * @returns {Promise<{ css: string, enabled: boolean, updatedAt: number } | null>}
 */
async function getTheme(domain) {
  const cleanDomain = normalizeDomain(domain);
  if (!cleanDomain) return null;
  const themes = await getAllThemes();
  return themes[cleanDomain] || null;
}

/**
 * Saves or updates a theme for a domain.
 * @param {string} domain 
 * @param {string} css 
 * @param {boolean} [enabled=true] 
 * @returns {Promise<{ css: string, enabled: boolean, updatedAt: number }>}
 */
async function saveTheme(domain, css, enabled = true) {
  const cleanDomain = normalizeDomain(domain);
  if (!cleanDomain) {
    throw new Error('Invalid domain provided.');
  }

  const themes = await getAllThemes();
  const themeData = {
    css: typeof css === 'string' ? css : '',
    enabled: Boolean(enabled),
    updatedAt: Date.now()
  };

  themes[cleanDomain] = themeData;
  await chrome.storage.local.set({ [STORAGE_KEY]: themes });
  return themeData;
}

/**
 * Toggles or updates the enabled state of a domain's custom style.
 * @param {string} domain 
 * @param {boolean} enabled 
 * @returns {Promise<boolean>}
 */
async function setThemeEnabled(domain, enabled) {
  const cleanDomain = normalizeDomain(domain);
  if (!cleanDomain) return false;

  const themes = await getAllThemes();
  if (themes[cleanDomain]) {
    themes[cleanDomain].enabled = Boolean(enabled);
    themes[cleanDomain].updatedAt = Date.now();
    await chrome.storage.local.set({ [STORAGE_KEY]: themes });
    return true;
  }
  return false;
}

/**
 * Deletes a theme for a specific domain.
 * @param {string} domain 
 * @returns {Promise<boolean>}
 */
async function deleteTheme(domain) {
  const cleanDomain = normalizeDomain(domain);
  if (!cleanDomain) return false;

  const themes = await getAllThemes();
  if (cleanDomain in themes) {
    delete themes[cleanDomain];
    await chrome.storage.local.set({ [STORAGE_KEY]: themes });
    return true;
  }
  return false;
}

/**
 * Clears all themes from storage.
 * @returns {Promise<void>}
 */
async function clearAllThemes() {
  await chrome.storage.local.remove(STORAGE_KEY);
}

/**
 * Exports all saved themes into a structured JSON string.
 * @returns {Promise<string>}
 */
async function exportThemesJSON() {
  const themes = await getAllThemes();
  const exportPayload = {
    app: 'CustomSkin',
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    themeCount: Object.keys(themes).length,
    themes: themes
  };
  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Imports themes from a JSON string or object.
 * @param {string | object} rawInput 
 * @param {'merge' | 'overwrite'} [mode='merge'] 
 * @returns {Promise<{ importedCount: number, totalCount: number }>}
 */
async function importThemesJSON(rawInput, mode = 'merge') {
  let parsed;
  try {
    parsed = typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput;
  } catch (e) {
    throw new Error('Invalid JSON format: Could not parse input.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup structure: Root must be an object.');
  }

  // Support both full CustomSkin backup { themes: { ... } } and raw domain mapping { "example.com": { ... } }
  const incomingThemes = parsed.themes && typeof parsed.themes === 'object' ? parsed.themes : parsed;

  const sanitizedThemes = {};
  let validCount = 0;

  for (const [key, val] of Object.entries(incomingThemes)) {
    // Skip non-domain metadata keys like "app", "version", "exportDate" if raw structure was used
    if (key === 'app' || key === 'version' || key === 'exportDate' || key === 'themeCount') {
      continue;
    }
    const cleanDomain = normalizeDomain(key);
    if (!cleanDomain) continue;

    let css = '';
    let enabled = true;
    let updatedAt = Date.now();

    if (typeof val === 'string') {
      // Direct string of CSS
      css = val;
    } else if (val && typeof val === 'object') {
      css = typeof val.css === 'string' ? val.css : '';
      enabled = val.enabled !== false;
      updatedAt = typeof val.updatedAt === 'number' ? val.updatedAt : Date.now();
    }

    sanitizedThemes[cleanDomain] = { css, enabled, updatedAt };
    validCount++;
  }

  if (validCount === 0) {
    throw new Error('No valid domain themes found in the imported file.');
  }

  let finalThemes;
  if (mode === 'overwrite') {
    finalThemes = sanitizedThemes;
  } else {
    // Merge mode
    const existing = await getAllThemes();
    finalThemes = { ...existing, ...sanitizedThemes };
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: finalThemes });

  return {
    importedCount: validCount,
    totalCount: Object.keys(finalThemes).length
  };
}

// Attach to global/window for extension pages, or module.exports for Node tests
const StorageAPI = {
  STORAGE_KEY,
  normalizeDomain,
  getAllThemes,
  getTheme,
  saveTheme,
  setThemeEnabled,
  deleteTheme,
  clearAllThemes,
  exportThemesJSON,
  importThemesJSON
};

if (typeof window !== 'undefined') {
  window.CustomSkinStorage = StorageAPI;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageAPI;
}
