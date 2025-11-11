import { defineEventHandler, readBody } from 'h3';
import { nanoid } from 'nanoid';
import { embedText, cosineSimilarity } from '~/utils/embeddings';
import {
	getChatMessagesCollection,
	getChatSessionsCollection,
	getRagChunksCollection,
	type ChatMessage,
	type ChatSession,
} from '~/utils/mongodb';
import { generateLocalCompletion } from '~/utils/local-llm';
import { generateWithGemini } from '~/utils/gemini';

interface ChatBody {
	sessionId?: string; 
	userId?: string;
	message: string;
	topK?: number;
	collection?: string;
	// modelUrl?: string; // removed external call
	historyLimit?: number;
	systemPrompt?: string;
}

function buildPrompt(params: {
	systemPrompt?: string;
	context: Array<{ content: string }>;
	history: Array<{ role: string; content: string }>;
	userMessage: string;
}) {
	const system = params.systemPrompt?.trim() || 'You are a helpful assistant. Answer based only on the provided context. If the answer is not in the context, say you don’t know.';
	const contextText =
		params.context
			.map((c, idx) => `[[Chunk ${idx + 1}]]\n${c.content}`)
			.join('\n\n') || 'No context provided.';
	const historyText = params.history
		.map((m) => `${m.role.toUpperCase()}: ${m.content}`)
		.join('\n');
	return [
		`SYSTEM:\n${system}`,
		`CONTEXT:\n${contextText}`,
		historyText ? `HISTORY:\n${historyText}` : '',
		`USER:\n${params.userMessage}`,
		`ASSISTANT:`,
	]
		.filter(Boolean)
		.join('\n\n');
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

	const sessionsCol = await getChatSessionsCollection();
	const messagesCol = await getChatMessagesCollection();
	const ragCol = await getRagChunksCollection();

	console.log('[RAG][chat] start', {
		collection,
		topK,
		historyLimit,
		hasUserId: !!body.userId,
		msgLen: message.length,
	});

	let sessionId = body.sessionId?.trim();
	let isNewSession = false;
	if (!sessionId) {
		sessionId = nanoid();
		isNewSession = true;
		const now = new Date().toISOString();
		const sessionDoc: ChatSession = {
			sessionId,
			userId: body.userId,
			title: message.slice(0, 50),
			createdAt: now,
			updatedAt: now,
		};
		await sessionsCol.insertOne(sessionDoc);
		console.log('[RAG][chat] created session', sessionId);
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
		const useGemini = !!process.env.GEMINI_API_KEY;
		if (useGemini) {
			console.log('[RAG][chat] generating with Gemini...');
			answer = await generateWithGemini(prompt, { maxTokens: 512, temperature: 0.7, topP: 0.9 });
		} else {
			console.log('[RAG][chat] generating locally...');
			answer = await generateLocalCompletion(prompt, { maxTokens: 512, temperature: 0.7, topP: 0.9 });
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


