import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { handleWebRequest } from '../src/netlify/adapter.js';
import { KnowledgeBaseStore } from '../src/services/knowledge-base.js';
import { baseEnv, FakeLlm, FIXTURE_DOCS, testConfig } from './helpers.js';
import { silentLogger } from '../src/lib/logger.js';

describe('handleWebRequest (Netlify adapter)', () => {
  const config = testConfig();
  const store = new KnowledgeBaseStore(config.allowedSourceHosts);
  store.loadFrom({ documents: FIXTURE_DOCS });
  const llm = new FakeLlm();
  const app = createApp({ config, store, llm, logger: silentLogger });

  it('routes GET /api/health through Web API Request/Response', async () => {
    const webReq = new Request('https://example.netlify.app/api/health', {
      method: 'GET',
    });
    const res = await handleWebRequest(webReq, app);
    assert.equal(res.status, 200);
    const body = await res.json() as { status: string; knowledge_base: string };
    assert.equal(body.status, 'ok');
    assert.equal(body.knowledge_base, 'ready');
  });

  it('routes GET /.netlify/functions/api/health by normalizing path', async () => {
    const webReq = new Request('https://example.netlify.app/.netlify/functions/api/health', {
      method: 'GET',
    });
    const res = await handleWebRequest(webReq, app);
    assert.equal(res.status, 200);
    const body = await res.json() as { status: string; knowledge_base: string };
    assert.equal(body.status, 'ok');
  });

  it('routes 404 for unknown endpoints through Web API Response', async () => {
    const webReq = new Request('https://example.netlify.app/api/unknown-endpoint', {
      method: 'GET',
    });
    const res = await handleWebRequest(webReq, app);
    assert.equal(res.status, 404);
  });

  it('rejects unsigned POST /api/chat with 401', async () => {
    const webReq = new Request('https://example.netlify.app/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    });
    const res = await handleWebRequest(webReq, app);
    assert.equal(res.status, 401);
  });

  it('sanitizes cold-start configuration errors, attaches security headers, and recovers on retry after transient init failure', async () => {
    const netlifyMod = await import('../src/netlify/api.js');
    const vercelHealthMod = await import('../src/vercel/health.js');
    const vercelAppMod = await import('../src/vercel/_app.js');

    const prevEnv = { ...process.env };
    const origError = console.error;
    console.error = () => {};
    try {
      // Cause loadConfig() to fail with sensitive-looking missing env vars
      delete process.env.GEMINI_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.CHAT_SHARED_SECRET;
      delete process.env.INDEX_API_TOKEN;
      netlifyMod.resetNetlifyAppForTest();
      vercelAppMod.resetAppForTest();

      const badNetlifyRes = await netlifyMod.default(new Request('https://example.netlify.app/api/health'));
      assert.equal(badNetlifyRes.status, 500);
      assert.equal(badNetlifyRes.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(badNetlifyRes.headers.get('cache-control'), 'no-store');
      assert.equal(badNetlifyRes.headers.get('x-frame-options'), 'DENY');
      const badNetlifyBody = (await badNetlifyRes.json()) as { error: { code: string; message: string } };
      assert.equal(badNetlifyBody.error.code, 'internal_error');
      assert.equal(badNetlifyBody.error.message, 'An internal error occurred.');
      assert.ok(!badNetlifyBody.error.message.includes('GEMINI_API_KEY'), 'must not leak env var names to client');

      const badVercelRes = (await vercelHealthMod.default(new Request('https://example.vercel.app/api/health'))) as Response;
      assert.equal(badVercelRes.status, 500);
      assert.equal(badVercelRes.headers.get('x-content-type-options'), 'nosniff');
      const badVercelBody = (await badVercelRes.json()) as { error: { code: string; message: string } };
      assert.equal(badVercelBody.error.code, 'internal_error');
      assert.equal(badVercelBody.error.message, 'An internal error occurred.');

      // Now supply valid env vars and verify both Netlify and Vercel recover without being stuck on a rejected promise
      Object.assign(process.env, baseEnv());

      const recoveredNetlifyRes = await netlifyMod.default(new Request('https://example.netlify.app/api/health'));
      assert.equal(recoveredNetlifyRes.status, 200);
      const recoveredBody = (await recoveredNetlifyRes.json()) as { status: string };
      assert.equal(recoveredBody.status, 'ok');

      const recoveredVercelRes = (await vercelHealthMod.default(new Request('https://example.vercel.app/api/health'))) as Response;
      assert.equal(recoveredVercelRes.status, 200);
    } finally {
      console.error = origError;
      for (const k of Object.keys(process.env)) {
        if (!(k in prevEnv)) delete process.env[k];
      }
      Object.assign(process.env, prevEnv);
      netlifyMod.resetNetlifyAppForTest();
      vercelAppMod.resetAppForTest();
    }
  });
});

