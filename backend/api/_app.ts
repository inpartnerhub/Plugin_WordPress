import type { RequestListener } from 'node:http';
import { createApp } from '../src/app.js';
import { ConfigError, loadConfig, type Config } from '../src/config/env.js';
import { createLogger, type Logger } from '../src/lib/logger.js';
import { KnowledgeBaseStore, readKnowledgeBaseFile } from '../src/services/knowledge-base.js';
import { createLlmClient } from '../src/services/llm.js';

let appPromise: Promise<RequestListener> | null = null;

export async function getApp(): Promise<RequestListener> {
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
    return createApp({ config, store, llm, logger, indexingEnabled: false });
  })();

  return appPromise;
}

