# WP Knowledge Chat: AI Backend Service

Lightweight, high-performance Node.js & TypeScript microservice backing the Inpartner WordPress AI Chatbot. It provides authenticated request processing, BM25 retrieval over authoritative company knowledge-base chunks, dual-provider LLM orchestration with high-availability failover (Google Gemini & OpenRouter DeepSeek-Chat), automated PII scrubbing, and strict source citation grounding.

[![Node.js 20.11+](https://img.shields.io/badge/Node.js-20.11%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript 5.9](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Runtime Dependencies: None](https://img.shields.io/badge/Dependencies-0%20Runtime-success?style=flat-square)](package.json)
[![Tests: 137 Pass](https://img.shields.io/badge/Tests-137%20Passing-brightgreen?style=flat-square)](tests/)

---

## 📌 Architecture Highlights

- **Zero Runtime Dependencies**: Built entirely with standard Node.js runtime APIs (`node:http`, `node:crypto`, `node:fs`, and global `fetch`). Zero third-party packages in production.
- **Dual-Provider Failover**: Built-in `FailoverLlmClient` automatically handles primary/secondary failover between Google Gemini API (`gemini-1.5-flash`) and OpenRouter API (`deepseek/deepseek-chat`).
- **Serverless & Container Ready**: Native standalone HTTP server with serverless compatibility (Netlify Functions Web API Request/Response adapter in `src/netlify-adapter.ts`).
- **Enterprise Guardrails**: Pre-model scope enforcement, Indonesian slang/obfuscation injection detection, and automatic PII redaction (Indonesian NIK 16 digits, credit cards, emails, phone numbers).

---

## 🔌 API Endpoints

| Method | Endpoint | Authorization | Description |
|:---:|---|---|---|
| `POST` | `/api/chat` | HMAC-SHA256 Signature (WordPress client) | Answers visitor questions with source-attributed citations |
| `POST` | `/api/index` | `Bearer $INDEX_API_TOKEN` | Atomically upserts, deletes, or refreshes knowledge-base documents |
| `GET` | `/api/health` | Public / Optional Signature | Health check returning status `200 ok` or `503 degraded` |

---

## 🚀 Getting Started

### 1. Installation
```bash
cd backend
npm install
cp ../.env.example .env
```

### 2. Generate Cryptographic Secrets
Generate secure random 64-hex strings for `CHAT_SHARED_SECRET` and `INDEX_API_TOKEN`:
```bash
npm run secret    # Run twice: once for CHAT_SHARED_SECRET, once for INDEX_API_TOKEN
```

### 3. Build & Run Locally
```bash
npm run build
npm run start:local    # Listens on http://127.0.0.1:8787 using local .env

# Verify service health:
curl http://127.0.0.1:8787/api/health
```

---

## 🧪 Testing with Mock Double (No API Keys Needed)

If you don't have an active Gemini or OpenRouter API key yet, you can run the deterministic mock model server:

```bash
npm run mock:gemini    # Starts local mock server on http://127.0.0.1:8790
```

Configure `.env`:
```env
GEMINI_API_BASE_URL=http://127.0.0.1:8790
GEMINI_API_KEY=mock-test-key
```

> **Testing edge cases with mock:** Queries containing `__slow__`, `__error__`, or `__garbage__` simulate timeout, 500 server error, or malformed JSON output respectively.

---

## 🔑 Manual Testing via cURL

To test `/api/chat` manually from terminal, compute the required HMAC-SHA256 signature:

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
| `npm run build` | Compiles TypeScript source (`src/`) to JavaScript (`dist/`) |
| `npm run start` | Runs production server (`node dist/src/server.js`) |
| `npm run start:local` | Runs server loading local `.env` via `node --env-file` |
| `npm test` | Builds and executes all 137 unit and integration tests |
| `npm run kb:build` | Rebuilds `data/kb.json` from authoritative profile documents |
| `npm run kb:validate` | Validates `data/kb.json` integrity and exclusion rules offline |
| `npm run kb:push` | Pushes validated knowledge base to `/api/index` |
| `npm run eval:retrieval`| Runs offline retrieval and gate accuracy evaluation on datasets |
| `npm run eval:live` | Runs live evaluation through configured LLMs (scrubs keys) |
| `npm run mock:gemini` | Starts local HTTP Gemini double on port 8790 |
| `npm run secret` | Generates a cryptographically secure 32-byte (64-char) hex secret |

---

## ⚙️ Configuration Reference

All configuration is supplied via environment variables and validated at process startup.

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `LLM_PROVIDER` | No | `openrouter` (or auto) | `openrouter` or `gemini` (enables failover if both keys present) |
| `OPENROUTER_API_KEY` | If OpenRouter | — | Server-side API key from OpenRouter.ai |
| `OPENROUTER_MODEL` | No | `deepseek/deepseek-chat` | OpenRouter model identifier |
| `OPENROUTER_FALLBACK_MODELS` | No | empty | Comma-separated fallback models for provider-level retry |
| `GEMINI_API_KEY` | If Gemini | — | Server-side key from Google AI Studio |
| `GEMINI_MODEL` | No | `gemini-1.5-flash` | Gemini model identifier |
| `CHAT_SHARED_SECRET` | **Yes** | — | ≥ 32 characters; must match `WP_KNOWLEDGE_CHAT_SHARED_SECRET` |
| `INDEX_API_TOKEN` | **Yes** | — | ≥ 32 characters; used for `/api/index` authorization |
| `HOST` / `PORT` | No | `127.0.0.1` / `8787` | Set `HOST=0.0.0.0` in containers or cloud environments |
| `GEMINI_TIMEOUT_MS` | No | `12000` | Request deadline including one retry (applies to both providers) |
| `GEMINI_MAX_OUTPUT_TOKENS` | No | `600` | Maximum token ceiling for model responses |
| `DAILY_REQUEST_LIMIT` | No | `1000` | Daily model-call budget ceiling (only charges actual LLM calls) |
| `RATE_LIMIT_PER_CLIENT_PER_MINUTE` | No | `8` | Per-client sliding window rate limit |
| `RATE_LIMIT_GLOBAL_PER_MINUTE` | No | `60` | Global aggregate rate limit |
| `LOG_LEVEL` | No | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |

---

## 🛡️ Step-by-Step Question Lifecycle

1. **HMAC Authentication**: Verifies request signature, timestamp freshness (±300s window), and nonce against replay cache (`src/lib/auth.ts`).
2. **Rate Limiting**: Enforces per-client and global rate windows before JSON body parsing (`src/middleware/rate-limit.ts`).
3. **Validation**: Validates message length (1–500 characters) and supported language code (`en`, `id`, `ko`).
4. **Scope & PII Redaction**: Checks for prompt injections, out-of-scope advice requests, and automatically scrubs sensitive PII (`src/services/pii.ts`, `src/services/scope.ts`).
5. **BM25 Retrieval**: Performs lexical search over ~700-character line-aligned chunks with language-specific query expansion and Korean NFD matching (`src/services/retrieval.ts`).
6. **Deterministic Abstention Gate**: If top retrieved score < `RETRIEVAL_MIN_SCORE` (1.0) or required fact type is absent, returns an honest fallback **without calling the model**.
7. **Cache & Budget**: Checks in-memory `ResponseCache` for cached grounded answers; otherwise accounts for 1 unit of `DAILY_REQUEST_LIMIT`.
8. **Constrained Generation & Failover**: Instructs LLM with delimited evidence. `FailoverLlmClient` automatically handles retries or failover to secondary provider if needed.
9. **Claim Verification**: Validates numbers, emails, phone numbers, and URLs in the model answer against evidence. Any unsupported claim is rejected and replaced with the safe fallback.

---

## 📊 Structured JSON Logging

All logs are emitted as single-line JSON objects to standard output:

```json
{"time":"2026-10-21T15:20:00.000Z","level":"info","event":"chat_completed","outcome":"answered","language":"en","message_chars":45,"sources":1,"latency_ms":850}
```

> **Privacy Guarantee:** Message contents, client IP addresses, passwords, and provider secrets are strictly **never** logged.
