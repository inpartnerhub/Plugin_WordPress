# Architecture

## Components and data flow

```
 Visitor browser                         WordPress (shared hosting, PHP)                 AI backend (Node.js: Vercel/Netlify/VPS)   LLM Providers
 ───────────────                         ───────────────────────────────                 ───────────────────────────────────        ─────────────
 chat-widget.js  ── POST same-origin ──▶  /wp-json/wp-knowledge-chat/v1/chat   ── HMAC ──▶  POST /api/chat                    ──▶   Google Gemini
 (vanilla JS)       {message,language,    • enabled? configured? origin ok?     signed       • verify signature + replay         or OpenRouter
                     history≤4}           • answer cache (first questions, 24 h)
                                          • validate message (≤500 chars)       HTTPS        • rate limit (client/global)           (DeepSeek-Chat)
                ◀── {answer,sources, ──   • per-IP sliding-window rate limit                 • validate request & PII scrub         [Failover]
                     grounded}            • salted client id (no raw IP)                     • scope policy → fallback (no LLM)
                                          • re-validate response, URL allowlist ◀──────────  • BM25 retrieval over KB chunks
                                                                                             • no evidence / missing answer type
                                                                                               → fallback (no LLM)
                                                                                             • response cache lookup
                                                                                             • daily model-call budget
                                                                                             • prompt with delimited sources
                                                                                             • parse + validate JSON output
                                                                                             • claim check & output leak filter
                                                                                             • sources resolved from KB only

 chat-widget.js  ── POST same-origin ──▶  /wp-json/wp-knowledge-chat/v1/lead                 [stored in WordPress, never sent to the backend]
 (consultation      {name,email,company,  • honeypot, disposable e-mail block, duplicate check
  form)              job_title,           • rate limit (3/visitor/10 min, 30/site/h)
                     department,message}  • private post type wkc_lead → notification e-mail to admin

 Admin (manage_options) ─ options.php                        ─▶ Settings API → wp_knowledge_chat_settings
                        ─ admin.php?page=wp-knowledge-chat-leads ─▶ Analytics & Leads (metrics, wkc_lead, CSV)
                        ─ admin.php?page=wp-knowledge-chat-sync  ─▶ Knowledge Base sync ── POST /api/index (Bearer)

 WP-Cron ── every 4 min ─▶ signed GET /api/health (keeps a serverless backend warm)
         ── wkc_retry_sync ─▶ retries failed page updates

 Operator (CLI) ── npm run kb:build ──▶ data/profile/*.txt + data/sources.json → data/kb.json
                ── npm run kb:push  ──▶ POST /api/index (Bearer INDEX_API_TOKEN) → validated, persisted atomically
                ── git push + deploy ─▶ new kb.json on Vercel/Netlify (where /api/index returns 501)
```

## Why this shape (simplest viable)

| Decision | Choice | Reason |
|---|---|---|
| Browser → AI path | Browser calls **its own WordPress REST route**; WordPress proxies to the backend | Shared hosting is PHP-only. The proxy keeps the backend URL and secret out of the browser, and the backend needs no CORS. It also gives a natural place for per-visitor limits. Cost: one PHP worker is held per chat request (≤22 s timeout). This is fine at MVP traffic. |
| WP ↔ backend auth | HMAC-SHA256 over `timestamp.nonce.clientId.body`, 5-min window, replay cache | Stateless, no TLS client certificates needed. Tampering with the body or client id breaks the signature. |
| Secret storage (WP) | `wp-config.php` constants, not options | Never in the database, the admin UI, exports or frontend. Settings stay limited to the four PRD fields. |
| Backend framework | `node:http`, **zero runtime dependencies** | Small attack surface, no supply-chain churn, and full control over body-size limits. Dev-only dependencies: TypeScript, `@types/node`. |
| LLM integration | Gemini REST `generateContent` and OpenRouter chat completions via `fetch`; JSON output | No SDK needed. One shared deadline for both providers (18 s, 6 s reserved for the failover), one bounded retry, a cooldown after auth/quota errors, and errors never echo provider payloads. |
| Retrieval | BM25 lexical search, in memory, plus term maps from Indonesian, Korean, Japanese and Chinese to the English knowledge base | The corpus is 6 profile documents. The offline evaluation hits the expected document for the answerable questions (see [evaluation.md](evaluation.md)). Embeddings and pgvector are not justified at this size (PRD §8). |
| Knowledge-base storage | JSON file (`data/kb.json`), atomic writes | No database to run. The file is diffable and reviewable in git. |
| Grounding enforcement | Model returns `source_ids` only; backend maps ids → KB title/URL | The model cannot introduce URLs. `grounded:true` without a valid id becomes the fallback. |
| Unanswerable questions | Scope policy, retrieval threshold and answer-type check → deterministic fallback **without calling the LLM**; claim check after generation | Keyword overlap is not evidence: the gate stops questions whose topic or requested fact type the evidence cannot answer. Cheaper, and immune to prompt injection on those paths. See [evaluation.md](evaluation.md). |
| Rate limiting | WP: per-IP sliding window (transients; `X-Forwarded-For` only from configured trusted proxies). Backend: per-client + global fixed window (in memory) + daily budget counted per model call | Protects PHP workers and provider cost independently. In-memory limits assume a single backend instance (see deployment). |
| Widget | Vanilla JS + CSS scoped under `#wkc-root`, deferred, footer | No framework needed. ID-scoped CSS beats Hello Elementor/Elementor kit button styles without `!important`; verified in Chrome. |
| Conversation memory | `sessionStorage` in the browser; the widget sends the last 4 turns with each question; the backend keeps nothing | No conversation is stored server-side. Follow-up questions keep their context, and retrieval also searches with the previous question. |
| Content sync | CLI build from reviewed profile text + git/deploy, or the WordPress *Knowledge Base* screen pushing selected pages | `/api/index` accepts documents but never fetches URLs, so it cannot become an SSRF/open proxy. It returns 501 on serverless hosts, where an update would reach one instance only. |
| Consultation leads | Stored in WordPress (private post type), e-mailed to the admin; the widget decides when to offer the form | Leads never leave the WordPress site, so the backend holds no personal data. Offering the form on consultation intent (not only on fallbacks) is a client-side rule (`CONSULT_INTENT_RE`, `CONSULT_INVITE_RE`). |
| Hosting | Vercel (Singapore, `sin1`) or Netlify Functions, or one Node process | Close to the Indonesian WordPress host; WP-Cron keeps the function warm. In-memory limits are per instance (see [deployment.md](deployment.md#scaling-decision)). |

## Module map

```
plugin/wp-knowledge-chat/
  wp-knowledge-chat.php          bootstrap, constants, lifecycle hooks
  includes/class-plugin.php      hook wiring, widget loading rules, frontend config (no secrets), privacy text,
                                 keep-warm cron, GitHub updater (bundled Plugin Update Checker in includes/puc/)
  includes/class-settings.php    defaults, Settings API registration, validation, URL/host policy, migration
  includes/class-admin-page.php  Settings, Knowledge Base and Analytics & Leads screens; CSV export; lead actions
  includes/class-rest-controller.php  /chat and /lead routes: origin check, rate limits, answer cache, response sanitising
  includes/class-backend-client.php   signed server-to-server client (wp_remote_post), health check, index push
  includes/class-content-sync.php     page → document conversion, sync, automatic updates/removals, retry cron
  includes/class-analytics.php        metrics, redacted snippets, content gaps, security counters, leads (wkc_lead), privacy exporter/eraser
  assets/js/chat-widget.js       widget (DOM via textContent only, URL allowlist, a11y, sessionStorage, consultation form)
  assets/css/chat-widget.css     #wkc-root-scoped styles, corporate blue palette, mobile bottom sheet
  assets/js/admin.js             admin interactivity (confirmations, connection test)
  assets/css/admin.css           admin styling: stat cards, tables, leads table layout
  languages/                     .pot + id_ID, ko_KR, ja, zh_CN translations
  uninstall.php                  removes options, leads, sync state, transients and cron events

backend/
  src/server.ts                  process entry: config, KB load, HTTP server timeouts, graceful shutdown
  src/app.ts                     router + dependency wiring (testable without a socket)
  src/config/env.ts              validated environment configuration (fails fast)
  src/routes/{chat,index,health}.ts
  src/services/retrieval.ts      BM25 retriever
  src/services/text.ts           normalisation, stemming, ID/KO/JA/ZH → EN term maps
  src/services/knowledge-base.ts document validation, chunking, store, atomic persistence
  src/services/llm.ts            GeminiClient, OpenRouterClient, FailoverLlmClient (shared deadline)
  src/services/chat.ts           grounding orchestration, prompt and few-shots, output validation, fallbacks, provider cooldown
  src/services/scope.ts          scope policy, answer-type evidence check, claim verification, scrubPii()
  src/services/kb-audit.ts       knowledge-base audit used by kb:build and kb:validate
  src/middleware/rate-limit.ts   fixed windows, daily budget, ResponseCache (5 min, 500 entries)
  src/lib/{auth,http,logger,html-to-text}.ts
  src/vercel/*.ts                Vercel handlers, bundled by esbuild into backend/api/*.js
  src/netlify/{api,adapter}.ts   Netlify Functions handler and Request/Response adapter
  scripts/build-kb.ts            builds data/kb.json from data/sources.json and data/profile/*.txt
  scripts/validate-kb.ts         offline audit of data/kb.json (kb:validate)
  scripts/verify-sources.ts      compares KB documents with their live pages (kb:verify-sources)
  scripts/push-kb.ts             pushes a reviewed KB to /api/index
  scripts/mock-gemini.ts         local Gemini stand-in for tests and offline E2E
  eval/                          design set, held-out set, offline/live evaluation runner
```

## Architectural Design Highlights

1. **Backend URL and secret are `wp-config.php` constants, not settings.** Secrets must not be stored in options, exports, or frontend payloads.
2. **Stateless Public Chat Route.** Anonymous visitors do not require cookie sessions or CSRF nonces that break on LiteSpeed page caches; origin verification, per-IP sliding rate limits, and server-to-server HMAC signatures protect the endpoint.
3. **Dual-Provider Failover.** Primary/secondary provider routing (Gemini 2.5 Flash and OpenRouter DeepSeek-Chat by default) inside one shared deadline, with a cooldown after auth or quota errors.
4. **Deterministic Abstention Gate.** Questions lacking authoritative evidence in the Inpartner Knowledge Base are rejected before reaching external LLMs, protecting against prompt injection and eliminating hallucination risk.
5. **Private Lead Management.** Consultation requests (name, e-mail, company, job title, function, message) are stored locally as a private post type (`wkc_lead`), covered by the WordPress personal-data exporter and eraser, and never sent to the AI backend.
6. **Self-updating plugin.** Releases are GitHub Releases built by CI from a `vX.Y.Z` tag; the plugin's bundled update checker offers them in *Dashboard → Updates*.
