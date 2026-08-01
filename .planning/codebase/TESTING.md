# Testing Patterns

**Analysis Date:** 2026-07-07

## Summary: No Automated Test Suite Exists

This codebase has **no automated testing framework configured or in use**. There is no PHPUnit, Pest, Jest, Vitest, Mocha, or Playwright *test-spec* suite anywhere in the repository.

Evidence:
- `composer.json` has no `require-dev` section and no `phpunit/phpunit` (or any test framework) dependency — only the production dependency `stripe/stripe-php`.
- `package.json`'s `"test"` script is the npm scaffold default and explicitly non-functional:
  ```json
  "scripts": { "test": "echo \"Error: no test specified\" && exit 1" }
  ```
  Its only real dependency is `web-push` (used for push-notification sending, not testing).
- No `phpunit.xml`, `jest.config.*`, `vitest.config.*`, `playwright.config.*`, or `*.test.php` / `*.spec.js` / `*.test.js` files exist anywhere in the repo (verified via repo-wide search).
- No `tests/` directory exists.

## What Looks Like Testing But Isn't

**`.playwright-cli/` directory (repo root):** This is **not a test suite**. It is leftover output from an interactive Playwright MCP browser-automation tool used ad hoc during development/debugging sessions — it contains hundreds of timestamped `console-*.log`, `page-*.yml` (accessibility snapshots), and `traces/` (screenshot/network trace artifacts) files with no corresponding test spec files that produced them. There are no `.spec.ts`/`.test.ts` files driving these traces. Treat this directory as build/debug noise; it should arguably be gitignored (currently it is not — the `.gitignore` at the repo root does not exclude it).

**`output/` directory (repo root):** Also debug/manual-verification artifacts — PNG screenshots (`landing-desktop.png`, `campaigns-test.png`, `metrics-settle.png`, etc.), `.err.log`/`.log` files from manual verification runs (`go-live-check.log`, `php-auth-check.log`, `release-final.log`), and a nested `output/playwright/` with more ad hoc Playwright MCP session artifacts (including a `layout-check/` and `files-feature/` subfolder of accessibility-snapshot YAML files). These appear to be one-off manual QA sessions performed by an AI coding agent (naming like `go-live-check`, `release-final`, `dashboard-empty-priority.png`) rather than a repeatable, checked-in test suite. No script or config re-runs these.

**`api/billing_test_checkout.php`:** Despite the name, this is a **production internal-testing endpoint**, not an automated test. It's a live HTTP endpoint (`billing_require_post()`, real Stripe checkout session creation) gated by `access_user_has_internal_access($user)` so that internal/admin accounts can manually trigger a real Stripe test-mode checkout from the running app. It has no assertions, no test runner integration, and executes real billing logic — it is a manually-invoked debug tool, not part of a test suite.

**`storage/db.example.json`, `storage/*.example.json` (admins/smtp/stripe/supabase):** Example/template config files for local setup, not fixtures for a test harness — nothing in the codebase loads them as test fixtures programmatically except as a fallback source of admin emails in `api/auth.php` (`auth_admin_emails()` falls back to `admins.example.json` if `admins.json` is absent), which is a production fallback, not a test mock.

## Verification Method: Manual / Exploratory Only

Based on the evidence above, this project's quality assurance is entirely manual and exploratory:
1. Developers/agents run the app locally (XAMPP/PHP built-in server) and click through flows in a real browser.
2. Playwright MCP (an interactive browser-automation *tool*, not a test framework) is used ad hoc to drive the browser, take screenshots, and capture console/network logs during these manual sessions — the artifacts in `.playwright-cli/` and `output/` are the byproduct, not the test suite itself.
3. There is no CI configuration (no `.github/workflows/`, no `.gitlab-ci.yml`, no other CI config found) that would run any automated checks on push/PR.
4. `storage/backups/` and `storage/states/backups/` contain timestamped JSON snapshots of real user data taken by the app's own runtime backup logic (see `backupStateFile()` in `api/state.php`) — these are production data-safety backups, not test fixtures.

## Recommendations for Future Work (if introducing tests)

There is no existing pattern to follow, so any new test suite would be a **greenfield addition**, not an extension of existing conventions. Given the stack:

- **PHP (`api/*.php`):** Consider PHPUnit for the `*_store.php` modules (`users_store.php`, `states_store.php`, `waitlist_store.php`) since they expose pure(ish) functions (`xxx_store_find_by_*`, `xxx_store_backend()`) that could be unit-tested against a temp `storage/` directory. Endpoint files (`auth.php`, `state.php`, etc.) mix HTTP I/O with logic in one procedural file, which would need refactoring (extracting testable functions from the top-level script body) before they're easily unit-testable — currently the top-level code in every endpoint executes immediately on `require`, which makes them hard to `require` in a test context without side effects (headers already sent, `respond()` calling `exit`).
- **JavaScript (`assets/js2/**`):** Vitest or Jest with jsdom would fit the existing native-ESM, no-bundler style reasonably well (Vitest in particular needs no build step for plain ESM). `core/state.js`'s pure normalization functions (`normalizeBrandIds`, `normalizeBrandFields`, `normalizeCampaignBrandLinks`, `state_data_score`-equivalent scoring) are good first candidates since they're deterministic and side-effect-free given a `state` object.
- **E2E:** If continuing to use Playwright, convert the ad hoc MCP sessions into checked-in `*.spec.ts` files under a `tests/e2e/` directory with a `playwright.config.ts`, and stop committing `.playwright-cli/`/`output/` artifacts (add them to `.gitignore`).

## Coverage

**Requirements:** None enforced — no coverage tooling configured.

---

*Testing analysis: 2026-07-07*
