import { detectLanguage } from "../services/language/language.service.js";

export function createAnalyzeText({ detectLanguageFn = detectLanguage } = {}) {
  return async function analyzeText(req, res) {
    try {
      const { text } = req.body;

      if (typeof text !== "string" || text.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Text is required.",
        });
      }

      if (text.length > 5000) {
        return res.status(413).json({
          success: false,
          message: "Text is too long. Maximum length is 5,000 characters.",
        });
      }

      const language = await detectLanguageFn(text);

      return res.status(200).json({
        success: true,
        language,
      });
    } catch (error) {
      console.error("Analyze error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to detect the language.",
      });
    }
  };
}

export const analyzeText = createAnalyzeText();
