let activeAudio = null;
let activeAudioUrl = null;
let activeTracker = null;

function getSelectedText() {
  return window.getSelection()?.toString().trim() ?? "";
}

function cleanupWordTracker() {
  if (!activeTracker) {
    return;
  }

  window.clearInterval(activeTracker.intervalId);

  activeTracker.spans.forEach((span) => {
    const parent = span.parentNode;

    if (!parent) {
      return;
    }

    parent.replaceChild(document.createTextNode(span.textContent), span);
    parent.normalize();
  });

  activeTracker = null;
}

function stopActiveAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.removeAttribute("src");
    activeAudio.load();
    activeAudio = null;
  }

  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = null;
  }

  cleanupWordTracker();
}

function getSelectedTextNodes(range) {
  const nodes = [];
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }

        try {
          return range.intersectsNode(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        } catch {
          return NodeFilter.FILTER_REJECT;
        }
      }
    }
  );

  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
    nodes.unshift(range.commonAncestorContainer);
  }

  return [...new Set(nodes)];
}

function getNodeSelectionOffsets(range, node) {
  const start = node === range.startContainer ? range.startOffset : 0;
  const end = node === range.endContainer ? range.endOffset : node.nodeValue.length;

  return {
    start: Math.max(0, Math.min(start, node.nodeValue.length)),
    end: Math.max(0, Math.min(end, node.nodeValue.length))
  };
}

function createHighlightSpan() {
  const span = document.createElement("span");
  span.dataset.selectSpeakWord = "true";
  span.style.borderRadius = "3px";
  span.style.transition = "background-color 80ms linear, box-shadow 80ms linear";

  return span;
}

function setActiveWord(index) {
  if (!activeTracker) {
    return;
  }

  activeTracker.spans.forEach((span, spanIndex) => {
    if (spanIndex === index) {
      span.style.backgroundColor = "#fde047";
      span.style.boxShadow = "0 0 0 2px rgba(253, 224, 71, 0.35)";
      return;
    }

    span.style.backgroundColor = spanIndex < index ? "rgba(250, 204, 21, 0.25)" : "transparent";
    span.style.boxShadow = "none";
  });
}

function createWordTracker() {
  cleanupWordTracker();

  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0).cloneRange();
  const entries = [];

  getSelectedTextNodes(range).forEach((node) => {
    const { start, end } = getNodeSelectionOffsets(range, node);
    const selectedPart = node.nodeValue.slice(start, end);
    const matches = [...selectedPart.matchAll(/\S+/g)];

    matches.forEach((match) => {
      entries.push({
        node,
        start: start + match.index,
        end: start + match.index + match[0].length,
        span: null
      });
    });
  });

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    const node = entry.node;

    if (!node.parentNode || entry.end > node.nodeValue.length || entry.start >= entry.end) {
      continue;
    }

    const afterNode = entry.end < node.nodeValue.length ? node.splitText(entry.end) : null;
    const wordNode = entry.start > 0 ? node.splitText(entry.start) : node;
    const span = createHighlightSpan();

    wordNode.parentNode.insertBefore(span, wordNode);
    span.appendChild(wordNode);
    entry.span = span;

    if (afterNode) {
      entry.node = node;
    }
  }

  const spans = entries.map((entry) => entry.span).filter(Boolean);

  if (spans.length === 0) {
    return null;
  }

  activeTracker = {
    spans,
    intervalId: null
  };

  setActiveWord(0);

  return activeTracker;
}

function startWordTracking(audio) {
  const tracker = createWordTracker();

  if (!tracker) {
    return;
  }

  const update = () => {
    if (!activeTracker || !Number.isFinite(audio.duration) || audio.duration <= 0) {
      return;
    }

    const progress = Math.min(audio.currentTime / audio.duration, 0.999);
    const activeIndex = Math.floor(progress * activeTracker.spans.length);
    setActiveWord(activeIndex);
  };

  tracker.intervalId = window.setInterval(update, 80);
  audio.addEventListener("timeupdate", update);
  audio.addEventListener("loadedmetadata", update, { once: true });
}

async function playText(text, preferences = {}) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    throw new Error("Text is required.");
  }

  stopActiveAudio();

  const audioBlob = await SelectSpeak.fetchSpeech(normalizedText, preferences);
  activeAudioUrl = URL.createObjectURL(audioBlob);
  activeAudio = new Audio(activeAudioUrl);
  activeAudio.playbackRate = preferences.rate || 1;

  activeAudio.addEventListener("ended", stopActiveAudio, { once: true });
  activeAudio.addEventListener("error", stopActiveAudio, { once: true });

  startWordTracking(activeAudio);

  try {
    await activeAudio.play();
  } catch (error) {
    stopActiveAudio();
    throw error;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "GET_SELECTED_TEXT" || message.action === "getSelectedText") {
    sendResponse({
      success: true,
      text: getSelectedText()
    });

    return false;
  }

  if (message.action === "PLAY_TEXT") {
    playText(message.text || getSelectedText(), message.preferences)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({
          success: false,
          message: error.message
        });
      });

    return true;
  }

  if (message.action === "STOP_AUDIO") {
    stopActiveAudio();
    sendResponse({ success: true });

    return false;
  }

  return false;
});

