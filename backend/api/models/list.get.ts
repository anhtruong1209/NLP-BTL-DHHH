import { defineEventHandler } from 'h3';
import { getAIModelsCollection } from '~/utils/mongodb';
import { requireAdmin, getUserFromRequest } from '~/utils/auth-utils';
import { useResponseSuccess, useResponseError } from '~/utils/response';

export default defineEventHandler(async (event) => {
	try {
		const col = await getAIModelsCollection();
		
		// Check if user is admin
		let isAdmin = false;
		try {
			await requireAdmin(event);
			isAdmin = true;
		} catch {
			// Not admin - that's OK, we'll return only enabled models
			isAdmin = false;
		}
		
		// If admin: return all models, otherwise: only enabled models
		const query = isAdmin 
			? {} 
			: { 
				$or: [
					{ enabled: true },
					{ enabled: 1 as any }
				]
			};
		
		const models = await col.find(query).sort({ createdAt: -1 }).toArray();
		
		// Don't return API keys in list (security)
		const safeModels = models.map(m => ({
			...m,
			apiKey: m.apiKey ? '***' : undefined, // Mask API key
		}));
		
		return useResponseSuccess({ models: safeModels });
	} catch (error) {
		console.error('[Models][list] Error:', error);
		event.node.res.statusCode = 500;
		return useResponseError(error instanceof Error ? error.message : 'Failed to fetch models');
	}
});

