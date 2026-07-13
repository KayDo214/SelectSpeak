const DEFAULT_SETTINGS = {
  speechRate: 1.0
};

const UNKNOWN_LANGUAGE = {
  code: "unknown",
  name: "Unknown"
};

const elements = {
  selectedVoiceText: document.getElementById("selectedVoiceText"),
  previewText: document.getElementById("previewText"),
  previewButton: document.getElementById("previewButton"),
  stopButton: document.getElementById("stopButton"),
  speakButton: document.getElementById("speakButton"),
  speedSlider: document.getElementById("speedSlider"),
  speedValue: document.getElementById("speedValue"),
  languageText: document.getElementById("languageText"),
  selectionText: document.getElementById("selectionText"),
  statusText: document.getElementById("statusText")
};

let detectedLanguage = UNKNOWN_LANGUAGE;
let lastSelectedText = "";
let popupAudio = null;
let popupAudioUrl = null;

function setStatus(message) {
  elements.statusText.textContent = message;
}

function updateSpeedText(rate) {
  elements.speedValue.textContent = `${Number(rate).toFixed(1)}x`;
}

function updatePreviewText() {
  elements.previewText.textContent = SelectSpeak.getPreviewText(detectedLanguage.code);
}

function updateLanguageText() {
  elements.languageText.textContent = detectedLanguage.code === "unknown"
    ? "Detected when speaking"
    : `${detectedLanguage.name} (${detectedLanguage.code})`;
}

function updateSelectionText(text) {
  const normalizedText = text.trim();
  lastSelectedText = normalizedText;
  elements.selectionText.textContent = normalizedText || "Select text on a webpage to read it aloud.";
}

function updateDetectedLanguage(language) {
  detectedLanguage = language || UNKNOWN_LANGUAGE;
  updateLanguageText();
  updatePreviewText();
}

function saveSettings(settings) {
  chrome.storage.sync.set(settings);
}

function restoreSavedSettings(callback) {
  chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS), (savedSettings) => {
    const settings = {
      ...DEFAULT_SETTINGS,
      ...savedSettings
    };

    elements.speedSlider.value = settings.speechRate;
    elements.selectedVoiceText.textContent = SelectSpeak.getVoiceLabel();
    updateSpeedText(settings.speechRate);
    updateLanguageText();
    updatePreviewText();

    callback?.();
  });
}

function getCurrentTab() {
  return chrome.tabs.query({
    active: true,
    currentWindow: true
  }).then((tabs) => tabs[0]);
}

function canInjectIntoTab(tab) {
  return /^https?:\/\//i.test(tab?.url || "");
}

function isMissingReceiverError(error) {
  return error?.message?.includes("Receiving end does not exist");
}

function getBlockedPageMessage(tab) {
  if (!tab?.url) {
    return "Cannot inspect this page.";
  }

  if (!canInjectIntoTab(tab)) {
    return "Chrome blocks extensions on this page. Try a normal http or https webpage.";
  }

  return "Cannot inspect this page. Refresh it and try again.";
}

async function injectContentScripts(tab) {
  if (!canInjectIntoTab(tab)) {
    throw new Error(getBlockedPageMessage(tab));
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

async function getSelectedTextFromPage() {
  const tab = await getCurrentTab();
  const response = await sendTabMessage(tab, {
    action: "GET_SELECTED_TEXT"
  });

  return (response?.text || "").trim();
}

async function refreshSelectedText({ silentWhenEmpty = false } = {}) {
  try {
    const selectedText = await getSelectedTextFromPage();
    updateSelectionText(selectedText);

    if (!selectedText && !silentWhenEmpty) {
      setStatus("Please select text on the page first.");
    }

    return selectedText;
  } catch (error) {
    console.error(error);
    updateSelectionText("");

    if (!silentWhenEmpty) {
      setStatus(error.message || "Cannot inspect this page.");
    }

    return "";
  }
}

async function detectLanguageForText(text) {
  setStatus("Detecting language...");
  const language = await SelectSpeak.analyzeText(text);
  updateDetectedLanguage(language);
  setStatus(`Detected ${language.name}. Preparing speech...`);

  return language;
}

function getSpeechPreferences() {
  return {
    provider: "elevenlabs",
    rate: Number(elements.speedSlider.value)
  };
}

function stopPopupAudio() {
  if (popupAudio) {
    popupAudio.pause();
    popupAudio.removeAttribute("src");
    popupAudio.load();
    popupAudio = null;
  }

  if (popupAudioUrl) {
    URL.revokeObjectURL(popupAudioUrl);
    popupAudioUrl = null;
  }
}

async function playInPopup(text, preferences) {
  stopPopupAudio();

  const audioBlob = await SelectSpeak.fetchSpeech(text, preferences);
  popupAudioUrl = URL.createObjectURL(audioBlob);
  popupAudio = new Audio(popupAudioUrl);
  popupAudio.playbackRate = preferences.rate || 1;
  popupAudio.addEventListener("ended", stopPopupAudio, { once: true });
  popupAudio.addEventListener("error", stopPopupAudio, { once: true });

  await popupAudio.play();
}

async function playInPage(text, preferences) {
  const tab = await getCurrentTab();
  const response = await sendTabMessage(tab, {
    action: "PLAY_TEXT",
    text,
    preferences
  });

  if (!response?.success) {
    throw new Error(response?.message || "Page playback failed.");
  }
}

elements.speedSlider.addEventListener("input", () => {
  const selectedRate = Number(elements.speedSlider.value);

  updateSpeedText(selectedRate);
  saveSettings({
    speechRate: selectedRate
  });
  setStatus(`Speed set to ${selectedRate.toFixed(1)}x.`);
});

elements.previewButton.addEventListener("click", async () => {
  try {
    const selectedText = await refreshSelectedText({ silentWhenEmpty: true });

    if (selectedText) {
      await detectLanguageForText(selectedText);
    }

    const previewText = SelectSpeak.getPreviewText(detectedLanguage.code);

    setStatus("Generating preview...");
    await playInPopup(previewText, getSpeechPreferences());
    setStatus("Previewing configured voice.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Preview failed.");
  }
});

elements.stopButton.addEventListener("click", async () => {
  stopPopupAudio();

  try {
    const tab = await getCurrentTab();
    await sendTabMessage(tab, { action: "STOP_AUDIO" });
  } catch {
    // The active page may not have the content script; popup audio is still stopped.
  }

  setStatus("Stopped.");
});

elements.speakButton.addEventListener("click", async () => {
  const selectedText = await refreshSelectedText();

  if (!selectedText) {
    return;
  }

  try {
    const language = await detectLanguageForText(selectedText);

    await playInPage(selectedText, getSpeechPreferences());
    setStatus(`Reading ${language.name} with word tracking.`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Speech playback failed.");
  }
});

restoreSavedSettings(() => {
  refreshSelectedText({ silentWhenEmpty: true });
});
