import { ELEVENLABS_VOICE_BY_LANGUAGE } from "./voice.config.js";

export function selectVoice({ languageCode, preferences = {} }) {
  const code = (languageCode || "default").toLowerCase();
  const voiceId =
    preferences.voiceId ||
    ELEVENLABS_VOICE_BY_LANGUAGE[code] ||
    ELEVENLABS_VOICE_BY_LANGUAGE.default;

  if (!voiceId) {
    throw new Error("ELEVENLABS_VOICE_ID is missing from .env.");
  }

  return {
    provider: "elevenlabs",
    voiceId,
  };
}
