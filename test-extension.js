/**
 * Automated Verification Script for CustomSkin Extension
 * Tests Manifest, Scopes (Domain, Path Prefix, Exact), Multi-rule Cascade, and Storage.
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
for (const [size, relPath] of Object.entries(manifest.icons)) {
  const fullPath = path.join(__dirname, relPath);
  assert(fs.existsSync(fullPath), `Icon file ${relPath} (${size}x${size}) must exist`);
  const stat = fs.statSync(fullPath);
  assert(stat.size > 0, `Icon file ${relPath} must not be empty`);
  console.log(`✓ Icon ${size}px verified: ${relPath} (${stat.size} bytes)`);
}

console.log('✓ Manifest V3 verified');

console.log('\n--- Step 2: Testing Multi-Scope Target Parsing ---');
const StorageAPI = require('./shared/storage.js');

const domainTarget = StorageAPI.parseTarget('https://github.com/features/actions', 'domain');
assert.strictEqual(domainTarget.key, 'github.com');
assert.strictEqual(domainTarget.scope, 'domain');

const prefixTarget = StorageAPI.parseTarget('https://github.com/settings/profile', 'prefix');
assert.strictEqual(prefixTarget.key, 'github.com/settings/profile');
assert.strictEqual(prefixTarget.path, '/settings/profile');
assert.strictEqual(prefixTarget.scope, 'prefix');

const exactTarget = StorageAPI.parseTarget('https://github.com/user/repo?tab=readme', 'exact');
assert.strictEqual(exactTarget.key, 'github.com/user/repo?tab=readme');
assert.strictEqual(exactTarget.scope, 'exact');
console.log('✓ Multi-scope target parsing verified');

console.log('\n--- Step 3: Testing Multi-Rule Specificity & Cascade ---');

// Mock chrome.storage.local
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

(async function testCascade() {
  // Save 3 rules on the same domain with different scopes
  await StorageAPI.saveTheme('github.com', '/* Domain Rule */ body { background: #111; }', true, 'domain');
  await StorageAPI.saveTheme('github.com/settings', '/* Prefix Rule */ .container { max-width: 800px; }', true, 'prefix');
  await StorageAPI.saveTheme('github.com/settings/profile', '/* Exact Rule */ h1 { color: #38bdf8; }', true, 'exact');

  // Test 1: Visiting root github.com -> should ONLY match domain rule
  const rootMatches = await StorageAPI.findMatchingThemesForUrl('https://github.com/');
  assert.strictEqual(rootMatches.length, 1);
  assert.strictEqual(rootMatches[0].scope, 'domain');
  assert.strictEqual(rootMatches[0].key, 'github.com');
  console.log('✓ Root URL matches only domain-level rule');

  // Test 2: Visiting https://github.com/settings -> should match domain + prefix rules
  const settingsMatches = await StorageAPI.findMatchingThemesForUrl('https://github.com/settings');
  assert.strictEqual(settingsMatches.length, 2);
  assert.strictEqual(settingsMatches[0].scope, 'domain', 'Domain rule must come first for cascade');
  assert.strictEqual(settingsMatches[1].scope, 'prefix', 'Prefix rule must come after domain rule');
  console.log('✓ Section URL matches domain + prefix rules in cascading order');

  // Test 3: Visiting https://github.com/settings/profile -> should match all 3 in order!
  const profileMatches = await StorageAPI.findMatchingThemesForUrl('https://github.com/settings/profile');
  assert.strictEqual(profileMatches.length, 3);
  assert.strictEqual(profileMatches[0].scope, 'domain');
  assert.strictEqual(profileMatches[1].scope, 'prefix');
  assert.strictEqual(profileMatches[2].scope, 'exact');
  console.log('✓ Specific page URL cascades domain -> prefix -> exact');

  // Test 4: Visiting another section https://github.com/marketplace -> should only match domain rule
  const marketplaceMatches = await StorageAPI.findMatchingThemesForUrl('https://github.com/marketplace');
  assert.strictEqual(marketplaceMatches.length, 1);
  assert.strictEqual(marketplaceMatches[0].key, 'github.com');
  console.log('✓ Unrelated subpath only inherits domain rule');

  // Test 5: JSON Export and Import with scopes preserved
  const exported = await StorageAPI.exportThemesJSON();
  const parsedExport = JSON.parse(exported);
  assert(parsedExport.themes['github.com/settings']);
  assert.strictEqual(parsedExport.themes['github.com/settings'].scope, 'prefix');

  // Clear and re-import
  await StorageAPI.clearAllThemes();
  const emptyCheck = await StorageAPI.getAllThemes();
  assert.strictEqual(Object.keys(emptyCheck).length, 0);

  const importResult = await StorageAPI.importThemesJSON(exported, 'overwrite');
  assert.strictEqual(importResult.importedCount, 3);
  const reimported = await StorageAPI.getAllThemes();
  assert.strictEqual(reimported['github.com/settings'].scope, 'prefix');
  console.log('✓ JSON backup export/import preserves scopes');

  console.log('\n--- Step 4: Testing CSS Syntax Highlighter ---');
  const CSSEditor = require('./shared/editor-highlighter.js');
  const sampleCSS = `/* Dark theme */\nbody {\n  background-color: #121212 !important;\n  color: #fff;\n}`;
  const highlighted = CSSEditor.highlightCSS(sampleCSS);
  assert(highlighted.includes('tok-comment'), 'Should highlight comments');
  assert(highlighted.includes('tok-selector'), 'Should highlight selectors');
  assert(highlighted.includes('tok-property'), 'Should highlight properties');
  assert(highlighted.includes('tok-color'), 'Should highlight hex colors');
  assert(highlighted.includes('tok-important'), 'Should highlight !important');
  console.log('✓ CSS Syntax Highlighter verified');

  console.log('\n🎉 ALL MULTI-SCOPE TESTS PASSED SUCCESSFULLY! 🎉');
})();
