import { detectLanguageWithGemini } from "./gemini.language.js";

export async function detectLanguage(text) {
  return detectLanguageWithGemini(text);
}
