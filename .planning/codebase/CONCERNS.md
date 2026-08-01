# Codebase Concerns

**Analysis Date:** 2026-07-07

## Security Considerations

**CRITICAL: Live secrets committed to git in `storage/*.json`:**
- Risk: `storage/stripe.json`, `storage/smtp.json`, and `storage/supabase.json` are tracked in git (confirmed via `git ls-files`) and are **not** listed in `.gitignore`. `.gitignore` only excludes `.aider*`, `.venv/`, `.playwright-cli/`, `output/`, and node artifacts — it has no rule for `storage/*.json`.
- Files and the credential fields they contain:
  - `storage/stripe.json`: `secret_key`, `webhook_secret`, `publishable_key`, price/product IDs
  - `storage/smtp.json`: `host`, `username`, `password` (mailbox password used for outbound email)
  - `storage/supabase.json`: `url`, `service_key` (a Supabase **service-role** key, which bypasses row-level security)
- Impact: Anyone with read access to the git history (including this repo if ever pushed to a public/shared remote, or any collaborator/CI system) can extract live Stripe secret keys, the SMTP mailbox password, and a Supabase service-role key. This allows creating fraudulent charges/refunds via Stripe, sending mail as the business, and reading/writing the entire Supabase database bypassing RLS.
- Files: `storage/stripe.json`, `storage/smtp.json`, `storage/supabase.json`, `.gitignore`
- Fix approach:
  1. Rotate all three credentials immediately (Stripe secret + webhook signing secret, SMTP app password, Supabase service key) since they must be treated as already compromised once committed.
  2. Add `storage/*.json` (excluding the `*.example.json` templates) to `.gitignore`.
  3. Remove the files from git history with `git filter-repo` / BFG (a plain `git rm` only stops future tracking; the secrets remain recoverable from history).
  4. Load these values from environment variables or a non-committed local file going forward — `api/db.php` and `api/mailer.php` already support `getenv()` fallbacks (`UGC_DB_*`, `UGC_SMTP_*`), so wiring `UGC_STRIPE_*` / `UGC_SUPABASE_*` env fallbacks the same way would let production run without a committed JSON secret file at all.

**`storage/admins.json` also committed:**
- Risk: Contains the list of admin email addresses (`api/auth.php` reads `UGC_ADMINS_FILE_PATH`) used for privileged local-fallback login and admin panel gating. Not as sensitive as the above, but still discloses which accounts have elevated access.
- Files: `storage/admins.json`
- Recommendation: Same treatment — gitignore and stop tracking; keep only `storage/admins.example.json` in version control.

**Local/dev admin-login bypass path (`api/auth.php`):**
- Risk: `auth_can_use_local_admin_fallback()` and `auth_is_trusted_access_email()` allow any request identified as "local" (`auth_is_local_request()`, matched by `REMOTE_ADDR`/`SERVER_ADDR` being loopback, or `HTTP_HOST` being `localhost`) to log in as an admin account **without a correct password**, and silently set whatever password was submitted. `HTTP_HOST` is client-supplied and easy to spoof unless the web server strictly validates vhost binding; if the app is ever deployed behind a reverse proxy that forwards `Host: localhost`, or if `REMOTE_ADDR`/`SERVER_ADDR` both resolve to loopback in a containerized/shared-hosting setup, this fallback could authenticate as an admin without credentials.
- Files: `api/auth.php:82-115, 357-368, 376-382, 389-393`
- Recommendation: Gate this fallback behind an explicit environment flag (e.g. `APP_ENV=local`) rather than inferring "local" from request headers, and log/alert whenever it fires.

**Plaintext and legacy-hash passwords tolerated indefinitely:**
- Risk: `api/auth.php` still supports legacy unhashed passwords (`$isHashed` check around line 373-387) and upgrades them to a hash only on next successful login. Accounts that never log in again keep a plaintext-equivalent stored password indefinitely. Also, `users_store_find_backup_password_for_user()` (referenced at `api/auth.php:349`) implies a secondary backup-password path whose storage location should be audited for the same plaintext risk.
- Files: `api/auth.php`, `api/users_store.php`
- Recommendation: Run a one-time migration to force-hash all remaining plaintext passwords, then remove the legacy branch.

**No visible CSRF protection or rate limiting on auth endpoints:**
- Risk: `api/auth.php`, `api/forgot.php`, and `api/reset.php` accept POST JSON bodies with no CSRF token and no evidence of throttling/lockout on repeated failed logins, enabling credential-stuffing / brute-force attacks against `action=login`.
- Files: `api/auth.php`, `api/forgot.php`, `api/reset.php`
- Recommendation: Add per-IP/per-account rate limiting (even a simple file/JSON-based counter given the flat-file architecture) and consider a CSRF token for state-changing admin actions in `admin.html`/`assets/js*/admin.js`.

**Error suppression hides operational failures (`api/auth.php:2-3`):**
- Risk: `ini_set('display_errors', '0'); error_reporting(0);` at the top of `api/auth.php` globally silences all PHP warnings/notices/deprecations for the request, which can mask silent data-corruption bugs in the flat-file writes (`@file_put_contents` calls throughout `api/users_store.php` already suppress errors with `@`). Combined, failures to persist a signup/login/session update may go completely unnoticed beyond the generic "Nao consegui salvar" message.
- Files: `api/auth.php:2-3`, `api/users_store.php` (multiple `@file_put_contents` / `@file_get_contents` calls)
- Recommendation: Log suppressed errors to `api/error_log` (already present but only 5 lines as of this audit) instead of fully silencing them.

## Tech Debt

**Flat-file JSON acting as the primary database:**
- Issue: `storage/users.json`, `storage/waitlist.json`, `storage/landing_insights*.json`, `storage/email_log.json`, and per-user `storage/states/*.json` are the system of record when no MySQL/Supabase backend is configured (`api/db.php`, `api/supabase.php` are optional overlays). `api/users_store.php` (1591 lines) implements full CRUD, session, referral, and billing-field logic directly against a JSON array read/rewritten wholesale on every write (`file_put_contents(..., json_encode(...), LOCK_EX)`).
- Files: `api/users_store.php`, `api/states_store.php`, `api/waitlist_store.php`, `storage/users.json`, `storage/states/*.json`
- Impact: Every write rewrites the entire users file; this does not scale past a small number of users/concurrent writers and risks lost updates under concurrent requests despite `LOCK_EX` (readers between lock acquisition and write can still see stale data, and there's no read-lock on the "read-modify-write" cycle across the many call sites in `users_store.php`). `storage/users.json` currently holds only 6 records, but the architecture has no defined migration trigger to move to `db.php`/`supabase.php` before it becomes a bottleneck.
- Fix approach: Treat `storage/db.json` (MySQL) or `storage/supabase.json` (Supabase) as required for any real production deployment; document the flat-file mode as dev-only. Add an explicit read-lock (`flock(LOCK_SH)`) around the read side of read-modify-write sequences in `users_store.php`.

**Duplicated `assets/js/` vs `assets/js2/` front-end trees:**
- Issue: There are two nearly-parallel JavaScript trees: `assets/js/` (36 files) and `assets/js2/` (34 files), including duplicate `core/state.js`, `core/actions.js`, `core/renderers*.js`, `features/**` modules, and even duplicate `app.js` / `app_v2.js` / `admin.js`. `diff` confirms the same-named files differ in content (not just copies), meaning fixes must be manually ported between trees or they silently drift.
- Files: `assets/js/**` vs `assets/js2/**` (mirrored directory structure)
- Which is live: `app.html` loads exclusively from `assets/js2/` (`assets/js2/core/customSelect.js`, `assets/js2/app.js`). `intelligence.html`, `landing-insights.html`, and `landing.html` load from `assets/js/` (`assets/js/intelligence.js`, `assets/js/landing-insights.js`, `assets/js/landing_tracker.js`). `admin.html` was not found to reference either `assets/js/` or `assets/js2/` admin.js in a simple grep — verify which (if any) admin bundle is actually wired before touching `admin.js` in either tree.
- Impact: Any bug fix or feature change to shared logic (auth flow, state management, campaign/script modals, settings) must be duplicated by hand across two trees or it only lands in one. This is a strong signal of an in-progress-but-abandoned rewrite (`js2` looks like the newer version powering `app.html`), and is a significant source of regressions.
- Fix approach: Confirm `assets/js2` is the actively maintained tree for the main app, delete or archive the unused `assets/js/core/*`, `assets/js/features/*`, `assets/js/app.js`, `assets/js/app_v2.js` files that have no live `<script>` reference, and keep only the files genuinely still loaded by `intelligence.html`/`landing.html`/`landing-insights.html` in `assets/js/` (or move those specific files out of the duplicated `core/`/`features/` structure into their own top-level scripts to make the split obvious).

**No package/build manifest despite `package.json` in repo:**
- Issue: A `package.json` exists at repo root but there is no evident bundler/build step wired to `app.html`/`index.html` — pages load raw `<script src="assets/js2/...">` tags with manual `?v=YYYYMMDDx` cache-busting query strings hand-edited per deploy (e.g. `app.js?v=20260628b`).
- Files: `package.json`, `app.html`, `index.html`
- Impact: Cache-busting relies on developers remembering to bump the version string on every edited file; forgetting it risks serving stale cached JS/CSS to returning users.
- Fix approach: Either commit to a real build step (bundler + content hashing) or adopt a single global asset version constant injected server-side, rather than per-file manual strings.

**Composer vendor directory and a git submodule-like Stripe path committed:**
- Issue: `vendor/` (18M) including `vendor/stripe/stripe-php` is committed directly to the repo alongside `composer.json`/`composer.lock`.
- Files: `vendor/**`, `composer.json`, `composer.lock`
- Impact: Inflates repo size and can drift from `composer.lock` if manually edited; typical PHP practice is to gitignore `vendor/` and run `composer install` on deploy (unless the hosting environment has no shell access, which may be the actual reason here on shared PHP hosting — worth confirming before changing).
- Fix approach: If deploys have shell/SSH access, gitignore `vendor/` and install via CI/deploy script. If deploying via FTP-only shared hosting with no composer, keep `vendor/` committed but document why in `README.md`.

## Repo Hygiene (bloat / history pollution)

**Historical commit `8424a2d` bulk-added hundreds of Playwright trace/screenshot artifacts:**
- Issue: A single commit (`8424a2d`, message truncated as `"new file: .continue/mcpServers/new-mcp-server.yaml ... new file: .playwright-cli/..."`) added hundreds of files under `.playwright-cli/traces/resources/*.jpeg`, `*.json`, `*.dat`, `*.css`, `*.woff2`, plus `.playwright-cli/console-*.log` and `.playwright-cli/page-*.yml`, and a large `output/` tree of screenshots (`output/playwright/**/*.png`) and log files (`output/*.err.log`, `output/*.log`).
- Current state: `.playwright-cli/` and `output/` are now listed in `.gitignore` and `git ls-files` confirms **zero** currently-tracked files under either directory — they were removed from tracking at some point after that commit. However, the objects remain permanently in git history/pack files.
- Impact: `du -sh .git` shows the repository's `.git` directory is **73MB**, almost entirely attributable to this historical blob bloat (working tree `.playwright-cli/` + `output/` on disk today is only ~3.8MB combined, confirming the bulk is in history, not the working copy). Every clone of this repo pays that 73MB cost even though none of those files exist in the current checkout. `storage/backups/` (1.5MB, dozens of timestamped `users_*.json` and `waitlist_*.json` snapshots) is a smaller but similar pattern of committed generated/runtime data.
- Fix approach: Rewrite history with `git filter-repo --path .playwright-cli --path output --invert-paths` (or BFG) to purge the blobs, force-push after coordinating with any collaborators, then run `git gc --aggressive --prune=now`. Do this in the same pass as the `storage/*.json` secret-purge (both require a history rewrite, so combine them into one operation). Also consider gitignoring/pruning `storage/backups/*.json` snapshots — they look like automatic point-in-time dumps generated by admin migration scripts (`api/admin_migrate_users.php`, `api/admin_migrate_states.php`) rather than source-controlled data.

**Duplicate/legacy top-level HTML entry points:**
- Issue: Both `reset.html` and `reset/index.html` exist, and both `verify.html` and (implicitly, per pattern) similar duplicate flows may exist for other flows. `KeilaBragante_15/index.html`, `KeilaBragante_30/index.html`, and `RickOlavo/index.html` look like personal/affiliate landing page variants committed as top-level directories rather than under a `partners/` or `affiliates/` namespace.
- Files: `reset.html`, `reset/index.html`, `KeilaBragante_15/index.html`, `KeilaBragante_30/index.html`, `RickOlavo/index.html`
- Recommendation: Confirm which of `reset.html` / `reset/index.html` is live (check `.htaccess` rewrite rules) and remove the unused one; move partner landing pages under a dedicated `partners/<slug>/` directory for clarity.

## Fragile Areas

**`api/users_store.php` (1591 lines) is a single god-file for user CRUD, sessions, referrals, and billing fields:**
- Files: `api/users_store.php`
- Why fragile: One file owns state-file discovery/backup (`users_store_list_state_files`, `users_store_user_from_state_file`), password fallback recovery, and JSON persistence, all operating on a shared in-memory array reloaded/rewritten per request. Any schema change to the user record (new billing field, new referral field) has to be threaded through this file plus the parallel key lists inside `api/auth.php`'s `$newUser` array (`api/auth.php:284-318`), creating two places that must stay in sync.
- Safe modification: When adding a new user field, update the `$newUser` array in `api/auth.php` and confirm `users_store_update_by_id()` in `api/users_store.php` doesn't strip unknown keys; add a regression check that a full round-trip signup → login preserves the new field.
- Test coverage: No test files were found anywhere in the repo (no `*.test.php`, no PHPUnit config in `composer.json`). All verification currently appears to be manual/Playwright-driven (per the volume of `.playwright-cli` trace artifacts), meaning there is no automated safety net for this file.

**Webhook and billing flows depend on `storage/stripe.json` state matching Stripe dashboard exactly:**
- Files: `api/stripe_webhook.php`, `api/billing_common.php`, `api/stripe.php`
- Why fragile: `stripe_webhook.php` reads `webhook_secret` from the same committed/potentially-stale `storage/stripe.json`. If secrets are rotated in the Stripe dashboard (which they should be, given the exposure above) without updating this file, webhook signature verification will fail closed (`SignatureVerificationException` → 400), silently breaking subscription status sync for all users until someone notices billing status isn't updating.
- Safe modification: After rotating Stripe keys, update `storage/stripe.json` (or the env-var equivalent) and immediately test with a live Stripe CLI webhook forward before relying on production traffic to reveal a misconfiguration.

## Test Coverage Gaps

**No automated tests anywhere in the repository:**
- What's not tested: All PHP business logic (auth, billing/Stripe webhook handling, referrals/commissions, mailer/SMTP sending, flat-file persistence) and all JavaScript front-end logic.
- Files: entire `api/` and `assets/js*` trees
- Risk: Regressions in security-sensitive flows (auth, billing webhook processing, password hashing/legacy fallback) can only be caught by manual QA or production incidents. The large volume of committed Playwright trace files suggests manual/agent-driven exploratory testing is the current practice, but no test scripts (e.g. `tests/*.spec.js`) were found alongside them.
- Priority: High — at minimum, add automated coverage for `api/auth.php` (login/signup/password-hash-upgrade paths) and `api/stripe_webhook.php` (signature verification, event-type routing) given they are the most security- and revenue-sensitive endpoints.

---

*Concerns audit: 2026-07-07*
