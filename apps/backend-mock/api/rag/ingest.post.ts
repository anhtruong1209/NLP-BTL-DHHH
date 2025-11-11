import { defineEventHandler, readBody } from 'h3';
import { nanoid } from 'nanoid';
import { chunkTextByLength, embedText } from '~/utils/embeddings';
import { getRagChunksCollection, type RagChunk } from '~/utils/mongodb';

interface IngestBodyItem {
	docId?: string;
	text: string;
	metadata?: Record<string, any>;
}

interface IngestBody {
	collection?: string;
	texts?: IngestBodyItem[];
	chunkSize?: number;
	chunkOverlap?: number;
}

export default defineEventHandler(async (event) => {
	const body = (await readBody(event)) as IngestBody;
	const collection = body.collection?.trim() || 'default';
	const items = body.texts ?? [];
	const chunkSize = Math.max(100, Math.min(4000, body.chunkSize ?? 800));
	const chunkOverlap = Math.max(0, Math.min(chunkSize - 1, body.chunkOverlap ?? 100));

	if (!Array.isArray(items) || items.length === 0) {
		event.node.res.statusCode = 400;
		return { error: 'texts is required and must be a non-empty array' };
	}

	const ragCol = await getRagChunksCollection();
	let totalChunks = 0;

	for (const item of items) {
		const docId = item.docId || nanoid();
		const chunks = chunkTextByLength(item.text ?? '', chunkSize, chunkOverlap);
		for (let i = 0; i < chunks.length; i++) {
			const content = chunks[i];
			const embedding = await embedText(content);
			const chunkDoc: RagChunk = {
				collection,
				docId,
				chunkId: `${docId}-${i}`,
				content,
				embedding,
				metadata: item.metadata,
				createdAt: new Date().toISOString(),
			};
			await ragCol.insertOne(chunkDoc);
			totalChunks += 1;
		}
	}

	return {
		ok: true,
		collection,
		items: items.length,
		chunks: totalChunks,
	};
});


