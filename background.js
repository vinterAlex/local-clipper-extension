const COMMUNITY_CLIP_LIMIT = 50;

let currentSelection = "";

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "save-clip",
      title: "Save selection to Clips",
      contexts: ["selection"]
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenu();
});

// Receive the formatted selection from content.js when right-clicking
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "set_active_selection") {
    currentSelection = message.text;
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-clip") {
    const rawSelectedText = currentSelection || info.selectionText || "";
    const pageUrl = tab.url || "";
    const pageTitle = tab.title || "Untitled Page";

    const cleanRawText = rawSelectedText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const normalizeText = (str) => str.replace(/\s+/g, ' ').trim();
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
});