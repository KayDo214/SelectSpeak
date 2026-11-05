import express from "express";
import cors from "cors";

import { createAnalyzeText } from "./controllers/analyze.controller.js";
import { createGenerateSpeech } from "./controllers/tts.controller.js";
import { createListVoices } from "./controllers/voices.controller.js";
import { createAnalyzeRouter } from "./routes/analyze.route.js";
import { createTtsRouter } from "./routes/tts.route.js";
import { createVoicesRouter } from "./routes/voices.route.js";

export function createApp(dependencies = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (req, res) => {
    return res.status(200).json({
      success: true,
      message: "SelectSpeak backend is running",
    });
  });

  app.use("/api/analyze", createAnalyzeRouter(createAnalyzeText(dependencies)));
  app.use("/api/tts", createTtsRouter(createGenerateSpeech(dependencies)));
  app.use("/api/voices", createVoicesRouter(createListVoices(dependencies)));

  app.use((req, res) => {
    return res.status(404).json({
      success: false,
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  return app;
}

export default createApp();
