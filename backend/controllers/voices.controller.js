import { listElevenLabsVoices } from "../services/tts/elevenlabs.tts.js";
import { GEMINI_TTS_VOICES } from "../services/voice/voice.config.js";

export function createListVoices({ listElevenLabsVoicesFn = listElevenLabsVoices } = {}) {
  return async function listVoices(req, res) {
    try {
      let elevenLabsVoices = [];

      try {
        elevenLabsVoices = await listElevenLabsVoicesFn();
      } catch (error) {
        console.warn("Failed to list ElevenLabs voices; returning Gemini voices only.", error);
      }

      return res.status(200).json({
        success: true,
        voices: [
          ...GEMINI_TTS_VOICES,
          ...elevenLabsVoices.map((voice) => ({
            ...voice,
            provider: "elevenlabs",
            voiceName: voice.name,
            lang: "ElevenLabs",
          })),
        ],
      });
    } catch (error) {
      console.error("Voices error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to list voices.",
      });
    }
  };
}

export const listVoices = createListVoices();
