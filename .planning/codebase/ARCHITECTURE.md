<!-- refreshed: 2026-07-07 -->
# Architecture

**Analysis Date:** 2026-07-07

## System Overview

```text
┌───────────────────────────────────────────────────────────────────────┐
│                          Static HTML Entry Pages                       │
│  landing.html   app.html   intelligence.html   admin.html(→redirect)  │
│  verify.html    reset.html   index.html(→redirect)                    │
└───────────────────────────┬─────────────────────────────────────────┘
                             │ <script type="module">
                             ▼
┌───────────────────────────────────────────────────────────────────────┐
│                 Front-end JS (vanilla ES modules, no build step)       │
│  assets/js2/*   — LIVE tree, powers app.html (the SaaS product)       │
│  assets/js/*    — LIVE tree, powers landing/intelligence/verify/reset │
│  (see "Two Parallel JS Trees" below — this is NOT a v1/v2 split)      │
└───────────────────────────┬─────────────────────────────────────────┘
                             │ fetch('api/xxx.php') — JSON over POST/GET
                             ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    PHP API — one file per endpoint                     │
│  `api/*.php` (procedural, no router, no framework)                    │
│  auth.php, state.php, account.php, billing_*.php, admin_*.php, ...    │
└───────────────────────────┬─────────────────────────────────────────┘
                             │ require_once shared "store" modules
                             ▼
┌───────────────────────────────────────────────────────────────────────┐
│              Shared PHP Modules (data access + integrations)          │
│  users_store.php, states_store.php, waitlist_store.php,               │
│  billing_common.php, supabase_client.php, db.php, stripe.php,         │
│  mailer.php / smtp_client.php                                         │
└───────────────────────────┬─────────────────────────────────────────┘
                             │
              ┌──────────────┼───────────────────────┐
              ▼                                       ▼
┌───────────────────────────────┐      ┌────────────────────────────────┐
│  Local JSON file storage       │      │  External services              │
│  `storage/*.json`              │      │  Supabase (Postgres REST)       │
│  `storage/states/*.json`       │      │  Stripe (billing)               │
│  (per-user state, users,       │      │  SMTP (email)                   │
│  waitlist, admins, sessions)   │      │  MySQL (optional, via db.php)   │
└───────────────────────────────┘      └────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Landing page | Marketing site, waitlist capture, tracking pixels | `landing.html`, `assets/js/landing_tracker.js` |
| Main app shell | The SaaS product (dashboard, campaigns, brands, finance, metrics, settings) | `app.html`, `assets/js2/app.js` |
| Intelligence dashboard | Admin/partner analytics view | `intelligence.html`, `assets/js/intelligence.js` |
| Admin redirect stub | Legacy route, now forwards to Intelligence | `admin.html` |
| Auth API | Login/signup/session token issuance | `api/auth.php` |
| State sync API | Save/load each user's full app state as JSON blob | `api/state.php`, `api/states_store.php` |
| Users data access | CRUD + password/security logic for user records | `api/users_store.php` |
| Billing | Stripe checkout/portal/webhook + plan snapshot | `api/billing_*.php`, `api/stripe.php`, `api/stripe_webhook.php` |
| Referrals/partners | Referral tracking and partner commission math | `api/referrals.php`, `api/referral_lookup.php`, `api/admin_partner_commissions.php`, `api/partner_redirect.php` |
| Waitlist/landing insights | Pre-launch signup capture and analytics | `api/waitlist_signup.php`, `api/waitlist_store.php`, `api/landing_insights*.php`, `api/landing_track.php` |
| Optional DB layer | MySQL config loader, used as alternative to JSON files | `api/db.php` |
| Optional remote data store | Supabase REST client used by users/states/waitlist stores | `api/supabase.php`, `api/supabase_client.php` |
| Email | SMTP sending (verification, reset, notifications) | `api/mailer.php`, `api/smtp_client.php` |
| Front-end state | In-memory app state object + localStorage cache + debounced remote save | `assets/js2/core/state.js` |
| Front-end rendering | DOM rendering for every page/section of the app | `assets/js2/core/renderers.js` |
| Front-end actions | Event wiring / user-triggered mutations | `assets/js2/core/actions.js` |
| Front-end features | Per-feature UI modules (modals, flows, deletions) | `assets/js2/features/**` |

## Pattern Overview

**Overall:** Server-rendered-free "fat static HTML + vanilla JS SPA-per-page" architecture backed by a procedural PHP API. There is no MVC framework, no router, no ORM, and no JS build/bundler — every `<script type="module">` is served as-is by Apache/PHP.

**Key Characteristics:**
- Each top-level page (`app.html`, `landing.html`, `intelligence.html`) is an independent mini-SPA; navigation between them is a full page load, not client-side routing.
- Inside `app.html`, section switching (dashboard/campaigns/brands/finance/metrics/settings/plans) IS client-side, driven by `data-section` attributes and `setActivePage()` in `assets/js2/core/ui.js`.
- The PHP "API" is a flat folder of single-purpose scripts (`api/*.php`), each handling its own method check, headers, and JSON response — there is no central dispatcher/front controller.
- Persistence is JSON-file-first (`storage/*.json`, `storage/states/*.json`) with optional pass-through to Supabase (Postgres REST) or MySQL when configured (`storage/supabase.json`, `storage/db.json` — both gitignored/example-only in repo).
- The main app's entire user state (campaigns, brands, scripts, settings, gamification, etc.) is stored as **one JSON document per user** (`storage/states/{safeUserId}.json`), not normalized relational rows — a document-store pattern implemented on top of the filesystem.
- Cache-busting is done manually via `?v=YYYYMMDDx` query strings on `<script>`/`<link>` tags in the HTML, not by a build tool.

## Two Parallel JS Trees — `assets/js` vs `assets/js2`

**This is not a "legacy vs current" split — both trees are live in production, serving different pages:**

| Tree | Used by | Purpose |
|------|---------|---------|
| `assets/js2/**` | `app.html` (script tags: `core/customSelect.js`, `app.js` as ES module) | The main SaaS application (dashboard, campaigns, brands, finance, metrics, settings, billing) |
| `assets/js/**` | `intelligence.html` (`intelligence.js`), `landing.html` (`landing_tracker.js`), `verify.html`/`reset.html` (styles only, minimal inline JS) | Admin analytics dashboard, marketing landing page, email verification/reset flows |

`assets/js/app.js`, `assets/js/app_v2.js`, and `assets/js/admin.js` exist on disk but are **not referenced by any `.html` file** — they are dead/orphaned copies left over from an earlier restructuring. Do not edit them expecting effect on the live app; if working on the main app, always edit `assets/js2/**`.

**A second, internal `_v2` split exists inside `assets/js2/core/` and is unrelated to the js/js2 split above:**

| File | Status |
|------|--------|
| `assets/js2/core/state.js`, `renderers.js`, `actions.js`, `ui.js`, `scripts.js`, `gamification.js` | **Live** — imported by `assets/js2/app.js` |
| `assets/js2/core/state_v2.js`, `renderers_v2.js`, `actions_v2.js`, `ui_v2.js`, `scripts_v2.js`, `gamification_v2.js`, `renderers_servidor.js` | **Dead code** — not imported anywhere in `assets/js2` or any `.html`. Left over from an abandoned rewrite. |
| `assets/js2/app_v2.js`, `assets/js2/admin.js` | **Dead code** — not referenced by any `.html` file. |

Mirror copies of the same dead files exist under `assets/js/` too (`app_v2.js`, `admin.js`, and no `_v2` core files there). When adding a feature to the live app, only touch `assets/js2/app.js` and the modules it imports (see Entry Points below); ignore any `*_v2.js` file and anything under `assets/js/` unless the task is specifically about the landing page, intelligence dashboard, or verify/reset flows.

## Layers

**Presentation (HTML shells):**
- Purpose: Provide the DOM skeleton, meta tags, CSS links, and the single `<script type="module">` bootstrap for each page.
- Location: repo root (`app.html`, `landing.html`, `intelligence.html`, `verify.html`, `reset.html`, `admin.html`, `index.html`)
- Depends on: `assets/css/*`, `assets/js*/*`
- Used by: browser directly (Apache serves static files; `.htaccess` rewrites clean URLs like `/admin` → `admin.html`)

**Front-end core (`assets/js2/core/`, `assets/js/`):**
- Purpose: State management, rendering, event wiring, gamification, UI helpers shared across all features of a given page.
- Contains: `state.js` (single source of truth object + localStorage + remote sync), `renderers.js` (DOM building for every section), `actions.js` (click/submit handlers), `ui.js` (page/section switching, notification permission), `gamification.js`, `scripts.js`, `customSelect.js`.
- Depends on: `api/*.php` via `fetch()`.
- Used by: `assets/js2/features/**` modules and `app.js`.

**Front-end features (`assets/js2/features/**`):**
- Purpose: Self-contained UI modules per business feature — modal forms, delete flows, settings panels, onboarding quiz, tour.
- Location: `assets/js2/features/{brands,campaigns,focus,onboarding,scripts,settings,tour}/`
- Depends on: `core/state.js` for reading/writing state, `core/renderers.js` for re-render triggers.
- Used by: imported directly by `assets/js2/app.js`.

**API layer (`api/*.php`):**
- Purpose: Stateless HTTP endpoints; each script is its own "controller" — validates method/input, calls store functions, emits JSON.
- Location: `api/`
- Contains: auth, state sync, billing (Stripe), admin operations, referrals/partners, waitlist, landing analytics, email.
- Depends on: shared store modules in the same folder (`require_once`).
- Used by: front-end `fetch()` calls, Stripe webhooks (`stripe_webhook.php`), and admin scripts.

**Data-access / integration modules (`api/*_store.php`, `api/supabase*.php`, `api/db.php`, `api/stripe.php`, `api/mailer.php`):**
- Purpose: Encapsulate persistence and third-party integration details so endpoint scripts stay thin.
- Pattern: each store module exposes plain functions (no classes) operating on a JSON file path constant, with an optional Supabase/MySQL fallback path baked into the same function.
- Used by: `api/*.php` endpoint scripts via `require_once`.

**Storage (`storage/`):**
- Purpose: Filesystem-backed persistence — the default/fallback datastore when no external DB is configured.
- Contains: `users.json`, `states/{userId}.json` (one file per user's full app state), `waitlist.json`/`waitlist.sqlite`, `admins.json`, `landing_insights*.json`, `email_log.json`, config files (`stripe.json`, `supabase.json`, `smtp.json`, `db.json` — all gitignored, `*.example.json` committed as templates), `backups/` (timestamped JSON snapshots written before destructive operations), `states/backups/` (per-user state snapshots).
- Not committed as real config: `storage/*.json` config files (stripe/supabase/smtp/db) are runtime secrets; only `*.example.json` templates are meant to be edited/committed.

## Data Flow

### Primary Request Path (loading the app)

1. Browser requests `app.html`; if no valid session in `sessionStorage`, JS redirects to `index.html` → `landing.html` (`app.html` inline check near top of file).
2. `assets/js2/app.js` imports `core/state.js`, which seeds `state` from `localStorage` (`ugcQuestState` style key) for instant paint.
3. `state.js` calls `enableRemoteSave()` / fetches `api/state.php` (`action: 'load'`, `token`) to pull the authoritative server copy for the logged-in user, then `replaceState()` merges it in.
4. `core/renderers.js` `renderAll()` builds the DOM for every `data-section` (dashboard, campaigns, brands, finance, metrics, settings, plans) from the in-memory `state` object.
5. `core/actions.js` `initActions()` wires up click/submit/change handlers across the whole page (delegated listeners), calling feature modules under `assets/js2/features/**` for modals and flows.
6. `core/ui.js` `setActivePage()` shows/hides the correct `<section data-section="...">` based on nav clicks / URL hash.

### State Save Flow (any mutation)

1. A feature module (e.g. `features/campaigns/modal.js`) mutates the shared `state` object directly and calls `saveState()`.
2. `saveState()` (`assets/js2/core/state.js`) updates `state.meta.updatedAt`, writes to `localStorage` immediately (synchronous, offline-safe), then calls `scheduleRemoteSave()`.
3. `scheduleRemoteSave()` debounces (timer) and calls `flushRemoteSave()`, which POSTs the entire `state` object to `api/state.php` with `{ action: 'save', token, state }`.
4. `api/state.php` validates the session token via `users_store.php`, writes the JSON blob to `storage/states/{safeUserId}.json`, and rotates a timestamped backup into `storage/states/backups/`.
5. Response `{ ok: true }`/error is logged to console only — the UI does not block on remote save (local-first).

### Auth Flow

1. `app.html`/`verify.html`/`reset.html` POST credentials to `api/auth.php` (`action`-based dispatch inside the single file: login/signup/etc.).
2. `auth.php` calls `users_store.php` functions to look up/create the user record (checks `storage/users.json` or Supabase depending on config).
3. On success, a session token is generated and returned; the front end stores it in `sessionStorage` (`ugcQuestToken`, `ugcQuestUserId`, `ugcQuestLoggedIn`).
4. Every subsequent state/billing/account API call includes this token; endpoint scripts re-validate it via `users_store.php` before touching data.

### Billing Flow

1. Front end (`assets/js2/features/settings/billing.js`) calls `api/billing_checkout.php` / `api/billing_status.php` / `api/billing_portal.php`.
2. These call `api/billing_common.php` (shared plan/snapshot logic) and `api/stripe.php` (Stripe SDK wrapper via `vendor/stripe/stripe-php`).
3. Stripe sends async events to `api/stripe_webhook.php`, which updates the user's billing fields via `users_store.php`.
4. Front end optimistically caches a pending plan (`applyOptimisticBillingPlanFromPending`) until the webhook-confirmed status is fetched.

**State Management:**
- Front end: one large mutable `state` object per page (`assets/js2/core/state.js` for `app.html`), no framework/reactivity — renderers are called explicitly after mutations.
- Back end: no server-side session store beyond the token check against `users.json`/Supabase; "session" state is really just token validation on each request.

## Key Abstractions

**"Store" modules (`api/*_store.php`):**
- Purpose: Represent a persistence-backed collection (users, states, waitlist) with functions like `*_load()`, `*_save()`, `*_find()`.
- Examples: `api/users_store.php`, `api/states_store.php`, `api/waitlist_store.php`.
- Pattern: procedural functions with a module-level file-path constant; some also branch to Supabase REST calls when `storage/supabase.json` is configured, making the JSON file a fallback/cache rather than the sole source of truth.

**Global mutable `$GLOBALS[...]`  state in PHP:**
- Purpose: Cache last error/info per request without passing objects around (e.g. `$GLOBALS['UGC_USERS_STORE_LAST_ERROR']`, `$GLOBALS['UGC_DB_LAST_INFO']`, `$GLOBALS['UGC_SUPABASE_LAST_HTTP']`).
- Examples: `api/db.php`, `api/users_store.php`, `api/supabase_client.php`.
- Pattern: set via a `_set_error`/`_set_last_info` function, read via a paired getter; scoped to a single PHP request lifetime (no persistence across requests).

**Front-end `state` singleton object:**
- Purpose: One JS object tree represents the entire logged-in user's app data (campaigns, brands, scripts, finance, settings, gamification, meta).
- Examples: `assets/js2/core/state.js` (`export const state = {...}`).
- Pattern: mutated in place by feature/action modules, persisted via `saveState()`, never replaced except on `replaceState()` (full reload/merge from server).

## Entry Points

**`app.html` → `assets/js2/app.js` (module):**
- Location: `app.html` line ~1448; imports at top of `assets/js2/app.js`
- Triggers: any browser load of `/app` or `app.html` with a valid `sessionStorage` session
- Responsibilities: session gate, state load, initial render, wiring of every feature module (onboarding, admin tracker, partner commissions, billing)

**`landing.html` → `assets/js/landing_tracker.js`:**
- Location: `landing.html` script tag near bottom
- Responsibilities: marketing page interactions, waitlist form submission (`api/waitlist_signup.php`), visit/event tracking (`api/landing_track.php`)

**`intelligence.html` → `assets/js/intelligence.js`:**
- Location: `intelligence.html` line 72
- Responsibilities: admin-facing analytics dashboard (partner/referral/landing insights), talks to `api/admin_intelligence.php`, `api/landing_insights*.php`

**`api/stripe_webhook.php`:**
- Location: `api/stripe_webhook.php`
- Triggers: Stripe's servers (async HTTP POST), not the front end
- Responsibilities: verify Stripe signature, update user billing state via `users_store.php`/`billing_common.php`

**`admin.html` / `index.html` (redirect stubs):**
- Location: repo root
- Triggers: legacy bookmarks / direct navigation
- Responsibilities: immediate client-side + meta-refresh redirect to `intelligence.html` and `landing.html` respectively — carry no other logic

## Architectural Constraints

- **Threading:** N/A — Apache + PHP-FPM/mod_php request-per-process model; each `api/*.php` request is independent, no shared in-process state between requests.
- **Global state:** Heavy use of PHP `$GLOBALS[...]` for last-error/last-info caching within a single request (see `api/db.php`, `api/users_store.php`, `api/supabase_client.php`). Front end uses one long-lived `state` object per page load (`assets/js2/core/state.js`) — effectively a global singleton mutated from many feature modules.
- **No router/front controller:** every `api/*.php` file is directly web-accessible; there is no central place enforcing auth/CORS/rate-limiting — each endpoint re-implements its own header/token checks.
- **Manual cache-busting:** script/link `?v=` query strings must be bumped by hand in the HTML file when a JS/CSS file changes, or browsers may serve stale cached assets (JS files are also served with `no-cache` headers per `.htaccess`, mitigating this for `.js` specifically).
- **Dead code coexists with live code:** `assets/js2/core/*_v2.js`, `assets/js2/app_v2.js`, `assets/js2/admin.js`, and the entire `assets/js/app.js`/`app_v2.js`/`admin.js` files are unreferenced by any HTML — see "Two Parallel JS Trees" above. Grep for the actual `<script>`/`import` chain before assuming a file is live.

## Anti-Patterns

### Orphaned rewrite branches left in place

**What happens:** A `_v2` suffixed copy of most `assets/js2/core/*.js` modules exists alongside the live file (e.g. `renderers.js` and `renderers_v2.js`), along with `app_v2.js` and `admin.js`, none of which are imported by any HTML or by the live module graph.
**Why it's wrong:** Anyone searching by filename similarity (e.g. grepping "renderers") can easily edit the wrong (dead) file and see no effect, wasting debugging time; it also inflates the codebase map and risks accidental imports later.
**Do this instead:** Before editing any `assets/js2/core/*.js` file, confirm it's imported from `assets/js2/app.js`'s import chain (see Entry Points). Treat any `*_v2.js`, `app_v2.js`, or `assets/js2/admin.js` as archived/dead unless a task explicitly says otherwise.

### Per-endpoint reimplementation of auth/session checks

**What happens:** Each `api/*.php` file independently re-validates the session token and re-sends CORS/cache headers rather than going through a shared middleware/front controller.
**Why it's wrong:** Security-relevant logic (token validation, header hardening) is duplicated dozens of times; a fix in one file (e.g. token expiry check) does not automatically propagate to the others, creating drift risk.
**Do this instead:** When adding a new endpoint, copy the token-validation pattern from a recently-touched, correct endpoint (e.g. `api/state.php` or `api/account.php`) rather than an older one, and consider extracting shared validation into a small `require_once`d helper if adding several new endpoints in one phase.

## Error Handling

**Strategy:** Defensive/silent-fail on the PHP side (many `@`-suppressed file operations, `error_reporting(0)` in some entry files like `api/state.php`); JSON error responses with HTTP status codes; front end logs to `console.error`/`console.warn` but rarely surfaces errors to the user beyond toast/inline messages.

**Patterns:**
- PHP endpoints use a local `respond($status, $data)` helper that sets `http_response_code`, echoes JSON, and calls `exit` — defined per-file (not shared), so duplicated across `api/*.php`.
- Store modules expose a `*_last_error()` getter backed by `$GLOBALS[...]` so callers can retrieve human-readable failure reasons after a `false`/`null` return.
- Front end wraps `fetch()` calls in `try/catch`, logs failures, and treats network/save failures as non-fatal for remote sync (local copy remains authoritative until next successful sync) — see `flushRemoteSave()` in `assets/js2/core/state.js`.

## Cross-Cutting Concerns

**Logging:** `console.log`/`console.warn`/`console.error` on the front end (Portuguese-language messages, e.g. `[Sync] Salvando estado no servidor...`); PHP side writes to `storage/email_log.json` (email attempts) and `storage/security_audit.log`-style append logs from `users_store.php`'s `users_store_security_audit()`. No centralized/structured logging framework.

**Validation:** Ad hoc per-endpoint in PHP (manual `trim()`/`isset()`/regex checks); no schema validation library. Front end does light validation in modal/form modules before calling `fetch()`.

**Authentication:** Token-based, issued by `api/auth.php`, stored client-side in `sessionStorage`, sent as a `token` field in JSON POST bodies (not an `Authorization` header) and re-validated per-request against `storage/users.json`/Supabase by each endpoint via `users_store.php`.

---

*Architecture analysis: 2026-07-07*
