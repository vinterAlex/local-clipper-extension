// Shared IndexedDB layer for saved pages. Runs in the extension origin only
// (service worker via importScripts, or extension pages via <script>).
// Content scripts must talk to this through background.js messaging.
(function (global) {
  "use strict";

  const DB_NAME = "clipperArchive";
  const DB_VERSION = 1;
  const PAGES = "pages";
  const BODIES = "bodies";

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(PAGES)) {
          const store = db.createObjectStore(PAGES, { keyPath: "id" });
          store.createIndex("url", "url", { unique: false });
          store.createIndex("savedAt", "savedAt", { unique: false });
        }
        if (!db.objectStoreNames.contains(BODIES)) {
          db.createObjectStore(BODIES, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  function promisify(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function store(db, name, mode) {
    return db.transaction(name, mode).objectStore(name);
  }

  async function countPages() {
    const db = await openDB();
    return promisify(store(db, PAGES, "readonly").count());
  }

  // Imported entries are link-only placeholders, not archived articles, and they
  // cost almost nothing to store. They must not consume the free offline-page
  // allowance — only real captures count toward it.
  async function countArchivedPages() {
    const pages = await listPages();
    return pages.filter((page) => !page.imported).length;
  }

  async function putPage(page, body) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([PAGES, BODIES], "readwrite");
      tx.objectStore(PAGES).put(page);
      tx.objectStore(BODIES).put(body);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function getPage(id) {
    const db = await openDB();
    const page = await promisify(store(db, PAGES, "readonly").get(id));
    if (!page) return null;
    const body = await promisify(store(db, BODIES, "readonly").get(id));
    return { page, body: body || { id, articleHtml: "", snapshotHtml: "", text: "" } };
  }

  async function getPageByUrl(url) {
    const db = await openDB();
    const index = store(db, PAGES, "readonly").index("url");
    return promisify(index.get(url));
  }

  async function listPages() {
    const db = await openDB();
    const all = await promisify(store(db, PAGES, "readonly").getAll());
    return all.sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));
  }

  async function deletePage(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([PAGES, BODIES], "readwrite");
      tx.objectStore(PAGES).delete(id);
      tx.objectStore(BODIES).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function clearPages() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([PAGES, BODIES], "readwrite");
      tx.objectStore(PAGES).clear();
      tx.objectStore(BODIES).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  function makeSnippet(text, query) {
    const lower = text.toLowerCase();
    const index = lower.indexOf(query);
    if (index === -1) return text.slice(0, 160).replace(/\s+/g, " ").trim();
    const start = Math.max(0, index - 60);
    const end = Math.min(text.length, index + query.length + 100);
    const prefix = start > 0 ? "\u2026" : "";
    const suffix = end < text.length ? "\u2026" : "";
    return prefix + text.slice(start, end).replace(/\s+/g, " ").trim() + suffix;
  }

  async function searchPages(query, options) {
    const opts = options || {};
    const q = String(query || "").trim().toLowerCase();
    const pages = await listPages();
    if (!q) return pages;

    const matchedIds = new Set();
    const snippets = {};

    pages.forEach((page) => {
      const haystack = `${page.title || ""} ${page.domain || ""} ${page.url || ""}`.toLowerCase();
      if (haystack.includes(q)) matchedIds.add(page.id);
    });

    if (opts.fullText) {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const request = store(db, BODIES, "readonly").openCursor();
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (!cursor) return resolve();
          const body = cursor.value || {};
          const text = body.text || "";
          if (text.toLowerCase().includes(q)) {
            matchedIds.add(body.id);
            snippets[body.id] = makeSnippet(text, q);
          }
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
      });
    }

    return pages
      .filter((page) => matchedIds.has(page.id))
      .map((page) => Object.assign({}, page, { snippet: snippets[page.id] || "" }));
  }

  global.ClipperArchive = {
    DB_NAME,
    openDB,
    countPages,
    countArchivedPages,
    putPage,
    getPage,
    getPageByUrl,
    listPages,
    deletePage,
    clearPages,
    searchPages
  };
})(typeof self !== "undefined" ? self : this);
