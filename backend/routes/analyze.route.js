import express from "express";
import { analyzeText } from "../controllers/analyze.controller.js";

export function createAnalyzeRouter(handler = analyzeText) {
  const router = express.Router();
  router.post("/", handler);
  return router;
}

export default createAnalyzeRouter();
