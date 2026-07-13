const ELEVENLABS_TTS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const ELEVENLABS_VOICES_API_URL = "https://api.elevenlabs.io/v2/voices";

function getElevenLabsApiKey() {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is missing from .env");
  }

  return apiKey;
}

export async function listElevenLabsVoices() {
  const response = await fetch(ELEVENLABS_VOICES_API_URL, {
    headers: {
      "xi-api-key": getElevenLabsApiKey(),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`ElevenLabs voices request failed (${response.status}): ${errorBody}`);
  }

  const result = await response.json();

  return (result.voices || []).map((voice) => ({
    voiceId: voice.voice_id,
    name: voice.name,
    category: voice.category,
    labels: voice.labels || {},
  }));
}

export async function generateElevenLabsSpeech({
  text,
  voiceId,
  languageCode,
}) {
  const selectedVoiceId = voiceId || process.env.ELEVENLABS_VOICE_ID;

  if (!selectedVoiceId) {
    throw new Error("No ElevenLabs voice ID was supplied or configured.");
  }

  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

  const response = await fetch(
    `${ELEVENLABS_TTS_API_URL}/${encodeURIComponent(selectedVoiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": getElevenLabsApiKey(),
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        ...(languageCode && modelId !== "eleven_multilingual_v2"
          ? { language_code: languageCode }
          : {}),
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`ElevenLabs request failed (${response.status}): ${errorBody}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
