// Page capture content script. Extracts a readable article plus a sanitized
// full-page snapshot and uploads them to background.js in chunks.
//
// Privacy: zero network requests are made here. Images are inlined only from
// bytes the browser has already decoded (same-origin/blob/data via canvas).
// Cross-origin images stay as absolute URLs.
(function () {
  "use strict";

  const CHUNK_SIZE = 512 * 1024;
  const DEFAULT_SETTINGS = { embedImages: true };
  const REMOVE_SELECTOR = "script, noscript, iframe, object, embed, form, input, button, select, textarea, canvas, dialog, template";
  const NOISE_SELECTOR = [
    "nav", "aside", "footer",
    "[role='navigation']", "[role='banner']", "[role='contentinfo']", "[aria-hidden='true']",
    ".sidebar", ".navigation", ".nav", ".menu", ".toc", "#toc",
    ".mw-editsection", ".mw-jump-link", ".mw-indicators", ".catlinks", ".printfooter",
    ".navbox", ".vertical-navbox", ".sistersitebox", ".metadata", ".ambox", ".mbox"
  ].join(", ");
  const CONTENT_SELECTORS = [
    "[itemprop='articleBody']",
    ".mw-parser-output",
    "#mw-content-text",
    "#bodyContent",
    "article",
    "[role='main']",
    "main",
    ".post-content",
    ".entry-content",
    ".article-body",
    ".article-content",
    ".markdown-body",
    ".blog-post",
    "#article",
    "#content",
    ".content"
  ];

  function sendMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          void chrome.runtime.lastError;
          resolve(response || null);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ pageSettings: DEFAULT_SETTINGS }, (data) => {
        resolve(Object.assign({}, DEFAULT_SETTINGS, data.pageSettings || {}));
      });
    });
  }

  function toAbsoluteUrl(value, baseUrl) {
    try {
      return new URL(value, baseUrl).href;
    } catch (e) {
      return value;
    }
  }

  function getDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (e) {
      return "unknown";
    }
  }

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function countWords(text) {
    const words = String(text || "").trim().match(/\S+/g);
    return words ? words.length : 0;
  }

  function textLength(el) {
    return (el.textContent || "").trim().length;
  }

  function contentScore(el) {
    const total = textLength(el);
    if (total < 200) return -Infinity;

    let paragraphScore = 0;
    el.querySelectorAll("p, pre, blockquote").forEach((node) => {
      const len = (node.textContent || "").trim().length;
      if (len >= 25) paragraphScore += Math.min(len, 1000);
    });
    el.querySelectorAll("li, td").forEach((node) => {
      const len = (node.textContent || "").trim().length;
      if (len >= 25) paragraphScore += Math.min(len, 1000) * 0.2;
    });

    const linkLength = Array.from(el.querySelectorAll("a")).reduce((sum, a) => sum + (a.textContent || "").length, 0);
    const linkDensity = Math.min(linkLength / total, 1);

    const className = el.className && el.className.toString ? el.className.toString() : "";
    const idAndClass = (className + " " + (el.id || "")).toLowerCase();
    let bonus = 0;
    if (/article|content|post|entry|story|main|markdown|read/.test(idAndClass)) bonus += 400;
    if (/comment|sidebar|footer|(^|[\s_-])nav|menu|advert|promo|share|related|recommend|widget|banner|popup|subscribe|newsletter/.test(idAndClass)) bonus -= 800;
    if (el.tagName === "ARTICLE") bonus += 400;
    if (el.tagName === "MAIN") bonus += 250;

    return paragraphScore * (1 - linkDensity) + bonus;
  }

  function findArticleRoot() {
    const candidates = [];

    CONTENT_SELECTORS.forEach((selector, priority) => {
      Array.from(document.querySelectorAll(selector)).forEach((el) => {
        if (textLength(el) < 300) return;
        const score = contentScore(el);
        if (score === -Infinity) return;
        const priorityBoost = (CONTENT_SELECTORS.length - priority) * 50;
        candidates.push({ el, score: score + priorityBoost });
      });
    });

    const parentScores = new Map();
    document.querySelectorAll("p, pre, blockquote").forEach((node) => {
      const len = (node.textContent || "").trim().length;
      if (len < 40) return;
      const parent = node.parentElement;
      if (!parent) return;
      const increment = 1 + Math.min(Math.floor(len / 100), 3);
      parentScores.set(parent, (parentScores.get(parent) || 0) + increment);
    });
    parentScores.forEach((base, el) => {
      const score = contentScore(el);
      if (score === -Infinity) return;
      candidates.push({ el, score: score + base * 12 });
    });

    if (!candidates.length) return document.body;

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].el;
  }

  function stripUnsafe(root, options) {
    const opts = options || {};
    root.querySelectorAll(REMOVE_SELECTOR).forEach((node) => node.remove());
    if (opts.stripStyles) {
      root.querySelectorAll("style, link").forEach((node) => node.remove());
    }
    root.querySelectorAll("*").forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on")) {
          el.removeAttribute(attr.name);
          return;
        }
        if (name === "srcdoc" || name === "ping") {
          el.removeAttribute(attr.name);
          return;
        }
        if ((name === "href" || name === "src" || name === "xlink:href") && /^\s*(javascript|vbscript):/i.test(attr.value)) {
          el.removeAttribute(attr.name);
        }
      });
    });
  }

  function absolutize(root, baseUrl) {
    root.querySelectorAll("a[href]").forEach((a) => {
      a.setAttribute("href", toAbsoluteUrl(a.getAttribute("href"), baseUrl));
    });
    root.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src");
      if (src) img.setAttribute("src", toAbsoluteUrl(src, baseUrl));
      img.removeAttribute("srcset");
      img.removeAttribute("sizes");
      img.removeAttribute("loading");
      img.removeAttribute("decoding");
    });
  }

  function buildArticleElement(root, baseUrl) {
    const container = document.createElement("div");
    container.innerHTML = root.innerHTML;
    container.querySelectorAll(NOISE_SELECTOR).forEach((node) => node.remove());
    stripUnsafe(container, { stripStyles: true });
    container.querySelectorAll("div, section, span").forEach((el) => {
      if (!el.textContent.trim() && !el.querySelector("img, picture, video")) el.remove();
    });
    absolutize(container, baseUrl);
    return container;
  }

  function buildSnapshotDocument(baseUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(document.documentElement.outerHTML, "text/html");
    stripUnsafe(doc, { stripStyles: false });
    let base = doc.querySelector("base");
    if (!base) {
      base = doc.createElement("base");
      doc.head.insertBefore(base, doc.head.firstChild);
    }
    base.setAttribute("href", baseUrl);
    absolutize(doc.body || doc.documentElement, baseUrl);
    return doc;
  }

  function canvasToDataUrl(img) {
    try {
      if (!img.complete || !img.naturalWidth || !img.naturalHeight) return null;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      try {
        return canvas.toDataURL("image/webp", 0.82);
      } catch (e) {
        return canvas.toDataURL("image/png");
      }
    } catch (e) {
      // Cross-origin canvas is tainted -> leave the absolute URL in place.
      return null;
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }

  async function buildInlineMap() {
    const map = new Map();
    const images = Array.from(document.images || []);
    for (const img of images) {
      try {
        const currentSrc = img.currentSrc || img.src || "";
        if (!currentSrc || currentSrc.startsWith("data:")) continue;

        if (currentSrc.startsWith("blob:")) {
          const response = await fetch(currentSrc);
          const blob = await response.blob();
          const dataUrl = await blobToDataUrl(blob);
          if (dataUrl) map.set(currentSrc, dataUrl);
          continue;
        }

        const dataUrl = canvasToDataUrl(img);
        if (dataUrl) {
          map.set(currentSrc, dataUrl);
          if (img.src && img.src !== currentSrc) map.set(img.src, dataUrl);
        }
      } catch (e) {
        // Best effort only.
      }
    }
    return map;
  }

  function applyInlineMap(root, map) {
    if (!map.size) return;
    root.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src");
      if (src && map.has(src)) img.setAttribute("src", map.get(src));
    });
  }

  function getTitle() {
    const og = document.querySelector("meta[property='og:title'], meta[name='twitter:title']");
    const ogContent = og ? (og.getAttribute("content") || "").trim() : "";
    return ogContent || document.title || "Untitled";
  }

  function getExcerpt(text) {
    const meta = document.querySelector("meta[name='description'], meta[property='og:description']");
    const content = meta ? (meta.getAttribute("content") || "").trim() : "";
    if (content) return content.slice(0, 300);
    return text.slice(0, 200);
  }

  function getFaviconDataUrl() {
    try {
      const link = document.querySelector("link[rel~='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']");
      if (!link) return "";
      const href = (link.getAttribute("href") || "").trim();
      // Only ship an already-embedded icon; fetching remote icons would be a
      // network request, which this extension does not make.
      return href.startsWith("data:") ? href : "";
    } catch (e) {
      return "";
    }
  }

  async function uploadChunks(captureId, articleHtml, snapshotHtml, text, meta) {
    const fields = [
      ["articleHtml", articleHtml],
      ["snapshotHtml", snapshotHtml],
      ["text", text]
    ];
    for (const entry of fields) {
      const field = entry[0];
      const value = entry[1];
      const total = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
      for (let index = 0; index < total; index++) {
        const data = value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
        await sendMessage({
          action: "page_capture_chunk",
          captureId,
          field,
          index,
          total,
          data
        });
      }
    }
    await sendMessage({ action: "page_capture_complete", captureId, meta });
  }

  async function capturePage(message) {
    const settings = await getSettings();
    const baseUrl = location.href;
    const root = findArticleRoot();
    const articleElement = buildArticleElement(root, baseUrl);
    const snapshotDocument = buildSnapshotDocument(baseUrl);

    if (settings.embedImages) {
      const inlineMap = await buildInlineMap();
      applyInlineMap(articleElement, inlineMap);
      applyInlineMap(snapshotDocument, inlineMap);
    }

    const text = normalizeText(articleElement.textContent);
    const words = countWords(text);
    const readingTime = Math.max(1, Math.round(words / 200));

    const meta = {
      id: message.pageId,
      url: baseUrl,
      title: getTitle(),
      domain: getDomain(baseUrl),
      favicon: getFaviconDataUrl(),
      savedAt: new Date().toISOString(),
      readingTime,
      wordCount: words,
      excerpt: getExcerpt(text)
    };

    const snapshotHtml = "<!DOCTYPE html>\n" + snapshotDocument.documentElement.outerHTML;
    await uploadChunks(message.pageId, articleElement.innerHTML, snapshotHtml, text, meta);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === "capture_page") {
      capturePage(message)
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: String(error) }));
      return true;
    }
    return undefined;
  });
})();
