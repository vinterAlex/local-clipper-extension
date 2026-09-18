// Library + reader page. Runs in the extension origin, so it talks to
// IndexedDB directly. No network requests are made here.
(function () {
  "use strict";

  const FREE_PAGE_LIMIT = 10;
  const state = { isPro: false, theme: "light", currentId: null, searchTimer: null };

  const els = {
    back: document.getElementById("rcBack"),
    search: document.getElementById("rcSearch"),
    export: document.getElementById("rcExport"),
    print: document.getElementById("rcPrint"),
    theme: document.getElementById("rcTheme"),
    progress: document.getElementById("rcProgress"),
    progressBar: document.getElementById("rcProgressBar"),
    upsell: document.getElementById("rcUpsell"),
    library: document.getElementById("rcLibrary"),
    reader: document.getElementById("rcReader"),
    list: document.getElementById("rcList"),
    title: document.getElementById("rcTitle"),
    sub: document.getElementById("rcSub"),
    source: document.getElementById("rcSource"),
    content: document.getElementById("rcContent")
  };

  function escapeHtml(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function avatarLetter(domain) {
    const match = String(domain || "?").replace(/^www\./, "").match(/[a-z0-9]/i);
    return (match ? match[0] : "?").toUpperCase();
  }

  function avatarColor(domain) {
    return `hsl(${hashString(domain || "?") % 360}, 55%, 45%)`;
  }

  function formatDate(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function applyTheme(theme) {
    state.theme = theme === "dark" ? "dark" : "light";
    document.body.classList.toggle("dark", state.theme === "dark");
    els.theme.innerText = state.theme === "dark" ? "☀️" : "🌙";
  }

  function toggleTheme() {
    const next = state.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    chrome.storage.local.set({ theme: next });
  }

  function sanitizeToContainer(html) {
    const parsed = new DOMParser().parseFromString("<div id='rcRoot'>" + (html || "") + "</div>", "text/html");
    const root = parsed.getElementById("rcRoot");
    if (!root) return document.createElement("div");
    root.querySelectorAll("script, iframe, object, embed, form, input, button, style, link, meta").forEach((node) => node.remove());
    root.querySelectorAll("*").forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on") || name === "srcdoc") {
          el.removeAttribute(attr.name);
        } else if ((name === "href" || name === "src") && /^\s*(javascript|vbscript):/i.test(attr.value)) {
          el.removeAttribute(attr.name);
        }
      });
      if (el.tagName === "IMG") {
        el.setAttribute("referrerpolicy", "no-referrer");
      }
    });
    return root;
  }

  function renderArticle(html) {
    const root = sanitizeToContainer(html);
    els.content.innerHTML = "";
    while (root.firstChild) {
      els.content.appendChild(document.adoptNode(root.firstChild));
    }
  }

  function renderList(pages, query) {
    els.list.innerHTML = "";
    if (!pages.length) {
      els.list.innerHTML = query.trim()
        ? "<p class='rc-empty'>No saved pages match that search.</p>"
        : "<p class='rc-empty'>No saved pages yet. Open any page, right-click, and choose “Save page for later”.</p>";
      return;
    }
    pages.forEach((page) => {
      const card = document.createElement("div");
      card.className = "rc-card";

      const favicon = page.favicon
        ? `<img class="rc-favicon" src="${page.favicon}" alt="">`
        : `<span class="rc-favicon rc-avatar" style="background:${avatarColor(page.domain)}">${escapeHtml(avatarLetter(page.domain))}</span>`;

      const snippet = page.snippet || page.excerpt || "";
      card.innerHTML = `
        <div class="rc-card-head">${favicon}<span class="rc-card-title">${escapeHtml(page.title || "Untitled")}</span></div>
        <div class="rc-card-sub">${escapeHtml(page.domain || "")} · ${escapeHtml(formatDate(page.savedAt))} · ${page.readingTime || 1} min read</div>
        ${snippet ? `<div class="rc-card-snippet">${escapeHtml(snippet)}</div>` : ""}
        <div class="rc-card-actions">
          <button class="rc-open">Read</button>
          <button class="rc-original" data-url="${escapeHtml(page.url || "")}">Original ↗</button>
          <button class="rc-del">Delete</button>
        </div>
      `;

      card.addEventListener("click", (event) => {
        if (event.target.classList.contains("rc-del") || event.target.classList.contains("rc-original")) return;
        openReader(page.id);
      });

      card.querySelector(".rc-original").addEventListener("click", (event) => {
        event.stopPropagation();
        const url = event.target.getAttribute("data-url");
        if (url) window.open(url, "_blank", "noopener");
      });

      card.querySelector(".rc-del").addEventListener("click", async (event) => {
        event.stopPropagation();
        if (!confirm("Delete this saved page?")) return;
        await ClipperArchive.deletePage(page.id);
        loadLibrary();
      });

      els.list.appendChild(card);
    });
  }

  async function loadLibrary() {
    const query = els.search.value || "";
    const pages = await ClipperArchive.searchPages(query, { fullText: state.isPro });
    renderList(pages, query);

    if (state.isPro) {
      els.upsell.style.display = "none";
      return;
    }
    els.upsell.style.display = "block";
    els.upsell.innerHTML = query.trim()
      ? "Full-text search is a <strong>Pro</strong> feature. Upgrade to search inside saved pages."
      : `Free plan saves up to ${FREE_PAGE_LIMIT} pages. <strong>Pro</strong> unlocks unlimited pages, full-text search, and archive export.`;
  }

  async function openReader(id) {
    const record = await ClipperArchive.getPage(id);
    if (!record) {
      els.upsell.style.display = "block";
      els.upsell.textContent = "This saved page could not be found.";
      return;
    }
    state.currentId = id;
    els.title.textContent = record.page.title || "Untitled";
    els.sub.textContent = `${record.page.domain || ""} · ${formatDate(record.page.savedAt)} · ${record.page.readingTime || 1} min read`;
    els.source.innerHTML = record.page.url
      ? `<a href="${escapeHtml(record.page.url)}" target="_blank" rel="noopener">${escapeHtml(record.page.url)}</a>`
      : "";

    let articleHtml = record.body.articleHtml || "";
    if (!articleHtml && record.body.snapshotHtml) {
      const match = record.body.snapshotHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      articleHtml = match ? match[1] : record.body.snapshotHtml;
    }
    renderArticle(articleHtml);
    els.library.style.display = "none";
    els.reader.style.display = "block";
    els.back.style.display = "inline-flex";
    els.search.style.display = "none";
    els.upsell.style.display = "none";
    els.progress.style.display = "block";
    els.progressBar.style.width = "0%";
    window.scrollTo(0, 0);
    if (location.hash.replace(/^#/, "") !== encodeURIComponent(id)) {
      location.hash = encodeURIComponent(id);
    }
  }

  function closeReader() {
    state.currentId = null;
    els.reader.style.display = "none";
    els.library.style.display = "block";
    els.back.style.display = "none";
    els.search.style.display = "";
    els.progress.style.display = "none";
    els.progressBar.style.width = "0%";
    history.replaceState(null, "", location.pathname);
    loadLibrary();
  }

  function updateProgress() {
    if (!state.currentId) return;
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const ratio = max > 0 ? (window.scrollY || doc.scrollTop) / max : 0;
    els.progressBar.style.width = Math.max(0, Math.min(ratio, 1)) * 100 + "%";
  }

  function buildStandaloneHtml(page, body) {
    const css = "body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;line-height:1.7;color:#1e293b}img,video{max-width:100%;height:auto}pre{background:#f8fafc;padding:12px;border-radius:6px;overflow:auto}a{color:#0284c7}blockquote{border-left:3px solid #e2e8f0;margin-left:0;padding-left:16px;color:#64748b}";
    return "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
      "<title>" + escapeHtml(page.title || "Untitled") + "</title>\n<style>" + css + "</style>\n</head>\n<body>\n<article>\n" +
      "<h1>" + escapeHtml(page.title || "Untitled") + "</h1>\n" +
      "<p><a href=\"" + escapeHtml(page.url || "#") + "\">" + escapeHtml(page.url || "") + "</a></p>\n<hr>\n" +
      (body.articleHtml || "") +
      "\n</article>\n</body>\n</html>";
  }

  async function exportArchive() {
    if (!state.isPro) {
      els.upsell.style.display = "block";
      els.upsell.innerHTML = "Exporting your archive is a <strong>Pro</strong> feature.";
      return;
    }

    const pages = await ClipperArchive.listPages();
    if (!pages.length) {
      alert("No saved pages to export.");
      return;
    }

    const files = [];
    const manifest = {
      app: "Local Clipper",
      version: chrome.runtime.getManifest().version,
      exportedAt: new Date().toISOString(),
      count: pages.length,
      pages: []
    };

    for (const page of pages) {
      const record = await ClipperArchive.getPage(page.id);
      const body = record ? record.body : { articleHtml: "", text: "" };
      files.push({ name: `pages/${page.id}.html`, content: buildStandaloneHtml(page, body) });
      manifest.pages.push({
        id: page.id,
        url: page.url,
        title: page.title,
        domain: page.domain,
        savedAt: page.savedAt,
        readingTime: page.readingTime,
        wordCount: page.wordCount,
        excerpt: page.excerpt,
        text: body.text || ""
      });
    }

    files.unshift({ name: "manifest.json", content: JSON.stringify(manifest, null, 2) });

    const zipBlob = ClipperZip.makeZip(files);
    const url = URL.createObjectURL(zipBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "local-clipper-archive.zip";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function onSearchInput() {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(loadLibrary, 150);
  }

  async function init() {
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
    } catch (e) {
      // Best effort only.
    }

    const data = await chrome.storage.local.get({ theme: "light", isPro: false });
    state.isPro = !!data.isPro;
    applyTheme(data.theme);

    els.search.addEventListener("input", onSearchInput);
    els.back.addEventListener("click", closeReader);
    els.theme.addEventListener("click", toggleTheme);
    els.print.addEventListener("click", () => window.print());
    els.export.addEventListener("click", exportArchive);
    window.addEventListener("scroll", updateProgress, { passive: true });

    document.addEventListener("keydown", (event) => {
      const tag = (event.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") {
        if (event.key === "Escape") event.target.blur();
        return;
      }
      if (event.key === "Escape") {
        if (state.currentId) closeReader();
      } else if (event.key === "t") {
        toggleTheme();
      } else if (event.key === "p") {
        if (state.currentId) window.print();
      } else if (event.key === "/") {
        event.preventDefault();
        els.search.focus();
      }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.isPro) {
        state.isPro = !!changes.isPro.newValue;
        if (!state.currentId) loadLibrary();
      }
      if (changes.theme) applyTheme(changes.theme.newValue);
    });

    window.addEventListener("focus", () => {
      if (!state.currentId) loadLibrary();
    });

    const params = new URLSearchParams(location.search);
    const hashId = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (hashId) {
      await openReader(hashId);
    } else {
      await loadLibrary();
    }
    if (params.get("export") === "1") exportArchive();
  }

  window.addEventListener("hashchange", () => {
    const id = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (id && id !== state.currentId) openReader(id);
    else if (!id && state.currentId) closeReader();
  });

  init();
})();
