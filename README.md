# Local Clipper

Save text snippets **and full web pages** locally from any website — no account, no cloud, no tracking. Everything stays in your browser's own storage. A private, offline-first alternative to Pocket.

### How it works

**Snippets**

1. Select any text on a web page.
2. Right-click and choose **"Save selection to Clips"**.
3. Open the panel from the floating **📌 Clips** button to browse, search, copy, and manage your saved snippets.

**Pages (Read Later)**

1. Right-click anywhere on a page and choose **"Save page for later"** (or use **Pages → Save this page** in the panel).
2. Open the **Pages** tab, or click **Library ↗**, to browse and read saved articles.
3. Reader view renders the saved article with light/dark typography — and works offline.

Your data is stored entirely on your device. Nothing ever leaves your machine.

### Features

- Save selected text from any page via the right-click context menu
- **Save full pages for offline reading** with a clean reader view
- **Pages library** with favicon, domain, saved date, and reading-time estimate
- **Full-text search** across everything you've saved (Pro)
- **Readable-article extraction** plus a sanitized full-page snapshot
- **Reading progress bar**, print / Save as PDF, and keyboard shortcuts (`Esc` back, `/` search, `t` theme, `p` print)
- Light/dark theme, resizable panel
- Duplicate detection for both clips and pages (refresh an existing page instead of duplicating it)
- Per-item "Original" link, copy, and delete
- **Bulk select / delete and Clear all** for pages, matching the clip manager (Pro)
- Storage usage tracker covering both clips and saved pages
- Best-effort persistent storage request so Chrome is less likely to evict saved pages
- **Pro (requires license):** unlimited clips, unlimited pages, bulk delete, full-text search, and CSV / Excel / JSON / ZIP archive export

### Free vs. Pro

| | Free (Community) | Pro |
|---|---|---|
| Save clips | Up to 50 | Unlimited |
| Save pages | Up to 10 | Unlimited |
| Clip search & filter | Yes | Yes |
| Page title / domain search | Yes | Yes |
| Full-text page search | — | Yes |
| Reader view, offline reading, print / Save as PDF | Yes | Yes |
| Open original, copy / delete per item | Yes | Yes |
| Reading progress & keyboard shortcuts | Yes | Yes |
| Bulk select & delete (clips **and** pages) | — | Yes |
| Clear all pages | — | Yes |
| Export clips (CSV / Excel / JSON) | — | Yes |
| Export page archive (single ZIP) | — | Yes |
| License required | No | Yes (Lemon Squeezy key) |

The extension is fully usable for free. To unlock every feature, activate a Pro license key.

**Get Pro:** [Local Clipper Extension](https://every-day-utilities.lemonsqueezy.com/checkout/buy/d1e75e77-76c5-4f50-b8c8-d96b32690798)

### Privacy by design

- No server, no cloud, no account, no analytics, no telemetry.
- The **only** network request the extension ever makes is validating your Pro license against Lemon Squeezy.
- Page images are inlined **only** from bytes your browser has already decoded (same-origin / blob / data URLs). Remote cross-origin images are left as normal URLs, so saving a page never phones home.

### Requirements & install

Install directly from the Chrome Web Store — [Local Clipper — Private Web Snippet & Read Later](https://chromewebstore.google.com/detail/local-clipper-%E2%80%94-private-w/lbenljceefgoppjoemkgkbpgdebnkjje) — or load it locally with the steps below.

This is a Manifest V3 Chrome extension. No build step is needed.

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `local-simple-chrome-clipper/` folder.
5. Right-click any selected text → **Save selection to Clips**, or right-click the page → **Save page for later**.

### License activation

1. Purchase a Pro key from the checkout link above.
2. Open the panel and click **Upgrade to Pro**.
3. Paste your Lemon Squeezy license key and click **Activate License**.

Note: Pro status is stored locally in your browser. Reinstalling the extension or using a different browser requires activating again with the same key.

### Storage

- **Clips, `isPro`, theme and settings** live in `chrome.storage.local` (unchanged shape).
- **Page article bodies and snapshots** live in **IndexedDB** (`clipperArchive`), which is better suited to large documents and keeps `chrome.storage.local` small.
- The panel's storage meter shows the combined size of clips and saved pages.
- On install (and when the library opens) the extension asks the browser for **persistent storage** so saved pages are less likely to be evicted under disk pressure.
- Nothing is synced or uploaded.

### Project structure

```
local-simple-chrome-clipper/
├── manifest.json     # Manifest V3 extension manifest
├── background.js     # Service worker: context menus, clip saving, page capture orchestration
├── content.js        # Injected panel UI: Clips | Pages tabs, search, export, Pro handling
├── content.css       # Styles for the in-page panel
├── capture.js        # Content script: readable extraction, zero-network image inlining, chunked upload
├── archive.js        # Shared IndexedDB layer for saved pages
├── reader.html       # Library + reader extension page
├── reader.js         # Library/reader logic and Pro ZIP export
├── reader.css        # Reader/library styles
├── zip.js            # Minimal store-only ZIP writer (archive export)
├── sidepanel.html    # Side-panel variant (not registered; parity copy)
├── sidepanel.js      # Side-panel logic
├── package.ps1       # Builds the Chrome Web Store zip (manifest at root)
├── CHANGELOG.md
├── PRIVACY.md
├── LICENSE.md
└── README.md
```

### Testing

- Save a page, then open it from **Pages → Read** with DevTools set to offline — the article should render.
- Search inside saved pages (Pro) and confirm matches highlight.
- Save an 11th page on the free plan to trigger the Pro upsell.
- Confirm the only Network activity is the Lemon Squeezy license validation.

### Privacy

100% local. No analytics, no accounts, no network calls except for validating your Pro license key against Lemon Squeezy. See [PRIVACY.md](PRIVACY.md).

### License

Licensed under the [Apache License 2.0](LICENSE.md).

### Screenshots

<img width="414" height="855" alt="local_clipper_3_dark" src="https://github.com/user-attachments/assets/ecf5bb0c-cf9f-4e29-ad18-3ca07a1f6e69" />

<img width="415" height="863" alt="local_clipper_2" src="https://github.com/user-attachments/assets/afaba252-9ec7-4903-aa0f-71c78a9985e3" />
