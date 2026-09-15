/**
 * CustomSkin - Shared Storage Management
 * Handles chrome.storage.local operations for domain, path prefix, and exact URL themes.
 */

const STORAGE_KEY = 'customskin_themes';

/**
 * Normalizes a URL or raw target string according to scope.
 * @param {string} input 
 * @param {'domain' | 'prefix' | 'exact'} [scope='domain'] 
 * @returns {{ key: string, domain: string, path: string, scope: string }}
 */
function parseTarget(input, scope = 'domain') {
  if (!input || typeof input !== 'string') {
    return { key: '', domain: '', path: '', scope: 'domain' };
  }

  let trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const domain = parsed.hostname.toLowerCase();
    let pathname = parsed.pathname || '/';

    // Normalize trailing slash (unless it's just root '/')
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    if (scope === 'prefix') {
      const cleanKey = domain + (pathname === '/' ? '' : pathname);
      return {
        key: cleanKey,
        domain: domain,
        path: pathname,
        scope: 'prefix'
      };
    } else if (scope === 'exact') {
      const search = parsed.search || '';
      const cleanKey = domain + pathname + search;
      return {
        key: cleanKey,
        domain: domain,
        path: pathname + search,
        scope: 'exact'
      };
    } else {
      // Default: domain scope
      return {
        key: domain,
        domain: domain,
        path: '/',
        scope: 'domain'
      };
    }
  } catch (err) {
    const fallbackDomain = input.toLowerCase()
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .split(':')[0]
      .trim();
    return {
      key: fallbackDomain,
      domain: fallbackDomain,
      path: '/',
      scope: 'domain'
    };
  }
}

/**
 * Backward-compatible domain normalizer
 */
function normalizeDomain(input) {
  return parseTarget(input, 'domain').domain;
}

/**
 * Retrieves all saved themes from chrome.storage.local.
 * @returns {Promise<Record<string, { key: string, domain: string, path?: string, scope?: string, css: string, enabled: boolean, updatedAt: number }>>}
 */
async function getAllThemes() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return {};
  }
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY] || {};

  // Ensure all themes have key, domain, and scope metadata
  const normalized = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!v) continue;
    const scope = v.scope || (k.includes('/') ? 'prefix' : 'domain');
    const domain = v.domain || k.split('/')[0];
    const path = v.path || (k.includes('/') ? '/' + k.split('/').slice(1).join('/') : '/');

    normalized[k] = {
      key: k,
      domain: domain.toLowerCase(),
      path: path,
      scope: scope,
      css: typeof v === 'string' ? v : (v.css || ''),
      enabled: v.enabled !== false,
      updatedAt: v.updatedAt || Date.now()
    };
  }
  return normalized;
}

/**
 * Finds all matching themes for a given full URL, sorted by specificity:
 * 1. Domain-level themes (broadest)
 * 2. Path prefix themes (longer paths take higher precedence)
 * 3. Exact URL themes (most specific)
 * 
 * @param {string} urlString 
 * @param {Record<string, any>} [preloadedThemes=null]
 * @returns {Promise<Array<{ key: string, scope: string, domain: string, path: string, css: string, enabled: boolean }>>}
 */
async function findMatchingThemesForUrl(urlString, preloadedThemes = null) {
  if (!urlString || typeof urlString !== 'string') return [];

  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return [];
  }

  const hostname = parsed.hostname.toLowerCase();
  let pathname = parsed.pathname || '/';
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  const fullSearch = parsed.search || '';
  const exactKey = hostname + pathname + fullSearch;

  const themes = preloadedThemes || (await getAllThemes());
  const matches = [];

  for (const [key, item] of Object.entries(themes)) {
    if (!item) continue;
    const ruleScope = item.scope || (key.includes('/') ? 'prefix' : 'domain');
    const ruleDomain = (item.domain || key.split('/')[0]).toLowerCase();
    const rulePath = item.path || (key.includes('/') ? '/' + key.split('/').slice(1).join('/') : '/');

    // Domain check (exact domain or www. strip)
    const domainMatches = hostname === ruleDomain ||
      (hostname.startsWith('www.') && hostname.substring(4) === ruleDomain) ||
      (ruleDomain.startsWith('www.') && ruleDomain.substring(4) === hostname);

    if (!domainMatches) continue;

    if (ruleScope === 'domain') {
      matches.push({ ...item, specificity: 10 });
    } else if (ruleScope === 'prefix') {
      // Path prefix check: pathname starts with rulePath
      const cleanRulePath = rulePath === '/' ? '/' : rulePath.replace(/\/$/, '');
      if (pathname === cleanRulePath || pathname.startsWith(cleanRulePath + '/') || cleanRulePath === '/') {
        matches.push({
          ...item,
          specificity: 100 + cleanRulePath.length // Longer path = higher specificity
        });
      }
    } else if (ruleScope === 'exact') {
      // Exact check
      if (exactKey === key || (hostname + pathname) === key) {
        matches.push({ ...item, specificity: 1000 });
      }
    }
  }

  // Sort ascending by specificity (broadest first -> most specific last for cascading)
  matches.sort((a, b) => a.specificity - b.specificity);
  return matches;
}

/**
 * Retrieves a single theme by its exact key.
 * @param {string} key 
 * @returns {Promise<{ key: string, domain: string, path: string, scope: string, css: string, enabled: boolean, updatedAt: number } | null>}
 */
async function getTheme(key) {
  if (!key) return null;
  const themes = await getAllThemes();
  return themes[key] || null;
}

/**
 * Saves or updates a theme with scope.
 * @param {string} targetInput - domain, path, or URL
 * @param {string} css 
 * @param {boolean} [enabled=true] 
 * @param {'domain' | 'prefix' | 'exact'} [scope='domain'] 
 * @returns {Promise<{ key: string, domain: string, path: string, scope: string, css: string, enabled: boolean, updatedAt: number }>}
 */
async function saveTheme(targetInput, css, enabled = true, scope = 'domain') {
  const parsed = parseTarget(targetInput, scope);
  if (!parsed.key || !parsed.domain) {
    throw new Error('Invalid target domain or path.');
  }

  const themes = await getAllThemes();
  const themeData = {
    key: parsed.key,
    domain: parsed.domain,
    path: parsed.path,
    scope: parsed.scope,
    css: typeof css === 'string' ? css : '',
    enabled: Boolean(enabled),
    updatedAt: Date.now()
  };

  themes[parsed.key] = themeData;
  await chrome.storage.local.set({ [STORAGE_KEY]: themes });
  return themeData;
}

/**
 * Toggles or updates the enabled state of a theme by key.
 * @param {string} key 
 * @param {boolean} enabled 
 * @returns {Promise<boolean>}
 */
async function setThemeEnabled(key, enabled) {
  if (!key) return false;
  const themes = await getAllThemes();
  if (themes[key]) {
    themes[key].enabled = Boolean(enabled);
    themes[key].updatedAt = Date.now();
    await chrome.storage.local.set({ [STORAGE_KEY]: themes });
    return true;
  }
  return false;
}

/**
 * Deletes a theme by key.
 * @param {string} key 
 * @returns {Promise<boolean>}
 */
async function deleteTheme(key) {
  if (!key) return false;
  const themes = await getAllThemes();
  if (key in themes) {
    delete themes[key];
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
    version: '1.1.0',
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

  const incomingThemes = parsed.themes && typeof parsed.themes === 'object' ? parsed.themes : parsed;

  const sanitizedThemes = {};
  let validCount = 0;

  for (const [key, val] of Object.entries(incomingThemes)) {
    if (['app', 'version', 'exportDate', 'themeCount'].includes(key)) {
      continue;
    }
    if (!key || typeof key !== 'string') continue;

    let css = '';
    let enabled = true;
    let scope = 'domain';
    let domain = '';
    let path = '/';
    let updatedAt = Date.now();

    if (typeof val === 'string') {
      css = val;
      scope = key.includes('/') ? 'prefix' : 'domain';
      const parsedInfo = parseTarget(key, scope);
      domain = parsedInfo.domain;
      path = parsedInfo.path;
    } else if (val && typeof val === 'object') {
      css = typeof val.css === 'string' ? val.css : '';
      enabled = val.enabled !== false;
      scope = val.scope || (key.includes('/') ? 'prefix' : 'domain');
      domain = val.domain || parseTarget(key, scope).domain;
      path = val.path || parseTarget(key, scope).path;
      updatedAt = typeof val.updatedAt === 'number' ? val.updatedAt : Date.now();
    }

    if (!domain) continue;

    sanitizedThemes[key] = {
      key,
      domain,
      path,
      scope,
      css,
      enabled,
      updatedAt
    };
    validCount++;
  }

  if (validCount === 0) {
    throw new Error('No valid domain or path themes found in the imported file.');
  }

  let finalThemes;
  if (mode === 'overwrite') {
    finalThemes = sanitizedThemes;
  } else {
    const existing = await getAllThemes();
    finalThemes = { ...existing, ...sanitizedThemes };
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: finalThemes });

  return {
    importedCount: validCount,
    totalCount: Object.keys(finalThemes).length
  };
}

const StorageAPI = {
  STORAGE_KEY,
  parseTarget,
  normalizeDomain,
  getAllThemes,
  findMatchingThemesForUrl,
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
