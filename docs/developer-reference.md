# Developer reference

Everything a developer can configure or hook into, checked against the code of release 1.2.1. For the HTTP request and response formats see [api-contract.md](api-contract.md); for the backend's environment variables see [backend/README.md](../backend/README.md#-configuration-reference).

## `wp-config.php` constants

Secrets and connection details are constants, never settings, so they cannot leak through the database, exports or the admin UI.

| Constant | Required | Purpose |
|---|---|---|
| `WP_KNOWLEDGE_CHAT_BACKEND_URL` | yes | Base URL of the AI backend. Must be `https` (plain `http` only for `localhost`), no query string. The widget stays hidden while it is missing or invalid. |
| `WP_KNOWLEDGE_CHAT_SHARED_SECRET` | yes | HMAC key for WordPress → backend requests, at least 32 characters. Must equal `CHAT_SHARED_SECRET` on the backend. |
| `WP_KNOWLEDGE_CHAT_INDEX_API_TOKEN` | for page sync | Bearer token for `POST /api/index`. Must equal `INDEX_API_TOKEN` on the backend. Without it, the Knowledge Base screen cannot sync pages. Not used on serverless hosts, where `/api/index` returns 501. |
| `WP_KNOWLEDGE_CHAT_TRUSTED_PROXIES` | no | Comma-separated IPs or CIDR ranges of reverse proxies/CDNs whose `X-Forwarded-For` header is trusted for rate limiting. Leave unset unless the site is behind a proxy. |
| `WP_KNOWLEDGE_CHAT_GITHUB_TOKEN` | no | GitHub token for the built-in updater, only needed if the release repository is private. |

The plugin also defines `WP_KNOWLEDGE_CHAT_VERSION`, `WP_KNOWLEDGE_CHAT_FILE`, `WP_KNOWLEDGE_CHAT_DIR` and `WP_KNOWLEDGE_CHAT_URL` for its own use.

## Settings

Stored in the single option `wp_knowledge_chat_settings` and edited on **WP Knowledge Chat → Settings** (`manage_options`).

| Key | Type | Default | Notes |
|---|---|---|---|
| `enabled` | bool | `true` | Off hides the widget and makes the chat endpoint return 503. |
| `greetings` | object `{en,id,ko,ja,zh}` | built-in text per language | Plain text, at most 500 characters each. Empty restores the default. |
| `language` | `en` \| `id` \| `ko` \| `ja` \| `zh` | `en` | Default interface and answer language. |
| `language_switcher` | bool | `true` | Globe dropdown in the chat header. |
| `detect_browser_language` | bool | `true` | Start in the browser language when it is one of the five. Every `zh-*` region maps to `zh`. |
| `contact_url` | https URL | `https://inpartnerglobal.com` | Must be on an approved host (`wp_knowledge_chat_allowed_contact_hosts`; a WhatsApp `wa.me` link is allowed). Never fetched. |

Saving changed settings calls `do_action( 'litespeed_purge_all' )`, because the greeting, languages and contact link are printed into cached pages.

## Filters

| Filter | Arguments → return | Default | Use |
|---|---|---|---|
| `wp_knowledge_chat_should_load` | `bool $load` → bool | `true` on the public site | Restrict the widget to some pages, e.g. `is_front_page() \|\| is_page( 'contact' )`. Never loaded in wp-admin or the Elementor editor. |
| `wp_knowledge_chat_suggested_questions` | `string[] $questions, string $language` → string[] | 4 built-in questions per language | Suggested questions for `en`, `id`, `ko`, `ja` or `zh`. At most 4, each at most 150 characters. |
| `wp_knowledge_chat_allowed_contact_hosts` | `string[] $hosts` → string[] | the source hosts, `wa.me`, `api.whatsapp.com` and this site's host | Hosts accepted for the Contact URL. |
| `wp_knowledge_chat_allowed_source_hosts` | `string[] $hosts` → string[] | `inpartnerglobal.com`, `www.inpartnerglobal.com`, `inpartner.id`, `www.inpartner.id` | Hosts allowed in source links shown under answers. Other links are dropped. |
| `wp_knowledge_chat_allowed_origins` | `string[] $hosts` → string[] | the hosts of `home_url()` and `site_url()` | Browser `Origin` hosts allowed to call `/chat` and `/lead`. |
| `wp_knowledge_chat_rate_limit_per_minute` | `int` → int | `6` | Chat questions per visitor per minute (sliding window). |
| `wp_knowledge_chat_client_ip` | `string $ip, string $remote_addr` → string | `REMOTE_ADDR`, or the forwarded client behind a trusted proxy | The IP used for rate limits. Override only for a header set by a trusted proxy. |
| `wp_knowledge_chat_trusted_proxies` | `string[] $proxies` → string[] | from `WP_KNOWLEDGE_CHAT_TRUSTED_PROXIES` | Same as the constant, in code. |
| `wp_knowledge_chat_cache_ttl` | `int $seconds` → int | `86400` (24 h) | How long WordPress caches a grounded answer to a first question (no history). `0` disables the cache. |
| `wp_knowledge_chat_store_query_snippets` | `bool` → bool | `true` | Keep the 25 latest redacted question snippets for Analytics & Leads. `false` keeps only counts. |
| `wp_knowledge_chat_store_content_gaps` | `bool` → bool | `true` | Keep unanswered questions (redacted) in *Knowledge Gaps & Unanswered Topics*. |
| `wp_knowledge_chat_lead_notification_email` | `string $email` → string | `admin_email` option | Who receives new-lead e-mails. |
| `wp_knowledge_chat_lead_retention_days` | `int $days` → int | `0` (keep until deleted) | Leads older than this are deleted automatically. |
| `wp_knowledge_chat_lead_limit_per_hour` | `int` → int | `30` | Site-wide cap on consultation requests per hour. The per-visitor cap (3 per 10 minutes) is fixed. |
| `wp_knowledge_chat_disposable_email_domains` | `string[] $domains` → string[] | 10 common throwaway domains | E-mail domains refused on the consultation form. Extend it with your own list. |
| `wp_knowledge_chat_boilerplate_lines` | `string[] $lines` → string[] | built-in list | Lower-case lines (buttons, menu items, placeholders) dropped from page text when pages are synced. |

## Actions

| Action | Arguments | Fires when |
|---|---|---|
| `wp_knowledge_chat_backend_failure` | `string $reason, int $status` | A chat request failed because of the backend. `$reason` is `unreachable`, `unauthorized`, `rate_limited`, `http_error` or `invalid_response`; `$status` is the backend HTTP status (0 when unreachable). No message text or IP is passed. |
| `wp_knowledge_chat_sync_failure` | `int $post_id, string $reason` | An automatic knowledge-base update for a synced page failed. It is retried by cron. `$reason` is `unreachable` or `http_<status>`. |
| `wp_knowledge_chat_lead_mail_failed` | `string $reason` | A lead was stored but its notification e-mail could not be sent. `$reason` is always `mail_failed`; no personal data is passed. |

Example: alert on backend failures.

```php
add_action( 'wp_knowledge_chat_backend_failure', function ( $reason, $status ) {
    error_log( "wp-knowledge-chat backend failure: {$reason} ({$status})" );
}, 10, 2 );
```

## REST routes

Namespace `wp-knowledge-chat/v1`. Both routes are public (anonymous visitors), same-origin only, and send `Cache-Control: no-store, private`. Details in [api-contract.md](api-contract.md).

| Route | Purpose |
|---|---|
| `POST /wp-json/wp-knowledge-chat/v1/chat` | Ask a question; WordPress signs it and forwards it to the backend. |
| `POST /wp-json/wp-knowledge-chat/v1/lead` | Submit the consultation form. |

## Consultation form behaviour (widget)

The **Request Consultation** button appears under an assistant answer when:

1. the answer is not grounded (the assistant had no evidence), or
2. the visitor's question shows consultation intent (`CONSULT_INTENT_RE` in `chat-widget.js`: consult, schedule a call or meeting, price/cost/fee, proposal, contact the team… in all five languages), or
3. the answer points the visitor to the team (`CONSULT_INVITE_RE`: "contact our team", "hubungi tim kami", "문의해 주세요", "お問い合わせ", "联系我们"…).

In case 2 the form also opens by itself, once per page load, with the visitor's question already in *Consultation Inquiry*. The `consult` flag is stored with the message in `sessionStorage`, so the button survives a reload.

Form fields: name (required, ≤100), work e-mail (required, ≤254), company (≤150), job title (≤100), function (dropdown, see below), consultation inquiry (≤2000), and a hidden honeypot `website`.

Function keys (stored as the key, shown translated): `founder` (Owner / Founder), `executive` (C-level / Director), `bizdev` (Business Development / Strategy), `sales_marketing` (Sales & Marketing), `finance` (Finance / Investment), `operations` (Operations / Supply Chain), `hr` (Human Resources), `legal` (Legal / Compliance), `other` (Other). `Analytics::department_label()` returns the translated label.

## Data stored by the plugin

| Name | Kind | Contents | Removed on uninstall |
|---|---|---|---|
| `wp_knowledge_chat_settings` | option | settings above | yes |
| `wkc_metrics` | option | counts, 25 recent redacted question snippets, up to 50 content gaps, security event counters (`honeypot_caught`, `spam_leads`, `abuse_blocked`, `rate_limited`) | yes |
| `wkc_synced_pages`, `wkc_sync_pending` | options | pages synced to the backend; failed updates waiting for retry | yes |
| `wkc_leads` | option | legacy 0.2.0 lead storage, migrated to posts and then deleted | yes |
| `wkc_lead` | private post type | one post per consultation request (no UI, REST, query var or export) | yes, all posts |
| `_wkc_name`, `_wkc_email`, `_wkc_company`, `_wkc_job_title`, `_wkc_department`, `_wkc_message`, `_wkc_language`, `_wkc_fingerprint`, `_wkc_mail_status` | post meta on `wkc_lead` | the lead; `fingerprint` is an HMAC of e-mail + message used to drop resubmissions within 10 minutes; `mail_status` is `pending`, `sent`, `failed` or `migrated` | yes |
| `wkc_rl_*`, `wkc_lead_*`, `wkc_lead_all_*` | transients | rate-limit counters keyed by an HMAC of the IP (never the raw IP) | yes |
| `wkc_qc_*` | transients | cached grounded answers (see `wp_knowledge_chat_cache_ttl`) | yes |
| `wkc_health_*`, `wkc_sync_result_*`, `wkc_leads_notice_*` | transients | one-minute admin notices per user | yes |

Cron hooks: `wkc_retry_sync` (retries failed page updates) and `wkc_keep_warm_backend` (a signed `GET /api/health` every 4 minutes so a serverless backend stays warm). Both are unscheduled on deactivation.

The CSV export (**Analytics & Leads → Export CSV**) has the columns `created_at_utc, name, email, company, job_title, department, message, language, notification`. Cells that start with `=`, `+`, `-`, `@`, a tab or a carriage return are prefixed with `'` so spreadsheets do not run them as formulas.

## Widget configuration

The plugin prints one inline script, `window.wpKnowledgeChatConfig`, before `chat-widget.js`. It contains no secrets:

| Key | Meaning |
|---|---|
| `restUrl` | URL of the `/chat` route (the lead route is derived from it). |
| `language`, `languages` | Default language and the five supported codes. |
| `switcher`, `detectBrowser` | The two language settings. |
| `greetings`, `suggestions` | Per-language greeting and suggested questions. |
| `contactUrl`, `contactHosts`, `sourceHosts` | Contact link and the host allowlists the widget enforces again in the browser. |
| `maxLength` | Maximum question length (500). |

After loading, the widget exposes `window.wpKnowledgeChat` (its instance) and does nothing if `#wkc-root` already exists.

## Automatic updates

The plugin updates itself from GitHub Releases of `inpartnerhub/Plugin_WordPress` (Plugin Update Checker, branch `main`, release asset `wp-knowledge-chat-*.zip`). A release is published by CI when a `vX.Y.Z` tag is pushed. See [CONTRIBUTING.md → Releases](../CONTRIBUTING.md#releases).
