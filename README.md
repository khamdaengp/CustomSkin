# CustomSkin — Browser Extension (Manifest V3)

> A clean, lightweight custom CSS theme manager for any website, inspired by Stylus. Live preview, per-domain storage, syntax-highlighted editor, and complete JSON backup/export support.

---

## Features

- **Domain-Specific Styling**: Styles are stored per-domain in `chrome.storage.local` and automatically applied every time you revisit the site.
- **Instant Live Preview**: Click **Apply** to inject CSS changes into the current page immediately without reloading.
- **One-Click Toggle**: Enable or disable styles for any domain instantly using the toggle switch.
- **Reset Button**: Quickly remove customized CSS and restore default website styling.
- **Enhanced CSS Editor**: Monospace font, line numbers, Tab key indentation (2 spaces), auto-closing brackets/quotes (`{}`, `()`, `[]`, `""`, `''`), and real-time syntax coloring.
- **Options Dashboard**:
  - View all customized domains in responsive cards.
  - Search and filter websites in real time.
  - In-place modal editor with dark mode boilerplate template.
  - Export individual domain CSS files (`.css`).
  - Single-domain delete with confirmation.
- **Backup & Portability**:
  - **Export All (JSON)**: Back up all your custom themes into a single structured JSON file.
  - **Import Backup**: Restore themes on another device with flexible **Merge** or **Overwrite** options.
- **Zero External Dependencies**: Pure vanilla HTML, CSS, and JavaScript.

---

## File Structure

```text
CustomSkin/
├── manifest.json              # Manifest V3 extension configuration
├── README.md                  # Documentation and loading guide
├── icons/
│   ├── icon-16.png            # 16x16 toolbar icon
│   ├── icon-48.png            # 48x48 extension management icon
│   ├── icon-128.png           # 128x128 store/installation icon
│   └── generate-icons.js      # Pure Node.js script used to generate valid PNG icons
├── shared/
│   ├── storage.js             # Centralized storage helper for themes & backup logic
│   └── editor-highlighter.js  # Zero-dependency syntax highlighter & editor enhancer
├── background/
│   └── service-worker.js      # Background service worker & active domain badge manager
├── content/
│   └── content-script.js      # Runs at document_start; injects & live-updates <style>
├── popup/
│   ├── popup.html             # Toolbar popup markup
│   ├── popup.css              # Dark-mode styling for the popup
│   └── popup.js               # Active tab detection, live apply, toggle, and reset
└── options/
    ├── options.html           # Full options page dashboard & modal editor
    ├── options.css            # Modern dashboard styling and dialogs
    └── options.js             # Options controller, search filter, and import/export
```

---

## How to Load in Google Chrome / Microsoft Edge

1. Open **Google Chrome** or **Microsoft Edge**.
2. Navigate to the Extensions manager:
   - **Chrome**: Go to `chrome://extensions`
   - **Edge**: Go to `edge://extensions`
3. In the top-right corner, turn on the **"Developer mode"** toggle switch.
4. Click the **"Load unpacked"** button that appears in the top toolbar.
5. In the file picker, select this directory:
   ```
   C:\Users\DELL\Documents\CustomSkin
   ```
6. Click **Select Folder**.
7. **CustomSkin** is now installed! Pin it to your toolbar by clicking the puzzle piece icon in Chrome and clicking the pin icon next to CustomSkin.

---

## How to Use

### 1. Applying Custom CSS to a Website
1. Visit any website (e.g. `https://news.ycombinator.com` or `https://example.com`).
2. Click the **CustomSkin** extension icon in your toolbar.
3. The popup automatically detects the current domain.
4. Paste or type your CSS in the editor. You can also click **+ Quick Dark Theme** to insert a dark-mode starter template.
5. Click **Apply CSS**.
   - Your CSS applies instantly to the active tab without needing to refresh!
   - It is saved to local storage and will automatically re-apply on future visits.

### 2. Toggling or Resetting Styles
- To temporarily turn off your custom styles without losing your CSS, toggle the switch from **Active** to **Disabled**.
- To permanently delete the styles for the current site, click **Reset**.

### 3. Managing All Domains & Backups
1. Click the gear icon (`⚙`) in the popup header, or right-click the extension icon and choose **Options**.
2. In the Options dashboard:
   - Search across all your styled websites using the search bar.
   - Click **Edit** on any card to update its CSS or toggle its status.
   - Click **CSS** on a card to download the domain's style as a standalone `.css` file.
   - Click **Export All (JSON)** to download a complete backup of all your themes.
   - Click **Import Backup** to restore or merge styles from a JSON file.
