# Local Clipper — Private Web Clipper & Read Later

Save articles, whole pages and snippets straight to your own device — with a clean
reader view, full-text search and offline reading. **No account, no cloud, no
tracking.** Nothing about your reading ever leaves your machine.

A private, offline alternative to Pocket, Readwise and Raindrop.

**Install from the Chrome Web Store →** *(link in the repo description)*

---

## Why

Every other read-later app is a service: you send it your articles and it keeps
them. Local Clipper has no server to send them to.

- Clips, settings and themes live in Chrome's own local storage.
- Article bodies and page snapshots live in IndexedDB on your machine.
- The **only** network request the extension ever makes is validating a Pro licence
  key against Lemon Squeezy.

---

## What it does

**Snippets**
1. Select any text on a web page.
2. Right-click → **Save selection to Clips**.
3. Open the panel from the floating **📌 Clips** button to browse, search, copy and manage.

**Pages (Read Later)**
1. Right-click anywhere → **Save page for later** (or use **Save this page** in the panel).
2. Open the **Pages** tab, or click **Library ↗**.
3. Reader view renders the saved article with light/dark typography — and works offline.

### Features

- Save selected text from any page via the right-click menu
- **Save full pages for offline reading**, with readable-article extraction and a sanitised snapshot
- **Pages library** with favicon, domain, saved date and reading-time estimate
- **Reader view** with light/dark themes, reading-progress bar, print / Save as PDF
- **Full-text search** across everything you've saved *(Pro)*
- **Import** a Pocket, Instapaper, Readwise or bookmarks export *(see below)*
- **Import clips** back from CSV or JSON
- Reading-progress bar and keyboard shortcuts (`Esc` back, `/` search, `t` theme, `p` print)
- Duplicate detection for both clips and pages
- Per-item original link, copy and delete
- Bulk select / delete and clear all *(Pro)*
- Storage meter with a hover breakdown of what's using space
- Export clips as CSV / Excel-friendly / JSON, and pages as a ZIP archive *(Pro)*

---

## Import

**Pages tab → Actions → Import** accepts:

| Format | Comes from |
| --- | --- |
| Netscape bookmarks HTML | Pocket's `ril_export.html`, browser bookmark exports |
| CSV | Instapaper, Readwise, or any table with a `URL` column |
| JSON | Local Clipper's own page export |

**Clips tab → Actions → Import clips** accepts our CSV or JSON export, or any
delimited file with a `Text` column.

**Imported page entries are links, not offline copies.** Pocket's export contains
URLs and titles, not article text — so imported rows are marked *link only* and the
reader explains how to archive one properly: open the original, then right-click and
**Save page for later**.

Imported links do **not** count against the free offline-page allowance; they have
their own, much larger import allowance.

---

## Free vs Pro

|  | Free | Pro |
| --- | --- | --- |
| Save clips | up to 50 | unlimited |
| Save pages offline | up to 10 | unlimited |
| Import links | up to 500 | unlimited |
| Reader view, offline reading, print | ✅ | ✅ |
| Title / domain search | ✅ | ✅ |
| Full-text search inside pages | — | ✅ |
| Bulk select & delete, clear all | — | ✅ |
| Export clips (CSV / JSON) and pages (ZIP) | — | ✅ |

One payment, one licence key, no renewal. The extension stays fully usable for free.

---

## Privacy

- No server, no cloud, no account, no analytics, no telemetry.
- The only network request is Lemon Squeezy licence validation.
- Page images are inlined **only** from bytes your browser has already decoded
  (same-origin / blob / data URLs). Remote cross-origin images stay as normal URLs,
  so saving a page never phones home.

See [PRIVACY.md](PRIVACY.md).

---

## Development

No build step. Load it unpacked:

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this folder

> If the store version is also installed, disable it first — two copies fight over
> the same storage.

### Tests

The import parsers and the licence gate are pure and unit-tested:

```bash
node tests/import.test.js
```

### Packaging

```powershell
.\package.ps1     # produces local-clipper-<version>.zip for the Web Store
```

### Layout

```
manifest.json     MV3 manifest
background.js     service worker: context menus, capture orchestration, licence gate
content.js        injected panel UI (Clips / Pages tabs)
content.css       panel styles
capture.js        readable-article extraction and page snapshot
archive.js        IndexedDB layer for saved pages
reader.html/.js   library + reader view
import.js         import parsers (pure, tested)
license.js        licence record + Lemon Squeezy validation
zip.js            minimal store-only ZIP writer
package.ps1       Web Store packaging
tests/            unit tests + sample export fixtures
```

---

## Licence

Apache 2.0 — see [LICENSE.md](LICENSE.md). The Pro licence is a separate commercial
grant for the paid features; this repository covers the extension itself.
