const DEFAULT_SETTINGS = {
  voiceMode: "auto",
  selectedVoiceName: "auto",
  speechRate: 1.0
};

const UNKNOWN_LANGUAGE = {
  code: "unknown",
  name: "Unknown"
};

const elements = {
  voiceMode: document.getElementById("voiceMode"),
  voiceSelect: document.getElementById("voiceSelect"),
  selectedVoiceText: document.getElementById("selectedVoiceText"),
  previewText: document.getElementById("previewText"),
  previewButton: document.getElementById("previewButton"),
  detectButton: document.getElementById("detectButton"),
  stopButton: document.getElementById("stopButton"),
  speakButton: document.getElementById("speakButton"),
  speedSlider: document.getElementById("speedSlider"),
  speedValue: document.getElementById("speedValue"),
  languageText: document.getElementById("languageText"),
  statusText: document.getElementById("statusText")
};

let availableVoices = [];
let detectedLanguage = UNKNOWN_LANGUAGE;
let lastSelectedText = "";

function setStatus(message) {
  elements.statusText.textContent = message;
}

function updateSpeedText(rate) {
  elements.speedValue.textContent = `${Number(rate).toFixed(1)}x`;
}

function getDisplayedVoices() {
  const languageVoices = SelectSpeak.getLanguageVoiceMatches(
    availableVoices,
    detectedLanguage.code
  );

  if (detectedLanguage.code === "unknown") {
    return availableVoices;
  }

  return languageVoices;
}

function getSelectedVoice() {
  return availableVoices.find((voice) => {
    return voice.voiceName === elements.voiceSelect.value;
  });
}

function getAutoVoice() {
  return SelectSpeak.findBestVoice(availableVoices, detectedLanguage.code);
}

function updatePreviewText() {
  elements.previewText.textContent = SelectSpeak.getPreviewText(detectedLanguage.code);
}

function updateLanguageText() {
  if (detectedLanguage.code === "unknown") {
    elements.languageText.textContent = "None yet";
    return;
  }

  elements.languageText.textContent = `${detectedLanguage.name} (${detectedLanguage.code})`;
}

function updateSelectedVoiceText() {
  if (elements.voiceMode.value === "manual" && elements.voiceSelect.value !== "auto") {
    elements.selectedVoiceText.textContent = SelectSpeak.getVoiceLabel(getSelectedVoice());
    return;
  }

  const autoVoice = getAutoVoice();
  elements.selectedVoiceText.textContent = autoVoice
    ? SelectSpeak.getVoiceLabel(autoVoice)
    : "Auto choose best voice";
}

function addVoiceOption(value, label, disabled = false) {
  const option = document.createElement("option");

  option.value = value;
  option.textContent = label;
  option.disabled = disabled;
  elements.voiceSelect.appendChild(option);
}

function populateVoiceOptions(preferredVoiceName = elements.voiceSelect.value) {
  const voicesToShow = getDisplayedVoices();

  elements.voiceSelect.replaceChildren();
  addVoiceOption("auto", "Auto choose best voice");

  voicesToShow.forEach((voice) => {
    addVoiceOption(voice.voiceName, SelectSpeak.getVoiceLabel(voice));
  });

  if (voicesToShow.length === 0 && detectedLanguage.code !== "unknown") {
    addVoiceOption("no-match", `No ${detectedLanguage.name} voices installed`, true);
  }

  const hasPreferredVoice = voicesToShow.some((voice) => {
    return voice.voiceName === preferredVoiceName;
  });

  elements.voiceSelect.value = hasPreferredVoice ? preferredVoiceName : "auto";
  updateSelectedVoiceText();
}

function updateVoiceSelectState() {
  const isAutoMode = elements.voiceMode.value === "auto";

  elements.voiceSelect.disabled = isAutoMode;

  if (isAutoMode) {
    elements.voiceSelect.value = "auto";
  }

  updateSelectedVoiceText();
}

function updateDetectedLanguage(language, selectedText) {
  detectedLanguage = language;
  lastSelectedText = selectedText;

  updateLanguageText();
  updatePreviewText();
  populateVoiceOptions();
  updateVoiceSelectState();
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

    elements.voiceMode.value = settings.voiceMode;
    elements.speedSlider.value = settings.speechRate;

    populateVoiceOptions(settings.selectedVoiceName);
    updateSpeedText(settings.speechRate);
    updateVoiceSelectState();
    updateLanguageText();
    updatePreviewText();

    callback?.();
  });
}

function loadVoices() {
  chrome.tts.getVoices((voices) => {
    availableVoices = voices;
    restoreSavedSettings(() => {
      detectSelectedText({ silentWhenEmpty: true });
    });
  });
}

function getCurrentTab() {
  return chrome.tabs.query({
    active: true,
    currentWindow: true
  }).then((tabs) => tabs[0]);
}

async function getSelectedTextFromPage() {
  const tab = await getCurrentTab();
  const response = await chrome.tabs.sendMessage(tab.id, {
    action: "getSelectedText"
  });

  return (response?.text || "").trim();
}

async function detectSelectedText({ silentWhenEmpty = false } = {}) {
  try {
    const selectedText = await getSelectedTextFromPage();

    if (!selectedText) {
      updateDetectedLanguage(UNKNOWN_LANGUAGE, "");

      if (!silentWhenEmpty) {
        setStatus("Please select text on the page first.");
      }

      return "";
    }

    const language = SelectSpeak.detectLanguage(selectedText);
    const matchingVoices = SelectSpeak.getLanguageVoiceMatches(availableVoices, language.code);

    updateDetectedLanguage(language, selectedText);
    setStatus(`Detected ${language.name}. Showing ${matchingVoices.length} matching voice${matchingVoices.length === 1 ? "" : "s"}.`);

    return selectedText;
  } catch (error) {
    console.error(error);

    if (!silentWhenEmpty) {
      setStatus("Cannot inspect this page. Refresh the page and try again.");
    }

    return "";
  }
}

function getConfiguredVoiceName() {
  if (elements.voiceMode.value === "manual" && elements.voiceSelect.value !== "auto") {
    updateSelectedVoiceText();

    return {
      voiceName: elements.voiceSelect.value,
      status: "Reading with manually selected voice."
    };
  }

  const bestVoice = getAutoVoice();

  if (!bestVoice) {
    elements.selectedVoiceText.textContent = "No matching voice found";

    return {
      voiceName: undefined,
      status: "No matching voice found. Using default voice."
    };
  }

  elements.selectedVoiceText.textContent = SelectSpeak.getVoiceLabel(bestVoice);

  return {
    voiceName: bestVoice.voiceName,
    status: "Reading with auto-detected voice."
  };
}

function getPreviewVoiceName() {
  if (elements.voiceMode.value === "manual" && elements.voiceSelect.value !== "auto") {
    return elements.voiceSelect.value;
  }

  return getAutoVoice()?.voiceName;
}

function speak(text, voiceName, rate) {
  chrome.tts.stop();
  chrome.tts.speak(text, SelectSpeak.getSpeechOptions({ rate, voiceName }));
}

elements.voiceMode.addEventListener("change", () => {
  const selectedMode = elements.voiceMode.value;
  const settings = {
    voiceMode: selectedMode
  };

  if (selectedMode === "auto") {
    settings.selectedVoiceName = "auto";
    elements.voiceSelect.value = "auto";
  }

  saveSettings(settings);
  updateVoiceSelectState();
  setStatus(`Voice mode set to ${selectedMode}.`);
});

elements.voiceSelect.addEventListener("change", () => {
  saveSettings({
    selectedVoiceName: elements.voiceSelect.value
  });

  updateSelectedVoiceText();
  setStatus("Selected voice saved.");
});

elements.speedSlider.addEventListener("input", () => {
  const selectedRate = Number(elements.speedSlider.value);

  updateSpeedText(selectedRate);
  saveSettings({
    speechRate: selectedRate
  });
  setStatus(`Speed set to ${selectedRate.toFixed(1)}x.`);
});

elements.detectButton.addEventListener("click", () => {
  detectSelectedText();
});

elements.previewButton.addEventListener("click", () => {
  const selectedRate = Number(elements.speedSlider.value);
  const selectedVoiceName = getPreviewVoiceName();
  const previewText = SelectSpeak.getPreviewText(detectedLanguage.code);

  speak(previewText, selectedVoiceName, selectedRate);
  setStatus(selectedVoiceName ? "Previewing detected-language voice." : "Previewing default voice.");
});

elements.stopButton.addEventListener("click", () => {
  chrome.tts.stop();
  setStatus("Stopped.");
});

elements.speakButton.addEventListener("click", async () => {
  const selectedText = await detectSelectedText();

  if (!selectedText) {
    return;
  }

  const selectedRate = Number(elements.speedSlider.value);
  const selectedVoice = getConfiguredVoiceName();

  speak(lastSelectedText, selectedVoice.voiceName, selectedRate);
  setStatus(selectedVoice.status);
});

loadVoices();
