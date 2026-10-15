// Import parsers for Local Clipper.
//
// Pure functions only — no chrome.* APIs and no DOM — so they can be unit-tested
// with plain node (see tests/import.test.js).
//
// Supported inputs:
//   - Netscape bookmarks HTML  (Pocket's ril_export.html, browser bookmarks)
//   - CSV                      (Instapaper, Readwise, generic URL/Title tables)
//   - JSON                     (Local Clipper's own export manifest, or a plain array)
//
// Output is always a list of { url, title, savedAt, tags }.
(function (root) {
  "use strict";

  function cleanText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function decodeEntities(value) {
    return String(value || "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, function (_m, code) { return String.fromCharCode(parseInt(code, 10)); })
      .replace(/&amp;/g, "&");
  }

  function isHttp(url) {
    return /^https?:\/\//i.test(String(url || ""));
  }

  function domainOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (e) {
      return "";
    }
  }

  function normalizeDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return isNaN(date.getTime()) ? "" : date.toISOString();
  }

  function splitTags(value) {
    return cleanText(value)
      .split(/[,;]/)
      .map(cleanText)
      .filter(Boolean);
  }

  // ── Netscape bookmarks HTML ────────────────────────────────────────────
  function parseNetscape(html) {
    const items = [];
    const re = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = re.exec(html))) {
      const url = decodeEntities(match[1]).trim();
      if (!isHttp(url)) continue;
      const tag = match[0];
      const title = cleanText(decodeEntities(match[2].replace(/<[^>]+>/g, ""))) || url;

      const timeAdded = /time_added\s*=\s*["'](\d+)["']/i.exec(tag);
      const addDate = /add_date\s*=\s*["'](\d+)["']/i.exec(tag);
      const tags = /tags\s*=\s*["']([^"']*)["']/i.exec(tag);
      const seconds = timeAdded ? parseInt(timeAdded[1], 10)
        : (addDate ? parseInt(addDate[1], 10) : 0);

      items.push({
        url: url,
        title: title,
        savedAt: seconds ? new Date(seconds * 1000).toISOString() : "",
        tags: tags ? splitTags(decodeEntities(tags[1])) : []
      });
    }
    return items;
  }

  // ── CSV ────────────────────────────────────────────────────────────────
  function parseCsvRows(text, delimiter) {
    const sep = delimiter || ",";
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === sep) {
        row.push(field); field = "";
      } else if (ch === "\n") {
        row.push(field); rows.push(row); row = []; field = "";
      } else if (ch !== "\r") {
        field += ch;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) {
      return r.some(function (c) { return String(c).trim() !== ""; });
    });
  }

  function parseCsv(text) {
    const rows = parseCsvRows(text);
    if (!rows.length) return [];

    const header = rows[0].map(function (h) { return cleanText(h).toLowerCase(); });
    function column(names) {
      return header.findIndex(function (h) { return names.indexOf(h) !== -1; });
    }

    let urlCol = column(["url", "link", "href", "address", "web url"]);
    let titleCol = column(["title", "name", "book title", "description"]);
    let dateCol = column(["timestamp", "time_added", "created", "created at", "saved at", "highlighted at", "date"]);
    let tagCol = column(["tags", "tag", "folder", "category", "document tags"]);
    let start = 1;

    // No recognisable header — assume the first column holds the URL.
    if (urlCol === -1) {
      urlCol = 0; titleCol = -1; dateCol = -1; tagCol = -1; start = 0;
    }

    const items = [];
    for (let i = start; i < rows.length; i++) {
      const cells = rows[i];
      const url = cleanText(cells[urlCol]);
      if (!isHttp(url)) continue;
      items.push({
        url: url,
        title: (titleCol > -1 && cleanText(cells[titleCol])) || url,
        savedAt: dateCol > -1 ? normalizeDate(cleanText(cells[dateCol])) : "",
        tags: tagCol > -1 ? splitTags(cells[tagCol]) : []
      });
    }
    return items;
  }

  // ── JSON ───────────────────────────────────────────────────────────────
  function parseJson(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return [];
    }

    let list = [];
    if (Array.isArray(data)) list = data;
    else if (data && Array.isArray(data.pages)) list = data.pages;
    else if (data && Array.isArray(data.items)) list = data.items;
    else if (data && Array.isArray(data.clips)) list = data.clips;
    else return [];

    const items = [];
    list.forEach(function (entry) {
      if (!entry || typeof entry !== "object") return;
      const url = cleanText(entry.url || entry.href || entry.link);
      if (!isHttp(url)) return;
      items.push({
        url: url,
        title: cleanText(entry.title || entry.name) || url,
        savedAt: normalizeDate(cleanText(entry.savedAt || entry.timestamp || entry.time_added || "")),
        tags: Array.isArray(entry.tags) ? entry.tags.map(cleanText).filter(Boolean) : []
      });
    });
    return items;
  }

  // ── CSV writing ────────────────────────────────────────────────────────
  // RFC 4180: quote a field only when it needs it; escape quotes by doubling.
  function csvField(value) {
    const text = String(value == null ? "" : value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function toCsv(rows) {
    return rows.map(function (row) {
      return row.map(csvField).join(",");
    }).join("\r\n");
  }

  // ── clips ──────────────────────────────────────────────────────────────
  // Accepts what this extension exports — JSON ([{id,text,url,title,timestamp}])
  // or a delimited file with a Text column (Title / URL / Category optional).
  function parseClips(text, filename) {
    const kind = detect(text, filename);

    if (kind === "json") {
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return [];
      }
      const list = Array.isArray(data) ? data
        : (data && Array.isArray(data.clips) ? data.clips : []);
      const out = [];
      list.forEach(function (entry) {
        if (!entry || typeof entry !== "object") return;
        const body = String(entry.text || entry.clip || entry.content || "").trim();
        if (!body) return;
        out.push({
          text: body,
          url: cleanText(entry.url || ""),
          title: cleanText(entry.title || ""),
          timestamp: normalizeDate(cleanText(entry.timestamp || entry.savedAt || ""))
        });
      });
      return out;
    }

    // Delimited: choose tab or comma by whichever appears more in the header row.
    const header = String(text).split(/\r?\n/)[0] || "";
    const separator = header.split("\t").length > header.split(",").length ? "\t" : ",";
    const rows = parseCsvRows(text, separator);
    if (!rows.length) return [];

    const cols = rows[0].map(function (h) { return cleanText(h).toLowerCase(); });
    function find(names) {
      return cols.findIndex(function (h) { return names.indexOf(h) !== -1; });
    }
    const textCol = find(["text", "clip", "content", "snippet"]);
    if (textCol === -1) return [];

    const titleCol = find(["title", "name"]);
    const urlCol = find(["url", "link", "href"]);
    const timeCol = find(["timestamp", "saved at", "date", "created"]);

    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i];
      const body = String(cells[textCol] || "").trim();
      if (!body) continue;
      out.push({
        text: body,
        url: urlCol > -1 ? cleanText(cells[urlCol]) : "",
        title: titleCol > -1 ? cleanText(cells[titleCol]) : "",
        timestamp: timeCol > -1 ? normalizeDate(cleanText(cells[timeCol])) : ""
      });
    }
    return out;
  }

  // ── detection + entry point ────────────────────────────────────────────
  function detect(text, filename) {
    const head = String(text || "").slice(0, 4000);
    if (/NETSCAPE-Bookmark-file/i.test(head)) return "netscape";
    if (/<a\s+[^>]*href\s*=/i.test(head)) return "netscape";
    if (/\.json$/i.test(String(filename || ""))) return "json";
    if (/\.(html?|htm)$/i.test(String(filename || ""))) return "netscape";
    if (/^\s*[[{]/.test(head)) return "json";
    return "csv";
  }

  function dedupe(items) {
    const seen = new Set();
    const out = [];
    items.forEach(function (item) {
      const key = String(item.url || "").replace(/\/+$/, "").toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(item);
    });
    return out;
  }

  function parse(text, filename) {
    const kind = detect(text, filename);
    let items = [];
    if (kind === "netscape") items = parseNetscape(text);
    else if (kind === "json") items = parseJson(text);
    else items = parseCsv(text);
    return { kind: kind, items: dedupe(items) };
  }

  const api = {
    parse: parse,
    detect: detect,
    parseNetscape: parseNetscape,
    parseCsv: parseCsv,
    parseJson: parseJson,
    parseClips: parseClips,
    toCsv: toCsv,
    csvField: csvField,
    dedupe: dedupe,
    domainOf: domainOf,
    cleanText: cleanText,
    decodeEntities: decodeEntities
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ClipperImport = api;
  }
})(typeof self !== "undefined" ? self : this);
