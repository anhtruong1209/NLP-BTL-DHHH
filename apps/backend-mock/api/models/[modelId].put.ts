import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { getAIModelsCollection, type AIModel } from '~/utils/mongodb';
import { requireAdmin } from '~/utils/auth-utils';
import { useResponseSuccess, useResponseError } from '~/utils/response';

export default defineEventHandler(async (event) => {
	try {
		// Require admin access
		await requireAdmin(event);
	} catch (err: any) {
		console.error('[Models][update] Admin check failed:', err);
		event.node.res.statusCode = err.message?.includes('Unauthorized') ? 401 : 403;
		return useResponseError(err.message || 'Forbidden: Admin access required');
	}
	
	const modelId = getRouterParam(event, 'modelId');
	if (!modelId) {
		event.node.res.statusCode = 400;
		return useResponseError('modelId is required');
	}

	const body = (await readBody(event)) as Partial<AIModel>;
	const col = await getAIModelsCollection();
	
	const existing = await col.findOne({ modelId });
	if (!existing) {
		event.node.res.statusCode = 404;
		return useResponseError('Model not found');
	}

	// Build update object
	const update: Partial<AIModel> = {
		updatedAt: new Date().toISOString(),
	};

	if (body.name?.trim()) update.name = body.name.trim();
	if (body.modelKey?.trim()) update.modelKey = body.modelKey.trim();
	if (body.description !== undefined) update.description = body.description?.trim();
	if (body.enabled !== undefined) update.enabled = body.enabled;
	if (body.defaultMaxTokens !== undefined) update.defaultMaxTokens = body.defaultMaxTokens;
	if (body.defaultTemperature !== undefined) update.defaultTemperature = body.defaultTemperature;
	if (body.defaultTopP !== undefined) update.defaultTopP = body.defaultTopP;
	
	// Update API key if provided (and not masked)
	if (body.apiKey && body.apiKey !== '***' && body.apiKey.trim()) {
		update.apiKey = body.apiKey.trim();
	}
	
	// Update local path if provided
	if (body.localPath !== undefined) update.localPath = body.localPath?.trim();
	if (body.localType !== undefined) update.localType = body.localType;

	try {
		const result = await col.updateOne(
			{ modelId },
			{ $set: update }
		);

		if (result.matchedCount === 0) {
			event.node.res.statusCode = 404;
			return useResponseError('Model not found');
		}

		const updated = await col.findOne({ modelId });
		return useResponseSuccess({ model: updated });
	} catch (error) {
		console.error('[Models][update] Error:', error);
		event.node.res.statusCode = 500;
		return useResponseError(error instanceof Error ? error.message : 'Failed to update model');
	}
});

