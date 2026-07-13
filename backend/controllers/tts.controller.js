import { detectLanguage } from "../services/language/language.service.js";
import { synthesizeSpeech } from "../services/tts/tts.service.js";
import { selectVoice } from "../services/voice/voice.service.js";

const MAX_TTS_TEXT_LENGTH = 5000;

export async function generateSpeech(req, res) {
  try {
    const { text, preferences = {} } = req.body;

    if (typeof text !== "string" || text.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Text is required.",
      });
    }

    const normalizedText = text.trim();

    if (normalizedText.length > MAX_TTS_TEXT_LENGTH) {
      return res.status(413).json({
        success: false,
        message: "Text is too long. Maximum length is 5,000 characters.",
      });
    }

    const language = await detectLanguage(normalizedText);
    const voiceSelection = selectVoice({
      languageCode: language.code,
      preferences,
    });

    const { audioBuffer, contentType } = await synthesizeSpeech({
      text: normalizedText,
      language,
      voiceSelection,
    });

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", audioBuffer.length);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Detected-Language-Code", language.code);
    res.setHeader("X-Detected-Language-Name", language.name);
    res.setHeader("X-TTS-Provider", voiceSelection.provider);

    return res.status(200).send(audioBuffer);
  } catch (error) {
    console.error("TTS error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to synthesize speech.",
    });
  }
}
