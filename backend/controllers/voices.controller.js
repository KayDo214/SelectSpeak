import { listElevenLabsVoices } from "../services/tts/elevenlabs.tts.js";

export async function listVoices(req, res) {
  try {
    const voices = await listElevenLabsVoices();

    return res.status(200).json({
      success: true,
      voices,
    });
  } catch (error) {
    console.error("Voices error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to list ElevenLabs voices.",
    });
  }
}
