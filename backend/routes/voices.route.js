import express from "express";
import { listVoices } from "../controllers/voices.controller.js";

const router = express.Router();

router.get("/", listVoices);

export default router;
