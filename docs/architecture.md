# Architecture

## Components and data flow

```
 Visitor browser                         WordPress (shared hosting, PHP)                 AI backend (Node.js, external host)        LLM Providers
 ───────────────                         ───────────────────────────────                 ───────────────────────────────────        ─────────────
 chat-widget.js  ── POST same-origin ──▶  /wp-json/wp-knowledge-chat/v1/chat   ── HMAC ──▶  POST /api/chat                    ──▶   Google Gemini
 (vanilla JS)       {message,language}    • enabled? configured? origin ok?     signed       • verify signature + replay         or OpenRouter
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

 chat-widget.js  ── POST same-origin ──▶  /wp-json/wp-knowledge-chat/v1/lead                 [Stored locally in private post type]
 (lead form)        {name,email,message}  • honeypot check, disposable email block
                                          • rate limit & retention policy

 Admin (manage_options) ─ options.php ─▶  Settings API → wp_knowledge_chat_settings
                        ─ edit.php    ─▶  Analytics & Leads Dashboard (wkc_lead)
                        ─ tools.php   ─▶  Knowledge Base Sync (class-content-sync.php)

 Operator (CLI) ── npm run kb:build ──▶ fetches page IDs in data/sources.json → data/kb.json
                ── npm run kb:push  ──▶ POST /api/index (Bearer INDEX_API_TOKEN) → validated, persisted atomically
```

## Why this shape (simplest viable)

| Decision | Choice | Reason |
|---|---|---|
| Browser → AI path | Browser calls **its own WordPress REST route**; WordPress proxies to the backend | Shared hosting is PHP-only. The proxy keeps the backend URL and secret out of the browser, and the backend needs no CORS. It also gives a natural place for per-visitor limits. Cost: one PHP worker is held per chat request (≤20 s timeout). This is fine at MVP traffic. |
| WP ↔ backend auth | HMAC-SHA256 over `timestamp.nonce.clientId.body`, 5-min window, replay cache | Stateless, no TLS client certificates needed. Tampering with the body or client id breaks the signature. |
| Secret storage (WP) | `wp-config.php` constants, not options | Never in the database, the admin UI, exports or frontend. Settings stay limited to the four PRD fields. |
| Backend framework | `node:http`, **zero runtime dependencies** | Small attack surface, no supply-chain churn, and full control over body-size limits. Dev-only dependencies: TypeScript, `@types/node`. |
| LLM integration | Gemini REST `generateContent` via `fetch`, JSON response schema | No SDK needed. Overall deadline, one bounded retry, and errors never echo provider payloads. |
| Retrieval | BM25 lexical search, in memory, plus a small Indonesian→English term map | The corpus is 5 pages (10 chunks). The offline evaluation hits the expected document for 100% of answerable questions. Embeddings and pgvector are not justified (PRD §8). |
| Knowledge-base storage | JSON file (`data/kb.json`), atomic writes | No database to run. The file is diffable and reviewable in git. |
| Grounding enforcement | Model returns `source_ids` only; backend maps ids → KB title/URL | The model cannot introduce URLs. `grounded:true` without a valid id becomes the fallback. |
| Unanswerable questions | Scope policy, retrieval threshold and answer-type check → deterministic fallback **without calling the LLM**; claim check after generation | Keyword overlap is not evidence: the gate stops questions whose topic or requested fact type the evidence cannot answer. Cheaper, and immune to prompt injection on those paths. See [evaluation.md](evaluation.md). |
| Rate limiting | WP: per-IP sliding window (transients; `X-Forwarded-For` only from configured trusted proxies). Backend: per-client + global fixed window (in memory) + daily budget counted per model call | Protects PHP workers and provider cost independently. In-memory limits assume a single backend instance (see deployment). |
| Widget | Vanilla JS + CSS scoped under `#wkc-root`, deferred, footer | No framework needed. ID-scoped CSS beats Hello Elementor/Elementor kit button styles without `!important`; verified in Chrome. |
| Conversation memory | `sessionStorage` in the browser only; backend is stateless per question | No personal data stored server-side. Follow-up questions are answered independently (documented limitation). |
| Content sync | CLI build from a reviewed allowlist + authenticated push | PRD lists automatic sync as P1. `/api/index` accepts documents but never fetches URLs, so it cannot become an SSRF/open proxy. |

## Module map

```
plugin/wp-knowledge-chat/
  wp-knowledge-chat.php          bootstrap, constants, lifecycle hooks
  includes/class-plugin.php      hook wiring, widget loading rules, frontend config (no secrets)
  includes/class-settings.php    defaults, Settings API registration, validation, URL policy, migration
  includes/class-admin-page.php  WP Knowledge Chat → Settings screen, corporate theme & stat cards
  includes/class-rest-controller.php  public chat route, origin check, rate limit, lead submission route
  includes/class-backend-client.php   signed server-to-server client (wp_remote_post), health check
  includes/class-content-sync.php     page synchronization engine with automated retry and removal
  includes/class-analytics.php        lead storage (wkc_lead), metrics aggregation, threat & gap tracking
  assets/js/chat-widget.js       widget (DOM via textContent only, URL allowlist, a11y, sessionStorage)
  assets/css/chat-widget.css     #wkc-root-scoped styles, corporate blue palette, mobile bottom sheet
  assets/js/admin.js             admin interactivity, connection test, chart enhancements
  assets/css/admin.css           modern corporate admin styling, stat metric cards, table styles
  uninstall.php                  removes options, leads, metrics, transients, and files

backend/
  src/server.ts                  process entry: config, KB load, HTTP server timeouts, graceful shutdown
  src/app.ts                     router + dependency wiring (testable without a socket)
  src/config/env.ts              validated environment configuration (fails fast)
  src/routes/{chat,index,health}.ts
  src/services/retrieval.ts      BM25 (with ID & KO query expansion, NFD normalization)
  src/services/text.ts           normalisation, stemming, ID/KO/EN term mapping
  src/services/knowledge-base.ts document validation, chunking, store, atomic persistence
  src/services/llm.ts            Gemini client (timeout, retry, error mapping)
  src/services/openrouter.ts     OpenRouter client (DeepSeek-Chat, fallback models)
  src/services/failover.ts       FailoverLlmClient (automatic backup provider switching)
  src/services/chat.ts           grounding orchestration, prompt, output validation
  src/services/scope.ts          scope policy, answer-type evidence check, claim verification
  src/services/pii.ts            PII scrubbing (NIK, payment cards, emails, phone numbers)
  src/services/cache.ts          ResponseCache (grounded answer caching with TTL)
  src/middleware/rate-limit.ts   fixed window + daily budget + abuse penalty tracker
  src/lib/{auth,http,logger,html-to-text}.ts
  scripts/build-kb.ts            builds data/kb.json from data/sources.json
  scripts/validate-kb.ts         offline audit of data/kb.json (kb:validate)
  scripts/push-kb.ts             pushes a reviewed KB to /api/index
  scripts/mock-gemini.ts         local Gemini stand-in for tests and offline E2E
  eval/                          design set, held-out set, offline/live evaluation runner (Gemini + OpenRouter)
```

## Architectural Design Highlights

1. **Backend URL and secret are `wp-config.php` constants, not settings.** Secrets must not be stored in options, exports, or frontend payloads.
2. **Stateless Public Chat Route.** Anonymous visitors do not require cookie sessions or CSRF nonces that break on LiteSpeed page caches; origin verification, per-IP sliding rate limits, and server-to-server HMAC signatures protect the endpoint.
3. **Dual-Provider Failover.** Zero-downtime resilience by supporting primary/secondary provider routing (Gemini 1.5 Flash and OpenRouter DeepSeek-Chat) with independent timeout and quota cooldown handling.
4. **Deterministic Abstention Gate.** Questions lacking authoritative evidence in the Inpartner Knowledge Base are rejected before reaching external LLMs, protecting against prompt injection and eliminating hallucination risk.
5. **Private Lead Management.** Consultation requests are stored locally as WordPress private post types (`wkc_lead`) with full compliance with WordPress Data Eraser and Privacy policy tools.
