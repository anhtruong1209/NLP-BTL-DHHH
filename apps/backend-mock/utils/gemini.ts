import { GoogleGenerativeAI } from '@google/generative-ai';

export const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FALLBACK_API_KEY = process.env.GEMINI_API_KEY; // Only use env as fallback

export interface GeminiOptions {
  apiKey: string; // Required - must be passed from database
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export async function generateWithGemini(prompt: string, opts: GeminiOptions) {
  const apiKey = opts.apiKey || FALLBACK_API_KEY;
  
  if (!apiKey) {
    throw new Error('Gemini API key is required. Please configure the model in the database.');
  }
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: opts?.model || DEFAULT_MODEL,
      generationConfig: {
        maxOutputTokens: Math.max(32, Math.min(2048, opts?.maxTokens ?? 512)),
        temperature: opts?.temperature ?? 0.7,
        topP: opts?.topP ?? 0.9,
      },
    });
    
    console.log('[Gemini] Calling model:', opts?.model || DEFAULT_MODEL);
    const result = await model.generateContent(prompt);
    const response = result.response;
    
    if (!response) {
      throw new Error('No response from Gemini API');
    }
    
    const text = response.text();
    console.log('[Gemini] Response length:', text.length);
    
    return text.trim() || 'I apologize, but I could not generate a response.';
  } catch (error: any) {
    console.error('[Gemini] Error:', error);
    throw new Error(`Gemini API error: ${error?.message || String(error)}`);
  }
}


