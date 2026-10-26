import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig, ConfigError } from '../src/config/env.js';
import { createLlmClient, FailoverLlmClient, LlmError, OpenRouterClient } from '../src/services/llm.js';
import { baseEnv } from './helpers.js';

const OPENROUTER_KEY = 'sk-or-v1-test-key-0123456789abcdef';
const OK_PAYLOAD = {
  choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '{"answer":"ok","source_ids":["S1"],"grounded":true}' } }],
  usage: { prompt_tokens: 120, completion_tokens: 30 },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function client(fetchImpl: typeof fetch, overrides: Partial<ConstructorParameters<typeof OpenRouterClient>[0]> = {}): OpenRouterClient {
  return new OpenRouterClient({
    apiKey: OPENROUTER_KEY,
    model: 'deepseek/deepseek-chat',
    baseUrl: 'https://openrouter.test/api/v1',
    timeoutMs: 2000,
    maxOutputTokens: 256,
    fetchImpl,
    sleep: async () => {},
    ...overrides,
  });
}

const REQUEST = { systemInstruction: 'system rules', userContent: 'SOURCES ... QUESTION' };

describe('OpenRouterClient', () => {
  it('sends the key in the Authorization header, never in the URL, and returns the message text', async () => {
    let seenUrl = '';
    let seenHeaders: Record<string, string> = {};
    let seenBody: Record<string, unknown> = {};
    const usage: { promptTokens: number; outputTokens: number }[] = [];
    const text = await client(
      async (url, init) => {
        seenUrl = String(url);
        seenHeaders = init?.headers as Record<string, string>;
        seenBody = JSON.parse(String(init?.body));
        return jsonResponse(200, OK_PAYLOAD);
      },
      { onUsage: (u) => usage.push(u) },
    ).generate(REQUEST);

    assert.equal(text, '{"answer":"ok","source_ids":["S1"],"grounded":true}');
    assert.equal(seenUrl, 'https://openrouter.test/api/v1/chat/completions');
    assert.ok(!seenUrl.includes(OPENROUTER_KEY));
    assert.equal(seenHeaders.Authorization, `Bearer ${OPENROUTER_KEY}`);
    assert.equal(seenBody.model, 'deepseek/deepseek-chat');
    assert.equal(seenBody.models, undefined);
    assert.deepEqual(seenBody.response_format, { type: 'json_object' });
    assert.deepEqual(seenBody.provider, { require_parameters: true, sort: 'latency' });
    assert.deepEqual(seenBody.messages, [
      { role: 'system', content: 'system rules' },
      { role: 'user', content: 'SOURCES ... QUESTION' },
    ]);
    assert.deepEqual(usage, [{ promptTokens: 120, outputTokens: 30 }]);
  });

  it('passes fallback models in the models array with the primary first', async () => {
    let seenBody: Record<string, unknown> = {};
    await client(
      async (_url, init) => {
        seenBody = JSON.parse(String(init?.body));
        return jsonResponse(200, OK_PAYLOAD);
      },
      { fallbackModels: ['qwen/qwen-2.5-72b-instruct', 'google/gemini-2.5-flash'] },
    ).generate(REQUEST);
    assert.deepEqual(seenBody.models, ['deepseek/deepseek-chat', 'qwen/qwen-2.5-72b-instruct', 'google/gemini-2.5-flash']);
    assert.equal(seenBody.model, undefined);
  });

  it('maps provider statuses to the shared error kinds without echoing the body', async () => {
    const cases: [number, string][] = [
      [401, 'auth'],
      [402, 'auth'],
      [429, 'rate_limited'],
      [400, 'bad_response'],
      [503, 'unavailable'],
    ];
    for (const [status, kind] of cases) {
      await assert.rejects(
        client(async () => jsonResponse(status, { error: { message: `bad ${OPENROUTER_KEY}` } })).generate(REQUEST),
        (err: unknown) => err instanceof LlmError && err.kind === kind && !err.message.includes(OPENROUTER_KEY),
        `status ${status}`,
      );
    }
  });

  it('retries a transient 503 once and then succeeds', async () => {
    let calls = 0;
    const text = await client(async () => (++calls === 1 ? jsonResponse(503, {}) : jsonResponse(200, OK_PAYLOAD))).generate(REQUEST);
    assert.equal(calls, 2);
    assert.match(text, /"grounded":true/);
  });

  it('treats a content_filter finish as blocked and empty content as a bad response', async () => {
    await assert.rejects(
      client(async () => jsonResponse(200, { choices: [{ finish_reason: 'content_filter', message: { content: '' } }] })).generate(REQUEST),
      (err: unknown) => err instanceof LlmError && err.kind === 'blocked',
    );
    await assert.rejects(
      client(async () => jsonResponse(200, { choices: [{ finish_reason: 'stop', message: { content: '   ' } }] })).generate(REQUEST),
      (err: unknown) => err instanceof LlmError && err.kind === 'bad_response',
    );
  });

  it('is selected by LLM_PROVIDER=openrouter and then needs OPENROUTER_API_KEY, not GEMINI_API_KEY', () => {
    const config = loadConfig(baseEnv({ LLM_PROVIDER: 'openrouter', OPENROUTER_API_KEY: OPENROUTER_KEY, GEMINI_API_KEY: '' }));
    assert.equal(config.llmProvider, 'openrouter');
    assert.equal(config.openrouterModel, 'deepseek/deepseek-chat');
    assert.deepEqual(config.openrouterFallbackModels, []);
    assert.ok(createLlmClient(config) instanceof OpenRouterClient);

    assert.throws(
      () => loadConfig(baseEnv({ LLM_PROVIDER: 'openrouter', GEMINI_API_KEY: 'x'.repeat(20) })),
      (err: unknown) => err instanceof ConfigError && err.problems.includes('OPENROUTER_API_KEY is required'),
    );
  });

  it('defaults to Gemini when LLM_PROVIDER is unset, so existing deployments do not change', () => {
    const config = loadConfig(baseEnv());
    assert.equal(config.llmProvider, 'gemini');
    assert.equal(config.openrouterApiKey, '');
  });

  it('parses and validates fallback models', () => {
    const config = loadConfig(
      baseEnv({
        LLM_PROVIDER: 'openrouter',
        OPENROUTER_API_KEY: OPENROUTER_KEY,
        OPENROUTER_FALLBACK_MODELS: ' qwen/qwen-2.5-72b-instruct , qwen/qwen-2.5-72b-instruct ',
      }),
    );
    assert.deepEqual(config.openrouterFallbackModels, ['qwen/qwen-2.5-72b-instruct']);

    assert.throws(
      () => loadConfig(baseEnv({ LLM_PROVIDER: 'openrouter', OPENROUTER_API_KEY: OPENROUTER_KEY, OPENROUTER_FALLBACK_MODELS: 'not a model' })),
      /OPENROUTER_FALLBACK_MODELS/,
    );
    assert.throws(
      () => loadConfig(baseEnv({ LLM_PROVIDER: 'openrouter', OPENROUTER_API_KEY: OPENROUTER_KEY, OPENROUTER_MODEL: 'deepseek/deepseek-chat', OPENROUTER_FALLBACK_MODELS: 'deepseek/deepseek-chat' })),
      /OPENROUTER_FALLBACK_MODELS/,
    );
  });

  it('rejects an unknown provider name', () => {
    assert.throws(() => loadConfig(baseEnv({ LLM_PROVIDER: 'openai' })), /LLM_PROVIDER must be gemini or openrouter/);
  });

  it('automatically fails over to the backup client when the primary client fails', async () => {
    const primary = {
      generate: async () => {
        throw new LlmError('unavailable');
      },
    };
    const secondary = {
      generate: async () => '{"answer":"secondary response","source_ids":["S1"],"grounded":true}',
    };
    let failoverCalled = false;
    const failover = new FailoverLlmClient(primary, secondary, () => {
      failoverCalled = true;
    });

    const res = await failover.generate(REQUEST);
    assert.equal(res, '{"answer":"secondary response","source_ids":["S1"],"grounded":true}');
    assert.equal(failoverCalled, true);
  });

  it('does not fail over if the primary client threw a blocked safety error', async () => {
    const primary = {
      generate: async () => {
        throw new LlmError('blocked');
      },
    };
    let secondaryCalled = false;
    const secondary = {
      generate: async () => {
        secondaryCalled = true;
        return 'unreachable';
      },
    };
    const failover = new FailoverLlmClient(primary, secondary);
    await assert.rejects(failover.generate(REQUEST), (err: unknown) => err instanceof LlmError && err.kind === 'blocked');
    assert.equal(secondaryCalled, false);
  });

  it('shares one deadline between both providers and keeps a reserve for the secondary', async () => {
    // Primary never answers and has a 5 s timeout of its own; the shared budget must cut it short.
    const primary = client((_url, init) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }), { timeoutMs: 5000 });
    let secondaryWindow = 0;
    const secondary = {
      generate: async (_req: unknown, deadlineAt?: number) => {
        secondaryWindow = (deadlineAt ?? Number.POSITIVE_INFINITY) - Date.now();
        return 'from secondary';
      },
    };
    const failover = new FailoverLlmClient(primary, secondary, undefined, { totalTimeoutMs: 1500, secondaryReserveMs: 1000 });

    const started = Date.now();
    assert.equal(await failover.generate(REQUEST), 'from secondary');
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 1000, `primary used ${elapsed} ms of a 500 ms share`);
    assert.ok(secondaryWindow > 900 && secondaryWindow <= 1500, `secondary got ${secondaryWindow} ms`);
  });

  it('caps every provider timeout at LLM_TOTAL_TIMEOUT_MS', async () => {
    const config = loadConfig(baseEnv({ GEMINI_TIMEOUT_MS: '30000', LLM_TOTAL_TIMEOUT_MS: '2000' }));
    assert.equal(config.llmTotalTimeoutMs, 2000);
    const defaults = loadConfig(baseEnv());
    assert.ok(defaults.llmTotalTimeoutMs < 22_000 - 3000, 'default budget leaves WordPress headroom');
    assert.ok(defaults.geminiTimeoutMs <= defaults.llmTotalTimeoutMs);
  });

  it('creates a FailoverLlmClient when both Gemini and OpenRouter keys are present', () => {
    const config = loadConfig(baseEnv({ OPENROUTER_API_KEY: OPENROUTER_KEY, GEMINI_API_KEY: 'AIza' + 'a'.repeat(35) }));
    const client = createLlmClient(config);
    assert.ok(client instanceof FailoverLlmClient);
  });
});
