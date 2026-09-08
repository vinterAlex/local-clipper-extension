document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("clipsContainer");
  const searchInput = document.getElementById("search");
  const btnExport = document.getElementById("btnExport");
  const btnPro = document.getElementById("btnPro");
  const btnClose = document.getElementById("btnClose");
  const proBox = document.getElementById("proBox");
  const btnActivate = document.getElementById("btnActivate");
  const licenseKeyInput = document.getElementById("licenseKey");

  // Close the sidebar panel window
  btnClose.addEventListener("click", () => {
    window.close();
  });

  function renderClips(filter = "") {
    chrome.storage.local.get({ clips: [], isPro: false }, (data) => {
      container.innerHTML = "";
      
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
          <p>"${clip.text}"</p>
          <div class="meta">
            <a href="${clip.url}" target="_blank">${clip.title}</a>
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
  });

  renderClips();
});