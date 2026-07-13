importScripts("shared.js");

function createContextMenu() {
  chrome.contextMenus.create({
    id: "read-selected-text",
    title: "Read selected text",
    contexts: ["selection"]
  });
}

function getSettings(callback) {
  chrome.storage.sync.get(["speechRate"], (settings) => {
    callback({
      speechRate: settings.speechRate || 1.0
    });
  });
}

function getPreferences(settings) {
  return {
    provider: "elevenlabs",
    rate: settings.speechRate
  };
}

function canInjectIntoTab(tab) {
  return /^https?:\/\//i.test(tab?.url || "");
}

function isMissingReceiverError(error) {
  return error?.message?.includes("Receiving end does not exist");
}

async function injectContentScripts(tab) {
  if (!canInjectIntoTab(tab)) {
    throw new Error("Chrome blocks extensions on this page.");
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["shared.js", "content.js"]
  });
}

async function sendTabMessage(tab, message) {
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }

    await injectContentScripts(tab);
    return chrome.tabs.sendMessage(tab.id, message);
  }
}

chrome.runtime.onInstalled.addListener(createContextMenu);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "read-selected-text" || !tab?.id) {
    return;
  }

  const selectedText = (info.selectionText || "").trim();

  if (!selectedText) {
    return;
  }

  getSettings((settings) => {
    sendTabMessage(tab, {
      action: "PLAY_TEXT",
      text: selectedText,
      preferences: getPreferences(settings)
    }).catch((error) => {
      console.error("SelectSpeak context menu playback failed:", error);
    });
  });
});
