// Service worker: context menus, clip saving, and page-archive orchestration.
// Page bodies live in IndexedDB (archive.js); snippets/settings stay in
// chrome.storage.local to preserve the existing shape ({ clips, isPro }).
importScripts("archive.js");

const COMMUNITY_CLIP_LIMIT = 50;
const PAGES_FREE_LIMIT = 10;
const DEFAULT_PAGE_SETTINGS = { embedImages: true };

let currentSelection = "";
const captureBuffers = new Map();

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "save-clip",
      title: "Save selection to Clips",
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: "save-page",
      title: "Save page for later",
      contexts: ["page"]
    });
  });
}

function requestPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }
  } catch (e) {
    // Best effort only.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
  requestPersistentStorage();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenu();
});

function askContent(tabId, message) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        void chrome.runtime.lastError;
        resolve(response || null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

function generateId() {
  return "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Receive the formatted selection from content.js when right-clicking
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return undefined;

  if (message.action === "set_active_selection") {
    currentSelection = message.text;
    return undefined;
  }

  if (message.action === "page_capture_chunk") {
    const buffer = captureBuffers.get(message.captureId) || {};
    buffer[message.field] = (buffer[message.field] || "") + (message.data || "");
    captureBuffers.set(message.captureId, buffer);
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === "page_capture_complete") {
    finalizeCapture(message, sender)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  routeMessage(message, sender)
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));
  return true;
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-clip") {
    handleSaveClip(info, tab);
  } else if (info.menuItemId === "save-page") {
    handleSavePage(tab);
  }
});

function handleSaveClip(info, tab) {
  const rawSelectedText = currentSelection || info.selectionText || "";
  const pageUrl = tab.url || "";
  const pageTitle = tab.title || "Untitled Page";

  const cleanRawText = rawSelectedText
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const normalizeText = (str) => str.replace(/\s+/g, " ").trim();
  const normalizedSelected = normalizeText(cleanRawText);

  chrome.storage.local.get({ clips: [], isPro: false }, (data) => {
    const existingClips = data.clips;
    const isPro = data.isPro;

    const isDuplicate = existingClips.some(
      (clip) => normalizeText(clip.text) === normalizedSelected && clip.url === pageUrl
    );

    if (isDuplicate) {
      chrome.tabs.sendMessage(tab.id, {
        action: "duplicate_clip_detected",
        text: cleanRawText
      });
      return;
    }

    if (!isPro && existingClips.length >= COMMUNITY_CLIP_LIMIT) {
      chrome.tabs.sendMessage(tab.id, {
        action: "clip_limit_reached",
        limit: COMMUNITY_CLIP_LIMIT
      });
      return;
    }

    const newClip = {
      id: Date.now(),
      text: cleanRawText,
      url: pageUrl,
      title: pageTitle,
      timestamp: new Date().toISOString()
    };

    const updatedClips = [newClip, ...existingClips];

    chrome.storage.local.set({ clips: updatedClips }, () => {
      chrome.tabs.sendMessage(tab.id, {
        action: "clip_saved",
        clip: newClip
      });
    });
  });
}

async function handleSavePage(tab) {
  if (!tab || typeof tab.id !== "number") return;
  if (!/^https?:/i.test(tab.url || "")) {
    askContent(tab.id, { action: "page_save_error", message: "Only http(s) pages can be saved." });
    return;
  }

  const existing = await ClipperArchive.getPageByUrl(tab.url);
  if (existing) {
    const response = await askContent(tab.id, { action: "page_duplicate_prompt", title: existing.title });
    if (!response || !response.ok) return;
  }

  const data = await chrome.storage.local.get({ isPro: false });
  if (!existing && !data.isPro) {
    const count = await ClipperArchive.countPages();
    if (count >= PAGES_FREE_LIMIT) {
      askContent(tab.id, { action: "page_limit_reached", limit: PAGES_FREE_LIMIT });
      return;
    }
  }

  const pageId = existing ? existing.id : generateId();
  const response = await askContent(tab.id, { action: "capture_page", pageId });
  if (!response || !response.ok) {
    askContent(tab.id, { action: "page_save_error", message: "Could not read this page. Try reloading it." });
  }
}

async function finalizeCapture(message, sender) {
  const buffer = captureBuffers.get(message.captureId) || {};
  captureBuffers.delete(message.captureId);

  const meta = message.meta || {};
  const id = meta.id || generateId();
  const articleHtml = buffer.articleHtml || "";
  const snapshotHtml = buffer.snapshotHtml || "";
  const text = buffer.text || "";

  const page = {
    id,
    url: meta.url || "",
    title: meta.title || "Untitled",
    domain: meta.domain || "",
    favicon: meta.favicon || "",
    savedAt: meta.savedAt || new Date().toISOString(),
    readingTime: meta.readingTime || 1,
    wordCount: meta.wordCount || 0,
    excerpt: meta.excerpt || "",
    byteSize: articleHtml.length + snapshotHtml.length
  };

  await ClipperArchive.putPage(page, { id, articleHtml, snapshotHtml, text });

  const tab = sender && sender.tab;
  if (tab && typeof tab.id === "number") {
    chrome.tabs.sendMessage(tab.id, { action: "page_saved", page });
  }
}

async function routeMessage(message, sender) {
  switch (message.action) {
    case "list_pages": {
      const pages = await ClipperArchive.listPages();
      return { ok: true, pages };
    }
    case "search_pages": {
      const data = await chrome.storage.local.get({ isPro: false });
      const pages = await ClipperArchive.searchPages(message.query, { fullText: data.isPro });
      return { ok: true, pages, fullText: data.isPro };
    }
    case "page_count": {
      const [count, data] = await Promise.all([
        ClipperArchive.countPages(),
        chrome.storage.local.get({ isPro: false })
      ]);
      return { ok: true, count, isPro: data.isPro, limit: PAGES_FREE_LIMIT };
    }
    case "archive_size": {
      const pages = await ClipperArchive.listPages();
      const bytes = pages.reduce((total, page) => total + (page.byteSize || 0), 0);
      let quota = 0;
      try {
        if (navigator.storage && navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          quota = estimate.quota || 0;
        }
      } catch (e) {
        quota = 0;
      }
      return { ok: true, bytes, count: pages.length, quota };
    }
    case "open_reader": {
      const suffix = message.pageId ? "#" + encodeURIComponent(message.pageId) : "";
      await chrome.tabs.create({ url: chrome.runtime.getURL("reader.html") + suffix });
      return { ok: true };
    }
    case "open_library": {
      const query = message.autoExport ? "?export=1" : "";
      await chrome.tabs.create({ url: chrome.runtime.getURL("reader.html") + query });
      return { ok: true };
    }
    case "export_archive": {
      await chrome.tabs.create({ url: chrome.runtime.getURL("reader.html") + "?export=1" });
      return { ok: true };
    }
    case "delete_page": {
      await ClipperArchive.deletePage(message.id);
      return { ok: true };
    }
    case "delete_pages": {
      const proCheck = await chrome.storage.local.get({ isPro: false });
      if (!proCheck.isPro) return { ok: false, pro: false };
      for (const id of message.ids || []) {
        await ClipperArchive.deletePage(id);
      }
      return { ok: true };
    }
    case "clear_pages": {
      const proCheck = await chrome.storage.local.get({ isPro: false });
      if (!proCheck.isPro) return { ok: false, pro: false };
      await ClipperArchive.clearPages();
      return { ok: true };
    }
    case "capture_current_page": {
      if (sender && sender.tab) {
        await handleSavePage(sender.tab);
        return { ok: true };
      }
      return { ok: false };
    }
    case "get_page_settings": {
      const data = await chrome.storage.local.get({ pageSettings: DEFAULT_PAGE_SETTINGS });
      return { ok: true, settings: Object.assign({}, DEFAULT_PAGE_SETTINGS, data.pageSettings || {}) };
    }
    case "set_page_settings": {
      await chrome.storage.local.set({ pageSettings: message.settings });
      return { ok: true };
    }
    default:
      return { ok: false, error: "unknown_action" };
  }
}
