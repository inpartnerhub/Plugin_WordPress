import type { RequestListener } from 'node:http';
import { createApp } from '../app.js';
import { loadConfig, type Config } from '../config/env.js';
import { HttpError, createErrorResponse } from '../lib/http.js';
import { createLogger, type Logger } from '../lib/logger.js';
import { KnowledgeBaseStore, readKnowledgeBaseFile } from '../services/knowledge-base.js';
import { createLlmClient } from '../services/llm.js';
import { handleWebRequest } from './adapter.js';

let appPromise: Promise<RequestListener> | null = null;

export function resetNetlifyAppForTest(): void {
  appPromise = null;
}

async function getApp(): Promise<RequestListener> {
  if (appPromise) return appPromise;

  appPromise = (async () => {
    const config: Config = loadConfig();
    const logger: Logger = createLogger(config.logLevel);
    const store = new KnowledgeBaseStore(config.allowedSourceHosts);

    try {
      const data = await readKnowledgeBaseFile(config.kbPath);
      const result = store.loadFrom(data);
      logger.info('kb_loaded', { documents: result.loaded, rejected: result.rejected });
    } catch (err) {
      logger.warn('kb_load_failed', { error: err instanceof Error ? err.name : 'unknown' });
    }

    const llm = createLlmClient(config);

    // Each function instance keeps its own memory and /tmp: runtime index updates would not reach the
    // other instances and would vanish on cold start, so /api/index is disabled here (501). Rate limits,
    // the replay cache and the daily budget are per instance too; see docs/deployment.md.
    logger.warn('serverless_single_instance_assumptions', { index: 'disabled' });
    return createApp({ config, store, llm, logger, indexingEnabled: false });
  })().catch((err) => {
    appPromise = null;
    throw err;
  });

  return appPromise;
}

export default async function handler(req: Request): Promise<Response> {
  try {
    const listener = await getApp();
    return await handleWebRequest(req, listener);
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', event: 'netlify_handler_error', error: err instanceof Error ? err.name : 'unknown' }));
    return createErrorResponse(new HttpError(500, 'internal_error', 'An internal error occurred.'));
  }
}

export const config = {
  path: ['/api/*', '/.netlify/functions/api/*'],
  preferStatic: true,
};
