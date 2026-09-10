# Local Clipper

Save text snippets locally from any website with a right-click — no account, no cloud, no tracking. Everything stays in your browser's own storage.

### How it works

1. Select any text on a web page.
2. Right-click and choose **"Save selection to Clips"**.
3. Open the clips panel from the floating **📌 Clips** button to browse, search, copy, and manage your saved snippets.

Your clips are stored entirely in your browser's local storage. Nothing ever leaves your machine.

### Features

- Save selected text from any page via the right-click context menu
- Floating in-page panel with search, category filters, and lazy-loaded clip list
- Light/dark theme toggle and resizable panel
- Duplicate detection and smart line-break cleanup
- Per-clip copy and delete
- Storage usage tracker with a soft 6 MB warning
- **Pro (requires license):** unlimited clips, bulk select/delete, and CSV / Excel / JSON export

### Free vs. Pro

| | Free (Community) | Pro |
|---|---|---|
| Save clips | Up to 50 | Unlimited |
| Search & filter | Yes | Yes |
| Copy / delete per clip | Yes | Yes |
| Bulk select & delete | — | Yes |
| Export (CSV / Excel / JSON) | — | Yes |
| License required | No | Yes (Lemon Squeezy key) |

The extension is fully usable for free. To unlock every feature, activate a Pro license key.

**Get Pro:** [Local Clipper Extension](https://every-day-utilities.lemonsqueezy.com/checkout/buy/d1e75e77-76c5-4f50-b8c8-d96b32690798)

### Requirements & install

Either install it directly from Chrome Web Store [Local Clipper — Private Web Snippet & Text Saver](https://chromewebstore.google.com/detail/local-clipper-%E2%80%94-private-w/lbenljceefgoppjoemkgkbpgdebnkjje) or install locally with below procedures.


This is a Manifest V3 Chrome extension. No build step is needed.

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `local-simple-chrome-clipper/` folder.
5. Right-click any selected text on a page → **Save selection to Clips**.

### License activation

1. Purchase a Pro key from the checkout link above.
2. Open the clips panel and click **Upgrade to Pro**.
3. Paste your Lemon Squeezy license key and click **Activate License**.

Note: Pro status is stored locally in your browser. Reinstalling the extension or using a different browser requires activating again with the same key.

### Project structure

```
local-simple-chrome-clipper/
├── manifest.json     # Manifest V3 extension manifest
├── background.js     # Service worker: context menu + clip saving logic
├── content.js        # Injected panel UI, search, export, Pro handling
├── content.css       # Styles for the in-page panel
├── sidepanel.html    # Side-panel version of the clip manager
├── sidepanel.js      # Side-panel logic (view, delete, export, activation)
```

### Privacy

100% local. No analytics, no accounts, no network calls except for validating your Pro license key against Lemon Squeezy.

### Screenshots
<img width="414" height="855" alt="local_clipper_3_dark" src="https://github.com/user-attachments/assets/ecf5bb0c-cf9f-4e29-ad18-3ca07a1f6e69" />

<img width="415" height="863" alt="local_clipper_2" src="https://github.com/user-attachments/assets/afaba252-9ec7-4903-aa0f-71c78a9985e3" />


