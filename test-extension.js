/**
 * Automated Verification Script for CustomSkin Extension
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Step 1: Validating Manifest V3 ---');
const manifestPath = path.join(__dirname, 'manifest.json');
assert(fs.existsSync(manifestPath), 'manifest.json must exist');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert.strictEqual(manifest.manifest_version, 3, 'Must be Manifest V3');
assert(manifest.name, 'Manifest must have a name');
assert(manifest.version, 'Manifest must have a version');

// Check icons
assert(manifest.icons, 'Manifest must have icons');
for (const [size, relPath] of Object.entries(manifest.icons)) {
  const fullPath = path.join(__dirname, relPath);
  assert(fs.existsSync(fullPath), `Icon file ${relPath} (${size}x${size}) must exist`);
  const stat = fs.statSync(fullPath);
  assert(stat.size > 0, `Icon file ${relPath} must not be empty`);
  console.log(`✓ Icon ${size}px verified: ${relPath} (${stat.size} bytes)`);
}

// Check popup files
assert(manifest.action && manifest.action.default_popup, 'Must declare action.default_popup');
assert(fs.existsSync(path.join(__dirname, manifest.action.default_popup)), 'Popup HTML must exist');
console.log('✓ Popup HTML verified');

// Check options page
assert(manifest.options_ui && manifest.options_ui.page, 'Must declare options_ui.page');
assert(fs.existsSync(path.join(__dirname, manifest.options_ui.page)), 'Options HTML must exist');
console.log('✓ Options HTML verified');

// Check service worker
assert(manifest.background && manifest.background.service_worker, 'Must declare service_worker');
assert(fs.existsSync(path.join(__dirname, manifest.background.service_worker)), 'Service worker file must exist');
console.log('✓ Background service worker verified');

// Check content script
assert(manifest.content_scripts && manifest.content_scripts.length > 0, 'Must declare content_scripts');
for (const scriptFile of manifest.content_scripts[0].js) {
  assert(fs.existsSync(path.join(__dirname, scriptFile)), `Content script ${scriptFile} must exist`);
}
console.log('✓ Content script verified');

console.log('\n--- Step 2: Testing Storage & Backup Logic ---');

// Mock chrome.storage.local for Node testing
const mockStorage = {};
global.chrome = {
  storage: {
    local: {
      get: async (key) => {
        if (typeof key === 'string') {
          return { [key]: mockStorage[key] };
        }
        return { ...mockStorage };
      },
      set: async (obj) => {
        Object.assign(mockStorage, obj);
      },
      remove: async (key) => {
        delete mockStorage[key];
      }
    }
  }
};

const StorageAPI = require('./shared/storage.js');

(async function testStorage() {
  // Test domain normalization
  assert.strictEqual(StorageAPI.normalizeDomain('https://sub.Example.com:8080/path?query=1'), 'sub.example.com');
  assert.strictEqual(StorageAPI.normalizeDomain('github.com/repo'), 'github.com');
  console.log('✓ Domain normalization verified');

  // Test save and retrieve theme
  await StorageAPI.saveTheme('example.com', 'body { color: red !important; }', true);
  const theme = await StorageAPI.getTheme('example.com');
  assert(theme, 'Theme for example.com should exist');
  assert.strictEqual(theme.css, 'body { color: red !important; }');
  assert.strictEqual(theme.enabled, true);
  console.log('✓ Save and getTheme verified');

  // Test toggle enabled
  await StorageAPI.setThemeEnabled('example.com', false);
  const toggled = await StorageAPI.getTheme('example.com');
  assert.strictEqual(toggled.enabled, false);
  console.log('✓ Toggle enabled verified');

  // Test export JSON
  const json = await StorageAPI.exportThemesJSON();
  const parsed = JSON.parse(json);
  assert.strictEqual(parsed.app, 'CustomSkin');
  assert(parsed.themes['example.com']);
  console.log('✓ Export JSON verified');

  // Test import JSON (merge and overwrite)
  const incomingBackup = JSON.stringify({
    themes: {
      'github.com': { css: 'body { background: #000; }', enabled: true },
      'reddit.com': { css: 'div { font-size: 14px; }', enabled: false }
    }
  });

  const importRes = await StorageAPI.importThemesJSON(incomingBackup, 'merge');
  assert.strictEqual(importRes.importedCount, 2);
  const allThemes = await StorageAPI.getAllThemes();
  assert(allThemes['example.com'], 'Merged theme should preserve example.com');
  assert(allThemes['github.com'], 'Merged theme should include github.com');
  assert(allThemes['reddit.com'], 'Merged theme should include reddit.com');
  console.log('✓ Import JSON (merge mode) verified');

  // Test delete theme
  await StorageAPI.deleteTheme('example.com');
  const deleted = await StorageAPI.getTheme('example.com');
  assert.strictEqual(deleted, null);
  console.log('✓ Delete theme verified');

  console.log('\n--- Step 3: Testing CSS Syntax Highlighter ---');
  const CSSEditor = require('./shared/editor-highlighter.js');
  const sampleCSS = `/* Dark theme */\nbody {\n  background-color: #121212 !important;\n  color: #fff;\n}`;
  const highlighted = CSSEditor.highlightCSS(sampleCSS);
  assert(highlighted.includes('tok-comment'), 'Should highlight comments');
  assert(highlighted.includes('tok-selector'), 'Should highlight selectors');
  assert(highlighted.includes('tok-property'), 'Should highlight properties');
  assert(highlighted.includes('tok-color'), 'Should highlight hex colors');
  assert(highlighted.includes('tok-important'), 'Should highlight !important');
  console.log('✓ CSS Syntax Highlighter verified');

  console.log('\n🎉 ALL AUTOMATED TESTS PASSED SUCCESSFULLY! 🎉');
})();
