import { GoogleGenerativeAI } from '@google/generative-ai';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5--pro';

export async function generateWithGemini(prompt: string, opts?: {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}) {
  const apiKey = 'AIzaSyBu5eeWuyQZLbQyPW262Y2tEj6yq2qomfU';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: opts?.model || DEFAULT_MODEL,
    generationConfig: {
      maxOutputTokens: Math.max(32, Math.min(2048, opts?.maxTokens ?? 512)),
      temperature: opts?.temperature ?? 0.7,
      topP: opts?.topP ?? 0.9,
    },
    // Safety settings can be customized if needed
  });
  const res = await model.generateContent(prompt);
  const text = res.response?.text?.() ?? '';
  return text.trim();
}


