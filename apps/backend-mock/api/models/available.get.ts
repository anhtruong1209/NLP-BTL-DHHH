import { defineEventHandler } from 'h3';
import { getAIModelsCollection } from '~/utils/mongodb';
import { useResponseSuccess, useResponseError } from '~/utils/response';

/**
 * Public endpoint to get available (enabled) models for chat
 * No admin access required - users need to see available models
 */
export default defineEventHandler(async (event) => {
	try {
		const col = await getAIModelsCollection();
		// Only return enabled models, without API keys
		const models = await col.find({ enabled: true }).sort({ createdAt: -1 }).toArray();
		
		// Return only necessary fields for frontend selection
		const safeModels = models.map(m => ({
			modelId: m.modelId,
			modelKey: m.modelKey,
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

