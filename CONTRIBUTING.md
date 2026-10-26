# Contributing

How to work on this project.

## Setup

See [README.md → Quick start](README.md#-quick-start-local-development) and [plugin/wp-knowledge-chat/tests/README.md](plugin/wp-knowledge-chat/tests/README.md). In short:

```bash
(cd backend && npm install)
(cd plugin/wp-knowledge-chat/tests && composer install && npm install && bin/setup-wp.sh)
scripts/test-all.sh
```

## Workflow

1. Branch from the latest `main`: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `release/<version>`.
2. Make the change, with tests for any behaviour change.
3. Run `scripts/test-all.sh`. All suites must pass.
   If you changed anything under `backend/src/` or `backend/data/`, also run `npm run build:vercel` in `backend/` and commit the regenerated `backend/api/*.js`; CI fails when they are stale.
4. Update the docs affected by the change (see the table below) and add an entry to `CHANGELOG.md` under *Unreleased*.
5. If you added or changed translatable PHP strings, update `languages/wp-knowledge-chat.pot` and the four `.po` files, compile the `.mo` files (`msgfmt -o x.mo x.po`) and regenerate the `.l10n.php` files (`wp i18n make-php languages/`). Widget strings live in the `STRINGS` object of `chat-widget.js`, one block per language.
6. Open a pull request describing what changed, why, and how it was tested. Merge only when CI is green.

Which docs to update:

| You changed | Update |
|---|---|
| A setting, hook, constant, stored option or post meta | [docs/developer-reference.md](docs/developer-reference.md), `readme.txt` (*Developer filters*) |
| A REST route, request field or error code | [docs/api-contract.md](docs/api-contract.md) |
| Something an administrator sees | [docs/admin-guide.md](docs/admin-guide.md) |
| A backend environment variable or script | [backend/README.md](backend/README.md), [.env.example](.env.example) |
| Personal data, limits or a security control | [docs/security.md](docs/security.md), the privacy section of `readme.txt` and the suggested privacy-policy text in `class-plugin.php` |
| Hosting or release steps | [docs/deployment.md](docs/deployment.md) |
| Knowledge-base content or rules | [docs/knowledge-base.md](docs/knowledge-base.md) |

Never deploy to production, or run tests against the live site, without the site owner's explicit approval.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add page targeting setting
fix: keep rate-limit window across minute boundary
docs: document LiteSpeed cache settings
test: cover invalid contact URLs
chore: bump typescript
```

## Coding standards

**PHP (plugin)**
- WordPress coding style: tabs, `array()` syntax, Yoda conditions, and docblocks on public methods.
- Everything lives in the `WP_Knowledge_Chat` namespace; files are named `includes/class-<name>.php`.
- Sanitise input on the way in and escape on the way out (`esc_html`, `esc_attr`, `esc_url`, `esc_textarea`). Check capabilities and nonces for every admin action.
- No secrets in options or frontend output.
- `vendor/bin/phpcs` (in `tests/`) must report 0 findings.
- Must work on PHP 8.1+ without deprecations: PHPUnit fails on any notice.

**JavaScript (widget)**
- Vanilla JS, no dependencies, no build step. Keep the syntax runnable in all current browsers.
- Never use `innerHTML`, `insertAdjacentHTML` or `document.write` for content (a test enforces this). Build DOM nodes with `textContent`.
- Links must go through `safeUrl()` (https plus an allowed host).

**CSS**
- Scope every selector under `#wkc-root`. Avoid `!important` except in the screen-reader-only helper.

**TypeScript (backend)**
- `strict` mode and ES modules, with `.js` extensions in imports.
- No new runtime dependencies without a documented reason.
- Never log message text, IP addresses, secrets or provider payloads.
- Validate all external input and return errors as `{ error: { code, message } }` without internal details.

## Knowledge-base changes

Content changes need approval from the Inpartner content owner. Follow [docs/knowledge-base.md](docs/knowledge-base.md):

1. Edit `backend/data/sources.json`.
2. Run `npm run kb:build` (fails if a required page cannot be built; the old `kb.json` is kept).
3. Review the `git diff` of `kb.json`.
4. Run `npm run kb:validate`, then `npm run eval:retrieval` and `node dist/eval/run-eval.js --mode=retrieval --dataset=eval/holdout.json`.

## Releases

Versions follow [Semantic Versioning](https://semver.org/): a new feature is a minor release (1.2.0), a fix or layout change a patch release (1.2.1). The version number also busts the browser cache for the widget's JS and CSS, so every change that ships to sites needs a release.

1. Branch `release/X.Y.Z` from the latest `main`.
2. Bump the version everywhere it appears:
   - `plugin/wp-knowledge-chat/wp-knowledge-chat.php`: the header `Version:` and `WP_KNOWLEDGE_CHAT_VERSION`;
   - `plugin/wp-knowledge-chat/readme.txt`: `Stable tag`;
   - `package.json`, `backend/package.json` and `backend/package-lock.json` (two places): `version`;
   - `README.md`: the release badge, the *Release Status* box and the *Verified Test Results* heading (and the test counts if they changed).
3. In `CHANGELOG.md`, add `## [X.Y.Z] - YYYY-MM-DD` under *Unreleased*, so the *Unreleased* entries become the release notes.
4. In `readme.txt`, add `= X.Y.Z =` entries to *Changelog* (plain language, for site administrators) and *Upgrade Notice* (what to do when updating).
5. Commit as `chore(release): bump version to X.Y.Z`, open a pull request, and merge it when CI is green.
6. Tag the merge commit on `main` and push the tag:
   ```bash
   git fetch origin
   git tag -a vX.Y.Z origin/main -m "vX.Y.Z — short title"
   git push origin refs/tags/vX.Y.Z
   ```
7. CI (`package-and-release`) builds `wp-knowledge-chat-X.Y.Z.zip` with its `.sha256` and publishes the GitHub Release. Sites then see the update in *Dashboard → Updates* (see [docs/deployment.md](docs/deployment.md#8-releasing-and-updating-the-plugin)).

Check the release page lists both files before announcing it. Never move or reuse a tag that was already pushed; release a new patch version instead.
