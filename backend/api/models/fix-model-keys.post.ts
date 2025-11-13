import { defineEventHandler } from 'h3';
import { getAIModelsCollection } from '~/utils/mongodb';
import { requireAdmin } from '~/utils/auth-utils';
import { useResponseSuccess, useResponseError } from '~/utils/response';

/**
 * Fix modelKey if it's an API key - migrate to proper modelKey
 * This is a one-time migration endpoint
 */
export default defineEventHandler(async (event) => {
	try {
		await requireAdmin(event);
	} catch (err: any) {
		event.node.res.statusCode = err.message?.includes('Unauthorized') ? 401 : 403;
		return useResponseError(err.message || 'Forbidden: Admin access required');
	}

	try {
		const col = await getAIModelsCollection();
		const models = await col.find({}).toArray();
		
		let fixed = 0;
		for (const model of models) {
			// Check if modelKey looks like an API key
			const looksLikeApiKey = model.modelKey && model.modelKey.length > 30 && (
				model.modelKey.startsWith('AIza') || // Google API key
				model.modelKey.startsWith('sk-') || // OpenAI API key
				/^[A-Za-z0-9_-]{40,}$/.test(model.modelKey) // Generic long alphanumeric string
			);
			
			if (looksLikeApiKey) {
				// Generate proper modelKey based on name and type
				let newModelKey = '';
				if (model.type === 'gemini') {
					// Extract model name from name field or use default
					const nameLower = (model.name || '').toLowerCase().replace(/\s+/g, '-');
					if (nameLower.includes('gemini')) {
						newModelKey = nameLower;
					} else {
						newModelKey = `gemini-${nameLower}`;
					}
					// Common Gemini model keys
					if (nameLower.includes('flash')) {
						newModelKey = 'gemini-2.5-flash';
					} else if (nameLower.includes('pro')) {
						newModelKey = 'gemini-2.5-pro';
					} else {
						newModelKey = 'gemini-2.5-flash'; // Default
					}
				} else {
					newModelKey = `${model.type}-${(model.name || 'model').toLowerCase().replace(/\s+/g, '-')}`;
				}
				
				// Update model with correct modelKey
				// Keep the API key in apiKey field if it's not there
				const updateData: any = {
					modelKey: newModelKey,
					updatedAt: new Date().toISOString(),
				};
				
				// If apiKey field is empty or masked, set it from modelKey (old API key)
				if (!model.apiKey || model.apiKey === '***') {
					updateData.apiKey = model.modelKey; // The old modelKey was actually the API key
				}
				
				await col.updateOne(
					{ _id: model._id },
					{ $set: updateData }
				);
				
				console.log(`[Models][fix] Fixed model ${model.name}: ${model.modelKey} -> ${newModelKey}`);
				fixed++;
			}
		}
		
		return useResponseSuccess({ 
			message: `Fixed ${fixed} model(s)`,
			fixed 
		});
	} catch (error) {
		console.error('[Models][fix] Error:', error);
		event.node.res.statusCode = 500;
		return useResponseError(error instanceof Error ? error.message : 'Failed to fix model keys');
	}
});

