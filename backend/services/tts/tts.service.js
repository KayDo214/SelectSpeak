import { generateElevenLabsSpeech } from "./elevenlabs.tts.js";
import { generateGeminiSpeech } from "./gemini.tts.js";

function createProviders({ generateGeminiSpeechFn, generateElevenLabsSpeechFn }) {
  return {
    gemini: {
      contentType: "audio/wav",
      maxAttempts: 2,
      generateSpeech({ text, language, voiceSelection }) {
        return generateGeminiSpeechFn({
          text,
          language,
          voiceName: voiceSelection.gemini.voiceName,
        });
      },
    },
    elevenlabs: {
      contentType: "audio/mpeg",
      maxAttempts: 1,
      generateSpeech({ text, language, voiceSelection }) {
        return generateElevenLabsSpeechFn({
          text,
          voiceId: voiceSelection.elevenlabs.voiceId,
          languageCode: language.code,
        });
      },
    },
  };
}

function normalizeProvider(providers, provider, fallbackProvider = "gemini") {
  return Object.hasOwn(providers, provider) ? provider : fallbackProvider;
}

function getProviderOrder(providers, requestedProvider) {
  const primaryProvider = normalizeProvider(providers, process.env.TTS_PROVIDER || "gemini");
  const fallbackProvider = normalizeProvider(
    providers,
    process.env.TTS_FALLBACK_PROVIDER || "elevenlabs",
    "elevenlabs"
  );

  if (requestedProvider && requestedProvider !== "auto") {
    return [normalizeProvider(providers, requestedProvider)];
  }

  return [...new Set([primaryProvider, fallbackProvider])];
}

function canRetryProvider(error) {
  return [429, 500, 502, 503, 504].includes(error?.status);
}

async function generateWithProvider(providerName, provider, params) {
  let lastError = null;

  for (let attempt = 1; attempt <= provider.maxAttempts; attempt += 1) {
    try {
      return await provider.generateSpeech(params);
    } catch (error) {
      lastError = error;

      if (attempt >= provider.maxAttempts || !canRetryProvider(error)) {
        throw error;
      }

      console.warn(`TTS provider ${providerName} failed on attempt ${attempt}; retrying.`, error);
    }
  }

  throw lastError;
}

export function createTtsService({
  generateGeminiSpeechFn = generateGeminiSpeech,
  generateElevenLabsSpeechFn = generateElevenLabsSpeech,
} = {}) {
  const providers = createProviders({ generateGeminiSpeechFn, generateElevenLabsSpeechFn });

  return async function synthesizeSpeech({ text, language, voiceSelection }) {
    const providerOrder = getProviderOrder(providers, voiceSelection.provider);
    let lastError = null;

    for (const providerName of providerOrder) {
      const provider = providers[providerName];

      try {
        const audioBuffer = await generateWithProvider(providerName, provider, {
          text,
          language,
          voiceSelection,
        });

        return {
          audioBuffer,
          contentType: provider.contentType,
          provider: providerName,
        };
      } catch (error) {
        lastError = error;

        if (providerName === providerOrder.at(-1) || !canRetryProvider(error)) {
          throw error;
        }

        console.warn(`TTS provider ${providerName} failed; trying fallback provider.`, error);
      }
    }

    throw lastError || new Error("No TTS providers are configured.");
  };
}

export const synthesizeSpeech = createTtsService();
