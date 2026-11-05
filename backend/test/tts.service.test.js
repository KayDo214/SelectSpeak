import assert from "node:assert/strict";
import test from "node:test";

import { createTtsService } from "../services/tts/tts.service.js";

const params = {
  text: "Hello",
  language: { code: "en", name: "English" },
  voiceSelection: {
    provider: "gemini",
    gemini: { voiceName: "Kore" },
    elevenlabs: { voiceId: "test-voice" },
  },
};

function providerError(status) {
  return Object.assign(new Error(`Provider failed with ${status}`), { status });
}

test("Gemini success returns WAV audio and the final provider", async () => {
  const audioBuffer = Buffer.from("gemini-audio");
  const synthesizeSpeech = createTtsService({
    generateGeminiSpeechFn: async () => audioBuffer,
  });

  const result = await synthesizeSpeech(params);

  assert.deepEqual(result, {
    audioBuffer,
    contentType: "audio/wav",
    provider: "gemini",
  });
});

test("Gemini retries one eligible provider failure", async (t) => {
  t.mock.method(console, "warn", () => {});
  let attempts = 0;
  const synthesizeSpeech = createTtsService({
    generateGeminiSpeechFn: async () => {
      attempts += 1;

      if (attempts === 1) {
        throw providerError(503);
      }

      return Buffer.from("recovered");
    },
  });

  const result = await synthesizeSpeech(params);

  assert.equal(attempts, 2);
  assert.equal(result.provider, "gemini");
});

test("eligible Gemini failures use the configured ElevenLabs fallback", async (t) => {
  t.mock.method(console, "warn", () => {});
  const previousPrimary = process.env.TTS_PROVIDER;
  const previousFallback = process.env.TTS_FALLBACK_PROVIDER;
  process.env.TTS_PROVIDER = "gemini";
  process.env.TTS_FALLBACK_PROVIDER = "elevenlabs";
  t.after(() => {
    previousPrimary === undefined
      ? delete process.env.TTS_PROVIDER
      : (process.env.TTS_PROVIDER = previousPrimary);
    previousFallback === undefined
      ? delete process.env.TTS_FALLBACK_PROVIDER
      : (process.env.TTS_FALLBACK_PROVIDER = previousFallback);
  });
  let geminiAttempts = 0;
  let elevenLabsAttempts = 0;
  const synthesizeSpeech = createTtsService({
    generateGeminiSpeechFn: async () => {
      geminiAttempts += 1;
      throw providerError(503);
    },
    generateElevenLabsSpeechFn: async () => {
      elevenLabsAttempts += 1;
      return Buffer.from("fallback");
    },
  });

  const result = await synthesizeSpeech({
    ...params,
    voiceSelection: { ...params.voiceSelection, provider: "auto" },
  });

  assert.equal(geminiAttempts, 2);
  assert.equal(elevenLabsAttempts, 1);
  assert.equal(result.provider, "elevenlabs");
  assert.equal(result.contentType, "audio/mpeg");
});

test("non-eligible Gemini failures do not use fallback", async () => {
  let elevenLabsAttempts = 0;
  const synthesizeSpeech = createTtsService({
    generateGeminiSpeechFn: async () => {
      throw providerError(400);
    },
    generateElevenLabsSpeechFn: async () => {
      elevenLabsAttempts += 1;
      return Buffer.from("unexpected");
    },
  });

  await assert.rejects(
    synthesizeSpeech({
      ...params,
      voiceSelection: { ...params.voiceSelection, provider: "auto" },
    }),
    { status: 400 }
  );
  assert.equal(elevenLabsAttempts, 0);
});
