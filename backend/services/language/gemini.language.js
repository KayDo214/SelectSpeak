import { createGeminiInteraction } from "../../config/gemini.client.js";

const languageAnalysisSchema = {
  type: "object",
  properties: {
    code: {
      type: "string",
      description: "ISO 639-1 language code when one exists, otherwise a short language tag.",
    },
    name: {
      type: "string",
      description: "English language name.",
    },
    confidence: {
      type: "number",
      description: "Confidence from 0 to 1.",
    },
    script: {
      type: "string",
      description: "Writing system such as Latin, Cyrillic, Arabic, Han, Hangul.",
    },
    isMixedLanguage: {
      type: "boolean",
      description: "True when substantial portions use multiple languages.",
    },
  },
  required: ["code", "name", "confidence", "script", "isMixedLanguage"],
};

function collectTextBlocks(value, blocks = []) {
  if (!value || typeof value !== "object") {
    return blocks;
  }

  if (value.type === "text" && typeof value.text === "string") {
    blocks.push(value.text);
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectTextBlocks(item, blocks));
    return blocks;
  }

  Object.values(value).forEach((item) => collectTextBlocks(item, blocks));
  return blocks;
}

function extractInteractionText(interaction) {
  if (typeof interaction.output_text === "string") {
    return interaction.output_text;
  }

  if (typeof interaction.outputText === "string") {
    return interaction.outputText;
  }

  const textBlocks = collectTextBlocks(interaction);
  return textBlocks.join("").trim();
}

function parseJsonObject(text) {
  const cleanedText = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  return JSON.parse(cleanedText);
}

function validateLanguageAnalysis(language) {
  const requiredFields = ["code", "name", "confidence", "script", "isMixedLanguage"];
  const missingFields = requiredFields.filter((field) => !(field in language));

  if (missingFields.length > 0) {
    throw new Error(`Gemini language analysis is missing: ${missingFields.join(", ")}`);
  }

  return {
    code: String(language.code).toLowerCase(),
    name: String(language.name),
    confidence: Number(language.confidence),
    script: String(language.script),
    isMixedLanguage: Boolean(language.isMixedLanguage),
  };
}

export async function detectLanguageWithGemini(text) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    throw new Error("Cannot detect the language of empty text.");
  }

  const interaction = await createGeminiInteraction({
    model: process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash",
    store: false,
    input: `Identify the primary language of this text. Do not translate or summarize it. Text:\n\n${normalizedText}`,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: languageAnalysisSchema,
    },
  });

  const outputText = extractInteractionText(interaction);

  if (!outputText) {
    throw new Error(
      `Gemini did not return text. Response keys: ${Object.keys(interaction).join(", ")}`
    );
  }

  return validateLanguageAnalysis(parseJsonObject(outputText));
}
