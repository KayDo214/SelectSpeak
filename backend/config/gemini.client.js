import "./env.js";
import { envPath } from "./env.js";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

export function getGeminiApiKey() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(`GEMINI_API_KEY is missing. Expected it in ${envPath}`);
  }

  return process.env.GEMINI_API_KEY;
}

export async function createGeminiInteraction(payload) {
  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": getGeminiApiKey(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}
