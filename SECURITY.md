# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 1.2.x | yes |
| 1.0.x – 1.1.x | critical security fixes only; please update to 1.2.x |
| < 1.0.0 | no |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Report privately through GitHub: **Security → Report a vulnerability** on this repository (private vulnerability reporting), or contact the repository owner directly. Include:

- affected component (WordPress plugin, backend, widget) and version or commit;
- steps to reproduce or a proof of concept;
- impact as you understand it.

You will receive an acknowledgement within 5 working days. Please allow time for a fix before any public disclosure.

## Scope

In scope:
- the WP Knowledge Chat plugin in `plugin/wp-knowledge-chat/`;
- the backend in `backend/`;
- leakage of secrets or of consultation requests (leads), cross-site scripting, authentication or authorisation bypass, unauthorised indexing, prompt-injection that leads to data exposure, and denial of service through cost amplification.

Out of scope:
- WordPress core, themes and other plugins;
- Google Gemini, OpenRouter and the hosting platforms (Vercel, Netlify) themselves;
- issues that need an already-compromised administrator account or server.

Never test against the production site (inpartnerglobal.com) without written permission from the site owner. Use a local install (`plugin/wp-knowledge-chat/tests/bin/setup-wp.sh`).

## If a secret leaks

| Secret | Where it lives | Rotation |
|---|---|---|
| `GEMINI_API_KEY` | backend environment | revoke in Google Cloud / AI Studio, create a new key, update the backend environment, restart |
| `OPENROUTER_API_KEY` | backend environment | revoke in OpenRouter dashboard, generate new key, update backend environment, restart |
| `CHAT_SHARED_SECRET` | backend environment + `WP_KNOWLEDGE_CHAT_SHARED_SECRET` in `wp-config.php` | generate with `npm run secret` and update **both** places together |
| `INDEX_API_TOKEN` | backend environment (+ `WP_KNOWLEDGE_CHAT_INDEX_API_TOKEN` and wherever `kb:push` runs) | generate a new value, update every place, restart |
| `WP_KNOWLEDGE_CHAT_GITHUB_TOKEN` (if used) | `wp-config.php` | revoke it on GitHub, create a read-only token, update `wp-config.php` |

Old values stop working immediately after the backend restarts (on Vercel/Netlify: after the redeploy that picks up the new environment variables).

## Security design

The threat model, trust boundaries and controls are documented in [docs/security.md](docs/security.md).
