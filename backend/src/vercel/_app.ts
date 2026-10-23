import type { RequestListener } from 'node:http';
import { createApp } from '../app.js';
import { ConfigError, loadConfig, type Config } from '../config/env.js';
import { createLogger, type Logger } from '../lib/logger.js';
import { KnowledgeBaseStore, readKnowledgeBaseFile } from '../services/knowledge-base.js';
import { createLlmClient } from '../services/llm.js';
import defaultKb from '../../data/kb.json' with { type: 'json' };

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
      logger.warn('kb_load_failed_using_bundled_kb', { error: err instanceof Error ? err.name : 'unknown' });
      const result = store.loadFrom(defaultKb);
      logger.info('kb_loaded_from_bundle', { documents: result.loaded, rejected: result.rejected });
    }

    const llm = createLlmClient(config);
    return createApp({ config, store, llm, logger, indexingEnabled: false });
  })().catch((err) => {
    appPromise = null;
    throw err;
  });

  return appPromise;
}
