import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

import { createApp } from "../app.js";

const language = {
  code: "en",
  name: "English",
  confidence: 0.99,
  script: "Latin",
  isMixedLanguage: false,
};

test("GET /health reports that the backend is running", async () => {
  const response = await request(createApp()).get("/health").expect(200);

  assert.equal(response.body.success, true);
});

test("unknown routes return 404", async () => {
  const response = await request(createApp()).get("/does-not-exist").expect(404);

  assert.equal(response.body.success, false);
  assert.match(response.body.message, /Route not found/);
});

test("POST /api/analyze rejects missing text without a provider call", async () => {
  let providerCalls = 0;
  const app = createApp({
    detectLanguageFn: async () => {
      providerCalls += 1;
      return language;
    },
  });

  const response = await request(app).post("/api/analyze").send({ text: "" }).expect(400);

  assert.equal(response.body.message, "Text is required.");
  assert.equal(providerCalls, 0);
});

test("POST /api/analyze returns mocked language detection", async () => {
  const app = createApp({ detectLanguageFn: async () => language });
  const response = await request(app)
    .post("/api/analyze")
    .send({ text: "Hello" })
    .expect(200);

  assert.deepEqual(response.body.language, language);
});

test("POST /api/tts rejects text longer than 5,000 characters", async () => {
  const response = await request(createApp())
    .post("/api/tts")
    .send({ text: "a".repeat(5_001) })
    .expect(413);

  assert.match(response.body.message, /Maximum length is 5,000 characters/);
});

test("POST /api/tts returns mocked audio and final-provider headers", async () => {
  const audioBuffer = Buffer.from([1, 2, 3, 4]);
  const app = createApp({
    detectLanguageFn: async () => language,
    selectVoiceFn: () => ({ provider: "auto" }),
    synthesizeSpeechFn: async () => ({
      audioBuffer,
      contentType: "audio/wav",
      provider: "gemini",
    }),
  });
  const response = await request(app)
    .post("/api/tts")
    .send({ text: "Hello" })
    .buffer(true)
    .parse((res, callback) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => callback(null, Buffer.concat(chunks)));
    })
    .expect(200);

  assert.deepEqual(response.body, audioBuffer);
  assert.equal(response.headers["x-tts-provider"], "gemini");
  assert.equal(response.headers["x-detected-language-code"], "en");
});
