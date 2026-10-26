# Technology stack

Every technology used in the project, the version it was built and tested with, and why it was chosen. Versions come from the lock files (`backend/package-lock.json`, `plugin/wp-knowledge-chat/tests/package-lock.json`, `plugin/wp-knowledge-chat/tests/composer.lock`) and the local test environment (first written 2026-10-14, updated for release 1.2.1).

## Overview

| Layer | Technology | Version | Shipped to production? |
|---|---|---|---|
| CMS | WordPress | ≥ 6.4 (tested 7.1.3) | yes (existing site) |
| Plugin language | PHP | ≥ 8.1 (tested 8.5.5) | yes |
| Widget | Vanilla JavaScript (ES5-compatible syntax) + Scoped CSS | WCAG 2.1 AA | yes |
| Backend runtime | Node.js: Vercel functions (`sin1`), Netlify Functions or a standalone process | ≥ 20.11 (tested 25.9.0) | yes |
| Backend language | TypeScript | 5.9.3 | compiled to JS |
| AI models | Dual-Provider: Google Gemini API & OpenRouter API | `gemini-2.5-flash` / `deepseek/deepseek-chat` (defaults) | external services (failover when both keys are set) |
| Retrieval | BM25 lexical search (EN, ID, KO, JA, ZH questions) | — | yes |
| Knowledge-base storage | JSON file (`backend/data/kb.json`) | — | yes |

**Runtime dependencies:** the backend uses only Node.js built-in modules (`node:http`, `node:crypto`, `node:fs`, global `fetch`). The plugin uses WordPress core APIs plus one bundled library, [Plugin Update Checker](https://github.com/YahnisElsts/plugin-update-checker) 5.7 (`includes/puc/`), which offers new GitHub Releases as WordPress updates.

## WordPress plugin

| Item | Detail |
|---|---|
| WordPress APIs used | Plugin API (hooks/filters), Options API, Settings API, REST API (`register_rest_route`), HTTP API (`wp_remote_post`/`wp_remote_get`), Transients API, custom post type (`wkc_lead`) and post meta, WP-Cron, `wp_mail`, Privacy API (exporter, eraser, policy text), Script/Style enqueue with `defer` strategy (WP 6.3+), Capabilities, Nonces, i18n (`.l10n.php` catalogs), escaping and sanitising functions |
| PHP features | namespaces, typed properties, nullable/union-free signatures, arrow functions, `random_bytes`, `hash_hmac` |
| Minimum versions | WordPress 6.4 (`Requires at least`), PHP 8.1 (`Requires PHP`) |
| Theme/builder compatibility tested | Hello Elementor 3.5.1, Elementor 4.3.5 |
| Frontend | Plain DOM APIs, `fetch`, `AbortController`, `sessionStorage`, inline SVG icons; no framework, no build step |
| Styling | Plain CSS with custom properties, scoped under `#wkc-root`; fonts inherit Lato / Open Sans from the site |

**Why no framework:** the widget is about 55 KB of JS (most of it the five language catalogs) and 33 KB of CSS, unminified and without a build step. React or Vue would add more weight than the whole widget, need a build pipeline, and raise the risk of conflicts with Elementor scripts.

## Backend

| Item | Detail |
|---|---|
| HTTP server | `node:http` with a small router (`src/app.ts`); request and header timeouts set |
| Crypto | `node:crypto`: HMAC-SHA256 signatures, `timingSafeEqual`, SHA-256 fingerprints |
| HTTP client | global `fetch` with `AbortController` timeouts (Gemini) |
| Config | environment variables, validated at startup (`src/config/env.ts`); `node --env-file` for local `.env` |
| Logging | JSON lines on stdout (`src/lib/logger.ts`) |
| Module system | ES modules, TypeScript `NodeNext` |
| Build | `tsc` → `dist/`; `esbuild` 0.28.2 bundles the Vercel functions into `backend/api/*.js` |

**Why no Express/Fastify/Gemini SDK:** three endpoints do not need a framework. Writing the HTTP layer directly gives exact control over body-size limits and error output, and removes the supply-chain risk of a dependency tree. The Gemini REST call is one `fetch`.

**Why BM25 and not embeddings/pgvector:** the knowledge base is 6 documents (company profile and service pages). The offline evaluation shows lexical retrieval finds the expected page for 100% of answerable questions. A vector database would add hosting cost and operational work without a measurable benefit at this size (PRD §8).

## External services

| Service | Used for | Notes |
|---|---|---|
| Google Gemini API | generating answers | Key held only by the backend. Requests and responses are not logged. Check Google's data-use terms for the account tier |
| OpenRouter API | generating answers (primary or failover) | Same handling as Gemini; default model `deepseek/deepseek-chat` |
| inpartnerglobal.com public pages | `npm run kb:verify-sources` (and `kb:build` for entries with `origin: "site"`) | read-only GETs of allowlisted pages |
| GitHub Releases | plugin packages and automatic updates | built by CI from a `vX.Y.Z` tag |
| Hosting for the backend | runs the Node service | Vercel (Singapore) is configured (`backend/vercel.json`); Netlify (`netlify.toml`) and any HTTPS Node host also work |

## Development and test tooling (not shipped)

| Tool | Version | Used for |
|---|---|---|
| `node:test` (built into Node) | — | backend tests, widget tests, E2E HTTP checks |
| `@types/node` | 20.19.43 | TypeScript types for Node 20 APIs |
| esbuild | 0.28.2 | bundles the Vercel functions |
| jsdom | 25.0.1 | simulated DOM for widget tests |
| axe-core | 4.14.0 | automated WCAG 2.1 A/AA accessibility checks in Chrome |
| Google Chrome (headless, DevTools Protocol) | 154 | real-browser E2E checks and screenshots |
| PHPUnit | 12.5.39 | plugin integration tests against real WordPress |
| PHP_CodeSniffer | 3.13.6 | static analysis runner |
| WordPress Coding Standards (WPCS) | 3.4.1 | security sniffs: escaping, nonces, sanitising, prepared SQL |
| PHPCompatibility / PHPCompatibilityWP | 9.3.5 / 2.1.8 | PHP 8.1+ compatibility check |
| WP-CLI | 2.12.0 | installing and driving the local test WordPress |
| SQLite Database Integration (WordPress plugin) | 3.1.0 | runs WordPress on SQLite in tests (no MySQL needed) |
| Composer | 2.9.7 | PHP test dependencies |
| npm | 11 | Node dependencies |
| Bash, `zip`, `openssl`, `curl` | system | scripts: setup, packaging, E2E orchestration |

## Compatibility targets vs. what was tested

| Target (production, as reported) | Tested locally | Gap |
|---|---|---|
| WordPress 7.1.3 | 7.1.3 | none |
| PHP 8.5.11 | 8.5.5 | patch version only |
| MySQL 8.0.46 | SQLite (via official integration) | the plugin creates no tables and uses only the Options/Transients APIs; still verify on staging |
| Apache / LiteSpeed + LiteSpeed Cache | PHP built-in server | caching and JS-combine behaviour untested |
| Hello Elementor 3.5.1, Elementor 4.3.5 | same versions | site-specific Elementor popups/widgets untested |
| PHP memory limit 40 MB | default CLI limit | the plugin adds negligible memory, but this is unmeasured |
