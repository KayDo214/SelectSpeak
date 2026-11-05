import express from "express";
import { generateSpeech } from "../controllers/tts.controller.js";

export function createTtsRouter(handler = generateSpeech) {
  const router = express.Router();
  router.post("/", handler);
  return router;
}

export default createTtsRouter();
