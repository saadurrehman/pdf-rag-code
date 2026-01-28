import 'dotenv/config';
import { Worker } from 'bullmq';
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_COLLECTION = 'langchainjs-testing';

// Clear all points so only the latest uploaded document is used by the chatbot
async function clearQdrantCollection() {
  try {
    let allIds = [];
    let offset = undefined;
    do {
      const body = { limit: 100, with_payload: false, with_vector: false };
      if (offset !== undefined) body.offset = offset;
      const scrollRes = await fetch(`${QDRANT_URL}/collections/${QDRANT_COLLECTION}/points/scroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!scrollRes.ok) {
        const err = await scrollRes.text();
        throw new Error(`Qdrant scroll failed: ${scrollRes.status} ${err}`);
      }
      const scrollData = await scrollRes.json();
      const points = scrollData.result?.points ?? [];
      const ids = points.map((p) => p.id);
      allIds = allIds.concat(ids);
      offset = scrollData.result?.next_page_offset ?? null;
    } while (offset !== undefined && offset !== null);
    if (allIds.length === 0) {
      console.log('Qdrant collection already empty');
      return;
    }
    const deleteRes = await fetch(`${QDRANT_URL}/collections/${QDRANT_COLLECTION}/points/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: allIds }),
    });
    if (!deleteRes.ok) {
      const err = await deleteRes.text();
      throw new Error(`Qdrant delete failed: ${deleteRes.status} ${err}`);
    }
    console.log('Qdrant collection cleared:', allIds.length, 'points removed');
  } catch (err) {
    if (err.message?.includes('404') || err.message?.includes('Not found')) {
      console.log('Qdrant collection does not exist yet, skip clear');
      return;
    }
    throw err;
  }
}

// Parse Redis URL if provided, otherwise use localhost
function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const url = new URL(redisUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
        username: url.username || undefined,
      };
    } catch (error) {
      console.warn('Failed to parse REDIS_URL, using default:', error.message);
    }
  }
  return {
    host: 'localhost',
    port: 6379,
  };
}

const _worker = new Worker(
  'file-upload-queue',
  async (job) => {
    console.log(`Job:`, job.data);
    const data = JSON.parse(job.data);
    /*
    Path: data.path
    read the pdf from path,
    chunk the pdf,
    call the openai embedding model for every chunk,
    store the chunk in qdrant db
    */

    // Load the PDF
    const loader = new PDFLoader(data.path);
    const docs = await loader.load();

    await clearQdrantCollection();

    const embeddings = new OpenAIEmbeddings({
      model: 'text-embedding-3-small',
      apiKey: OPENAI_API_KEY,
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: QDRANT_URL,
        collectionName: QDRANT_COLLECTION,
      }
    );
    await vectorStore.addDocuments(docs);
    console.log(`All docs are added to vector store`);
  },
  {
    concurrency: 100,
    connection: getRedisConnection(),
  }
);
void _worker;
