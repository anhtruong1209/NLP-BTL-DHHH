import { defineEventHandler, readBody } from 'h3';
import { nanoid } from 'nanoid';
import { getAIModelsCollection, type AIModel } from '~/utils/mongodb';
import { requireAdmin, getUserFromRequest } from '~/utils/auth-utils';
import { useResponseSuccess, useResponseError } from '~/utils/response';

export default defineEventHandler(async (event) => {
	try {
		// Require admin access
		await requireAdmin(event);
	} catch (err: any) {
		console.error('[Models][create] Admin check failed:', err);
		event.node.res.statusCode = err.message?.includes('Unauthorized') ? 401 : 403;
		return useResponseError(err.message || 'Forbidden: Admin access required');
	}
	
	const body = (await readBody(event)) as Partial<AIModel>;
	
	const modelId = body.modelId?.trim() || nanoid();
	const name = body.name?.trim();
	const type = body.type;
	const modelKey = body.modelKey?.trim();
	
	if (!name || !type || !modelKey) {
		event.node.res.statusCode = 400;
		return useResponseError('name, type, and modelKey are required');
	}

	// Validate type
	if (type !== 'gemini' && type !== 'local') {
		event.node.res.statusCode = 400;
		return useResponseError('type must be "gemini" or "local"');
	}

	// For Gemini, require API key
	if (type === 'gemini' && !body.apiKey?.trim()) {
		event.node.res.statusCode = 400;
		return useResponseError('apiKey is required for Gemini models');
	}

	// For local models, require localPath
	if (type === 'local' && !body.localPath?.trim()) {
		event.node.res.statusCode = 400;
		return useResponseError('localPath is required for local models');
	}

	const col = await getAIModelsCollection();
	
	// Check if modelId already exists
	const existing = await col.findOne({ modelId });
	if (existing) {
		event.node.res.statusCode = 409;
		return useResponseError('Model with this modelId already exists');
	}

	const now = new Date().toISOString();
	const modelDoc: AIModel = {
		modelId,
		name,
		type,
		provider: body.provider || (type === 'gemini' ? 'google' : 'local'),
		modelKey,
		apiKey: body.apiKey?.trim(),
		apiKeyEncrypted: false, // TODO: Add encryption if needed
		localPath: body.localPath?.trim(),
		localType: body.localType,
		enabled: body.enabled ?? true,
		defaultMaxTokens: body.defaultMaxTokens ?? 2048,
		defaultTemperature: body.defaultTemperature ?? 0.8,
		defaultTopP: body.defaultTopP ?? 0.95,
		description: body.description?.trim(),
		createdAt: now,
		updatedAt: now,
		createdBy: body.createdBy,
	};

	await col.insertOne(modelDoc);
	
	return useResponseSuccess({ model: modelDoc });
});

