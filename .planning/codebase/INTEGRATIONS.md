# External Integrations

**Analysis Date:** 2026-07-07

## APIs & External Services

**Payments:**
- Stripe — subscription billing, checkout sessions, customer portal, and Stripe Connect for partner payouts
  - SDK/Client: `stripe/stripe-php` v18.2.0, initialized in `api/billing_common.php` (`billing_require_stripe_client()`) using API version pinned to `2026-02-25.clover` (see `UGC_STRIPE_API_VERSION` in `api/stripe.php`)
  - Config source: `storage/stripe.json` (fallback to `UGC_STRIPE_*` env vars), template at `storage/stripe.example.json`
  - Auth: `secret_key` (`sk_live_...`), optional `restricted_key`, `publishable_key` for client-side Stripe.js, `webhook_secret` (`whsec_...`) for signature verification
  - Endpoints implementing it: `api/billing_checkout.php` (creates Checkout Sessions), `api/billing_portal.php` (Customer Portal), `api/billing_status.php`, `api/billing_diagnostics.php`, `api/billing_test_checkout.php`, `api/stripe_webhook.php`
  - Stripe Connect: `partner_connect_accounts` map in `storage/stripe.json` associates partner usernames (e.g. `keilabragante`, `rickolavo`) with Stripe Connect account IDs, used for affiliate/partner commission payout tracking (`api/admin_partner_commissions.php`, `api/referrals.php`)

**Data Backend (dual REST/DB):**
- Supabase — used as a hosted Postgres + REST API backend, an alternative to local MySQL/JSON storage
  - SDK/Client: no official SDK; hand-rolled REST client in `api/supabase_client.php` using cURL (`CURLOPT_*`) with `file_get_contents` fallback, calling `{url}/rest/v1/{table}`
  - Config source: `storage/supabase.json` (fallback to `UGC_SUPABASE_*` env vars), template at `storage/supabase.example.json`
  - Auth: `service_key` sent as both `Authorization: Bearer` and `apikey` headers (service-role key — full read/write, bypasses RLS)
  - Tables referenced: `ugc_users`, `ugc_user_states`, `landing_pre_signups`, `partner_commissions` (names configurable per-key in config)
  - Used by: `api/users_store.php` (`users_store_backend()` picks Supabase first if enabled+reachable, else MySQL, else local JSON file), `api/states_store.php`, `api/referrals.php`, `api/waitlist_signup.php`

## Data Storage

**Databases:**
- MySQL (optional) — direct PDO connection, alternative backend to Supabase/JSON
  - Connection: `storage/db.json` (fallback `UGC_DB_*` env vars), template `storage/db.example.json`
  - Client: raw `PDO` (`mysql:host=...;dbname=...;charset=utf8mb4`), configured in `api/db.php`
  - Table: `ugc_users` (configurable via `table_users`)
- SQLite — dedicated local database for the marketing waitlist feature only
  - File: `storage/waitlist.sqlite`
  - Client: `PDO` with `sqlite:` DSN, in `api/waitlist_store.php`
  - Schema reference: `sql/landing_waitlist.sqlite.sql`
- Supabase/Postgres schema references (for the REST-backed tables above): `sql/ugc_users.supabase.sql`, `sql/ugc_user_states.supabase.sql`, `sql/partner_commissions.supabase.sql`; MySQL variant: `sql/ugc_users.mysql.sql`

**Primary/default storage — flat JSON files (no DB required to run):**
- `storage/users.json` — all user accounts (used when neither Supabase nor MySQL is configured/reachable)
- `storage/states/u_*.json` — one file per user, holding their app state (campaigns, deadlines, scripts, gamification progress); managed by `api/states_store.php` / `api/state.php`, with automatic timestamped backups written to `storage/states/backups/`
- `storage/waitlist.json`, `storage/landing_insights.json`, `storage/landing_insights_sessions.json`, `storage/email_log.json`, `storage/deleted_emails.json`, `storage/admins.json` — feature-specific flat-file stores
- `storage/backups/` — periodic full-file JSON snapshots (`users_YYYYMMDD_HHMMSS.json`, waitlist snapshots, tracker resets) written by admin/migration scripts (`api/admin_migrate_users.php`, `api/admin_migrate_states.php`)

**File Storage:**
- Local filesystem only, under `storage/`. No S3/cloud object storage integration detected. `storage/.htaccess` restricts direct web access to this directory.

**Caching:**
- None. No Redis/Memcached. `.htaccess` explicitly disables browser caching for JS and HTML app pages during development.

## Authentication & Identity

**Auth Provider:**
- Custom, self-hosted — no third-party auth provider (no Auth0/Firebase Auth/Clerk)
  - Implementation: `api/auth.php` handles signup/login; issues an opaque bearer-style session token via `bin2hex(random_bytes(24))`, stores only `hash('sha256', $token)` server-side (`sessionTokenHash` field on the user record) — the raw token is never persisted, only its hash
  - Password reset flow: `api/forgot.php` + `api/reset.php` (token-based, emailed via SMTP), `api/verify.php` for email verification
  - Admin authorization: allowlist of emails in `storage/admins.json` (`auth_admin_emails()` in `api/auth.php`), checked by `api/admin_*.php` endpoints
  - Referral/partner system: `api/referrals.php`, `api/referral_lookup.php`, `api/partner_redirect.php` — custom referral-code and partner-commission tracking, not a third-party affiliate platform

## Email

**Provider:** SMTP (any provider, e.g. Gmail SMTP shown in example config) — no transactional email API (no SendGrid/Postmark/SES)
  - Config source: `storage/smtp.json` (fallback `UGC_SMTP_*` env vars), template `storage/smtp.example.json`
  - Client: hand-rolled SMTP implementation over raw sockets in `api/smtp_client.php` (`stream_socket_client`, `stream_socket_enable_crypto` for TLS) — **does not use** the vendored PHPMailer library sitting unused in `vendor/phpmailer/`
  - Sending logic/templates: `api/mailer.php`
  - Delivery log: `storage/email_log.json`, viewable via `api/email_log.php`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry/Bugsnag). PHP errors are suppressed in production paths (`error_reporting(0)`, `ini_set('display_errors', '0')` in `api/auth.php` and similar entrypoints) and written to the default PHP `error_log` (present at `api/error_log`)

**Analytics/Tracking (custom, first-party):**
- `api/landing_track.php`, `api/landing_insights.php`, `api/landing_insights_store.php`, `api/landing_insights_access.php`, `api/landing_insights_auth.php`, `api/landing_insights_cleanup.php` — a custom-built landing-page analytics/insights system (session tracking, waitlist funnel), storing data in `storage/landing_insights*.json` and exposing a dashboard at `landing-insights.html`
- `api/admin_intelligence.php` + `intelligence.html` — an internal admin "intelligence" dashboard, reads from the same JSON/DB stores (not a third-party analytics SaaS)
- `assets/js/landing_tracker.js` / `assets/js/landing-insights.js` — client-side event collection posting to the above endpoints (self-hosted, no GA/Mixpanel/Segment detected)

**Logs:**
- File-based only: `api/error_log` (PHP errors), `storage/email_log.json` (email send history), `storage/backups/*` (state/data snapshots for recovery)

## CI/CD & Deployment

**Hosting:**
- Traditional PHP/Apache hosting implied by `.htaccess` usage and XAMPP local dev setup; no cloud-specific deployment config (no Vercel/Netlify/AWS config files) detected

**CI Pipeline:**
- None detected — no `.github/workflows/`, no other CI config in the repo

## Environment Configuration

**Required config (file-based, with env var fallback):**
- `storage/stripe.json` — Stripe secret/publishable/webhook keys, price/product IDs, partner Connect account map
- `storage/supabase.json` — Supabase URL + service-role key + table name overrides
- `storage/db.json` — MySQL host/credentials (optional alternative to Supabase)
- `storage/smtp.json` — SMTP host/credentials for transactional email
- `storage/admins.json` — list of admin email addresses

**Secrets location:**
- All secrets live in plain JSON files under `storage/`, which is `.htaccess`-protected from direct web access but **is committed to this git working tree with real-looking values** (e.g. `storage/stripe.json`, `storage/supabase.json`, `storage/smtp.json`). Treat these as sensitive — never print their contents in generated documentation, PRs, or logs. `*.example.json` counterparts are the safe, sanitized templates intended for onboarding/documentation.

## Webhooks & Callbacks

**Incoming:**
- `api/stripe_webhook.php` — Stripe webhook receiver, verifies `Stripe-Signature` header against `webhook_secret` via `\Stripe\Webhook::constructEvent()`. Handles: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`. On successful invoice payment, also triggers `referrals_record_commission_from_invoice()` to credit partner/affiliate commissions.

**Outgoing:**
- None detected (no outbound webhook dispatch to third parties). Partner/referral commission data is pushed to Supabase (`partner_commissions` table) rather than via webhook.

## In-Progress / Unwired Integration

- **Web Push (VAPID)** — `web-push` npm package (`^3.6.7`) is declared in `package.json` and installed in `node_modules/`, matching the current git branch `feat/web-push-notifications`. As of this analysis there is **no PHP endpoint, no service worker (`sw.js`), and no frontend `pushManager`/`Notification` wiring** consuming it — the integration is scaffolded but not implemented. Any future work should add: a PHP endpoint to store push subscriptions (likely alongside `storage/users.json` or a new `storage/push_subscriptions.json`/DB table), a `sw.js` service worker registered from `app.html`, and a Node-based (or PHP-via-shell) sender using the `web-push` library with VAPID keys.

---

*Integration audit: 2026-07-07*
