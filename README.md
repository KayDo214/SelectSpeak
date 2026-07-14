# SelectSpeak

SelectSpeak is a browser extension backed by a Node.js/Express API. The extension captures selected page text and sends it to the backend. The backend uses Gemini to detect the language, then generates speech with Gemini TTS and can fall back to ElevenLabs for quota/rate-limit/server failures. The browser never receives provider API keys.

## Backend

```powershell
cd backend
npm install
New-Item .env -ItemType File
# Fill GEMINI_API_KEY and optional ElevenLabs fallback settings in .env
npm run dev
```

The extension expects the backend at `http://localhost:3000`.

Required `.env` values:

```env
GEMINI_API_KEY=your_gemini_key
GEMINI_TEXT_MODEL=gemini-3.5-flash
GEMINI_TTS_MODEL=gemini-3.1-flash-tts-preview
GEMINI_TTS_VOICE=Kore
TTS_PROVIDER=gemini
TTS_FALLBACK_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_default_voice_id
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
PORT=3000
```

`TTS_PROVIDER=gemini` makes Gemini the primary speech provider. `TTS_FALLBACK_PROVIDER=elevenlabs` keeps ElevenLabs available when Gemini returns a quota, rate-limit, or server error.

## Extension

Load the `frontend` directory as an unpacked Chrome extension. Select text on a webpage, then use the popup or the context menu to play backend-generated speech.
