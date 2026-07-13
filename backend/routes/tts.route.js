import express from "express";
import { generateSpeech } from "../controllers/tts.controller.js";

const router = express.Router();

router.post("/", generateSpeech);

export default router;