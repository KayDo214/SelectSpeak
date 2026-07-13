import "./config/env.js";
import express from "express";
import cors from "cors";

import analyzeRoutes from "./routes/analyze.route.js";
import ttsRoutes from "./routes/tts.route.js";
import voicesRoutes from "./routes/voices.route.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.use(
  express.json({
    limit: "1mb",
  })
);

app.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "SelectSpeak backend is running",
  });
});

app.use("/api/analyze", analyzeRoutes);
app.use("/api/tts", ttsRoutes);
app.use("/api/voices", voicesRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.listen(PORT, () => {
  console.log(`SelectSpeak backend running on port ${PORT}`);
});

