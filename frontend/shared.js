(function () {
  const PREVIEW_TEXT_BY_LANGUAGE = {
    ar: "مرحبا، هذه معاينة للصوت.",
    de: "Hallo, dies ist eine kurze Stimmvorschau.",
    el: "Γεια σας, αυτή είναι μια σύντομη προεπισκόπηση φωνής.",
    en: "Hello, this is a short voice preview.",
    es: "Hola, esta es una breve prueba de voz.",
    fr: "Bonjour, voici un court aperçu de la voix.",
    he: "שלום, זו תצוגה מקדימה קצרה של הקול.",
    hi: "नमस्ते, यह आवाज़ का छोटा पूर्वावलोकन है।",
    it: "Ciao, questa è una breve anteprima della voce.",
    ja: "こんにちは。これは短い音声プレビューです。",
    ko: "안녕하세요. 짧은 음성 미리듣기입니다.",
    pt: "Olá, esta é uma breve prévia da voz.",
    ru: "Здравствуйте, это короткий пример голоса.",
    th: "สวัสดี นี่คือตัวอย่างเสียงสั้น ๆ",
    vi: "Xin chào, đây là bản nghe thử giọng nói ngắn.",
    zh: "你好，这是一个简短的语音预览。"
  };

  const LATIN_LANGUAGE_RULES = [
    {
      code: "es",
      name: "Spanish",
      pattern: /[ñ¿¡]|(?:\b(?:el|la|los|las|un|una|unos|unas|que|de|del|con|para|por|como|este|esta|esto|hola|gracias|usted|yo|tú|pero|porque|es|son|está|están)\b)/gi
    },
    {
      code: "fr",
      name: "French",
      pattern: /[œç]|(?:\b(?:le|la|les|des|une|avec|pour|vous|nous|est|sont|bonjour|merci|mais|parce|dans|être|cette|cela)\b)/gi
    },
    {
      code: "de",
      name: "German",
      pattern: /[äöüß]|(?:\b(?:der|die|das|und|nicht|mit|für|ist|sind|ich|sie|wir|aber|weil|hallo|danke|diese|dieser)\b)/gi
    },
    {
      code: "it",
      name: "Italian",
      pattern: /(?:\b(?:il|lo|la|gli|le|un|una|che|di|con|per|come|ciao|grazie|sono|questa|questo|perché|ma|noi|voi)\b)/gi
    },
    {
      code: "pt",
      name: "Portuguese",
      pattern: /[ãõç]|(?:\b(?:um|uma|que|com|para|por|como|olá|obrigado|você|está|estão|este|esta|porque|mas)\b)/gi
    }
  ];

  const LANGUAGE_RULES = [
    {
      code: "vi",
      name: "Vietnamese",
      pattern: /[\u0103\u00e2\u0111\u00ea\u00f4\u01a1\u01b0]/i
    },
    { code: "ko", name: "Korean", pattern: /[\uac00-\ud7af]/ },
    { code: "ja", name: "Japanese", pattern: /[\u3040-\u30ff]/ },
    { code: "zh", name: "Chinese", pattern: /[\u4e00-\u9fff]/ },
    { code: "ar", name: "Arabic", pattern: /[\u0600-\u06ff]/ },
    { code: "he", name: "Hebrew", pattern: /[\u0590-\u05ff]/ },
    { code: "th", name: "Thai", pattern: /[\u0e00-\u0e7f]/ },
    { code: "ru", name: "Cyrillic language", pattern: /[\u0400-\u04ff]/ },
    { code: "el", name: "Greek", pattern: /[\u0370-\u03ff]/ },
    { code: "hi", name: "Hindi / Devanagari", pattern: /[\u0900-\u097f]/ }
  ];

  function detectLanguage(text) {
    const sample = text.trim();

    if (!sample) {
      return {
        code: "unknown",
        name: "Unknown"
      };
    }

    const matchedLanguage = LANGUAGE_RULES.find((language) => {
      return language.pattern.test(sample);
    });

    if (matchedLanguage) {
      return {
        code: matchedLanguage.code,
        name: matchedLanguage.name
      };
    }

    const latinMatch = getBestLatinLanguageMatch(sample);

    if (latinMatch) {
      return latinMatch;
    }

    return {
      code: "en",
      name: "English / Latin text"
    };
  }

  function getBestLatinLanguageMatch(sample) {
    const lowerSample = sample.toLowerCase();
    let bestMatch = null;

    LATIN_LANGUAGE_RULES.forEach((language) => {
      const matches = lowerSample.match(language.pattern);
      const score = matches ? matches.length : 0;

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = {
          code: language.code,
          name: language.name,
          score
        };
      }
    });

    if (!bestMatch) {
      return null;
    }

    return {
      code: bestMatch.code,
      name: bestMatch.name
    };
  }

  function getLanguageVoiceMatches(voices, languageCode) {
    if (!languageCode || languageCode === "unknown") {
      return [];
    }

    const lowerCode = languageCode.toLowerCase();

    return voices.filter((voice) => {
      const voiceLang = (voice.lang || "").toLowerCase();

      return voiceLang === lowerCode || voiceLang.startsWith(`${lowerCode}-`);
    });
  }

  function findBestVoice(voices, languageCode) {
    const directMatches = getLanguageVoiceMatches(voices, languageCode);

    if (directMatches.length > 0) {
      return directMatches[0];
    }

    return null;
  }

  function getPreviewText(languageCode) {
    return PREVIEW_TEXT_BY_LANGUAGE[languageCode] || PREVIEW_TEXT_BY_LANGUAGE.en;
  }

  function getVoiceLabel(voice) {
    return voice ? `${voice.voiceName} (${voice.lang})` : "Auto choose best voice";
  }

  function getSpeechOptions({ rate, voiceName }) {
    const options = {
      rate,
      pitch: 1.0,
      volume: 1.0
    };

    if (voiceName) {
      options.voiceName = voiceName;
    }

    return options;
  }

  globalThis.SelectSpeak = {
    detectLanguage,
    findBestVoice,
    getLanguageVoiceMatches,
    getPreviewText,
    getSpeechOptions,
    getVoiceLabel
  };
})();
