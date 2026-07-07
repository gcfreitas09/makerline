# Technology Stack

**Analysis Date:** 2026-07-07

## Languages

**Primary:**
- PHP (procedural style, no framework) - all backend logic in `api/*.php`
- JavaScript (vanilla, ES6+, no bundler/transpiler) - frontend logic in `assets/js/` (legacy/"servidor" set) and `assets/js2/` (active/refactored set, loaded by `app.html`)
- HTML - static entry pages served directly (`landing.html`, `app.html`, `admin.html`, `intelligence.html`, `landing-insights.html`, `reset.html`, `verify.html`, `index.html`)

**Secondary:**
- SQL - schema files in `sql/` (MySQL and Supabase/Postgres variants), no migration tool
- CSS - hand-written, no preprocessor (`assets/css/*.css`)

## Runtime

**Environment:**
- Apache + PHP via XAMPP (local dev path `C:\xampp2\htdocs\saas-ugc`), `.htaccess` present at repo root for `mod_rewrite`/`mod_headers`
- PHP requirement: `>=5.6.0` per `composer.lock` (stripe-php constraint); actual code uses modern PHP features (typed nullable coalescing `??`, `random_bytes`, `PDO`), so a current PHP 8.x runtime is expected in practice
- No `.env` file present in repo; configuration is file-based JSON under `storage/` with environment-variable fallbacks (see Configuration below)
- Node.js is present only for one dependency (`web-push`, see INTEGRATIONS.md) — there is no Node server/process in this app; `package.json` has no start script

**Package Manager:**
- PHP: Composer — `composer.json` / `composer.lock` present, vendor committed to repo (`vendor/`)
- JS: npm — `package.json` present, no lockfile committed (no `package-lock.json`/`yarn.lock` found), `node_modules/web-push` installed locally

## Frameworks

**Core:**
- None (no PHP framework — no Laravel/Symfony/Slim). Each `api/*.php` file is a standalone script acting as its own endpoint, included via direct HTTP requests (e.g. `api/auth.php`, `api/state.php`)
- Frontend: no SPA framework (no React/Vue). Plain DOM manipulation and hand-rolled state/render modules under `assets/js2/core/` (`state.js`, `renderers.js`, `actions.js`, `ui.js`)

**Testing:**
- None detected. No test runner configured; `package.json` test script is the npm default stub (`"echo \"Error: no test specified\" && exit 1"`). No PHPUnit config despite `phpunit` appearing as a dev-dependency of the vendored `stripe/stripe-php` package only (not used by this app)

**Build/Dev:**
- None. No bundler, no transpiler, no CSS preprocessor. JS/CSS are served as static files directly by Apache; `.htaccess` disables browser caching for `.js` files and app HTML pages to simplify iterative development
- Playwright CLI is used ad hoc for manual QA/screenshots (`.playwright-cli/` — traces, screenshots, console logs); this is tooling output, not part of the application

## Key Dependencies

**Critical:**
- `stripe/stripe-php` `^18.0` (installed `v18.2.0`) — Stripe SDK for subscription billing, checkout, customer portal, and webhook signature verification (`api/stripe.php`, `api/billing_checkout.php`, `api/billing_portal.php`, `api/stripe_webhook.php`)
- `phpmailer/src/*` — PHPMailer library vendored manually under `vendor/phpmailer/` (not declared in `composer.json`, has no `composer.lock` entry). **Not actually used**: `api/mailer.php` and `api/smtp_client.php` implement a hand-rolled SMTP client over raw `stream_socket_client`/`fsockopen`, so PHPMailer is dead code physically present in vendor
- `web-push` `^3.6.7` (npm) — VAPID/Web Push protocol library. Present in `node_modules` but **not wired into any PHP endpoint or frontend service worker yet** (no `sw.js`, no `pushManager` usage in app JS, no PHP endpoint calling it). Matches the current branch name `feat/web-push-notifications`, indicating this is an in-progress/unstarted integration

**Infrastructure:**
- `vendor/composer/ClassLoader.php` + PSR-4 autoloading (`vendor/autoload.php`) — standard Composer autoload, manually includes `vendor/phpmailer/src/*.php` via `autoload_classmap.php` even though phpmailer isn't a declared composer package

## Configuration

**Environment:**
- No `.env` support via a library (no `vlucas/phpdotenv` or similar). Each integration module reads config from a JSON file in `storage/` first (e.g. `storage/stripe.json`, `storage/supabase.json`, `storage/smtp.json`, `storage/db.json`), falling back to OS-level `getenv()` variables if the JSON file is absent (e.g. `UGC_STRIPE_SECRET_KEY`, `UGC_SUPABASE_URL`, `UGC_SMTP_HOST`, `UGC_DB_HOST`)
- Every integration ships an `*.example.json` template committed to the repo (`storage/db.example.json`, `storage/smtp.example.json`, `storage/stripe.example.json`, `storage/supabase.example.json`, `storage/admins.example.json`) documenting the expected shape; the real `storage/*.json` files (containing live-looking secrets) are also committed in this working tree — treat as sensitive, do not print contents in generated docs/PRs
- Admin allowlist: `storage/admins.json` (`{"emails": [...]}`), checked in `api/auth.php` (`auth_admin_emails()`)

**Build:**
- No build config files (no webpack/vite/rollup config, no `tsconfig.json`, no `.babelrc`)
- `.htaccess` acts as the only "build-adjacent" config: URL rewriting (SPA-style fallback to `landing.html`/`app.html`), no-cache headers for JS/HTML, and `noindex` headers for internal pages (`app`, `admin`, `intelligence`, `landing-insights`, `reset`, `verify`)

## Platform Requirements

**Development:**
- XAMPP (Apache + PHP + MySQL) on Windows, project served from `C:\xampp2\htdocs\saas-ugc`
- PHP `curl` extension expected (Supabase REST client falls back to `file_get_contents`/`allow_url_fopen` if cURL is unavailable — see `api/supabase_client.php`)
- PHP `pdo_mysql` extension for the optional MySQL backend (`api/db.php`), and `pdo_sqlite` for the waitlist SQLite store (`storage/waitlist.sqlite`, used by `api/waitlist_store.php`)
- Composer for PHP dependency management; npm only needed if/when the `web-push` integration is completed

**Production:**
- Shared/traditional PHP hosting (Apache + `mod_rewrite` + `mod_headers`), no containerization detected (no `Dockerfile`, no `docker-compose.yml`)
- Persistent storage is file-based JSON under `storage/` by default (`storage/users.json`, `storage/waitlist.json`, `storage/states/*.json` per user), with optional promotion to MySQL or Supabase/Postgres as the backing store — selected dynamically per-request by `users_store_backend()` in `api/users_store.php` (Supabase takes priority if configured and reachable, then MySQL, else JSON file fallback)

---

*Stack analysis: 2026-07-07*
