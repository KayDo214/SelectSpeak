import express from "express";
import { listVoices } from "../controllers/voices.controller.js";

export function createVoicesRouter(handler = listVoices) {
  const router = express.Router();
  router.get("/", handler);
  return router;
}

export default createVoicesRouter();
