import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { writeFileSync } from 'fs';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Queue } from 'bullmq';
import uploadFile, { uploadFromBuffer, isS3Configured } from './utils/uploadFile.js';
import getS3 from './utils/s3Client.js';
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import OpenAI from 'openai';

// 1. Load .env first (server/.env). Never commit .env — it's in .gitignore.
//    Required for S3: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, AWS_REGION (optional).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

console.log('OpenAI API Key loaded:', OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 15) + '...' : 'NOT FOUND');

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

const client = new OpenAI({
  apiKey: OPENAI_API_KEY,
});
let queue;
try {
  queue = new Queue('file-upload-queue', {
    connection: getRedisConnection(),
  });
  console.log('Redis queue initialized successfully');
} catch (queueError) {
  console.error('Failed to initialize Redis queue:', queueError.message);
  // Create a mock queue that logs errors instead of failing
  queue = {
    add: async () => {
      console.warn('Redis queue not available, file upload queuing skipped');
    }
  };
}

// Memory storage: no file written to project folder; buffer goes straight to S3
const memoryStorage = multer.memoryStorage();
const uploadMemory = multer({ storage: memoryStorage });

// Disk storage kept only for any route that needs a local path (e.g. worker); S3 routes use memory
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Wraps memory multer for S3-only PDF — no file written to project folder
function multerUploadPdf(req, res, next) {
  uploadMemory.single('pdf')(req, res, (err) => {
    if (err) {
      const isMulter = err.code && /^LIMIT_/.test(err.code);
      return res.status(isMulter ? 400 : 500).json({
        error: 'File upload error',
        message: err.message || 'Upload failed',
      });
    }
    next();
  });
}

// Wraps memory multer for S3-only file — no file written to project folder
function multerUploadFile(req, res, next) {
  uploadMemory.single('file')(req, res, (err) => {
    if (err) {
      const isMulter = err.code && /^LIMIT_/.test(err.code);
      return res.status(isMulter ? 400 : 500).json({
        error: 'File upload error',
        message: err.message || 'Upload failed',
      });
    }
    next();
  });
}

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// ROOT & HEALTH CHECK ROUTES (No /api prefix)
// ============================================

app.get('/', (req, res) => {
  return res.json({ status: 'All Good!' });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Backend is running 🚀'
  });
});

// ============================================
// API ROUTES (All under /api prefix)
// ============================================

// --- S3 example routes (use credentials from .env; never log or expose keys) ---

// GET /api/s3/buckets — list buckets (example: AWS credentials from .env)
app.get('/api/s3/buckets', async (req, res) => {
  try {
    if (!isS3Configured()) {
      return res.status(503).json({
        error: 'S3 not configured',
        message: 'Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET in server/.env',
      });
    }
    const s3 = getS3();
    const data = await s3.listBuckets().promise();
    const names = (data.Buckets || []).map((b) => b.Name);
    return res.json({ buckets: names });
  } catch (err) {
    // Safe logging: no credentials or full error objects
    console.error('[S3] listBuckets error:', err.code || err.name, err.message);
    return res.status(500).json({
      error: 'Failed to list buckets',
      message: err.message || 'S3 error',
    });
  }
});

// POST /api/upload — multipart form field "file", uploads to S3 via uploadFile (v2 client)
app.post('/api/upload', multerUploadFile, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Send a file in multipart/form-data under the field name "file".',
      });
    }
    const s3Path = await uploadFromBuffer(req.file.buffer, `uploads/${req.file.originalname}`);
    return res.json({ message: 'File uploaded to S3', url: s3Path });
  } catch (err) {
    console.error('POST /api/upload error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// POST /api/upload-pdf — multipart/form-data, multer, S3 upload, returns file URL
app.post('/api/upload-pdf', multerUploadPdf, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Send a PDF file in multipart/form-data under the field name "pdf".',
      });
    }
    const mimetype = (req.file.mimetype || '').toLowerCase();
    if (mimetype !== 'application/pdf') {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only PDF files are accepted.',
        received: req.file.mimetype || 'unknown',
      });
    }
    if (!isS3Configured()) {
      return res.status(503).json({
        error: 'S3 not configured',
        message: 'File storage is not available. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET in server/.env',
      });
    }
    const key = `pdfs/${Date.now()}-${req.file.originalname}`;
    const url = await uploadFromBuffer(req.file.buffer, key, 'application/pdf');
    return res.status(200).json({ url });
  } catch (err) {
    console.error('POST /api/upload-pdf error:', err);
    return res.status(500).json({
      error: 'Upload failed',
      message: err.message || 'An unexpected error occurred',
    });
  }
});

// Upload PDF endpoint — buffer only; uploads to S3, worker gets temp file path (not project folder)
app.post('/api/upload/pdf', uploadMemory.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const key = `pdfs/${Date.now()}-${req.file.originalname}`;
    let url = null;
    if (isS3Configured()) {
      try {
        url = await uploadFromBuffer(req.file.buffer, key, 'application/pdf');
      } catch (s3Error) {
        console.error('S3 upload error:', s3Error);
        return res.status(500).json({
          error: 'Failed to upload file to S3',
          message: s3Error.message || 'S3 upload failed',
          details: 'Check server logs and AWS credentials in .env',
        });
      }
    }
    // Worker needs a file path: write buffer to system temp dir (not project folder), then enqueue
    const tempPath = join(tmpdir(), `pdf-rag-${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    writeFileSync(tempPath, req.file.buffer);
    try {
      await queue.add(
        'file-ready',
        JSON.stringify({
          filename: req.file.originalname,
          destination: tmpdir(),
          path: tempPath,
        })
      );
    } catch (queueError) {
      console.warn('Queue error (continuing anyway):', queueError.message);
    }

    return res.json(url ? { message: 'uploaded', url } : { message: 'uploaded' });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      error: 'Failed to upload file',
      message: error.message || 'Unknown error',
      details: 'Check server logs for more information',
    });
  }
});

// Chat endpoint
app.get('/api/chat', async (req, res) => {
  // Log incoming request for debugging
  console.log('📨 Chat request received:', {
    query: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const userQuery = req.query.message;

    // Validate message parameter
    if (!userQuery || typeof userQuery !== 'string') {
      console.error('❌ Validation Error: Missing or invalid message parameter');
      return res.status(400).json({ 
        error: 'Message query parameter is required',
        message: 'Please provide a message as a query parameter',
        example: '/api/chat?message=Hello'
      });
    }

    // Validate OpenAI API Key
    if (!OPENAI_API_KEY) {
      console.error('❌ Configuration Error: OpenAI API key not found');
      return res.status(500).json({ 
        error: 'OpenAI API key is not configured',
        message: 'Server configuration error. Please contact administrator.',
        hint: 'Admin: Set OPENAI_API_KEY in server/.env file'
      });
    }

    console.log('✓ Validation passed, processing query...');

    // Step 1: Retrieve relevant context from vector store
    let result = [];
    let qdrantStatus = 'not_attempted';
    
    try {
      console.log('🔍 Attempting to retrieve PDF context from Qdrant...');
      const embeddings = new OpenAIEmbeddings({
        model: 'text-embedding-3-small',
        apiKey: OPENAI_API_KEY,
      });
      
      const vectorStore = await QdrantVectorStore.fromExistingCollection(
        embeddings,
        {
          url: 'http://localhost:6333',
          collectionName: 'langchainjs-testing',
        }
      );
      
      const ret = vectorStore.asRetriever({
        k: 2,
      });
      
      result = await ret.invoke(userQuery);
      qdrantStatus = 'success';
      console.log(`✓ Retrieved ${result.length} relevant document chunks from Qdrant`);
      
    } catch (qdrantError) {
      qdrantStatus = 'failed';
      console.warn('⚠️  Qdrant connection failed, continuing without PDF context');
      console.warn('Qdrant error details:', {
        message: qdrantError.message,
        code: qdrantError.code,
        stack: qdrantError.stack?.split('\n')[0]
      });
      
      // Check specific Qdrant errors
      if (qdrantError.message?.includes('ECONNREFUSED')) {
        console.warn('💡 Hint: Qdrant service might not be running. Run: docker-compose up -d');
      } else if (qdrantError.message?.includes('Not found')) {
        console.warn('💡 Hint: Collection "langchainjs-testing" might not exist. Create it first.');
      }
      
      // Continue without vector store results
    }

    // Step 2: Prepare system prompt based on available context
    const SYSTEM_PROMPT = result.length > 0
      ? `You are a helpful AI Assistant who answers the user query based on the available context from PDF File.
  Context:
  ${JSON.stringify(result)}`
      : `You are a helpful AI Assistant. Answer the user's query.`;

    console.log(`🤖 Calling OpenAI API with ${result.length > 0 ? 'PDF context' : 'no context'}...`);

    // Step 3: Set up streaming response headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send initial metadata
    res.write(`data: ${JSON.stringify({ type: 'metadata', docs: result, qdrantStatus })}\n\n`);

    // Step 4: Call OpenAI API with streaming
    try {
      const stream = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userQuery },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      });
      
      console.log('✓ OpenAI streaming started');
      
      // Stream the response chunks
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          res.write(`data: ${JSON.stringify({ type: 'content', content })}\n\n`);
        }
      }
      
      // Send completion signal
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
      
      console.log('✅ Chat streaming completed successfully');
      return;
      
    } catch (openaiError) {
      console.error('❌ OpenAI API Error occurred');
      
      // Extract error details
      const fullError = {
        status: openaiError?.status,
        statusText: openaiError?.statusText,
        message: openaiError?.message,
        code: openaiError?.code,
        type: openaiError?.type,
        error: openaiError?.error,
        response: openaiError?.response ? {
          status: openaiError.response.status,
          statusText: openaiError.response.statusText,
          data: openaiError.response.data
        } : null
      };
      
      console.error('OpenAI Error Details:', JSON.stringify(fullError, null, 2));
      
      // Determine status code and error message
      const status = openaiError?.status || openaiError?.response?.status || 500;
      const errorMessage = openaiError?.message || 
                          openaiError?.error?.message || 
                          openaiError?.response?.data?.error?.message || 
                          'Unknown OpenAI error';
      
      // Handle specific OpenAI error types
      
      // 1. Invalid API Key (401)
      if (status === 401 || 
          errorMessage.includes('401') || 
          errorMessage.includes('Incorrect API key') || 
          errorMessage.includes('Invalid API key') || 
          errorMessage.includes('invalid_api_key')) {
        console.error('💡 Solution: Check your OpenAI API key in server/.env');
        res.write(`data: ${JSON.stringify({ 
          type: 'error',
          status: 401,
          error: 'Invalid OpenAI API key',
          message: 'Authentication failed with OpenAI API',
          details: errorMessage,
          hint: 'Verify your API key at https://platform.openai.com/account/api-keys',
          troubleshooting: [
            '1. Check server/.env file has OPENAI_API_KEY',
            '2. Ensure API key starts with sk-proj- or sk-',
            '3. Verify API key is active and has credits',
            '4. Restart the server after updating .env'
          ]
        })}\n\n`);
        res.end();
        return;
      }
      
      // 2. Rate Limit (429)
      if (status === 429 || 
          errorMessage.includes('429') || 
          errorMessage.includes('rate limit') ||
          errorMessage.includes('Rate limit')) {
        console.error('💡 Solution: Wait a moment and try again');
        res.write(`data: ${JSON.stringify({ 
          type: 'error',
          status: 429,
          error: 'OpenAI API rate limit exceeded',
          message: 'Too many requests. Please wait a moment.',
          hint: 'OpenAI has usage limits. Wait 1-2 minutes before trying again.',
          retryAfter: 60
        })}\n\n`);
        res.end();
        return;
      }
      
      // 3. Insufficient Quota (403)
      if (status === 403 || 
          errorMessage.includes('quota') || 
          errorMessage.includes('insufficient_quota')) {
        console.error('💡 Solution: Add credits to your OpenAI account');
        res.write(`data: ${JSON.stringify({ 
          type: 'error',
          status: 403,
          error: 'OpenAI API quota exceeded',
          message: 'Your OpenAI account has insufficient credits',
          hint: 'Add credits at https://platform.openai.com/account/billing',
          details: errorMessage
        })}\n\n`);
        res.end();
        return;
      }
      
      // 4. Model Not Available (404)
      if (status === 404 || errorMessage.includes('model') || errorMessage.includes('not found')) {
        console.error('💡 Solution: Model might not be available');
        res.write(`data: ${JSON.stringify({ 
          type: 'error',
          status: 404,
          error: 'OpenAI model not available',
          message: 'The requested model (gpt-4o-mini) is not available',
          hint: 'Your API key might not have access to this model',
          details: errorMessage
        })}\n\n`);
        res.end();
        return;
      }
      
      // 5. Timeout or Network Error
      if (errorMessage.includes('timeout') || 
          errorMessage.includes('ETIMEDOUT') || 
          errorMessage.includes('ECONNREFUSED')) {
        console.error('💡 Solution: Network or timeout issue');
        res.write(`data: ${JSON.stringify({ 
          type: 'error',
          status: 503,
          error: 'OpenAI API connection failed',
          message: 'Could not connect to OpenAI API',
          hint: 'Check your internet connection or try again',
          details: errorMessage
        })}\n\n`);
        res.end();
        return;
      }
      
      // 6. Generic OpenAI Error
      console.error('💡 Unhandled OpenAI error type');
      res.write(`data: ${JSON.stringify({ 
        type: 'error',
        status: status < 600 ? status : 500,
        error: 'OpenAI API error',
        message: errorMessage,
        statusCode: status,
        hint: 'An unexpected error occurred with OpenAI API',
        details: 'Check server logs for more information'
      })}\n\n`);
      res.end();
      return;
    }

  } catch (error) {
    // Catch-all error handler for unexpected errors
    console.error('❌ Unexpected error in chat endpoint');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Check for specific error types
    
    // 1. Network/Connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ 
        error: 'Service unavailable',
        message: 'Could not connect to required service',
        details: error.message,
        hint: 'Check if Docker services (Qdrant, Redis) are running',
        troubleshooting: [
          'Run: docker ps',
          'If no containers, run: docker-compose up -d'
        ]
      });
    }
    
    // 2. Type errors (coding bugs)
    if (error.name === 'TypeError') {
      return res.status(500).json({ 
        error: 'Internal server error',
        message: 'A coding error occurred',
        details: error.message,
        hint: 'This is a server bug. Check logs for details.',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
    
    // 3. OpenAI API errors that weren't caught above
    if (error.message && (
      error.message.includes('OpenAI') || 
      error.message.includes('API key') ||
      error.message.includes('401') ||
      error.message.includes('429')
    )) {
      return res.status(error.status || 500).json({ 
        error: 'OpenAI API error',
        message: error.message,
        hint: 'Check your OpenAI API key configuration',
        troubleshooting: [
          '1. Verify server/.env has OPENAI_API_KEY',
          '2. Check API key is valid at https://platform.openai.com',
          '3. Ensure API key has credits',
          '4. Restart server after .env changes'
        ]
      });
    }
    
    // 4. Generic catch-all error
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
      type: error.name || 'Error',
      hint: 'Check server logs for detailed error information',
      timestamp: new Date().toISOString(),
      possibleCauses: [
        'OpenAI API key not configured or invalid',
        'Qdrant service not running (docker-compose up -d)',
        'Redis service not running',
        'Network connectivity issues',
        'Server configuration error'
      ]
    });
  }
});

// Global error handler for unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

const PORT = Number(process.env.PORT) || 8000;
const server = app.listen(PORT, () => {
  console.log(`Server started on PORT:${PORT}`);
  console.log(`OpenAI API Key: ${OPENAI_API_KEY ? 'Loaded (' + OPENAI_API_KEY.substring(0, 15) + '...)' : 'NOT FOUND'}`);
  console.log(`Redis URL: ${process.env.REDIS_URL ? 'Configured' : 'Using localhost'}`);
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is in use. Free it with: lsof -ti:${PORT} | xargs kill -9`);
    console.error(`Or run on another port: PORT=${PORT + 1} pnpm run dev`);
    process.exit(1);
  }
  throw err;
});
