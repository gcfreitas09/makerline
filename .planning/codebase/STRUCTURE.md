# Codebase Structure

**Analysis Date:** 2026-07-07

## Directory Layout

```
saas-ugc/
├── api/                     # PHP backend — one file per HTTP endpoint + shared "store"/integration modules
├── assets/
│   ├── css/                 # Stylesheets (per-page, no preprocessor)
│   ├── fonts/                # Self-hosted webfont (SpaceGrotesk.ttf)
│   ├── img/                  # Static images/icons used across pages
│   ├── js/                   # LIVE for landing/intelligence/verify/reset pages (see note below)
│   │   ├── core/              # Shared state/render/actions/ui helpers for this tree
│   │   └── features/          # Per-feature UI modules for this tree
│   └── js2/                  # LIVE for app.html (the main SaaS product)
│       ├── core/               # Shared state/render/actions/ui helpers (+ dead *_v2.js files)
│       └── features/           # Per-feature UI modules (brands, campaigns, focus, onboarding, scripts, settings, tour)
├── sql/                     # Reference SQL/DDL for Supabase/MySQL/SQLite tables (not auto-applied)
├── storage/                 # Runtime data: JSON "database" files, per-user state, backups, secrets configs
│   ├── states/                # One JSON file per user = their full app state; states/backups/ = snapshots
│   └── backups/               # Timestamped snapshots of users.json/waitlist.json etc.
├── vendor/                  # Composer dependencies (Stripe SDK, PHPMailer) — committed, not gitignored
├── KeilaBragante_15/, KeilaBragante_30/, RickOlavo/   # Static partner/referral landing pages (one dir per partner, each with its own index.html)
├── reset/                   # Clean-URL alias target for reset.html (see .htaccess rewrite)
├── restore_real_tracker/    # One-off data-restore utility/script directory
├── .planning/                # GSD planning artifacts (this document lives here)
├── output/, .playwright-cli/ # Playwright test run artifacts (screenshots/traces/logs) — NOT part of the app, ignore
├── node_modules/            # JS tooling deps (Playwright, etc.) — dev-only, not shipped
├── admin.html                # Redirect stub → intelligence.html
├── index.html                 # Redirect stub → landing.html
├── app.html                   # Main SaaS application shell (entry point for logged-in users)
├── landing.html                # Marketing/landing page
├── intelligence.html           # Admin analytics dashboard
├── landing-insights.html       # Legacy/alternate analytics view (superseded by intelligence.html)
├── verify.html                  # Email verification page
├── reset.html                    # Password reset page
├── composer.json / composer.lock  # PHP dependency manifest (Stripe SDK)
├── package.json                    # Node dev-tooling manifest (Playwright etc.)
└── .htaccess                        # Apache rewrite rules, cache headers, clean URLs
```

## Directory Purposes

**`api/`:**
- Purpose: All server-side logic. No subfolders — flat namespace of PHP files.
- Contains: HTTP endpoint scripts (called directly from the front end, e.g. `api/state.php`) and shared library scripts (`require_once`d by endpoints, e.g. `api/users_store.php`). There is no naming convention that visually separates the two — check for `header('Content-Type: application/json...')` + a `respond()` function to identify an endpoint vs. a pure library file.
- Key files: `db.php` (optional MySQL config loader), `supabase.php`/`supabase_client.php` (Supabase REST integration), `users_store.php`, `states_store.php`, `waitlist_store.php` (JSON-file-backed data stores), `billing_common.php`, `stripe.php`, `stripe_webhook.php` (Stripe integration), `mailer.php`/`smtp_client.php` (email sending), `auth.php` (login/signup), `state.php` (per-user app-state sync).

**`assets/css/`:**
- Purpose: Page-specific and shared stylesheets, plain CSS (no Sass/Less/PostCSS build step).
- Contains: `app.css`/`app2.css` (app.html base styles — `app2.css` is the current one, loaded by `app.html`), `mobile.css` (responsive overrides for `app.html`), `landing.css` (landing.html), `intelligence.css` (intelligence.html), `landing-insights.css`.

**`assets/js/`:**
- Purpose: Front-end code for the **landing page, intelligence dashboard, and verify/reset flows** — a separate module graph from `assets/js2/`.
- Contains: `landing_tracker.js` (landing.html), `intelligence.js` + `intelligence-components.js` + `intelligence-utils.js` (intelligence.html), `landing-insights.js` (landing-insights.html), plus a `core/` and `features/` subtree left over from an earlier shared-codebase attempt with `app.html` — **most of `assets/js/core/` and `assets/js/features/` and `assets/js/app.js`/`app_v2.js`/`admin.js` are dead code**, not referenced by any current `.html` file. Verify with a grep for the exact filename in `*.html` before editing.

**`assets/js2/`:**
- Purpose: Front-end code for `app.html`, the main SaaS product. This is the tree to edit for any dashboard/campaigns/brands/finance/metrics/settings/billing work.
- Contains:
  - `core/state.js` — the single state object, localStorage cache, debounced remote sync to `api/state.php` (**live**)
  - `core/renderers.js` — DOM rendering for every section (**live**, 3300 lines)
  - `core/actions.js` — event wiring / mutation handlers (**live**, 2150 lines)
  - `core/ui.js` — page/section switching, notifications (**live**)
  - `core/scripts.js`, `core/gamification.js`, `core/customSelect.js` — supporting live utilities
  - `core/*_v2.js`, `core/renderers_servidor.js`, `app_v2.js`, `admin.js` — **dead code**, not imported anywhere; do not edit expecting effect
  - `features/{brands,campaigns,focus,onboarding,scripts,settings,tour}/` — one folder per business feature, each containing modal/delete/flow/history-style modules imported directly by `app.js`

**`storage/`:**
- Purpose: The application's primary datastore when no external DB is configured, plus config/secrets for optional integrations.
- Contains:
  - `users.json` — all user accounts (fallback when Supabase/MySQL not configured)
  - `states/{safeUserId}.json` — one file per user holding their entire app state (campaigns, brands, scripts, finance, settings, gamification); `states/backups/` holds timestamped snapshots written before overwrite
  - `waitlist.json` / `waitlist.sqlite` — pre-launch signups
  - `admins.json` — admin account list (separate from regular users)
  - `landing_insights*.json` — marketing analytics data
  - `email_log.json` — outbound email attempt log
  - `deleted_emails.json` — audit trail of deleted accounts (prevents re-signup abuse)
  - `*.example.json` (`stripe.example.json`, `supabase.example.json`, `smtp.example.json`, `db.example.json`, `admins.example.json`) — **committed templates**; the real `stripe.json`/`supabase.json`/`smtp.json`/`db.json` are runtime secrets and should never be read/quoted in analysis
  - `backups/` — timestamped full snapshots of `users.json`/`waitlist.json` taken by admin migration/restore scripts
  - `.htaccess` — blocks direct web access to this directory's contents
- Generated: Yes (most files are runtime-written by the API, not hand-authored)
- Committed: Mixed — `.example.json` templates and `.gitkeep` files are committed; actual data/secret files are present in this repo's history but should be treated as environment-specific and not edited as "source code."

**`sql/`:**
- Purpose: Reference schema definitions for the external datastores this app can use instead of/alongside JSON files.
- Contains: `ugc_users.mysql.sql`, `ugc_users.supabase.sql`, `ugc_user_states.supabase.sql`, `partner_commissions.supabase.sql`, `landing_waitlist.sqlite.sql`, `landing_pre_signups.supabase.sql`. These are not auto-applied by any migration tool — run manually against the target DB when provisioning.

**`vendor/`:**
- Purpose: Composer-managed PHP dependencies, committed directly into the repo (no CI install step assumed).
- Contains: `stripe/stripe-php` (billing SDK), `phpmailer/` (SMTP sending), `composer/` (autoloader).

**`KeilaBragante_15/`, `KeilaBragante_30/`, `RickOlavo/`:**
- Purpose: Static, self-contained partner/influencer landing pages (each just an `index.html`), used for referral/commission tracking links (see `api/partner_redirect.php`, `api/referral_lookup.php`).
- Naming: `{PartnerName}_{discountOrPlanId}/index.html` — one directory per partner campaign variant.

**`output/`, `.playwright-cli/`:**
- Purpose: Local Playwright test run artifacts — screenshots, DOM snapshots, network traces, console logs.
- Generated: Yes, entirely.
- Committed: Yes in current history, but **not part of the application** — ignore when mapping architecture or looking for source code.

## Key File Locations

**Entry Points:**
- `app.html`: Main SaaS application shell (logged-in users)
- `landing.html`: Public marketing page
- `intelligence.html`: Admin analytics dashboard
- `index.html`: Redirect stub → `landing.html`
- `admin.html`: Redirect stub → `intelligence.html`
- `verify.html` / `reset.html`: Email verification / password reset pages
- `api/stripe_webhook.php`: Stripe async event receiver

**Configuration:**
- `.htaccess`: Apache URL rewriting, cache headers, clean-URL routes (`/admin`, `/verify`, `/reset`, `/intelligence`, `/landing-insights`)
- `composer.json`: PHP dependencies (Stripe SDK)
- `package.json`: Node dev-tooling (Playwright)
- `storage/*.json` (non-example): runtime secrets/config for Stripe, Supabase, SMTP, MySQL — never commit real values, edit the `*.example.json` template to document new required keys

**Core Logic:**
- `api/users_store.php`: user CRUD, security audit log, password handling
- `api/states_store.php` + `api/state.php`: per-user app-state persistence
- `api/billing_common.php`, `api/stripe.php`, `api/stripe_webhook.php`: billing
- `assets/js2/core/state.js`: front-end state singleton + sync
- `assets/js2/core/renderers.js`: front-end DOM rendering
- `assets/js2/core/actions.js`: front-end event/mutation handling

**Testing:**
- No formal test suite directory found (no `tests/`, `*.test.js`, PHPUnit config). Verification is done manually via Playwright CLI sessions, whose artifacts land in `.playwright-cli/` and `output/playwright/` — these are exploratory run logs, not a repeatable automated test suite.

## Naming Conventions

**Files:**
- PHP API endpoints/libraries: `snake_case.php`, prefixed by domain when part of a family (`billing_checkout.php`, `billing_portal.php`, `billing_status.php`; `admin_delete_user.php`, `admin_migrate_users.php`, `admin_reset_password.php`).
- Front-end JS: `camelCase.js` or `kebab-not-used` — actually mostly `lowercase` or `snake_case` per historical inconsistency (`renderers.js`, `admin_tracker.js`, `customSelect.js` mixed within the same tree).
- `_v2` suffix: indicates an abandoned parallel rewrite, **not** "version 2 in production" — treat as dead unless confirmed imported.
- `js` vs `js2` top folder: indicates which HTML page's module graph the file belongs to, **not** old vs. new.

**Directories:**
- `features/{featureName}/` under both JS trees, each holding files named by role within that feature: `modal.js`, `delete.js`, `flow.js`, `history.js`, `quiz.js`.
- `core/` under both JS trees for cross-feature shared modules (state, rendering, actions, UI).
- `storage/{domain}` for data files; `storage/{domain}/backups/` for that domain's snapshots.

## Where to Add New Code

**New feature in the main app (app.html):**
- Front end: create `assets/js2/features/{featureName}/*.js`, import it from `assets/js2/app.js`, wire state via `assets/js2/core/state.js` and rendering via `assets/js2/core/renderers.js`.
- Back end: add a new `api/{feature}.php` endpoint (copy the `respond()`/header/token-check pattern from `api/state.php` or `api/account.php`); if it needs its own persistent collection, add `api/{feature}_store.php` following `api/users_store.php`'s pattern (JSON file constant + optional Supabase branch).
- Tests: none exist; if adding automated coverage, introduce a `tests/` directory and a runner — there is no existing convention to follow.

**New page (like a new landing variant or dashboard):**
- Add `{name}.html` at repo root, add a matching `assets/js/{name}.js` (or a new subfolder if it needs its own `core/features` split — follow `assets/js2` as the template for a full-app page, or the flat `assets/js/*.js` style for a simple page).
- Register a clean-URL rewrite in `.htaccess` if the page should be reachable without `.html`.

**New external integration (payment, email, analytics provider):**
- Add `api/{provider}.php` as a thin SDK wrapper (see `api/stripe.php` for the pattern), a `storage/{provider}.example.json` config template, and load it via a `{provider}_config()`-style function similar to `db.php`'s `load_db_config()`.

**Utilities shared across features:**
- Front end: `assets/js2/core/` (for app.html) or `assets/js/core/` if genuinely shared by landing/intelligence pages — verify it's actually imported before adding more files there, given the existing dead-code clutter.
- Back end: add functions to the relevant `*_store.php` or a new small `api/{concern}_common.php` (pattern: `billing_common.php`).

## Special Directories

**`storage/states/`:**
- Purpose: One JSON document per user = their entire app state (document-store pattern on the filesystem).
- Generated: Yes, written by `api/state.php` on every debounced save.
- Committed: Data files present in repo history are user data, not source — do not treat as reference code.

**`storage/backups/`, `storage/states/backups/`:**
- Purpose: Point-in-time snapshots taken automatically before destructive writes (e.g. before `admin_migrate_users.php` runs, or before each state overwrite).
- Generated: Yes, entirely.
- Committed: Present in repo but should be treated as disposable data, not documentation of intended structure.

**`vendor/`:**
- Purpose: Composer dependency payloads (Stripe SDK, PHPMailer, autoloader).
- Generated: Yes (via `composer install`), but currently committed directly rather than gitignored — do not hand-edit files here; change `composer.json` and reinstall instead.

**`.playwright-cli/`, `output/`:**
- Purpose: Ad hoc manual QA artifacts (screenshots, DOM snapshots `.yml`, console logs, trace files) accumulated across many exploratory sessions.
- Generated: Yes, entirely.
- Committed: Yes currently, but explicitly out of scope for architecture/structure understanding — treat as noise, not signal.

---

*Structure analysis: 2026-07-07*
