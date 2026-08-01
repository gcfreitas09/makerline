# Coding Conventions

**Analysis Date:** 2026-07-07

## Stack Context

This is a PHP 8-style procedural backend (no framework, no PSR-4 app namespace — only `vendor/` uses Composer autoloading for `stripe/stripe-php` and `phpmailer/phpmailer`) paired with a vanilla ES-modules JavaScript frontend (no build step, no bundler, no TypeScript). There are **two parallel frontend trees**: `assets/js/` (legacy) and `assets/js2/` (active). Always edit `assets/js2/**` and `assets/css/app2.css` — `app.html` loads `assets/js2/app.js` as `type="module"`. `assets/js/` is the older single-file (`app.js`) version kept for the legacy `index.html`/older flows and should be treated as read-mostly/reference unless explicitly asked to update both trees.

## Naming Patterns

**PHP files (`api/*.php`):**
- One file = one endpoint or one "store"/service module, named `snake_case.php` (e.g. `api/waitlist_signup.php`, `api/billing_checkout.php`, `api/users_store.php`).
- Files that back multiple endpoints (`billing_common.php`, `users_store.php`, `states_store.php`, `waitlist_store.php`) are included via `require_once __DIR__ . '/xxx.php'` at the top of the endpoint file.

**PHP functions:**
- Dominant pattern: `module_prefix_verb_noun()` snake_case, prefixed by the owning file/module — e.g. `billing_respond()`, `billing_require_post()`, `auth_public_user()`, `auth_normalize_instagram()`, `users_store_find_by_email()`, `states_store_upsert_by_user_id()`, `referrals_valid_code_or_null()`. This is a manual substitute for namespacing since there is no PSR-4 namespace for app code — **always prefix new functions with the file's module name** to avoid global collisions (all functions live in the global namespace).
- Older/smaller files (`api/state.php`) mix in bare camelCase helpers (`ensureDir()`, `safeUserIdForFile()`, `respond()`). Do not introduce more of this style in new files — prefer the `module_verb_noun` snake_case form used in `billing_common.php`, `auth.php`, `users_store.php`.
- Every endpoint file defines its own local `respond($status, $data)` (or reuses `billing_respond()` from `billing_common.php`) — there is no shared response helper across all files. When adding a new endpoint, either `require_once billing_common.php` and use `billing_respond()`, or define a local `respond()` following the exact same signature/behavior (see Error Handling below).

**PHP variables:** `camelCase` (`$userId`, `$sessionTokenHash`, `$stateFile`, `$safeUserId`). Booleans are prefixed contextually (`$isHashed`, `$okSupabase`, `$wantsRedirect`).

**PHP constants:** `SCREAMING_SNAKE_CASE` with a module prefix, defined via `const` at file top: `UGC_ADMINS_FILE_PATH`, `UGC_ADMINS_EXAMPLE_FILE_PATH` (`api/auth.php`).

**JavaScript files (`assets/js2/**`):**
- `camelCase.js` for feature modules, organized under `core/` (shared state/rendering/UI plumbing) and `features/<domain>/<concern>.js` (e.g. `features/campaigns/modal.js`, `features/campaigns/delete.js`, `features/scripts/flow.js`, `features/settings/account.js`).
- Each feature file typically exports paired `openXModal` / `closeXModal` / `initXFeature` functions consumed by `core/actions.js`, which is the central event-delegation hub (see Module Design below).

**JS functions/variables:** `camelCase` throughout. Arrow-function `const` style is dominant (`const doThing = () => { ... }`) over `function doThing() {}` declarations, especially in `assets/js2/`.

**JS constants:** `SCREAMING_SNAKE_CASE` for true module-level constants (`STORAGE_KEY`, `PREFS_KEY`, `REMOTE_SAVE_DEBOUNCE_MS`, `TOTAL_TRANSITIONS`).

**Storage keys (localStorage/sessionStorage):** `ugcQuest`-prefixed camelCase strings, e.g. `ugcQuestToken`, `ugcQuestUserId`, `ugcQuestSessionUserId`, `ugcQuestState:<userId>`, `ugcQuestPrefs:<userId>`. Always prefix any new persisted key with `ugcQuest` to avoid clashing with other scripts on the page.

## Code Style

**Formatting:** No `.eslintrc`, `.prettierrc`, or `phpcs`/`php-cs-fixer` config exists anywhere in the repo — there is no automated formatter or linter. Style consistency is maintained by convention/copy-paste from neighboring files only. When adding code, match the exact style of the file you're editing (indentation, quote style, brace placement) rather than introducing a new style.

**PHP indentation:** 4 spaces, Allman-ish (opening brace on same line as `function`/`if`), matches PSR-2-like formatting loosely but is not linted/enforced.

**JS indentation:** 2 spaces, single quotes for strings, semicolons used consistently, trailing commas in multi-line object/array literals are common in `assets/js2/`.

**PHP strict types:** Not declared (`declare(strict_types=1)` is absent). Loose/coercive comparisons are common; most values are explicitly cast (`(string)`, `(int)`, `(array)`) at the point of use rather than relying on type declarations.

**Comments:** Sparse. Portuguese-language inline comments explain *why*, not *what*, and appear at decision points with non-obvious business logic, e.g. in `api/state.php`:
```php
// Evita backup a cada sync (o front salva bem frequente). Faz no máx 1 por hora por usuário.
// Migração suave: se o state existe no arquivo, sobe pro Supabase na primeira chance.
```
and in `assets/js/core/actions.js`:
```js
// Quiz / onboarding actions
```
Do not add JSDoc/PHPDoc blocks — none exist in the codebase; keep comments as short inline notes only where logic is non-obvious.

**Language of user-facing strings and error messages:** Brazilian Portuguese, informal register (uses "Faz login de novo" not "Faça login novamente"). Keep all user-facing strings (`respond()` error messages, toasts, labels) in this same informal PT-BR voice. Internal code identifiers (function/variable names) are in English.

## Import Organization (JS)

**Order in `assets/js2/**` feature files:**
1. Core state/data imports first: `import { state, saveState, ... } from '../../core/state.js';` (or `'./state.js'` for files inside `core/`)
2. Core UI/render imports next: `import { renderAll } from '../../core/renderers.js?v=...';`
3. Sibling feature imports last.

**Cache-busting:** Imports of frequently-changed core files use a `?v=YYYYMMDDx` query-string suffix (e.g. `renderers.js?v=20260429d`, `app.js?v=20260628b` in `app.html`) to bust browser/CDN caches on deploy. When editing a core file that's imported this way, bump the version suffix at both the `<script>` tag in `app.html`/`index.html` and any internal `import ... from '...js?v=...'` references that point to it.

**No bundler/module resolution beyond native ESM** — all imports are relative paths resolved directly by the browser; there's no `node_modules` resolution for app code (only `web-push` in `package.json` is a real npm dependency, used server-side/tooling, not bundled into the frontend).

## Error Handling

**PHP — endpoint-level HTTP responses:**
- Every endpoint funnels all error/success output through a single `respond($status, $data)` (local per-file) or `billing_respond($status, $data)` (shared, `api/billing_common.php`) that sets `http_response_code()`, JSON headers, `echo json_encode(..., JSON_UNESCAPED_UNICODE)`, then `exit`. **Never `echo` JSON directly or return before calling `exit`** — the codebase relies on `exit` inside the responder to guarantee no double-output.
- Standard shape: `{"ok": true, ...}` on success, `{"error": "message"}` on failure, with the message in PT-BR aimed at the end user (see Language note above). Some endpoints add a `hint` key for operational debugging (e.g. `'hint' => 'Confira o banco (storage/db.json) ou a permissao de escrita do servidor.'` in `api/auth.php`).
- Auth/session failures consistently return **401** with message `'Sessão inválida. Faz login de novo.'` or `'Sessão expirada. Faz login de novo.'` — reuse these exact strings for consistency when adding new authenticated endpoints.
- Method guards are explicit and early: check `$_SERVER['REQUEST_METHOD']` first, `respond(405, ...)` if wrong (`billing_require_post()` centralizes this for billing endpoints).
- Validation is manual, sequential `if` blocks that `respond()` and `exit` immediately — no exception-based validation layer, no framework-level request validation.
- Fatal PHP errors are suppressed for user output: `api/auth.php` sets `ini_set('display_errors', '0'); error_reporting(0);` at the top so raw PHP errors/warnings never leak into the JSON response. Follow this pattern in any new endpoint that must guarantee clean JSON output.
- File/network I/O uses the `@` error-suppression operator liberally on best-effort operations (`@mkdir(...)`, `@copy(...)`, `@file_get_contents(...)`, `@unlink(...)`) combined with explicit follow-up checks (`is_dir()`, `=== false`) rather than try/catch — this codebase does not use PHP exceptions for control flow in the storage layer. `error_log()` usage is rare (2 occurrences repo-wide) — prefer returning a descriptive `error`/`warning` field in the JSON response over server-side logging.
- "Best-effort, never lose data" pattern: state-saving endpoints (`api/state.php`) prefer degrading gracefully (fallback from Supabase to local file, restoring from timestamped backups, skipping an empty-state overwrite via `'reason' => 'empty_state_protected'`) over hard-failing. When touching persistence code, preserve this fallback chain rather than making failures fatal.

**JavaScript — client-side:**
- `try { ... } catch (error) { ... }` wraps all `localStorage`/`sessionStorage` access because these can throw in private-browsing/quota-exceeded scenarios; the catch block is often empty (`catch (error) {}`) — this is intentional defensive code, not a mistake, and should be replicated for any new storage access.
- Network calls (`fetch`) follow a consistent pattern in `assets/js2/core/state.js` (`flushRemoteSave`):
```js
try {
  const res = await fetch('api/state.php', { method: 'POST', headers: {...}, body: JSON.stringify({...}) });
  if (!res.ok) {
    console.error('[Sync] Erro ao salvar estado:', res.status, res.statusText);
  } else {
    const data = await res.json().catch(() => null);
    if (data?.ok === true) { /* success */ } else { console.warn('[Sync] Resposta inesperada do servidor:', data); }
  }
} catch (error) {
  console.error('[Sync] Falha ao salvar estado no servidor:', error);
} finally {
  /* cleanup / retry scheduling */
}
```
Reuse this shape (check `res.ok`, safely parse JSON with `.catch(() => null)`, check `data?.ok`) for any new `fetch` call.
- Logging uses bracketed subsystem tags for `console.log`/`console.warn`/`console.error`, e.g. `[Sync]` in `state.js`. Prefix new debug logs the same way (`[FeatureName] message`) so they're greppable in browser devtools.
- No global error boundary/handler is registered (no `window.onerror`/`window.addEventListener('error', ...)`) — errors are handled locally at each call site.

## Function Design

**PHP:** Endpoint files are structured as: helper function definitions first (all in the global scope, no classes), followed by top-level procedural script logic (reading `$_SERVER`, `$body`, running validation `if`/`respond()` chains, then business logic) at the bottom of the same file. There is no MVC/controller class — the file itself *is* the controller.

**JS:** Small, single-purpose functions preferred; most exported functions are named for the exact UI action they perform (`openCampaignModal`, `closeCampaignModal`, `confirmFocusModal`). Event handling is centralized: `assets/js2/core/actions.js` has one `handleActionClick(event)` dispatcher that reads `event.target.closest('[data-action]')` and branches on `actionEl.dataset.action` string values, delegating to feature-module functions. **New interactive UI features should add a new `data-action="..."` value and a branch in this dispatcher**, not a separate ad-hoc event listener, unless the feature is fully self-contained (like `initAccountForm`, which attaches its own form-submit listener).

## Module Design (JS)

- ES modules (`import`/`export`) throughout `assets/js2/`; `assets/js/` (legacy) is also ES modules but slightly behind in feature parity (see diff notes — legacy lacks `localStorage` session fallback, `prospections` array, goal/alert settings fields present in `assets/js2`).
- `core/state.js` is the single source of truth for the in-memory `state` object, `saveState()`, and remote sync (`scheduleRemoteSave`/`flushRemoteSave`); feature modules import `state`/`saveState` from it rather than managing their own persistence.
- No barrel files (no `index.js` re-export aggregators) — every consumer imports directly from the specific file it needs.

## Module Design (PHP)

- No classes/OOP for application logic — pure functions plus procedural top-level script bodies. The only OOP in the codebase is third-party (`\Stripe\StripeClient`, `PHPMailer\PHPMailer\PHPMailer`) via Composer (`vendor/`).
- "Store" files (`users_store.php`, `states_store.php`, `waitlist_store.php`) abstract persistence behind `xxx_store_*()` functions and expose `xxx_store_backend()` (returns `'file' | 'supabase' | 'error'`) plus `xxx_store_last_error()` for the calling endpoint to branch on and surface warnings — follow this dual-backend (file-fallback + Supabase) pattern for any new persisted entity.

---

*Convention analysis: 2026-07-07*
