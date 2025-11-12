import { defineEventHandler } from 'h3';
import { getAIModelsCollection } from '~/utils/mongodb';
import { DEFAULT_MODEL } from '~/utils/gemini';
import { useResponseSuccess, useResponseError } from '~/utils/response';

/**
 * Public endpoint to get available (enabled) models for chat
 * No admin access required - users need to see available models
 */
function looksLikeApiKey(value?: string | null) {
	if (!value) return false;
	return (
		value.length > 30 &&
		(value.startsWith('AIza') ||
			value.startsWith('sk-') ||
			/^[A-Za-z0-9_-]{40,}$/.test(value))
	);
}

function isLikelyGeminiModel(value?: string | null) {
	if (!value || typeof value !== 'string') return false;
	const trimmed = value.trim();
	if (looksLikeApiKey(trimmed)) return false;
	// Accept formats like "gemini-2.0-flash" or "models/gemini-1.5-pro"
	return /^(?:models\/)?gemini[-\w.]+$/i.test(trimmed);
}

function resolvePayloadModel(model: any) {
	const candidates: Array<string | undefined> = [
		model?.payloadModel,
		model?.modelKey,
		model?.modelId,
		model?.providerModelId,
		model?.provider,
		model?.name,
	];

	for (const candidate of candidates) {
		if (isLikelyGeminiModel(candidate)) {
			return candidate!.trim();
		}
	}

	// For Gemini models where identifiers look like API keys, fallback to default Gemini model.
	if (model?.type === 'gemini') {
		return DEFAULT_MODEL;
	}

	// As a final fallback, return default Gemini model.
	return DEFAULT_MODEL;
}

export default defineEventHandler(async (event) => {
	try {
		const col = await getAIModelsCollection();
		// Only return enabled models, without API keys
		// enabled can be 1 (number) or true (boolean) in DB
		const models = await col.find({ 
			$or: [
				{ enabled: true },
				{ enabled: 1 as any }
			]
		}).sort({ createdAt: -1 }).toArray();
		
		// Return only necessary fields for frontend selection
		const safeModels = models.map(m => ({
			modelId: m.modelId,
			modelKey: m.modelKey,
			payloadModel: resolvePayloadModel(m),
			name: m.name,
			type: m.type,
			provider: m.provider,
			description: m.description,
			// Don't include apiKey, localPath, or other sensitive info
		}));
		
		return useResponseSuccess({ models: safeModels });
	} catch (error) {
		console.error('[Models][available] Error:', error);
		event.node.res.statusCode = 500;
		return useResponseError(error instanceof Error ? error.message : 'Failed to fetch available models');
	}
});

