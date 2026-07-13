(function () {
  const BACKEND_BASE_URL = "http://localhost:3000";

  const PREVIEW_TEXT_BY_LANGUAGE = {
    ar: "\u0645\u0631\u062d\u0628\u0627\u060c \u0647\u0630\u0647 \u0645\u0639\u0627\u064a\u0646\u0629 \u0644\u0644\u0635\u0648\u062a.",
    de: "Hallo, dies ist eine kurze Stimmvorschau.",
    el: "\u0393\u03b5\u03b9\u03b1 \u03c3\u03b1\u03c2, \u03b1\u03c5\u03c4\u03ae \u03b5\u03af\u03bd\u03b1\u03b9 \u03bc\u03b9\u03b1 \u03c3\u03cd\u03bd\u03c4\u03bf\u03bc\u03b7 \u03c0\u03c1\u03bf\u03b5\u03c0\u03b9\u03c3\u03ba\u03cc\u03c0\u03b7\u03c3\u03b7 \u03c6\u03c9\u03bd\u03ae\u03c2.",
    en: "Hello, this is a short voice preview.",
    es: "Hola, esta es una breve prueba de voz.",
    fr: "Bonjour, voici un court apercu de la voix.",
    he: "\u05e9\u05dc\u05d5\u05dd, \u05d6\u05d5 \u05ea\u05e6\u05d5\u05d2\u05d4 \u05de\u05e7\u05d3\u05d9\u05de\u05d4 \u05e7\u05e6\u05e8\u05d4 \u05e9\u05dc \u05d4\u05e7\u05d5\u05dc.",
    hi: "\u0928\u092e\u0938\u094d\u0924\u0947, \u092f\u0939 \u0906\u0935\u093e\u091c \u0915\u093e \u091b\u094b\u091f\u093e \u092a\u0942\u0930\u094d\u0935\u093e\u0935\u0932\u094b\u0915\u0928 \u0939\u0948.",
    it: "Ciao, questa e una breve anteprima della voce.",
    ja: "\u3053\u3093\u306b\u3061\u306f\u3002\u3053\u308c\u306f\u77ed\u3044\u97f3\u58f0\u30d7\u30ec\u30d3\u30e5\u30fc\u3067\u3059\u3002",
    ko: "\uc548\ub155\ud558\uc138\uc694. \uc9e7\uc740 \uc74c\uc131 \ubbf8\ub9ac\ub4e3\uae30\uc785\ub2c8\ub2e4.",
    pt: "Ola, esta e uma breve previa da voz.",
    ru: "\u0417\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435, \u044d\u0442\u043e \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0439 \u043f\u0440\u0438\u043c\u0435\u0440 \u0433\u043e\u043b\u043e\u0441\u0430.",
    th: "\u0e2a\u0e27\u0e31\u0e2a\u0e14\u0e35 \u0e19\u0e35\u0e48\u0e04\u0e37\u0e2d\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e40\u0e2a\u0e35\u0e22\u0e07\u0e2a\u0e31\u0e49\u0e19.",
    vi: "Xin chao, day la ban nghe thu giong noi ngan.",
    zh: "\u4f60\u597d\uff0c\u8fd9\u662f\u4e00\u4e2a\u7b80\u77ed\u7684\u8bed\u97f3\u9884\u89c8\u3002"
  };

  const BACKEND_VOICES = [
    { voiceName: "configured", lang: "ElevenLabs" }
  ];

  const VOICE_BY_LANGUAGE = {
    default: "configured"
  };

  function getPreviewText(languageCode) {
    return PREVIEW_TEXT_BY_LANGUAGE[languageCode] || PREVIEW_TEXT_BY_LANGUAGE.en;
  }

  function findBestVoice(voices, languageCode) {
    const voiceName = VOICE_BY_LANGUAGE[languageCode] || VOICE_BY_LANGUAGE.en;

    return voices.find((voice) => voice.voiceName === voiceName) || voices[0] || null;
  }

  function getLanguageVoiceMatches(voices) {
    return voices;
  }

  function getVoiceLabel(voice) {
    return voice ? `Configured ${voice.lang} voice` : "Configured ElevenLabs voice";
  }

  async function readErrorMessage(response) {
    try {
      const body = await response.json();

      return body.message || `Request failed with ${response.status}`;
    } catch {
      return `Request failed with ${response.status}`;
    }
  }

  async function analyzeText(text) {
    const response = await fetch(`${BACKEND_BASE_URL}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const result = await response.json();

    return result.language;
  }

  async function fetchSpeech(text, preferences = {}) {
    const response = await fetch(`${BACKEND_BASE_URL}/api/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text, preferences })
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    return response.blob();
  }

  globalThis.SelectSpeak = {
    BACKEND_BASE_URL,
    BACKEND_VOICES,
    analyzeText,
    fetchSpeech,
    findBestVoice,
    getLanguageVoiceMatches,
    getPreviewText,
    getVoiceLabel
  };
})();
