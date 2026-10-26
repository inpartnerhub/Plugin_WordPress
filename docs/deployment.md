# Deployment

> The plugin runs on the Inpartner WordPress site, and the backend is set up for **Vercel** (Singapore) with **Netlify** as an alternative. Every production change (deploys, releases, secret rotation, knowledge-base updates) still needs the site owner's approval, and **staging comes first** whenever one is available.

## Overview

| Part | Where it runs | How it is updated |
|---|---|---|
| WordPress plugin | the Inpartner WordPress site (shared hosting, PHP 8.1+) | *Dashboard → Updates*, from GitHub Releases ([Releases](#8-releasing-and-updating-the-plugin)) |
| AI backend | Vercel functions in `sin1` (`backend/vercel.json`), or Netlify Functions (`netlify.toml`), or one Node.js process | redeploy from `main`; the knowledge base ships as `backend/data/kb.json` |
| Secrets | backend environment variables + `wp-config.php` constants | rotated together ([Rollback](#6-rollback)) |

## Vercel environment setup

Project root: `backend/`. The committed bundles in `backend/api/*.js` are the functions; `vercel.json` routes `/api/chat`, `/api/health`, `/api/index` and the rest, includes `data/kb.json` in every function, and pins the region to `sin1` (Singapore, close to the Indonesian WordPress host). After changing anything in `backend/src/` or `backend/data/`, run `npm run build:vercel` and commit `backend/api/`; CI fails when the bundles are stale.

In Vercel: *Project → Settings → Environment Variables* (Production). Never commit these values.

| Variable | Value |
|---|---|
| `LLM_PROVIDER` | `openrouter` or `gemini`: the primary provider. With both keys set, the other one is the automatic failover. |
| `OPENROUTER_API_KEY` | OpenRouter key (when OpenRouter is primary or the failover). |
| `OPENROUTER_MODEL` / `OPENROUTER_FALLBACK_MODELS` | Default `deepseek/deepseek-chat`; up to 4 fallback model ids. |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Google AI Studio key (put a spending cap on it); default model `gemini-2.5-flash`. |
| `CHAT_SHARED_SECRET` | 32+ random characters (`cd backend && npm run secret`). Same value as `WP_KNOWLEDGE_CHAT_SHARED_SECRET` in `wp-config.php`. |
| `INDEX_API_TOKEN` | 32+ characters, different from the chat secret. Required by config validation; `/api/index` itself returns 501 on Vercel. |
| `DAILY_REQUEST_LIMIT` | Daily model-call budget, from the owner's monthly budget. |

Deploy, then set the two constants in `wp-config.php` (`WP_KNOWLEDGE_CHAT_BACKEND_URL` = the Vercel URL, `WP_KNOWLEDGE_CHAT_SHARED_SECRET`), click **Test connection** in WordPress, and ask one question (for example "What is Inpartner's vision?").

Cold starts: WordPress sends a signed `GET /api/health` every 4 minutes through WP-Cron (`wkc_keep_warm_backend`) so the function stays warm. WP-Cron runs on page visits; on a quiet site, a real cron job calling `wp-cron.php` keeps it regular.

## Netlify environment setup

`netlify.toml` builds `backend/` and publishes the functions from `backend/dist/src/netlify`, with `kb.json` included. In Netlify: *Site configuration → Environment variables*, the same variables as for Vercel. `/api/index` returns 501 there too. Then **Deploys → Trigger deploy** and the same WordPress steps as above.

## Netlify deployment check (2026-10-16 snapshot)

The backend runs on Netlify Functions at `https://inpartner-chat-api.netlify.app`. Checked from outside, without secrets:

| Check | Result |
|---|---|
| `GET /api/health` (unsigned) | 200 `{"status":"ok","knowledge_base":"ready"}` |
| `GET /api/health` with a wrong signature | 401 `unauthorized` |
| `POST /api/chat` without signature | 401 `unauthorized`, generic message |
| `POST /api/index` without or with a wrong token | 401 `unauthorized` (it returns 501 only to an authorised caller on Netlify) |
| `GET /api/index` | 405, `Allow: POST` |
| `GET /robots.txt` | 200. `/` was a 404 page; a `noindex` placeholder (`backend/public/index.html`) is published from the next deploy |
| Security headers | `Content-Security-Policy: default-src 'none'`, HSTS, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` on API responses; no CORS headers for a foreign origin |

**Not checked (needs `CHAT_SHARED_SECRET`):** that the shared secret matches WordPress, that the deployed `GEMINI_API_KEY` is valid, and which `kb.json` version is deployed. Use **Test connection** in WordPress, then one real question.

**Known limit of serverless hosts (Vercel and Netlify):** rate limits, the daily model-call budget, the replay cache and the response cache are per function instance, so the effective limits are higher than configured and a cold start resets them. Set a spending cap on the provider keys themselves. See [Scaling decision](#scaling-decision).

## Status legend

| Mark | Meaning |
|---|---|
| **L** | Verified locally (disposable WordPress 7.1.3 on SQLite, PHP 8.5.5, Node 25, mock Gemini, headless Chrome). Evidence: [test-report.md](test-report.md) |
| **S** | Must be verified on staging. Not done: no staging environment was available |
| **P** | Must be verified on production after approval. Not done |
| **B** | Blocked: needs credentials, infrastructure or an owner decision |

## Prerequisites

| Item | Needed for |
|---|---|
| Gemini and/or OpenRouter API key, with billing alerts and spending caps | backend |
| Vercel or Netlify project (or a host that runs Node.js ≥ 20.11 with HTTPS, for example Cloud Run with max instances = 1, Render, Railway, Fly.io or a small VPS behind Caddy/Nginx) | backend |
| A staging copy of the WordPress site (same theme, plugins, LiteSpeed Cache, MySQL 8.0), when available | plugin acceptance |
| Write access to `wp-config.php` on staging/production | plugin config |
| Owner decisions on open content questions (phone number, contact page, budget) | config, knowledge base; see [site-content-request.md](site-content-request.md) |

The WordPress host only needs outbound HTTPS from PHP to the backend (`wp_remote_post`). No Node.js, SSH, cron workers or Docker are needed there.

## Scaling decision

The backend keeps rate-limit counters, the daily model-call budget and the signature replay cache **in process memory**. That is correct only for **one instance**:

- with two instances, each enforces its own limits (effective limits double) and a captured request could be replayed once against the other instance inside the 5-minute window;
- a restart resets the counters and the daily budget.

**Serverless (Vercel, Netlify Functions) is not equivalent.** Every function instance has its own memory and `/tmp`, so the limits above are per instance. `/api/index` returns **501** there, because an update would reach only one instance and vanish on cold start. Update the knowledge base by committing `data/kb.json` (and, for Vercel, the rebuilt `backend/api/`) and redeploying. The current setup accepts per-instance limits and relies on provider spending caps; add shared state if that stops being acceptable.

Expected MVP traffic (well under the 60 requests/minute global limit) fits one small instance, so **single-instance mode is the supported deployment** and no Redis or database was added. Configure the platform accordingly (for example Cloud Run `--max-instances=1`, one Render/Railway instance, one systemd service). Move these three stores to a shared store (Redis with `INCR`/`EXPIRE` and `SET NX EX`) only if traffic or availability requirements make a second instance necessary; that is an infrastructure decision for the system administrator.

## 1. Deploy the backend as a Node.js process (VPS / container)

```bash
cd backend
npm ci
npm run build
npm test                          # on the build machine
npm run kb:validate               # the shipped knowledge base must pass
npm prune --omit=dev              # runtime has zero dependencies
# Provide env vars from the host's secret manager (see ../.env.example):
#   GEMINI_API_KEY, CHAT_SHARED_SECRET, INDEX_API_TOKEN, HOST=0.0.0.0 (PaaS), PORT, DAILY_REQUEST_LIMIT
npm start                         # node dist/src/server.js
```

- Generate secrets with `npm run secret` (64 hex characters). `CHAT_SHARED_SECRET` and `INDEX_API_TOKEN` must differ. Never put them in the repository, the WordPress database or a chat message.
- Invalid configuration stops the process with exit code 78 and names the variables (never their values).
- Ship `data/kb.json` with the build, or populate it after boot with `npm run kb:push`. Without it, `/api/health` and chat return 503 (the website is unaffected; the widget shows an error).
- Terminate TLS in front of the service. WordPress accepts plain http only for `localhost`.
- `INDEX_API_TOKEN` is only needed where `kb:push` runs; do not copy it to the WordPress server.
- For `/api/index` updates to survive redeploys, mount `data/` on a persistent volume, or treat `kb.json` in git as the source of truth and redeploy.
- Health check for the platform: `GET /api/health` (200 = ready). Logs are JSON lines on stdout and contain no message text, IPs or secrets.
- Set `DAILY_REQUEST_LIMIT` from the approved monthly budget: it counts **Gemini calls** per UTC day (fallbacks without a model call are free). Example: budget ÷ 30 ÷ cost per call.

### Process manager example (VPS)

```ini
# /etc/systemd/system/wkc-backend.service
[Service]
WorkingDirectory=/opt/wkc/backend
EnvironmentFile=/etc/wkc/backend.env      # chmod 600, owned by root
ExecStart=/usr/bin/node dist/src/server.js
User=wkc
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/wkc/backend/data
```

## 2. Build and verify the plugin ZIP

```bash
scripts/package-plugin.sh                              # dist/wp-knowledge-chat-<version>.zip + .sha256 (CI builds the same for releases)
plugin/wp-knowledge-chat/tests/bin/package-check.sh    # checksum, no dev files, install/activate/deactivate/uninstall/reinstall
plugin/wp-knowledge-chat/tests/bin/multisite-check.sh  # network install; uninstall cleans every site (only relevant for multisite)
```

Before uploading anywhere, re-check the checksum on the machine that uploads it:

```bash
cd dist && shasum -a 256 -c wp-knowledge-chat-<version>.zip.sha256
```

## 3. Install on WordPress staging

1. **Back up** the staging database and `wp-content/plugins`.
2. Add to `wp-config.php` *above* "That's all, stop editing":
   ```php
   define( 'WP_KNOWLEDGE_CHAT_BACKEND_URL', 'https://chat-api.example.com' );   // https, no query string
   define( 'WP_KNOWLEDGE_CHAT_SHARED_SECRET', '…same as CHAT_SHARED_SECRET…' );
   // Only for page sync from WordPress, with a backend that persists /api/index updates:
   // define( 'WP_KNOWLEDGE_CHAT_INDEX_API_TOKEN', '…same as INDEX_API_TOKEN…' );
   // Only behind Cloudflare/QUIC.cloud/a load balancer, with that provider's published ranges:
   // define( 'WP_KNOWLEDGE_CHAT_TRUSTED_PROXIES', '…' );
   ```
3. Plugins → Add New → Upload Plugin → choose the ZIP → Activate.
4. WP Knowledge Chat → Settings:
   - Keep **Contact URL** at the default `https://inpartnerglobal.com` unless the site owner approves a dedicated contact page (for example `/contact/`).
   - Choose the language, then **Test connection**. Expected: "backend is reachable, the shared secret is accepted and the knowledge base is ready".
5. Optional page targeting in a small mu-plugin:
   ```php
   add_filter( 'wp_knowledge_chat_should_load', fn( $load ) => $load && ( is_front_page() || is_page( array( 'about-us', 'contact' ) ) ) );
   ```
6. Optional monitoring of backend failures (no message text or IP is passed):
   ```php
   add_action( 'wp_knowledge_chat_backend_failure', function ( $reason, $status ) {
       error_log( "wp-knowledge-chat backend failure: {$reason} ({$status})" );
   }, 10, 2 );
   ```

### LiteSpeed Cache notes

- The widget reads no per-user data, so cached pages are safe to serve. The chat REST route is POST and sends `Cache-Control: no-store`.
- Saving changed settings calls `litespeed_purge_all`, because the greeting, language, contact URL and the enabled flag are embedded in cached pages. With another page cache, purge manually.
- If JS/CSS combine or minify is enabled, test the widget after purging; exclude `chat-widget.js` from "JS Combine" if it misbehaves. It already loads `defer` in the footer.
- With QUIC.cloud CDN or Cloudflare in front, set `WP_KNOWLEDGE_CHAT_TRUSTED_PROXIES`, otherwise all visitors share one rate-limit bucket (6 questions per minute for the whole site).

## 4. Staging acceptance checklist

| # | Check | L | S | P |
|---|---|---|---|---|
| 1 | Backend reachable over HTTPS only; plain http refused by WordPress | L (http only for localhost) | ☐ | ☐ |
| 2 | Secrets only in the host's secret store and `wp-config.php`; none in page source, options, logs or responses | L (E2E greps HTML, settings page, logs) | ☐ | ☐ |
| 3 | `npm run kb:validate` passes; `GET /api/health` → 200 | L | ☐ | ☐ |
| 4 | ZIP checksum verified; install/activate/deactivate/uninstall/reinstall clean | L (`package-check.sh`) | ☐ | ☐ |
| 5 | Plugin activates without PHP notices (`WP_DEBUG_LOG` on) | L (PHP 8.5.5) | ☐ (PHP 8.5.11) | ☐ |
| 6 | Settings save on **MySQL 8.0**; invalid values rejected; non-admins blocked | L (SQLite, and MySQL 8.0.46 via `mysql-check.sh`: 126 tests, ZIP install/uninstall) | ☐ | ☐ |
| 7 | **Test connection** passes; with a deliberately wrong secret it reports "rejected the shared secret" | L | ☐ | ☐ |
| 8 | Widget opens/closes on desktop and real mobile devices; header menu, Elementor sections and popups still work | L (Chrome emulation) | ☐ | ☐ |
| 9 | Keyboard and screen reader (VoiceOver/NVDA) walkthrough | L (keyboard, axe-core only) | ☐ | ☐ |
| 10 | LiteSpeed: settings change visible after save (auto purge); widget works with JS combine/minify; Apache/LiteSpeed rewrite of `/wp-json/` works | ☐ not testable locally | ☐ | ☐ |
| 11 | Behind CDN: two visitors are rate-limited separately (trusted proxies configured) | L (PHPUnit) | ☐ | ☐ |
| 12 | **Real Gemini**: `npm run eval:live` on both datasets against the staging backend; failure rate, p95 latency recorded | **B** (no key) | ☐ | — |
| 13 | Invalid Gemini key → `llm_failed kind=auth` in logs, friendly error in the widget; quota exhaustion → `rate_limited` | L (mocked) | ☐ | — |
| 14 | **Owner review** of every live answer (correct, unsupported claim, wrong refusal, tone) and of contact details | **B** | ☐ | — |
| 15 | Stopping the backend shows a friendly error; the rest of the site keeps working | L | ☐ | ☐ |
| 16 | Monitoring: backend log alerts on `llm_failed`, `chat_auth_failed`, `rate_limited scope=daily`; uptime check on `/api/health`; Google Cloud budget alert | ☐ | ☐ | ☐ |
| 17 | `DAILY_REQUEST_LIMIT` set from the approved budget | **B** (budget not decided) | ☐ | ☐ |
| 18 | Rollback rehearsed (disable, deactivate, restore previous `kb.json`) | L (disable/enable in E2E) | ☐ | ☐ |
| 19 | `npm run kb:verify-sources` passes against the site the backend cites (every KB document is on its page) | **B** (`--strict` fails until the site publishes the profile text, 2026-10-16) | ☐ | ☐ |
| 19a | Settings → Privacy → Policy Guide shows the "WP Knowledge Chat" suggested text; the site's privacy policy mentions the AI assistant, Google Gemini and the consultation form | L (text added in 0.2.2) | ☐ (owner pastes it into the policy) | ☐ |
| 20 | Upgrade 0.2.0 → 0.2.1 keeps every lead; a widget lead reaches a staging inbox; a mail failure shows "Failed" on the dashboard | L (migration in `package-check.sh`, mail mocked) | ☐ | ☐ |
| 21 | Lead abuse: 4th submission in 10 min → 429; honeypot stores nothing | L (PHPUnit) | ☐ | ☐ |
| 22 | Sync: synced page edit/rename/unpublish/protect/trash each reflected in answers; backend stopped → pending notice → **Retry now** clears it | L (PHPUnit, mocked backend) | ☐ | ☐ |
| 23 | After upgrade, sync approved pages once (only synced pages are updated automatically) | — | ☐ | ☐ |
| 24 | **Written approval from the site owner before any production change** | — | — | ☐ |

## 5. Production (only after approval)

Repeat sections 1–3 against production with production secrets (new values, not the staging ones), then re-run checklist rows 1–11, 15–18 on production. Start with the widget restricted to a few pages (`wp_knowledge_chat_should_load`) for the controlled pilot (PRD §15 phase 5).

## 6. Rollback

| Situation | Action | Effect |
|---|---|---|
| Widget misbehaving | Settings → untick **Enable Chatbot** → Save (LiteSpeed purges automatically) | Widget no longer printed; chat route returns 503 |
| Plugin problem | Plugins → Deactivate (or rename `wp-content/plugins/wp-knowledge-chat` via FTP) | Plugin code not loaded; settings kept |
| Remove completely | Export leads (Analytics & Leads → Export CSV), then Deactivate → Delete | `uninstall.php` deletes settings, metrics, **all leads**, sync state and transients |
| Downgrade to an older release | Export leads first, then install the older ZIP from GitHub Releases | Leads are kept. Before 1.2.0 the job title and function are not shown (the data stays in the database); before 0.2.1 leads are not shown at all |
| Backend problem | Stop or roll back the backend deployment | Widget shows "unavailable" errors; site unaffected |
| Bad knowledge base | Revert `data/kb.json` (and `backend/api/` for Vercel) and redeploy; on a persistent Node host `npm run kb:push -- --file=<previous>` also works | Index replaced atomically |
| Cost spike | Lower `DAILY_REQUEST_LIMIT` and restart, or disable the widget | Further model calls refused with 429 |
| Leaked secret | Rotate `CHAT_SHARED_SECRET` (backend env + `wp-config.php` together) and/or `INDEX_API_TOKEN`; rotate the Gemini key in Google Cloud (needs authorisation) | Old signatures/tokens rejected after restart |

## 7. Troubleshooting

| Symptom | Likely cause | Check |
|---|---|---|
| Widget not visible | Disabled, backend constants missing/invalid (non-https URL, query string, secret < 32 chars), page-targeting filter, Elementor preview, stale page cache | Settings page "AI backend" box; view-source for `chat-widget.js` |
| Test connection: "rejected the shared secret" | `WP_KNOWLEDGE_CHAT_SHARED_SECRET` ≠ `CHAT_SHARED_SECRET`, or clock skew > 5 min | backend log `health_auth_failed reason=invalid|expired` |
| "Assistant unavailable" on every question | Backend down, wrong URL, secret mismatch (`chat_auth_failed`), outbound HTTPS blocked by host | *Test connection*; backend logs; `wp_knowledge_chat_backend_failure` action |
| Health 503 | `data/kb.json` missing or invalid | backend log `kb_load_failed` / `kb_loaded` |
| 502 from backend | Gemini key invalid (`llm_failed kind=auth`, including HTTP 400 `API_KEY_INVALID`), provider outage (`kind=unavailable`) | backend logs; Google Cloud console |
| 429 `daily_limit_reached` | Daily model-call budget used up | backend log `rate_limited scope=daily`; raise `DAILY_REQUEST_LIMIT` only within the approved budget |
| Frequent 429 for everyone | Shared IP behind a proxy/CDN, or limits too low | `WP_KNOWLEDGE_CHAT_TRUSTED_PROXIES`; `wp_knowledge_chat_rate_limit_per_minute`; backend `RATE_LIMIT_*` |
| Many fallbacks | Question out of scope or about facts not on the site (`chat_completed outcome=out_of_scope|missing_answer_type|no_evidence reason=…`), or claim check (`outcome=unsupported_claims`) | review logs; add approved content, not looser rules |
| Widget styled oddly | Aggressive CSS optimisation / combine | Purge cache; exclude widget assets from combine |

## 8. Releasing and updating the plugin

Releases follow [CONTRIBUTING.md → Releases](../CONTRIBUTING.md#releases): a `chore(release): bump version to X.Y.Z` pull request, then a `vX.Y.Z` tag on `main`. CI builds `wp-knowledge-chat-X.Y.Z.zip` with its `.sha256` and publishes the GitHub Release.

On the WordPress site:

1. *Dashboard → Updates* (or *Plugins*) offers the new version within about 12 hours; the **Check for updates** link under the plugin on the *Plugins* screen fetches it immediately.
2. Read the release's **Upgrade Notice** (in `readme.txt` and the GitHub Release).
3. Update, then **purge the page cache**, because the widget script and its settings are cached in pages.
4. Smoke test: open the chat, ask one question, and open *Analytics & Leads*.

Manual alternative: download the ZIP from the release, verify it (`shasum -a 256 -c wp-knowledge-chat-X.Y.Z.zip.sha256`), and upload it via *Plugins → Add New → Upload Plugin* (WordPress offers to replace the installed version).
