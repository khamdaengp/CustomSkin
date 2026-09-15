# Chrome Web Store Listing & Metadata: CustomSkin

> **Last Updated:** 2026-09-15  
> **Extension Version:** 1.0.0  
> **Status:** Ready for Unpacked Development & Store Submission

---

## 1. Store Listing Copy

### Extension Name
`CustomSkin - Custom CSS & Themes`

### Short Description (Max 132 chars)
`Apply custom CSS themes and dark modes to any website with live preview, per-domain storage, and complete backup import/export.`

### Detailed Description
CustomSkin is a fast, lightweight, and modern custom style manager for your browser. Inspired by Stylus, it lets you easily customize any website's look and feel with custom CSS stylesheets.

Key Features:
- 🌐 Per-Domain Custom Styles: Saves CSS rules per-domain in local browser storage; automatically applies your custom theme whenever you visit that site.
- ⚡ Live Tab Preview: Click "Apply" to immediately inject your CSS into the current tab without needing to reload the page.
- 🎚️ Instant Toggle Switch: Temporarily enable or pause your custom CSS for any domain with a single click.
- 🔄 Reset Button: Clear custom styles for a domain in one click.
- 💻 Enhanced CSS Code Editor: Monospace font, line numbers, Tab key indentation (2 spaces), auto-closing brackets/quotes ({}, (), [], "", ''), and live syntax highlighting.
- 📋 Management Dashboard: Search and filter all your customized domains, edit CSS in a full-screen modal, and export individual stylesheets (.css).
- 💾 Complete Backup & Portability: Export all saved themes to a single JSON backup file and import them back with merge or overwrite support.
- 🔒 100% Privacy Friendly: No tracking, no external analytics, zero external dependencies. All styles remain strictly on your local device.

---

## 2. Permissions Justifications (Store Compliance)

| Permission | Purpose & Plain-English Justification |
| :--- | :--- |
| `storage` | Required to store and retrieve your custom CSS stylesheets and enable/disable states per domain in `chrome.storage.local`. |
| `tabs` | Required to detect the active tab's domain so the popup knows which website's CSS to load and edit, and to update action badge indicators. |
| `activeTab` | Required to communicate directly with the current tab for live CSS preview when the user interacts with the extension popup. |
| `scripting` | Required to dynamically inject the style-handling content script into open tabs that were loaded prior to extension installation. |
| `host_permissions` (`http://*/*`, `https://*/*`) | Required to inject user-authored CSS stylesheets into any website visited by the user to apply their custom themes. |

---

## 3. Privacy & Data Handling

- **Data Collection:** None.
- **Data Transmission:** None. No remote servers or third-party APIs are contacted.
- **Local Storage:** Only user-written CSS text, domain hostnames, enabled toggles, and modification timestamps are saved locally in the browser's internal storage.
- **Single Purpose Compliance:** The extension's sole purpose is applying custom user-defined CSS stylesheets to web pages.
