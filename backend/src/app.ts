import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import type { Config } from './config/env.js';
import { SignatureVerifier } from './lib/auth.js';
import { HttpError, createErrorResponse, sendError, sendJson } from './lib/http.js';
import type { Logger } from './lib/logger.js';
import { AbusePenaltyTracker, DailyBudget, FixedWindowLimiter, ResponseCache } from './middleware/rate-limit.js';
import { handleChat } from './routes/chat.js';
import { handleHealth } from './routes/health.js';
import { createLock, handleIndex } from './routes/index.js';
import { ChatService } from './services/chat.js';
import type { KnowledgeBaseStore } from './services/knowledge-base.js';
import type { LlmClient } from './services/llm.js';
import { Bm25Retriever } from './services/retrieval.js';

export interface AppDeps {
  config: Config;
  store: KnowledgeBaseStore;
  llm: LlmClient;
  logger: Logger;
  now?: () => number;
  /** False on serverless/multi-instance hosts (see routes/index.ts). */
  indexingEnabled?: boolean;
}

export function createApp({ config, store, llm, logger, now = () => Date.now(), indexingEnabled = true }: AppDeps): RequestListener {
  const retriever = new Bm25Retriever(store.chunks());
  const cache = new ResponseCache(5 * 60_000, 500, now);
  const cacheNamespace = `${config.llmProvider}:${config.llmProvider === 'openrouter' ? config.openrouterModel : config.geminiModel}`;
  const chat = new ChatService({
    store,
    retriever,
    llm,
    logger,
    topK: config.retrievalTopK,
    minScore: config.retrievalMinScore,
    secrets: [config.geminiApiKey, config.openrouterApiKey, config.chatSharedSecret, config.indexApiToken],
    budget: new DailyBudget(config.dailyRequestLimit, now),
    cache,
    cacheNamespace,
    now,
  });
  const verifier = new SignatureVerifier(config.chatSharedSecret, config.signatureMaxSkewSeconds, now);

  const penaltyTracker = new AbusePenaltyTracker(3, 5 * 60_000, 10 * 60_000, now);

  const chatDeps = {
    verifier,
    clientLimiter: new FixedWindowLimiter(config.rateLimitPerClientPerMinute, 60_000, now),
    globalLimiter: new FixedWindowLimiter(config.rateLimitGlobalPerMinute, 60_000, now),
    chat,
    store,
    logger,
    maxMessageChars: config.maxMessageChars,
    penaltyTracker,
  };

  const indexDeps = {
    indexApiToken: config.indexApiToken,
    allowedSourceHosts: config.allowedSourceHosts,
    store,
    retriever,
    kbPath: config.kbPath,
    limiter: new FixedWindowLimiter(30, 60_000, now),
    logger,
    lock: createLock(),
    indexingEnabled,
    cache,
  };

  const routes: Record<string, { method: string; handle: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void }> = {
    '/api/chat': { method: 'POST', handle: (req, res) => handleChat(req, res, chatDeps) },
    '/api/index': { method: 'POST', handle: (req, res) => handleIndex(req, res, indexDeps) },
    '/api/health': { method: 'GET', handle: (req, res) => handleHealth(req, res, { store, verifier, logger }) },
  };

  return (req, res) => {
    const pathname = (req.url ?? '/').split('?')[0] ?? '/';
    const route = routes[pathname];

    const run = async () => {
      if (!route) throw new HttpError(404, 'not_found', 'Not found.');
      if (req.method !== route.method) {
        throw new HttpError(405, 'method_not_allowed', 'Method not allowed.', { Allow: route.method });
      }
      await route.handle(req, res);
    };

    run().catch((err: unknown) => {
      if (!req.complete) req.resume();
      if (err instanceof HttpError) {
        const details = (err as HttpError & { details?: unknown }).details;
        if (details) {
          sendJson(res, err.status, { error: { code: err.code, message: err.message, details } }, err.headers);
        } else {
          sendError(res, err);
        }
        return;
      }
      logger.error('unhandled_error', { error: err instanceof Error ? err.name : 'unknown' });
      sendError(res, new HttpError(500, 'internal_error', 'An internal error occurred.'));
    });
  };
}

let defaultAppPromise: Promise<RequestListener> | null = null;

async function getDefaultApp(): Promise<RequestListener> {
  if (defaultAppPromise) return defaultAppPromise;
  defaultAppPromise = (async () => {
    const { loadConfig } = await import('./config/env.js');
    const { createLogger } = await import('./lib/logger.js');
    const { KnowledgeBaseStore, readKnowledgeBaseFile } = await import('./services/knowledge-base.js');
    const { createLlmClient } = await import('./services/llm.js');
    const defaultKb = (await import('../data/kb.json', { with: { type: 'json' } })).default;

    const config = loadConfig();
    const logger = createLogger(config.logLevel);
    const store = new KnowledgeBaseStore(config.allowedSourceHosts);

    try {
      const data = await readKnowledgeBaseFile(config.kbPath);
      store.loadFrom(data);
    } catch {
      store.loadFrom(defaultKb);
    }

    const llm = createLlmClient(config);
    return createApp({ config, store, llm, logger, indexingEnabled: false });
  })().catch((err) => {
    defaultAppPromise = null;
    throw err;
  });
  return defaultAppPromise;
}

export default async function defaultHandler(
  req: IncomingMessage | Request,
  res?: ServerResponse,
): Promise<Response | void> {
  try {
    const app = await getDefaultApp();
    if (res && typeof res.setHeader === 'function') {
      const nodeReq = req as IncomingMessage;
      return await new Promise((resolve, reject) => {
        res.on('finish', resolve);
        res.on('close', resolve);
        res.on('error', reject);
        try {
          app(nodeReq, res);
        } catch (e) {
          reject(e);
        }
      });
    }
    const { handleWebRequest } = await import('./netlify/adapter.js');
    return await handleWebRequest(req as Request, app);
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', event: 'default_handler_error', error: err instanceof Error ? err.name : 'unknown' }));
    const httpErr = new HttpError(500, 'internal_error', 'An internal error occurred.');
    if (res && typeof res.setHeader === 'function') {
      sendError(res, httpErr);
      return;
    }
    return createErrorResponse(httpErr);
  }
}

