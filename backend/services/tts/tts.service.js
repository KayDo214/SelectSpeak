import { generateElevenLabsSpeech } from "./elevenlabs.tts.js";

export async function synthesizeSpeech({ text, language, voiceSelection }) {
  const audioBuffer = await generateElevenLabsSpeech({
    text,
    voiceId: voiceSelection.voiceId,
    languageCode: language.code,
  });

  return {
    audioBuffer,
    contentType: "audio/mpeg",
  };
}
