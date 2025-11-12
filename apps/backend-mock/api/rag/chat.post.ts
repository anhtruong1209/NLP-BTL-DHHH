import { defineEventHandler, readBody } from 'h3';
import { nanoid } from 'nanoid';
import { embedText, cosineSimilarity } from '~/utils/embeddings';
import {
	getChatMessagesCollection,
	getChatSessionsCollection,
	getRagChunksCollection,
	getModelUsageCollection,
	getAIModelsCollection,
	type ChatMessage,
	type ChatSession,
	type ModelUsage,
} from '~/utils/mongodb';
import { generateWithGemini } from '~/utils/gemini';

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

	const collection = body.collection?.trim() || 'default';
	const topK = Math.max(1, Math.min(20, body.topK ?? 5));
	const historyLimit = Math.max(0, Math.min(50, body.historyLimit ?? 10));
	const modelKey = body.model?.trim() || 'gemini-2.5-flash';

	const sessionsCol = await getChatSessionsCollection();
	const messagesCol = await getChatMessagesCollection();
	const ragCol = await getRagChunksCollection();
	const usageCol = await getModelUsageCollection();
	const modelsCol = await getAIModelsCollection();

	// Helper to detect if a string looks like an API key
	function looksLikeApiKeyStr(val?: string) {
		if (!val) return false;
		return (
			val.length > 30 &&
			(val.startsWith('AIza') || // Google API key
				val.startsWith('sk-') || // OpenAI API key
				/^[A-Za-z0-9_-]{40,}$/.test(val))
		);
	}

	// Get model config from database
	let modelConfig: any = null;
	let useModelKey = modelKey; // Use separate variable for modelKey
	
	if (modelKey) {
		// Try to find model by modelId first (canonical identifier)
		modelConfig = await modelsCol.findOne(
			{
				modelId: modelKey,
				$or: [{ enabled: true }, { enabled: 1 as any }],
			} as any,
		);

		// If not found by modelId, try to find model by modelKey (even if it looks like API key - might be legacy data)
		// enabled can be 1 (number) or true (boolean) in DB
		if (!modelConfig) {
			modelConfig = await modelsCol.findOne({
				modelKey,
				$or: [{ enabled: true }, { enabled: 1 as any }],
			} as any);
		}
		
		// If not found by modelKey, check if it's an API key and try to find by apiKey field
		if (!modelConfig) {			
			if (looksLikeApiKeyStr(modelKey)) {
				console.warn(`[RAG][chat] ModelKey looks like API key, trying to find model by apiKey field...`);
				// Try to find model where apiKey matches (legacy data where modelKey was set to API key)
				modelConfig = await modelsCol.findOne({ 
					apiKey: modelKey,
					$or: [
						{ enabled: true },
						{ enabled: 1 as any } // Type assertion for MongoDB query compatibility
					]
				} as any);
				
				if (modelConfig) {
					console.warn(`[RAG][chat] Found model by apiKey, but modelKey mismatch. Using model: ${modelConfig.modelKey}`);
					// Use the correct modelKey from DB
					useModelKey = modelConfig.modelKey;
				} else {
					console.error(`[RAG][chat] Invalid modelKey: looks like an API key and not found in database.`);
					event.node.res.statusCode = 400;
					return {
						error: 'Invalid modelKey: Please select a model from the dropdown, not an API key.',
					};
				}
			} else {
				console.warn(`[RAG][chat] Model ${modelKey} not found or disabled, using fallback`);
			}
		}
	}

	// Determine which model to use
	let useModel = modelConfig?.modelKey || useModelKey;
	const useModelType = modelConfig?.type || 'gemini';
	const apiKey = modelConfig?.apiKey || process.env.GEMINI_API_KEY;
	const modelName = modelConfig?.name || useModel;

	// If DB accidentally stored modelKey as API key, switch to canonical modelId for Gemini endpoint
	if (modelConfig && useModelType === 'gemini' && looksLikeApiKeyStr(modelConfig.modelKey)) {
		if (modelConfig.modelId) {
			console.warn(`[RAG][chat] modelKey looks like API key; switching to modelId: ${modelConfig.modelId}`);
			useModel = modelConfig.modelId;
		} else {
			// Fallback to a safe default
			console.warn(`[RAG][chat] modelKey looks like API key and no modelId found; using default gemini-2.5-flash`);
			useModel = 'gemini-2.5-flash';
		}
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
		hasUserId: !!body.userId,
		msgLen: message.length,
	});

	// Normalize userId to string for consistency
	const userId = body.userId ? String(body.userId).trim() : undefined;

	let sessionId = body.sessionId?.trim();
	let isNewSession = false;
	if (!sessionId) {
		sessionId = nanoid();
		isNewSession = true;
		const now = new Date().toISOString();
		const sessionDoc: ChatSession = {
			sessionId,
			userId: userId,
			title: message.slice(0, 50),
			createdAt: now,
			updatedAt: now,
		};
		await sessionsCol.insertOne(sessionDoc);
		console.log('[RAG][chat] created session', sessionId, 'for user', userId);
	} else {
		// Update existing session's userId if not set
		const existingSession = await sessionsCol.findOne({ sessionId });
		if (existingSession && userId && !existingSession.userId) {
			await sessionsCol.updateOne({ sessionId }, { $set: { userId } });
			console.log('[RAG][chat] updated session userId', sessionId, 'to', userId);
		}
	}

	// Save user message
	const userMsg: ChatMessage = {
		sessionId,
		role: 'user',
		content: message,
		createdAt: new Date().toISOString(),
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

	// Save assistant message with context used
	const assistantMsg: ChatMessage = {
		sessionId,
		role: 'assistant',
		content: answer,
		createdAt: new Date().toISOString(),
		contextChunks: scored.map((s) => ({
			collection,
			docId: s.chunk.docId,
			chunkId: s.chunk.chunkId,
			score: s.score,
			content: s.chunk.content,
		})),
	};
	await messagesCol.insertOne(assistantMsg);
	await sessionsCol.updateOne(
		{ sessionId },
		{ $set: { updatedAt: new Date().toISOString() } },
	);
	
	// Save model usage statistics
	const usageDoc: ModelUsage = {
		modelKey: useModel,
		userId: userId,
		sessionId,
		messageId: assistantMsg._id?.toString(),
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


