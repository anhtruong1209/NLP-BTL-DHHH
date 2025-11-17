import { defineEventHandler, readBody } from 'h3';
import { randomUUID } from 'node:crypto';
import { embedText, cosineSimilarity } from '../../utils/embeddings';
import {
	getChatMessagesCollection,
	getChatSessionsCollection,
	getRagChunksCollection,
	getModelUsageCollection,
	getAIModelsCollection,
	type ChatMessage,
	type ChatSession,
	type ModelUsage,
} from '../../utils/mongodb';
import { generateWithGemini } from '../../utils/gemini';
import { verifyAccessToken } from '../../utils/jwt-utils';

interface ChatBody {
	sessionId?: string; 
	userId?: string;
	message: string;
	topK?: number;
	collection?: string;
	model?: string;
	historyLimit?: number;
	systemPrompt?: string;
}

function buildPrompt(params: {
	systemPrompt?: string;
	context: Array<{ content: string }>;
	history: Array<{ role: string; content: string }>;
	userMessage: string;
}) {
	// Improved system prompt: Use context if available, but also use general knowledge
	const defaultSystem = 'You are a helpful and friendly AI assistant. You can answer questions using:\n' +
		'1. The provided context (if available and relevant)\n' +
		'2. Your general knowledge\n' +
		'3. The conversation history\n\n' +
		'Be natural, conversational, and helpful. If context is provided, prioritize it, but you can still answer general questions using your knowledge.';
	
	const system = params.systemPrompt?.trim() || defaultSystem;
	
	// Build context text - only include if there's actual context
	const hasContext = params.context && params.context.length > 0;
	const contextText = hasContext
		? params.context
			.map((c, idx) => `[[Relevant Information ${idx + 1}]]\n${c.content}`)
			.join('\n\n')
		: null;
	
	const historyText = params.history
		.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
		.join('\n');
	
	// Build prompt with conditional context
	const promptParts = [
		`System Instructions:\n${system}`,
	];
	
	if (contextText) {
		promptParts.push(`Relevant Context:\n${contextText}`);
	}
	
	if (historyText) {
		promptParts.push(`Conversation History:\n${historyText}`);
	}
	
	promptParts.push(`User Question: ${params.userMessage}`);
	promptParts.push(`Your Response:`);
	
	return promptParts.join('\n\n');
}

export default defineEventHandler(async (event) => {
	const t0 = Date.now();
	const body = (await readBody(event)) as ChatBody;
	const message = (body.message ?? '').trim();
	if (!message) {
		event.node.res.statusCode = 400;
		return { error: 'message is required' };
	}

	const userinfo = await verifyAccessToken(event);
	if (!userinfo) {
		event.node.res.statusCode = 401;
		return { error: 'Unauthorized: Please login' };
	}

	const userId = String(userinfo.id ?? userinfo.username ?? '').trim();
	if (!userId) {
		event.node.res.statusCode = 400;
		return { error: 'User ID is required' };
	}
	const userRole = (userinfo as any)?.role;
	const isAdmin = userRole === 0;

	const collection = body.collection?.trim() || 'default';
	const topK = Math.max(1, Math.min(20, body.topK ?? 5));
	const historyLimit = Math.max(0, Math.min(50, body.historyLimit ?? 10));
	const modelKey = body.model?.trim() || 'gemini-2.5-flash';

	const sessionsCol = await getChatSessionsCollection();
	const messagesCol = await getChatMessagesCollection();
	const ragCol = await getRagChunksCollection();
	const usageCol = await getModelUsageCollection();
	const modelsCol = await getAIModelsCollection();

	// Get model config from database
	function isModelEnabled(model: any) {
		const val = model?.enabled;
		if (val === undefined || val === null) {
			return true;
		}
		if (typeof val === 'string') {
			const normalized = val.toLowerCase();
			return normalized === '1' || normalized === 'true';
		}
		return val === true || val === 1;
	}

	let modelConfig: any = null;
	if (modelKey) {
		// Validate modelKey is not an API key (API keys are usually long strings starting with specific prefixes)
		const looksLikeApiKey = modelKey.length > 30 && (
			modelKey.startsWith('AIza') || // Google API key
			modelKey.startsWith('sk-') || // OpenAI API key
			modelKey.match(/^[A-Za-z0-9_-]{40,}$/) // Generic long alphanumeric string
		);
		
		if (looksLikeApiKey) {
			console.error(`[RAG][chat] Invalid modelKey: looks like an API key. Please use modelKey from database, not API key.`);
			event.node.res.statusCode = 400;
			return {
				error: 'Invalid modelKey: Please select a model from the dropdown, not an API key.',
			};
		}
		
		const byKey = await modelsCol.findOne({ modelKey });
		if (byKey && isModelEnabled(byKey)) {
			modelConfig = byKey;
		} else {
			const byId = await modelsCol.findOne({ modelId: modelKey });
			if (byId && isModelEnabled(byId)) {
				modelConfig = byId;
			}
		}
		if (!modelConfig) {
			console.warn(`[RAG][chat] Model ${modelKey} not found or disabled, using fallback`);
		}
	}

	// Determine which model to use
	const useModel = modelConfig?.modelKey || modelKey;
	const useModelType = modelConfig?.type || 'gemini';
	const apiKey = modelConfig?.apiKey || process.env.GEMINI_API_KEY;
	const modelName = modelConfig?.name || useModel;

	if (!apiKey) {
		console.error('[RAG][chat] No API key available for model', {
			useModel,
			foundInDb: !!modelConfig,
			modelFields: modelConfig ? Object.keys(modelConfig) : [],
			hasEnvKey: !!process.env.GEMINI_API_KEY,
		});
		event.node.res.statusCode = 500;
		return {
			ok: false,
			error: 'Gemini API key is required. Please configure the model in the database.',
		};
	}

	console.log('[RAG][chat] model lookup', {
		requestedModelKey: modelKey,
		foundModel: modelConfig ? {
			modelKey: modelConfig.modelKey,
			name: modelConfig.name,
			type: modelConfig.type,
			hasApiKey: !!modelConfig.apiKey,
		} : null,
		useModel,
		useModelType,
		hasApiKey: !!apiKey,
	});

	console.log('[RAG][chat] start', {
		collection,
		topK,
		historyLimit,
		userId,
		msgLen: message.length,
	});

	let sessionId = body.sessionId?.trim();
	let isNewSession = false;
	if (!sessionId) {
		sessionId = randomUUID();
		isNewSession = true;
		const now = new Date().toISOString();
		const sessionDoc: ChatSession = {
			sessionId,
			userId,
			title: message.slice(0, 50) || 'New chat',
			model: useModel,
			createdAt: now,
			updatedAt: now,
		};
		await sessionsCol.insertOne(sessionDoc);
		console.log('[RAG][chat] created session', sessionId, 'for user', userId);
	} else {
		const existingSession = await sessionsCol.findOne({ sessionId });
		if (!existingSession) {
			event.node.res.statusCode = 404;
			return { error: 'Session not found' };
		}
		const sessionOwnerId = existingSession.userId
			? String(existingSession.userId)
			: '';
		if (!isAdmin && sessionOwnerId && sessionOwnerId !== userId) {
			event.node.res.statusCode = 403;
			return { error: 'Forbidden: Session does not belong to user' };
		}
		if (!sessionOwnerId) {
			await sessionsCol.updateOne({ sessionId }, { $set: { userId } });
			console.log('[RAG][chat] updated session userId', sessionId, 'to', userId);
		}
	}

	// Save user message (chat detail - input)
	const userMsg: ChatMessage = {
		sessionId,
		userId,
		role: 'user',
		direction: 'in',
		content: message,
		model: useModel,
		createdAt: new Date().toISOString(),
		metadata: {
			systemPrompt: body.systemPrompt,
		},
	};
	await messagesCol.insertOne(userMsg);
	const t1 = Date.now();
	console.log('[RAG][chat] saved user message, dt=', t1 - t0, 'ms');

	// Retrieve history
	const historyCursor = messagesCol
		.find({ sessionId })
		.sort({ createdAt: 1 })
		.limit(Math.max(0, historyLimit * 2)); // user+assistant pairs
	const historyDocs = await historyCursor.toArray();
	const history = historyDocs
		.filter((m) => m.role === 'user' || m.role === 'assistant')
		.slice(-historyLimit * 2)
		.map((m) => ({ role: m.role, content: m.content }));
	const t2 = Date.now();
	console.log('[RAG][chat] loaded history', { count: history.length, dt: t2 - t1 });

	// Retrieval: compute query embedding and score all chunks (by collection)
	console.log('[RAG][chat] embedding query...');
	const queryEmbedding = await embedText(message);
	const t3 = Date.now();
	console.log('[RAG][chat] embedded query, dt=', t3 - t2, 'ms');

	console.log('[RAG][chat] fetching chunks...');
	const chunks = await ragCol.find({ collection }).toArray();
	console.log('[RAG][chat] scoring chunks...', { total: chunks.length });
	const scored = chunks
		.map((c) => ({
			chunk: c,
			score: cosineSimilarity(queryEmbedding, c.embedding),
		}))
		.sort((a, b) => b.score - a.score)
		.slice(0, topK);
	const t4 = Date.now();
	console.log('[RAG][chat] retrieval done', { topK: scored.length, dt: t4 - t3, totalDt: t4 - t0 });

	const context = scored.map((s) => s.chunk);
	const prompt = buildPrompt({
		systemPrompt: body.systemPrompt,
		context,
		history,
		userMessage: message,
	});

	let answer = '';
	try {
		console.log('[RAG][chat] generating with model...', { 
			modelKey: useModel, 
			type: useModelType,
			modelName 
		});
		
		if (useModelType === 'gemini') {
			if (!apiKey) {
				throw new Error('Gemini API key is required. Please configure the model in the database.');
			}
			// Use config from database or defaults
			const maxTokens = modelConfig?.defaultMaxTokens ?? 2048;
			const temperature = modelConfig?.defaultTemperature ?? 0.8;
			const topP = modelConfig?.defaultTopP ?? 0.95;
			
			answer = await generateWithGemini(prompt, { 
				apiKey, // Pass API key from database
				model: useModel, 
				maxTokens, 
				temperature, 
				topP 
			});
		} else {
			// For local models, you can add logic here later
			throw new Error(`Model type ${useModelType} is not yet supported`);
		}
		const t5 = Date.now();
		console.log('[RAG][chat] generation complete, dt=', t5 - t4, 'ms', 'total=', t5 - t0, 'ms');
	} catch (err: any) {
		event.node.res.statusCode = 502;
		console.error('[RAG][chat] generation error', err);
		return {
			error: `Generation error: ${err?.message || String(err)}`,
			sessionId,
			isNewSession,
		};
	}

	// Save assistant message with context used (chat detail - output)
	const assistantMsg: ChatMessage = {
		sessionId,
		userId,
		role: 'assistant',
		direction: 'out',
		model: useModel,
		content: answer,
		createdAt: new Date().toISOString(),
		contextChunks: scored.map((s) => ({
			collection,
			docId: s.chunk.docId,
			chunkId: s.chunk.chunkId,
			score: s.score,
			content: s.chunk.content,
		})),
		metadata: {
			modelName,
		},
	};
	const assistantInsert = await messagesCol.insertOne(assistantMsg);
	await sessionsCol.updateOne(
		{ sessionId },
		{ $set: { updatedAt: new Date().toISOString(), model: useModel } },
	);
	
	// Save model usage statistics
	const usageDoc: ModelUsage = {
		modelKey: useModel,
		userId: userId,
		sessionId,
		messageId: assistantInsert.insertedId?.toString(),
		timestamp: new Date().toISOString(),
		responseTime: Date.now() - t4,
	};
	await usageCol.insertOne(usageDoc);
	
	const t6 = Date.now();
	console.log('[RAG][chat] saved assistant message, totalDt=', t6 - t0, 'ms');

	return {
		ok: true,
		sessionId,
		answer,
		context: assistantMsg.contextChunks,
		topK,
		newSession: isNewSession,
	};
});


