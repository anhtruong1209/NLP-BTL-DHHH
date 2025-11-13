import { defineEventHandler } from 'h3';
import { getAIModelsCollection } from '~/utils/mongodb';
import { requireAdmin, getUserFromRequest } from '~/utils/auth-utils';
import { useResponseSuccess, useResponseError } from '~/utils/response';

export default defineEventHandler(async (event) => {
	try {
		// Require admin access
		await requireAdmin(event);
	} catch (err: any) {
		console.error('[Models][list] Admin check failed:', err);
		event.node.res.statusCode = err.message?.includes('Unauthorized') ? 401 : 403;
		return useResponseError(err.message || 'Forbidden: Admin access required');
	}
	
	try {
		const col = await getAIModelsCollection();
		const models = await col.find({}).sort({ createdAt: -1 }).toArray();
		
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

