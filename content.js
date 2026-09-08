// Inject Floating Dock Button
const dockBtn = document.createElement("div");
dockBtn.id = "clipper-dock-btn";
dockBtn.innerText = "📌 Clips";
document.body.appendChild(dockBtn);

// Inject Drawer Panel Container
const drawer = document.createElement("div");
drawer.id = "clipper-drawer-panel";
drawer.innerHTML = `
  <div id="clipperResizer"></div>
  <div class="clipper-header">
    <div style="display:flex; align-items:center; gap:8px;">
      <h3>Local Clipper</h3>
      <button id="clipperThemeToggle" class="clipper-theme-toggle" title="Toggle Light/Dark Mode">🌙</button>
      <button id="clipperBtnPro" class="clipper-pro-badge">Upgrade to Pro</button>
    </div>
    <button class="clipper-close-btn" id="clipperCloseBtn">✕ Hide</button>
  </div>
  
  <div class="clipper-stats-bar">
    <span id="clipperTotalCount">Total: 0</span>
    <span id="clipperFilteredCount" style="display:none;">Filtered: 0</span>
  </div>

  <div class="clipper-storage-wrapper">
    <div class="clipper-storage-text">
      <span>Storage Used:</span>
      <strong id="clipperStorageUsage">0 KB</strong>
    </div>
    <div class="clipper-storage-bar">
      <div id="clipperStorageProgress" class="clipper-storage-progress" style="width: 0%;"></div>
    </div>
    <div id="clipperStorageWarning" class="clipper-storage-warning" style="display:none;">
      ⚠️ High storage usage (>6 MB). Consider exporting and clearing space for optimal performance.
    </div>
  </div>

  <input type="text" class="clipper-search" id="clipperSearch" placeholder="Search clips...">
  
  <div id="clipperCategoryBox" class="clipper-category-box"></div>

      <!-- Unified Compact Control Bar -->
      <div class="clipper-toolbar-select">
        <label id="clipperSelectAllWrap"><input type="checkbox" id="clipperSelectAll"> Select All Visible</label>
        
        <div style="display:flex; gap:6px; align-items:center;">
          <button id="clipperBtnDeleteSelected" class="clipper-btn-del-selected" style="display:none;">Delete Selected</button>
          
          <!-- Actions Dropdown Menu -->
          <div class="clipper-dropdown">
            <button id="clipperDropdownToggle" class="clipper-dropdown-btn">Actions ⚙️ ▼</button>
            <div id="clipperDropdownMenu" class="clipper-dropdown-content">
              <button id="clipperBtnExport">Export CSV<span class="clipper-pro-hint">PRO</span></button>
              <button id="clipperBtnExportJson">Export JSON<span class="clipper-pro-hint">PRO</span></button>
              <hr style="border:none; border-top:1px solid var(--clipper-border-color); margin:4px 0;">
              <button id="clipperBtnClear" style="color:#dc2626;">Clear All Clips</button>
            </div>
          </div>
        </div>
      </div>

      <div id="clipperProUpsell" class="clipper-pro-upsell" style="display:none;">
        Bulk manage and export your clips with <strong>Pro</strong>.
      </div>

  <!-- Safety Modal for Clear All -->
  <div id="clipperClearModal" class="clipper-modal" style="display:none;">
    <div class="clipper-modal-content">
      <h4>Clear All Clips</h4>
      <p>Have you backed up or exported your saved clips?</p>
      
      <div class="clipper-modal-options">
        <label><input type="radio" name="exportCheck" value="yes"> Yes, I already exported my clips</label>
        <label><input type="radio" name="exportCheck" value="none"> I don't need to export</label>
        <label><input type="radio" name="exportCheck" value="no" checked> No, I want to export first</label>
      </div>

      <div class="clipper-modal-actions">
        <button id="clipperBtnModalCancel" class="clipper-btn-modal-sec">Cancel</button>
        <button id="clipperBtnModalConfirm" class="clipper-btn-modal-danger" disabled>Confirm & Clear</button>
      </div>
    </div>
  </div>

  <div id="clipperProBox" class="clipper-pro-box">
    <p style="margin:0 0 6px 0; font-weight:600;">Enter License Key:</p>
    <input type="text" id="clipperLicenseKey" class="clipper-search" placeholder="Paste License Key" style="margin-bottom:6px;">
    <button id="clipperBtnActivate" style="background:#15803d; color:white; width:100%; padding:6px; border:none; border-radius:4px; cursor:pointer;">Activate License</button>
  </div>

  <div id="clipperContainer"></div>
`;
document.body.appendChild(drawer);

// Capture selection formatting on right click and send to background.js
document.addEventListener("contextmenu", () => {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const containerEl = document.createElement("div");
  for (let i = 0; i < selection.rangeCount; i++) {
    containerEl.appendChild(selection.getRangeAt(0).cloneContents());
  }

  const breaks = containerEl.querySelectorAll("br, p, div, pre, li");
  breaks.forEach(el => el.after("\n"));

  const formattedText = containerEl.textContent || selection.toString();

  chrome.runtime.sendMessage({
    action: "set_active_selection",
    text: formattedText
  });
});

// DOM Elements
const closeBtn = document.getElementById("clipperCloseBtn");
const themeToggleBtn = document.getElementById("clipperThemeToggle");
const searchInput = document.getElementById("clipperSearch");
const container = document.getElementById("clipperContainer");
const totalCountSpan = document.getElementById("clipperTotalCount");
const filteredCountSpan = document.getElementById("clipperFilteredCount");
const categoryBox = document.getElementById("clipperCategoryBox");
const btnExport = document.getElementById("clipperBtnExport");
const btnExportJson = document.getElementById("clipperBtnExportJson");
const btnClear = document.getElementById("clipperBtnClear");
const btnPro = document.getElementById("clipperBtnPro");
const proBox = document.getElementById("clipperProBox");
const btnActivate = document.getElementById("clipperBtnActivate");
const licenseKeyInput = document.getElementById("clipperLicenseKey");
const resizer = document.getElementById("clipperResizer");
const selectAllCheckbox = document.getElementById("clipperSelectAll");
const btnDeleteSelected = document.getElementById("clipperBtnDeleteSelected");
const storageUsageText = document.getElementById("clipperStorageUsage");
const storageProgressBar = document.getElementById("clipperStorageProgress");
const storageWarning = document.getElementById("clipperStorageWarning");

const dropdownToggle = document.getElementById("clipperDropdownToggle");
const dropdownMenu = document.getElementById("clipperDropdownMenu");

const selectAllWrap = document.getElementById("clipperSelectAllWrap");
const proUpsell = document.getElementById("clipperProUpsell");

const clearModal = document.getElementById("clipperClearModal");
const btnModalCancel = document.getElementById("clipperBtnModalCancel");
const btnModalConfirm = document.getElementById("clipperBtnModalConfirm");
const modalRadioInputs = document.querySelectorAll('input[name="exportCheck"]');

const BATCH_SIZE = 15;
const COMMUNITY_CLIP_LIMIT = 50;
let currentRenderIndex = 0;
let isProState = false;
let currentFilteredClips = [];
let searchTimeout = null;

function applyTheme(theme) {
  if (theme === "dark") {
    drawer.classList.add("dark-mode");
    themeToggleBtn.innerText = "☀️";
  } else {
    drawer.classList.remove("dark-mode");
    themeToggleBtn.innerText = "🌙";
  }
}

chrome.storage.local.get({ theme: "light" }, (data) => {
  applyTheme(data.theme);
});

themeToggleBtn.addEventListener("click", () => {
  const isDark = drawer.classList.contains("dark-mode");
  const newTheme = isDark ? "light" : "dark";
  applyTheme(newTheme);
  chrome.storage.local.set({ theme: newTheme });
});

dockBtn.addEventListener("click", () => drawer.classList.toggle("open"));
closeBtn.addEventListener("click", () => drawer.classList.remove("open"));

dropdownToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  dropdownMenu.classList.toggle("show");
});

document.addEventListener("click", () => {
  dropdownMenu.classList.remove("show");
});

let isResizing = false;
resizer.addEventListener("mousedown", () => {
  isResizing = true;
  document.body.style.cursor = "ew-resize";
  document.body.style.userSelect = "none";
});

document.addEventListener("mousemove", (e) => {
  if (!isResizing) return;
  const newWidth = window.innerWidth - e.clientX;
  if (newWidth >= 280 && newWidth <= 800) {
    drawer.style.width = `${newWidth}px`;
  }
});

document.addEventListener("mouseup", () => {
  if (isResizing) {
    isResizing = false;
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  }
});

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getCategoryName(urlStr) {
  try {
    const url = new URL(urlStr);
    return url.hostname.replace("www.", "");
  } catch (e) {
    return "Other";
  }
}

function showToastNotification(message, isWarning = false) {
  const existingToast = document.getElementById("clipper-toast-notification");
  if (existingToast) existingToast.remove();

  const toast = document.createElement("div");
  toast.id = "clipper-toast-notification";
  toast.innerText = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${isWarning ? "#f59e0b" : "#0284c7"};
    color: white;
    padding: 10px 16px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    font-family: system-ui, -apple-system, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 1000020;
    transition: opacity 0.3s ease;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function updateStorageTracker() {
  chrome.storage.local.getBytesInUse(null, (bytes) => {
    const kb = (bytes / 1024).toFixed(1);
    const mb = (bytes / (1024 * 1024)).toFixed(2);
    
    const targetSoftLimit = 6 * 1024 * 1024;
    const percentage = Math.min(((bytes / targetSoftLimit) * 100), 100).toFixed(1);

    if (bytes >= targetSoftLimit) {
      storageUsageText.innerText = `${mb} MB`;
      storageProgressBar.style.width = "100%";
      storageProgressBar.style.background = "#e11d48";
      storageWarning.style.display = "block";
    } else {
      storageUsageText.innerText = bytes > 1024 * 1024 ? `${mb} MB` : `${kb} KB`;
      storageProgressBar.style.width = `${percentage}%`;
      storageProgressBar.style.background = percentage > 80 ? "#f59e0b" : "#0284c7";
      storageWarning.style.display = "none";
    }
  });
}

function createCardElement(clip, showCheckbox) {
  const card = document.createElement("div");
  card.className = "clipper-card";
  const catName = getCategoryName(clip.url);

  const cleanText = escapeHtml(clip.text).trim();
  const lineCount = (cleanText.match(/\n/g) || []).length;
  const isLong = cleanText.length > 250 || lineCount > 3;

  const checkboxHtml = showCheckbox
    ? `<input type="checkbox" class="clipper-card-checkbox" data-id="${clip.id}">`
    : "";

  card.innerHTML = `
    <div class="clipper-card-top">
      ${checkboxHtml}
      <span class="clipper-card-cat">${escapeHtml(catName)}</span>
    </div>
    <div class="clipper-card-body ${isLong ? 'truncated' : ''}">
      <p>${cleanText}</p>
    </div>
    ${isLong ? '<button class="clipper-toggle-btn">Show More ▼</button>' : ''}
    <div class="clipper-meta">
      <a href="${clip.url}" target="_blank">${escapeHtml(clip.title)}</a>
      <div style="display:flex; gap:4px;">
        <button class="clipper-btn-copy" data-text="${escapeHtml(clip.text)}">Copy</button>
        <button class="clipper-btn-del" data-id="${clip.id}">Delete</button>
      </div>
    </div>
  `;

  const cb = card.querySelector(".clipper-card-checkbox");
  if (cb) {
    cb.addEventListener("change", updateSelectedCount);
  }

  const toggleBtn = card.querySelector(".clipper-toggle-btn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", (e) => {
      const body = e.target.previousElementSibling;
      if (body.classList.contains("truncated")) {
        body.classList.remove("truncated");
        e.target.innerText = "Show Less ▲";
      } else {
        body.classList.add("truncated");
        e.target.innerText = "Show More ▼";
      }
    });
  }

  const copyBtn = card.querySelector(".clipper-btn-copy");
  copyBtn.addEventListener("click", (e) => {
    const rawText = e.target.getAttribute("data-text");
    navigator.clipboard.writeText(rawText).then(() => {
      const originalText = e.target.innerText;
      e.target.innerText = "Copied!";
      e.target.style.background = "#16a34a";
      setTimeout(() => {
        e.target.innerText = originalText;
        e.target.style.background = "";
      }, 1500);
    });
  });

  const delBtn = card.querySelector(".clipper-btn-del");
  delBtn.addEventListener("click", (e) => {
    const id = Number(e.target.getAttribute("data-id"));
    deleteClip(id);
  });

  return card;
}

function renderNextBatch() {
  const nextSlice = currentFilteredClips.slice(currentRenderIndex, currentRenderIndex + BATCH_SIZE);
  const fragment = document.createDocumentFragment();

  nextSlice.forEach(clip => {
    fragment.appendChild(createCardElement(clip, isProState));
  });

  container.appendChild(fragment);
  currentRenderIndex += nextSlice.length;
}

function renderDrawerClips(filter = "") {
  updateStorageTracker();
  chrome.storage.local.get({ clips: [], isPro: false }, (data) => {
    container.innerHTML = "";
    currentRenderIndex = 0;
    selectAllCheckbox.checked = false;
    updateSelectedCount();
    isProState = data.isPro;

    if (data.isPro) {
      btnPro.innerText = "PRO ✓";
      btnPro.style.background = "var(--clipper-badge-bg)";
      btnPro.style.color = "var(--clipper-text-muted)";
      btnPro.style.borderColor = "var(--clipper-border-color)";
      btnPro.disabled = true;
      selectAllWrap.style.display = "flex";
      proUpsell.style.display = "none";
    } else {
      selectAllWrap.style.display = "none";
      proUpsell.style.display = "block";
    }

    const totalClips = data.clips.length;
    totalCountSpan.innerText = data.isPro
      ? `Total: ${totalClips}`
      : `Total: ${totalClips} / ${COMMUNITY_CLIP_LIMIT}`;

    const categoryCounts = {};
    data.clips.forEach(clip => {
      const cat = getCategoryName(clip.url);
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    categoryBox.innerHTML = "";
    
    const allBadge = document.createElement("span");
    allBadge.className = filter.trim() === "" ? "clipper-cat-badge active" : "clipper-cat-badge";
    allBadge.innerHTML = `All <strong>(${totalClips})</strong>`;
    allBadge.addEventListener("click", () => {
      searchInput.value = "";
      renderDrawerClips("");
    });
    categoryBox.appendChild(allBadge);

    Object.keys(categoryCounts).forEach(cat => {
      const badge = document.createElement("span");
      const isSelected = filter.toLowerCase() === cat.toLowerCase();
      badge.className = isSelected ? "clipper-cat-badge active" : "clipper-cat-badge";
      badge.innerHTML = `${escapeHtml(cat)} <strong>(${categoryCounts[cat]})</strong>`;
      badge.addEventListener("click", () => {
        searchInput.value = cat;
        renderDrawerClips(cat);
      });
      categoryBox.appendChild(badge);
    });

    currentFilteredClips = data.clips.filter(c => {
      const search = filter.toLowerCase();
      const domain = getCategoryName(c.url).toLowerCase();
      return (
        c.text.toLowerCase().includes(search) || 
        c.title.toLowerCase().includes(search) ||
        domain.includes(search)
      );
    });

    if (filter.trim() !== "") {
      filteredCountSpan.style.display = "inline";
      filteredCountSpan.innerText = `Filtered: ${currentFilteredClips.length}`;
    } else {
      filteredCountSpan.style.display = "none";
    }

    if (currentFilteredClips.length === 0) {
      container.innerHTML = "<p style='font-size:12px;color:var(--clipper-text-muted);'>No matching clips found.</p>";
      return;
    }

    renderNextBatch();
  });
}

drawer.addEventListener("scroll", () => {
  if (currentRenderIndex >= currentFilteredClips.length) return;
  if (drawer.scrollTop + drawer.clientHeight >= drawer.scrollHeight - 100) {
    renderNextBatch();
  }
});

function updateSelectedCount() {
  const selectedBoxes = document.querySelectorAll(".clipper-card-checkbox:checked");
  if (selectedBoxes.length > 0) {
    btnDeleteSelected.style.display = "inline-block";
    btnDeleteSelected.innerText = `Delete Selected (${selectedBoxes.length})`;
  } else {
    btnDeleteSelected.style.display = "none";
  }
}

selectAllCheckbox.addEventListener("change", (e) => {
  chrome.storage.local.get({ isPro: false }, (data) => {
    if (!data.isPro) {
      e.target.checked = false;
      updateSelectedCount();
      showToastNotification("Bulk select requires Pro.", true);
      return;
    }
    const isChecked = e.target.checked;
    document.querySelectorAll(".clipper-card-checkbox").forEach(cb => {
      cb.checked = isChecked;
    });
    updateSelectedCount();
  });
});

btnDeleteSelected.addEventListener("click", () => {
  chrome.storage.local.get({ isPro: false }, (data) => {
    if (!data.isPro) {
      showToastNotification("Bulk delete requires Pro.", true);
      return;
    }
    const selectedBoxes = document.querySelectorAll(".clipper-card-checkbox:checked");
    const selectedIds = Array.from(selectedBoxes).map(cb => Number(cb.getAttribute("data-id")));

    if (selectedIds.length === 0) return;

    const confirmed = confirm(`Are you sure you want to delete ${selectedIds.length} selected clip(s)?`);
    if (confirmed) {
      chrome.storage.local.get({ clips: [] }, (data) => {
        const updated = data.clips.filter(c => !selectedIds.includes(c.id));
        chrome.storage.local.set({ clips: updated }, () => renderDrawerClips(searchInput.value));
      });
    }
  });
});

function deleteClip(id) {
  chrome.storage.local.get({ clips: [] }, (data) => {
    const updated = data.clips.filter(c => c.id !== id);
    chrome.storage.local.set({ clips: updated }, () => renderDrawerClips(searchInput.value));
  });
}

btnClear.addEventListener("click", () => {
  dropdownMenu.classList.remove("show");
  chrome.storage.local.get({ clips: [] }, (data) => {
    if (data.clips.length === 0) return alert("No clips to clear!");
    clearModal.style.display = "flex";
  });
});

modalRadioInputs.forEach(radio => {
  radio.addEventListener("change", (e) => {
    if (e.target.value === "yes" || e.target.value === "none") {
      btnModalConfirm.disabled = false;
    } else {
      btnModalConfirm.disabled = true;
    }
  });
});

btnModalCancel.addEventListener("click", () => {
  clearModal.style.display = "none";
});

btnModalConfirm.addEventListener("click", () => {
  chrome.storage.local.set({ clips: [] }, () => {
    clearModal.style.display = "none";
    renderDrawerClips();
  });
});

function getExportClips(allClips) {
  const selectedBoxes = document.querySelectorAll(".clipper-card-checkbox:checked");
  const selectedIds = Array.from(selectedBoxes).map(cb => Number(cb.getAttribute("data-id")));

  if (selectedIds.length > 0) {
    return allClips.filter(c => selectedIds.includes(c.id));
  }
  return currentFilteredClips;
}

btnExport.addEventListener("click", () => {
  dropdownMenu.classList.remove("show");
  chrome.storage.local.get({ isPro: false }, (data) => {
    if (!data.isPro) {
      showToastNotification("Export requires Pro. Click Upgrade to unlock.", true);
      return;
    }
    chrome.storage.local.get({ clips: [] }, (data) => {
      if (data.clips.length === 0) return alert("No clips to export!");
      const clipsToExport = getExportClips(data.clips);

      if (clipsToExport.length === 0) return alert("No matching clips to export!");

      let tsv = "Title\tCategory\tURL\tText\n";
      clipsToExport.forEach(c => {
        const cat = getCategoryName(c.url);
        const cleanTitle = (c.title || "").replace(/[\r\n\t]/g, " ");
        const cleanText = (c.text || "").replace(/\t/g, " ").replace(/[\r\n]+/g, " ");
        tsv += `${cleanTitle}\t${cat}\t${c.url}\t${cleanText}\n`;
      });

      const blob = new Blob(["\uFEFF" + tsv], { type: "text/tab-separated-values;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my_clips_excel.tsv";
      a.click();
    });
  });
});

btnExportJson.addEventListener("click", () => {
  dropdownMenu.classList.remove("show");
  chrome.storage.local.get({ isPro: false }, (data) => {
    if (!data.isPro) {
      showToastNotification("Export requires Pro. Click Upgrade to unlock.", true);
      return;
    }
    chrome.storage.local.get({ clips: [] }, (data) => {
      if (data.clips.length === 0) return alert("No clips to export!");
      const clipsToExport = getExportClips(data.clips);

      if (clipsToExport.length === 0) return alert("No matching clips to export!");

      const jsonStr = JSON.stringify(clipsToExport, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my_clips.json";
      a.click();
    });
  });
});

btnPro.addEventListener("click", () => {
  proBox.style.display = proBox.style.display === "block" ? "none" : "block";
});

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
        renderDrawerClips();
      });
    } else {
      alert("Invalid license key.");
    }
  } catch (err) {
    alert("Error validating key.");
  }
});

searchInput.addEventListener("input", (e) => {
  clearTimeout(searchTimeout);
  const val = e.target.value;
  searchTimeout = setTimeout(() => {
    renderDrawerClips(val);
  }, 150);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "clip_saved") {
    renderDrawerClips(searchInput.value);
    drawer.classList.add("open");
  } else if (msg.action === "duplicate_clip_detected") {
    showToastNotification("⚠️ Clip already exists in your collection!", true);
  } else if (msg.action === "clip_limit_reached") {
    showToastNotification(`⚠️ Free plan stores up to ${msg.limit} clips. Upgrade to Pro for unlimited.`, true);
  }
});

renderDrawerClips();