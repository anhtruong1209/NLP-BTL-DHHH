import { defineEventHandler, getRouterParam } from 'h3';
import { getAIModelsCollection } from '~/utils/mongodb';
import { requireAdmin } from '~/utils/auth-utils';
import { useResponseSuccess, useResponseError } from '~/utils/response';

export default defineEventHandler(async (event) => {
	try {
		// Require admin access
		await requireAdmin(event);
	} catch (err: any) {
		console.error('[Models][delete] Admin check failed:', err);
		event.node.res.statusCode = err.message?.includes('Unauthorized') ? 401 : 403;
		return useResponseError(err.message || 'Forbidden: Admin access required');
	}
	
	const modelId = getRouterParam(event, 'modelId');
	if (!modelId) {
		event.node.res.statusCode = 400;
		return useResponseError('modelId is required');
	}

	try {
		const col = await getAIModelsCollection();
		const result = await col.deleteOne({ modelId });

		if (result.deletedCount === 0) {
			event.node.res.statusCode = 404;
			return useResponseError('Model not found');
		}

		return useResponseSuccess({ message: 'Model deleted successfully' });
	} catch (error) {
		console.error('[Models][delete] Error:', error);
		event.node.res.statusCode = 500;
		return useResponseError(error instanceof Error ? error.message : 'Failed to delete model');
	}
});

