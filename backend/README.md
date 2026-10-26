# WP Knowledge Chat: AI Backend Service

Lightweight Node.js & TypeScript service behind the Inpartner WordPress AI chatbot. It verifies signed requests from WordPress, retrieves evidence from the Inpartner knowledge base with BM25, asks an LLM (Google Gemini or OpenRouter, with automatic failover) for an answer constrained to that evidence, checks the answer, and returns it with its sources.

[![Node.js 20.11+](https://img.shields.io/badge/Node.js-20.11%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript 5.9](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Runtime Dependencies: None](https://img.shields.io/badge/Dependencies-0%20Runtime-success?style=flat-square)](package.json)
[![Tests: 152 Pass](https://img.shields.io/badge/Tests-152%20Passing-brightgreen?style=flat-square)](tests/)

---

## 📌 Architecture Highlights

- **Zero Runtime Dependencies**: only Node.js built-ins (`node:http`, `node:crypto`, `node:fs`, global `fetch`). Dev-only tools: TypeScript, `@types/node`, `esbuild` (Vercel bundles).
- **Dual-Provider Failover**: `FailoverLlmClient` (`src/services/llm.ts`) uses the provider chosen by `LLM_PROVIDER` first and the other one when it fails, if both API keys are set. Both share one deadline (`LLM_TOTAL_TIMEOUT_MS`, 18 s), with 6 s kept back for the secondary, so the answer arrives before WordPress gives up at 22 s.
- **Three ways to run**: standalone HTTP server (`src/server.ts`), Vercel serverless functions (`src/vercel/*.ts`, bundled into `api/*.js`, region `sin1`) and Netlify Functions (`src/netlify/api.ts` + `adapter.ts`).
- **Five languages**: English, Indonesian, Korean, Japanese and Simplified Chinese. Answers, fallbacks and scope messages are localised; Korean, Japanese and Chinese questions are matched to the English knowledge base through term maps (`src/services/text.ts`).
- **Guardrails**: pre-model scope policy (prompt injection, personal investment/legal/tax/medical advice, guarantees, unrelated topics), PII scrubbing before anything leaves the service, and a claim check on every answer.

---

## 🔌 API Endpoints

| Method | Endpoint | Authorization | Description |
|:---:|---|---|---|
| `POST` | `/api/chat` | HMAC-SHA256 signature (WordPress) | Answers a question with sources |
| `POST` | `/api/index` | `Bearer $INDEX_API_TOKEN` | Upserts, deletes or replaces knowledge-base documents. Returns **501** on Vercel and Netlify, where an update would reach only one instance |
| `GET` | `/api/health` | none, or the same signature as chat | `200 ok` when the knowledge base is loaded, `503 degraded` otherwise |

Full request/response formats: [docs/api-contract.md](../docs/api-contract.md).

---

## 🚀 Getting Started

### 1. Installation
```bash
cd backend
npm install
cp ../.env.example .env
```

### 2. Generate Secrets
```bash
npm run secret    # run twice: once for CHAT_SHARED_SECRET, once for INDEX_API_TOKEN (they must differ)
```

### 3. Build & Run Locally
```bash
npm run build
npm run start:local    # http://127.0.0.1:8787, reads .env
curl http://127.0.0.1:8787/api/health
```

---

## 🧪 Running Without an API Key (Mock Gemini)

```bash
npm run build
npm run mock:gemini    # local Gemini stand-in on http://127.0.0.1:8790
```

Then in `.env`:
```env
LLM_PROVIDER=gemini
GEMINI_API_BASE_URL=http://127.0.0.1:8790
GEMINI_API_KEY=mock-test-key
```

Questions containing `__slow__`, `__error__` or `__garbage__` make the mock time out, return HTTP 500 or return malformed output.

---

## 🔑 Manual Testing via cURL

`/api/chat` needs a signature over `timestamp.nonce.client.body`:

```bash
SECRET="your-chat-shared-secret"
BODY='{"message":"What services does Inpartner offer?","language":"en"}'
TIMESTAMP=$(date +%s)
NONCE=$(openssl rand -hex 16)
CLIENT="manual-curl-client"

SIG=$(printf '%s' "$TIMESTAMP.$NONCE.$CLIENT.$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $NF}')

curl -s http://127.0.0.1:8787/api/chat \
  -H 'Content-Type: application/json' \
  -H "X-WKC-Timestamp: $TIMESTAMP" \
  -H "X-WKC-Nonce: $NONCE" \
  -H "X-WKC-Client: $CLIENT" \
  -H "X-WKC-Signature: $SIG" \
  -d "$BODY"
```

---

## 📜 Available NPM Scripts

| Command | Description |
|---|---|
| `npm run build` | Compiles `src/`, `scripts/`, `eval/` and `tests/` to `dist/` |
| `npm run build:vercel` | Bundles the Vercel entry points into `api/*.js` with esbuild. Run it after changing `src/` or `data/` and commit the result; CI fails when the bundles are stale |
| `npm start` | Runs the server (`node dist/src/server.js`) |
| `npm run start:local` | Same, loading `.env` via `node --env-file` |
| `npm test` | Builds and runs all 152 tests |
| `npm run kb:build` | Rebuilds `data/kb.json` from `data/sources.json` and `data/profile/*.txt` |
| `npm run kb:validate` | Audits the committed `data/kb.json` offline |
| `npm run kb:verify-sources` | Checks each knowledge-base document against its live page (`--strict` fails on any mismatch) |
| `npm run kb:push` | Pushes `data/kb.json` to `/api/index` (needs `BACKEND_URL` and `INDEX_API_TOKEN`) |
| `npm run eval:retrieval` | Offline retrieval and gate evaluation on the design set (`--dataset=eval/holdout.json` for the held-out set) |
| `npm run eval:live` | Live evaluation through the configured LLM (keys are scrubbed from the report) |
| `npm run mock:gemini` | Starts the Gemini stand-in on port 8790 (build first) |
| `npm run secret` | Prints a random 32-byte (64-hex) secret |

---

## ⚙️ Configuration Reference

Environment variables, validated at startup. Invalid configuration stops the process (exit code 78) and names the variable, never its value. Template: [`.env.example`](../.env.example).

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `LLM_PROVIDER` | No | `gemini` | Primary provider: `gemini` or `openrouter`. With both keys set, the other provider becomes the failover |
| `GEMINI_API_KEY` | If Gemini is primary | — | Google AI Studio key. Optional otherwise (enables failover) |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model id |
| `GEMINI_API_BASE_URL` | No | `https://generativelanguage.googleapis.com` | Only for the local mock (`http` is allowed for localhost only) |
| `OPENROUTER_API_KEY` | If OpenRouter is primary | — | OpenRouter key. Optional otherwise (enables failover) |
| `OPENROUTER_MODEL` | No | `deepseek/deepseek-chat` | OpenRouter model id |
| `OPENROUTER_FALLBACK_MODELS` | No | empty | Up to 4 comma-separated model ids that OpenRouter tries if the primary model fails |
| `CHAT_SHARED_SECRET` | **Yes** | — | ≥ 32 characters; equals `WP_KNOWLEDGE_CHAT_SHARED_SECRET` in `wp-config.php` |
| `INDEX_API_TOKEN` | **Yes** | — | ≥ 32 characters, different from `CHAT_SHARED_SECRET`; authorises `/api/index` |
| `HOST` / `PORT` | No | `127.0.0.1` / `8787` | Use `HOST=0.0.0.0` in containers or on a PaaS |
| `GEMINI_TIMEOUT_MS` | No | `12000` | Deadline per provider call, including one retry (used by both providers) |
| `LLM_TOTAL_TIMEOUT_MS` | No | `18000` | Shared deadline for primary + failover. Keep it below the WordPress timeout (22 s) |
| `GEMINI_MAX_OUTPUT_TOKENS` | No | `220` | Output token cap for both providers (answers are 2–3 sentences) |
| `KB_PATH` | No | `data/kb.json` | Knowledge-base file |
| `ALLOWED_SOURCE_HOSTS` | No | `inpartnerglobal.com,www.inpartnerglobal.com,inpartner.id,www.inpartner.id` | Hosts a knowledge-base URL may use |
| `MAX_MESSAGE_CHARS` | No | `500` | Maximum question length |
| `RATE_LIMIT_PER_CLIENT_PER_MINUTE` | No | `8` | Per visitor (WordPress sends a salted client id) |
| `RATE_LIMIT_GLOBAL_PER_MINUTE` | No | `60` | All visitors together |
| `DAILY_REQUEST_LIMIT` | No | `1000` | Model calls per UTC day; fallbacks that skip the model are free |
| `SIGNATURE_MAX_SKEW_SECONDS` | No | `300` | Allowed clock difference for signatures |
| `RETRIEVAL_MIN_SCORE` / `RETRIEVAL_TOP_K` | No | `1.0` / `4` | BM25 threshold and number of chunks given to the model |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn` or `error` |

Rate limits, the daily budget, the replay cache and the response cache live in process memory, so they are per instance. See [docs/deployment.md → Scaling decision](../docs/deployment.md#scaling-decision).

---

## 🛡️ Question Lifecycle

1. **Authentication**: signature, timestamp (±300 s) and nonce replay check (`src/lib/auth.ts`).
2. **Rate limiting**: per-client and global windows, before the body is parsed (`src/middleware/rate-limit.ts`).
3. **Validation**: message 1–500 characters, language `en`/`id`/`ko`/`ja`/`zh`, at most 4 history turns (`src/routes/chat.ts`).
4. **Scope & PII**: questions outside the policy get a localised fallback without a model call; e-mails, phone numbers, Indonesian NIK and card numbers are replaced before retrieval, logging or the provider (`scrubPii()` and the scope rules in `src/services/scope.ts`).
5. **Retrieval**: BM25 over ~700-character line-aligned chunks, with Indonesian term mapping and NFKC substring matching for Korean, Japanese and Chinese (`src/services/retrieval.ts`, `text.ts`). Follow-up questions also search with the previous turn.
6. **Deterministic gate**: no chunk above `RETRIEVAL_MIN_SCORE`, or the requested fact type (price, phone, client name…) absent from the evidence → fallback **without calling the model**.
7. **Cache & budget**: a first question (no history) may be answered from the in-memory cache (5 minutes, 500 entries); otherwise one unit of `DAILY_REQUEST_LIMIT` is used.
8. **Generation**: the model gets delimited evidence and must return JSON `{answer, source_ids, grounded}`; failover if the primary provider fails.
9. **Checks**: invalid or unsafe output, or a number, e-mail, phone or URL that the evidence does not contain → fallback. Sources come from the knowledge base by id; the model can never supply a URL.

---

## 📊 Structured JSON Logging

One JSON object per line on stdout:

```json
{"time":"2026-10-21T15:20:00.000Z","level":"info","event":"chat_completed","outcome":"answered","language":"en","message_chars":45,"sources":1,"latency_ms":850}
```

Useful events: `chat_completed` (with `outcome` and `reason`), `llm_failed` (`kind=auth|unavailable|timeout|rate_limited|blocked|bad_response`), `provider_cooldown`, `chat_auth_failed`, `health_auth_failed`, `rate_limited` (`scope=client|global|daily`), `kb_loaded`, `kb_load_failed`.

> **Privacy:** message text, IP addresses and secrets are never logged.
