# CustomSkin — Browser Extension (Manifest V3)

> A clean, lightweight custom CSS theme manager for any website, inspired by Stylus. Live preview, per-domain & per-path storage, syntax-highlighted editor, and complete JSON backup/export support.

---

## Features

- **Granular Target Scopes**:
  - 🌐 **Entire Site / Domain**: `example.com` (applies to all pages)
  - 📁 **Path Prefix / Subpages**: `example.com/settings/*` (applies to a section and all subpages)
  - 🎯 **Exact Page URL**: `example.com/settings/profile` (applies strictly to a single page)
- **Smart CSS Cascading**: Automatically combines site-wide styles with section and page-specific styles in the correct order.
- **SPA & Client-Side Route Support**: Automatically updates styles when navigating Single Page Applications (Next.js, React, GitHub Turbo/PJAX) without full page reloads.
- **Instant Live Preview**: Click **Apply CSS** to inject changes immediately into the active tab without reloading.
- **One-Click Toggle**: Enable or pause styles for any scope with a single click.
- **Reset Button**: Quickly clear styles for the selected scope.
- **Enhanced CSS Editor**: Monospace font, line numbers, Tab key indentation (2 spaces), auto-closing brackets/quotes (`{}`, `()`, `[]`, `""`, `''`), and real-time syntax coloring.
- **Options Dashboard**:
  - Filter by scope: **All**, **Domains**, **Paths**, **Exact URLs**.
  - Search and filter websites and paths in real time.
  - In-place modal editor with dark mode boilerplate template.
  - Export individual stylesheets (`.css`).
  - Single-rule delete with confirmation.
- **Backup & Portability**:
  - **Export All (JSON)**: Back up all your domain and path themes into a single structured JSON file.
  - **Import Backup**: Restore themes on another device with flexible **Merge** or **Overwrite** options.
- **Zero External Dependencies**: Pure vanilla HTML, CSS, and JavaScript.

---

## File Structure

```text
CustomSkin/
├── manifest.json              # Manifest V3 extension configuration
├── README.md                  # Documentation and loading guide
├── CHROMEWEBSTORE.md          # Web Store listing descriptions & permissions justification
├── test-extension.js          # Automated multi-scope validation test suite
├── icons/
│   ├── icon-16.png            # 16x16 toolbar icon
│   ├── icon-48.png            # 48x48 extension management icon
│   ├── icon-128.png           # 128x128 store/installation icon
│   └── generate-icons.js      # Pure Node.js script used to generate valid PNG icons
├── shared/
│   ├── storage.js             # Centralized storage helper for domain & path rules
│   └── editor-highlighter.js  # Zero-dependency syntax highlighter & editor enhancer
├── background/
│   └── service-worker.js      # Background service worker & active domain badge manager
├── content/
│   └── content-script.js      # Multi-rule cascade & SPA navigation listener
├── popup/
│   ├── popup.html             # Toolbar popup markup with scope selector
│   ├── popup.css              # Dark-mode styling for the popup
│   └── popup.js               # Active tab detection, scope switcher, live apply, toggle
└── options/
    ├── options.html           # Full options page dashboard & modal editor with scope tabs
    ├── options.css            # Modern dashboard styling and scope badge colors
    └── options.js             # Options controller, scope filter, and import/export
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
7. If you had previously loaded CustomSkin, simply click the **reload icon (⟳)** on the CustomSkin card in `chrome://extensions`.

---

## How to Target Specific Pages & Paths

1. Visit any website (e.g. `https://github.com/settings/profile`).
2. Click the **CustomSkin** toolbar icon.
3. Under **"Apply Style To:"**, select your desired scope:
   - Click **🌐 Entire Site** if you want your CSS to apply everywhere on `github.com`.
   - Click **📁 Path Prefix** if you want your CSS to apply to `github.com/settings/*`.
   - Click **🎯 Exact Page** if you want your CSS to apply strictly to `github.com/settings/profile`.
4. Enter your custom CSS and click **Apply CSS**.
5. CustomSkin automatically cascades the styles: site-wide rules apply first, followed by path rules, followed by exact page rules!
