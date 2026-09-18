# Changelog

## 1.2.0 — Read Later

Local Clipper becomes a private, offline-first Pocket replacement while keeping every existing snippet feature intact.

### Added

- **Save page for later** context-menu item and a **Save this page** button.
- **Pages library** with favicon, domain, saved date, and reading-time estimate, available in the in-page panel's new **Clips | Pages** tabs, the side-panel parity view, and a dedicated `reader.html` library page.
- **Reader view** with clean light/dark typography, rendered from a saved snapshot and working fully offline.
- **Readable-article extraction** plus a sanitized full-page snapshot for each saved page.
- **Full-text search** across saved page text (Pro).
- **Archive export** as a single ZIP containing self-contained HTML per page plus a JSON manifest (Pro).
- Reading-time estimates, excerpts, and offline image embedding (best effort, zero network calls).
- Free page limit (10 pages) with a clear Pro upsell when reached; duplicate pages offer refresh/overwrite.
- Storage usage tracker now reports the combined size of clips **and** saved pages.
- Best-effort persistent-storage request (`navigator.storage.persist()`) so Chrome is less likely to evict saved pages.
- Reader polish: reading-progress bar, print / Save as PDF, and keyboard shortcuts (`Esc`, `/`, `t`, `p`).
- "Original ↗" links on saved-page cards in both the panel and the library.
- **Pro:** bulk select / delete and "Clear all pages" for the page library, mirroring the clip manager.

### Fixed

- Rewrote readable-article detection (content scoring with known content containers, noise removal, and a paragraph-based fallback) so pages like Wikipedia pick the article body instead of the sidebar/navigation.

### Changed

- `manifest.json` bumped to `1.2.0`. No new permissions were added.
- `background.js` now orchestrates page capture and routes archive messages in addition to clip saving.
- `content.js` / `content.css` gained the tabbed Pages UI.
- `README.md` documents the new feature set; `PRIVACY.md` reaffirms that everything stays local.

### Storage

- Page bodies and snapshots are stored in IndexedDB (`clipperArchive`), not `chrome.storage.local`.
- The existing storage shape (`clips`, `isPro`, `theme`) is unchanged — no migration required.
