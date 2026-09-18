document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("clipsContainer");
  const searchInput = document.getElementById("search");
  const btnExport = document.getElementById("btnExport");
  const btnPro = document.getElementById("btnPro");
  const btnClose = document.getElementById("btnClose");
  const proBox = document.getElementById("proBox");
  const btnActivate = document.getElementById("btnActivate");
  const licenseKeyInput = document.getElementById("licenseKey");

  const clipsView = document.getElementById("clipsView");
  const pagesView = document.getElementById("pagesView");
  const tabClips = document.getElementById("tabClips");
  const tabPages = document.getElementById("tabPages");
  const pagesContainer = document.getElementById("pagesContainer");
  const pagesCount = document.getElementById("pagesCount");
  const pageSearch = document.getElementById("pageSearch");
  const pagesUpsell = document.getElementById("pagesUpsell");
  const btnOpenLibrary = document.getElementById("btnOpenLibrary");

  const FREE_PAGE_LIMIT = 10;
  let currentTab = "clips";
  let isProState = false;
  let pageSearchTimer = null;

  function escapeHtml(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  // Close the sidebar panel window
  btnClose.addEventListener("click", () => {
    window.close();
  });

  function renderClips(filter = "") {
    chrome.storage.local.get({ clips: [], isPro: false }, (data) => {
      container.innerHTML = "";
      isProState = data.isPro;

      if (data.isPro) {
        btnPro.innerText = "PRO Active ✓";
        btnPro.style.background = "#64748b";
        btnPro.disabled = true;
      }

      const filtered = data.clips.filter(c =>
        c.text.toLowerCase().includes(filter.toLowerCase()) ||
        c.title.toLowerCase().includes(filter.toLowerCase())
      );

      if (filtered.length === 0) {
        container.innerHTML = "<p style='font-size:12px;color:#64748b;'>No clips found. Right-click selected text to save.</p>";
        return;
      }

      filtered.forEach(clip => {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <p>"${escapeHtml(clip.text)}"</p>
          <div class="meta">
            <a href="${escapeHtml(clip.url)}" target="_blank">${escapeHtml(clip.title)}</a>
            <button class="btn-del" data-id="${clip.id}">Delete</button>
          </div>
        `;
        container.appendChild(card);
      });

      document.querySelectorAll(".btn-del").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const id = Number(e.target.getAttribute("data-id"));
          deleteClip(id);
        });
      });
    });
  }

  function deleteClip(id) {
    chrome.storage.local.get({ clips: [] }, (data) => {
      const updated = data.clips.filter(c => c.id !== id);
      chrome.storage.local.set({ clips: updated }, () => renderClips(searchInput.value));
    });
  }

  async function renderPages(filter = "") {
    const [pages, data, count] = await Promise.all([
      ClipperArchive.searchPages(filter, { fullText: isProState }),
      chrome.storage.local.get({ isPro: false }),
      ClipperArchive.countPages()
    ]);
    isProState = data.isPro;
    pagesContainer.innerHTML = "";

    pagesCount.innerText = isProState ? `Pages: ${count}` : `Pages: ${count} / ${FREE_PAGE_LIMIT}`;

    if (isProState) {
      pagesUpsell.style.display = "none";
    } else {
      pagesUpsell.style.display = "block";
      pagesUpsell.innerHTML = filter.trim()
        ? "Full-text search is a <strong>Pro</strong> feature."
        : "Pro unlocks unlimited pages, full-text search and archive export.";
    }

    if (pages.length === 0) {
      pagesContainer.innerHTML = "<p style='font-size:12px;color:#64748b;'>No saved pages yet. Right-click a page and choose “Save page for later”.</p>";
      return;
    }

    pages.forEach(page => {
      const card = document.createElement("div");
      card.className = "card";
      const snippet = page.snippet || page.excerpt || "";
      card.innerHTML = `
        <p>${escapeHtml(page.title || "Untitled")}</p>
        <div class="page-sub">${escapeHtml(page.domain || "")} · ${escapeHtml(formatDate(page.savedAt))} · ${page.readingTime || 1} min read</div>
        ${snippet ? `<div class="page-sub">${escapeHtml(snippet)}</div>` : ""}
        <div class="meta">
          <button class="btn-read" data-id="${page.id}">Read</button>
          <button class="btn-read" data-url="${escapeHtml(page.url || "")}">Original</button>
          <button class="btn-del" data-id="${page.id}">Delete</button>
        </div>
      `;
      pagesContainer.appendChild(card);
    });

    pagesContainer.querySelectorAll(".btn-read[data-url]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const url = e.target.getAttribute("data-url");
        if (url) window.open(url, "_blank", "noopener");
      });
    });

    pagesContainer.querySelectorAll(".btn-read[data-id]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.target.getAttribute("data-id");
        chrome.runtime.sendMessage({ action: "open_reader", pageId: id });
      });
    });

    pagesContainer.querySelectorAll(".btn-del").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.getAttribute("data-id");
        if (!confirm("Delete this saved page?")) return;
        await ClipperArchive.deletePage(id);
        renderPages(pageSearch.value);
      });
    });
  }

  function switchTab(tab) {
    currentTab = tab;
    const isClips = tab === "clips";
    clipsView.style.display = isClips ? "block" : "none";
    pagesView.style.display = isClips ? "none" : "block";
    tabClips.classList.toggle("active", isClips);
    tabPages.classList.toggle("active", !isClips);
    if (isClips) renderClips(searchInput.value);
    else renderPages(pageSearch.value);
  }

  tabClips.addEventListener("click", () => switchTab("clips"));
  tabPages.addEventListener("click", () => switchTab("pages"));

  pageSearch.addEventListener("input", (e) => {
    clearTimeout(pageSearchTimer);
    const value = e.target.value;
    pageSearchTimer = setTimeout(() => renderPages(value), 150);
  });

  btnOpenLibrary.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "open_library" });
  });

  // Export Clips as CSV File (Pro only)
  btnExport.addEventListener("click", () => {
    chrome.storage.local.get({ clips: [], isPro: false }, (data) => {
      if (!data.isPro) {
        return alert("Exporting clips is a Pro feature. Upgrade to unlock it.");
      }
      if (data.clips.length === 0) return alert("No clips to export!");
      let csv = "Title,URL,Text\n";
      data.clips.forEach(c => {
        csv += `"${c.title}","${c.url}","${c.text.replace(/"/g, '""')}"\n`;
      });
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my_clips.csv";
      a.click();
    });
  });

  // Toggle Pro License Section
  btnPro.addEventListener("click", () => {
    proBox.style.display = proBox.style.display === "block" ? "none" : "block";
  });

  // Validate License Key via Lemon Squeezy API
  btnActivate.addEventListener("click", async () => {
    const key = licenseKeyInput.value.trim();
    if (!key) return alert("Please enter a key.");

    try {
      const res = await fetch("https://api.lemonsqueezy.com/v1/licenses/validate", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ license_key: key })
      });
      const json = await res.json();

      if (json.valid) {
        chrome.storage.local.set({ isPro: true }, () => {
          alert("License activated! You are now Pro.");
          proBox.style.display = "none";
          renderClips();
        });
      } else {
        alert("Invalid license key.");
      }
    } catch (err) {
      alert("Error validating license key.");
    }
  });

  searchInput.addEventListener("input", (e) => renderClips(e.target.value));
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "clip_saved") renderClips(searchInput.value);
    if (msg.action === "page_saved" && currentTab === "pages") renderPages(pageSearch.value);
  });

  renderClips();
});
