# Enterprise Migration Journal

## Migration Objective

Restructure the existing production-oriented Next.js application into a cleaner, scalable architecture while preserving current behavior, routes, database schema, authentication behavior, API contracts, PWA behavior, and business logic.

The migration prepares the project for a future monorepo or independently deployable frontend/backend split without regenerating the project or replacing the current technology stack.

## Current Architecture Summary

- Next.js App Router application with pages, layouts, and route handlers under `app/`.
- API route handlers live under `app/api/**/route.js`.
- UI and feature components live under `components/`.
- Mixed server, client, and shared modules currently live together under `lib/`.
- Client hooks live under `hooks/`.
- Zustand state lives under `store/`.
- Prisma schema, migrations, and seed script live under `prisma/`.
- PWA assets, service worker, icons, and manifest live under `public/`.

Important current boundaries:

- Server auth: `lib/auth.js`
- Client auth: `lib/auth-client.js`
- OTP abstraction: `lib/otp-provider.js`
- Firebase client SDK: `lib/firebase.js`
- Prisma client: `lib/prisma.js`
- IndexedDB client helpers: `lib/db.js`
- Client sync helpers: `lib/sync.js`

## Target Architecture

Initial target folder skeleton:

```text
lib/
  server/
    auth/
    db/
    services/
    uploads/
  client/
    auth/
    firebase/
    offline/
    sync/
  shared/
    validations/
    utils/
    serializers/
    constants/
```

Target boundary rules:

- Server-only modules must not be imported by client components.
- Client-only modules must keep browser-only code behind client boundaries.
- Shared modules must be runtime-safe for both server and browser.
- Frontend behavior should communicate with backend behavior through API routes.
- Prisma remains server-only.
- Better Auth remains the session/auth framework.
- Firebase remains only the current OTP provider, not a business-logic dependency.
- OTP behavior must continue through the provider abstraction.

## Migration Phases

### Phase 0 - Preparation

- Create target directory structure only.
- Create and maintain this migration journal.
- Do not move source files.
- Do not update imports.
- Do not change runtime behavior.

### Phase 1 - Server Module Migration

Planned small groups:

- Move Prisma client module into `lib/server/db/` with old-path compatibility re-export.
- Move server auth module into `lib/server/auth/` with old-path compatibility re-export.
- Move server services such as audit/catalog into `lib/server/services/` with old-path compatibility re-exports.
- Move upload provider helpers into `lib/server/uploads/` with old-path compatibility re-export.

### Phase 2 - Client Module Migration

Planned small groups:

- Move Better Auth client module into `lib/client/auth/` with old-path compatibility re-export.
- Move Firebase client SDK module into `lib/client/firebase/` with old-path compatibility re-export.
- Move IndexedDB helpers into `lib/client/offline/` with old-path compatibility re-export.
- Move sync helpers into `lib/client/sync/` with old-path compatibility re-export.

### Phase 3 - Shared Module Migration

Move only stable, low-risk shared utilities when imports are understood:

- Validation helpers
- Phone utilities
- API response helpers
- Serializers
- General utilities

### Phase 4 - Backend Separation Preparation

- Extract repeated route-handler logic into server services only when it reduces duplication.
- Preserve all route paths and response formats.
- Keep frontend calls routed through `/api/**`.

### Phase 5 - OTP Boundary Hardening

- Keep Firebase as the active OTP provider.
- Move provider-specific verification behind OTP/provider helpers when approved.
- Do not change login, registration, reset-password, or Better Auth behavior.

### Phase 6 - Verification and Cleanup

- Keep compatibility re-exports until every import has been updated and verified.
- Remove compatibility layers only after explicit approval.
- Do not delete previous migration journal entries.

## Completed Tasks

### 2026-07-22 - Phase 0 Preparation

- Phase status: completed.
- Date and time: 2026-07-22 10:03:28 +07:00.
- Git commit hash: pending user commit.
- Git commit message: pending user commit.
- Created target directory structure:
  - `lib/server/auth/`
  - `lib/server/db/`
  - `lib/server/services/`
  - `lib/server/uploads/`
  - `lib/client/auth/`
  - `lib/client/firebase/`
  - `lib/client/offline/`
  - `lib/client/sync/`
  - `lib/shared/validations/`
  - `lib/shared/utils/`
  - `lib/shared/serializers/`
  - `lib/shared/constants/`
- Created `docs/migration-plan.md`.
- Added `.gitkeep` files so Git can track the prepared empty target directories.
- No source files were moved.
- No imports were changed.
- No Prisma schema or migration files were modified.
- `app/api/auth/[...all]/route.js` was not modified.
- Verification performed:
  - `npm run lint` completed with 0 errors and 3 warnings.
  - `npm run build` was not run because it may implicitly read `.env`.
  - Development server verification was not run because it may implicitly read `.env`.
- Warnings encountered:
  - Existing lint warning in `app/(pos)/pos/reports/page.jsx`.
  - Existing lint warning in `app/(pos)/pos/settings/page.jsx`.
  - Existing lint warning in `components/pos/ProductCard.jsx`.
- Rollback notes:
  - Remove `docs/migration-plan.md` only if the migration journal should be discarded.
  - Remove `.gitkeep` files and empty target directories only if Phase 0 folder preparation should be undone.

### 2026-07-22 - Phase 1 Server DB: Prisma Module

- Phase status: completed, awaiting user approval before next migration step.
- Date and time: 2026-07-22 10:03:28 +07:00.
- Git commit hash: pending user commit.
- Git commit message: pending user commit.
- Scope:
  - Moved Prisma Client initialization from `lib/prisma.js` to `lib/server/db/prisma.js`.
  - Replaced `lib/prisma.js` with a compatibility re-export.
- Files changed:
  - `lib/server/db/prisma.js`
  - `lib/prisma.js`
  - `docs/migration-plan.md`
- Files intentionally not changed:
  - `prisma/schema.prisma`
  - `prisma/migrations/**`
  - `app/api/auth/[...all]/route.js`
  - Authentication modules
  - Firebase modules
  - OTP provider modules
- Import changes:
  - No existing imports were updated.
  - Existing imports from `@/lib/prisma` remain compatible through the old-path re-export.
- Compatibility re-export files created:
  - `lib/prisma.js`
- Verification results:
  - `npm run lint` passed with 0 errors and 3 warnings.
  - Initial `npm run lint` attempt timed out before reporting; rerun with a longer timeout completed successfully.
  - `npm run build` passed successfully.
  - Build confirmed `app/api/auth/[...all]` and all API/page routes still compile.
  - Development server started successfully with `npm run dev`.
  - `GET /api/health` returned 200.
  - `GET /api/auth/me` returned 401 for an unauthenticated request, which is expected.
  - `GET /login` returned 200.
  - `GET /admin` returned 307 redirect for an unauthenticated request, which is expected.
  - `GET /pos` returned 307 redirect for an unauthenticated request, which is expected.
  - `GET /client` returned 307 redirect for an unauthenticated request, which is expected.
  - `GET /api/products` returned 200.
  - Direct Prisma import from `lib/server/db/prisma.js` succeeded, but a live `SELECT 1` query could not reach the configured Neon database from this environment.
- Warnings encountered:
  - Existing lint warning in `app/(pos)/pos/reports/page.jsx`.
  - Existing lint warning in `app/(pos)/pos/settings/page.jsx`.
  - Existing lint warning in `components/pos/ProductCard.jsx`.
  - `npm run build` and `npm run dev` reported `Environments: .env`, meaning Next.js loaded environment configuration during verification as explicitly requested for this phase.
  - Direct Prisma query failed with database reachability error for the configured Neon host. This appears to be network/database connectivity, not a broken import, because build passed and `/api/products` exercised Prisma-backed code and returned 200 through existing fallback behavior.
  - Direct Node ESM import emitted a package warning because `package.json` does not specify `"type": "module"`. This warning existed as a consequence of direct Node verification and does not affect Next.js build/runtime.
- Rollback notes:
  - Restore Prisma Client initialization in `lib/prisma.js`.
  - Remove `lib/server/db/prisma.js` if no longer needed.
  - Keep or remove `lib/server/db/.gitkeep` depending on whether Phase 0 folder structure remains approved.

## Remaining Tasks

- Move server modules in small logical groups.
- Add compatibility re-export files during each move.
- Update imports only after compatibility is in place.
- Verify after each group.
- Move client modules in small logical groups.
- Move shared modules only after confirming they are runtime-safe.
- Harden the OTP provider boundary without changing auth behavior.
- Remove compatibility layers only after explicit approval.

## Files Moved

- `lib/prisma.js` implementation moved to `lib/server/db/prisma.js`.

## Import Changes

- No existing import call sites changed yet.
- `lib/prisma.js` now re-exports `prisma` from `lib/server/db/prisma.js`.

## Compatibility Re-export Files Created

- `lib/prisma.js`

## Risks Discovered

- `lib/` currently mixes server-only, client-only, and shared modules.
- Prisma and Better Auth must remain server-only.
- Some server components directly import auth or Prisma-backed helpers; this works now but is a future frontend/backend split risk.
- Firebase client SDK is correctly isolated from most business logic, but registration/reset flows still perform provider-specific token verification in API routes.
- PWA and offline sync depend on IndexedDB, service worker behavior, and background sync; those modules should be moved carefully.
- Build and dev-server verification may implicitly load `.env`; this requires explicit approval because `.env` must not be read or written by the assistant.

## Problems Encountered

- The codebase-memory MCP graph tools became unavailable during Phase 1 follow-up analysis, so read-only shell inspection was used as fallback.
- No Phase 0 implementation problems encountered.
- Git does not track empty directories, so `.gitkeep` files were added after approval.

## Rollback Instructions

For Phase 0:

1. Delete `docs/migration-plan.md` if the journal itself must be removed.
2. Delete the empty target directories if they remain empty:
   - `lib/server/`
   - `lib/client/`
   - `lib/shared/`
3. No source imports, runtime files, Prisma files, migrations, or API routes need rollback because none were changed.

For future phases:

1. Revert the specific migration commit.
2. Confirm old-path compatibility re-export files are restored if needed.
3. Run verification before proceeding.

## Verification Checklist

After each migration group:

- `npm run lint`
- `npm run build`
- Development server starts successfully
- Authentication works
- Registration works
- Phone OTP works
- Password reset works
- Better Auth still functions
- Prisma still connects correctly
- API routes still respond correctly
- Admin pages still load
- Cashier POS still loads
- Client storefront still loads
- Offline/PWA functionality remains unaffected

Verification note:

- Commands that build or start the app may implicitly load `.env`. They should only be run after explicit approval to perform verification that may read environment variables.

## Git Commit History

### Phase 0 - Preparation

- Commit not created yet.
- Recommended commit message: `chore: prepare migration folder structure`

### Phase 1 - Server DB Prisma Module

- Commit not created yet.
- Recommended commit message: `refactor: move prisma client to server db module`

### 2026-07-22 - Compatibility-First Boundary Restructure

- Phase status: completed for the prepared `lib/` boundary migration; compatibility cleanup remains intentionally deferred.
- Date and time: 2026-07-22 10:50:20 +07:00.
- Git commit hash: pending user commit.
- Git commit message: pending user commit.
- Scope: relocated existing implementations into server, client, and shared boundary folders while preserving original import paths through re-export shims.
- New implementation locations include:
  - `lib/server/auth/` for Better Auth and OTP provider modules.
  - `lib/server/db/` for Prisma and PostgreSQL modules.
  - `lib/server/services/` for audit, catalog, and business-event services.
  - `lib/server/uploads/` for Cloudinary helpers.
  - `lib/client/auth/`, `lib/client/firebase/`, `lib/client/offline/`, `lib/client/sync/`, and `lib/client/translations/` for browser-facing modules.
  - `lib/shared/validations/`, `lib/shared/utils/`, `lib/shared/serializers/`, and `lib/shared/constants/` for runtime-neutral modules.
- Compatibility re-export files retained at the original `lib/*.js` paths, including auth, OTP, Firebase, offline, sync, Prisma, PostgreSQL, translations, services, and shared helpers.
- Internal imports in moved implementations were updated to use the new boundary paths where applicable.
- Protected files were not modified: `prisma/schema.prisma`, `prisma/migrations/**`, and `app/api/auth/[...all]/route.js`.
- Verification results:
  - `npm run lint`: passed with 0 errors and the same 3 existing warnings.
  - `npm run build`: passed; all existing application and API routes compiled.
  - Development server smoke test: inconclusive; the bounded probe exceeded 90 seconds without returning, so no successful result is claimed for this step.
  - Static import scan: no stale moved-module references found for Prisma, OTP, fallback data, offline DB, site constants, translations, or PostgreSQL.
  - Authentication, registration, OTP, password reset, and live Prisma connectivity were not exercised end-to-end in this compressed step. Existing Phase 1 route checks remain recorded above.
- Warnings encountered:
  - Existing lint warnings in POS reports/settings and `components/pos/ProductCard.jsx`.
  - Next build reported that `.env` was loaded internally by Next.js; the file was not opened, read, or written by the assistant.
  - Direct live database connectivity remains environment-dependent as previously recorded.
- Rollback notes:
  - Revert this migration commit, or restore the original implementation bodies from the compatibility wrappers’ corresponding new locations.
  - Keep the old-path wrappers during rollback until all callers are confirmed.
  - Do not remove the new boundary directories or `.gitkeep` files if the prepared architecture is retained.

## Latest Migration File Summary

- Modified journal: `docs/migration-plan.md`.
- Modified compatibility paths: `lib/api-response.js`, `lib/audit.js`, `lib/auth-client.js`, `lib/auth.js`, `lib/business-events.js`, `lib/catalog.js`, `lib/cloudinary.js`, `lib/csv.js`, `lib/db.js`, `lib/fallback-data.js`, `lib/firebase.js`, `lib/offline-db.js`, `lib/otp-provider.js`, `lib/phone.js`, `lib/postgres.js`, `lib/prisma.js`, `lib/serializers.js`, `lib/site.js`, `lib/sync.js`, `lib/systems.js`, `lib/translations.js`, `lib/utils.js`, and `lib/validations.js`.
- Added implementation files under `lib/server/`, `lib/client/`, and `lib/shared/`, plus `.gitkeep` files in prepared empty directories.

## Verification-Only Update: Completed `lib/` Restructure

- Phase status: restructure verification in progress; no additional source migration authorized or performed.
- Date and time: 2026-07-22 11:05:43 +07:00.
- Git commit hash: pending user commit.
- Git commit message: pending user commit.

### Implementation Path Map

| Original implementation path | New implementation path | Original path status |
| --- | --- | --- |
| `lib/auth.js` | `lib/server/auth/auth.js` | Compatibility re-export |
| `lib/otp-provider.js` | `lib/server/auth/otp-provider.js` | Compatibility re-export |
| `lib/prisma.js` | `lib/server/db/prisma.js` | Compatibility re-export |
| `lib/postgres.js` | `lib/server/db/postgres.js` | Compatibility re-export |
| `lib/audit.js` | `lib/server/services/audit.js` | Compatibility re-export |
| `lib/catalog.js` | `lib/server/services/catalog.js` | Compatibility re-export |
| `lib/business-events.js` | `lib/server/services/business-events.js` | Compatibility re-export |
| `lib/cloudinary.js` | `lib/server/uploads/cloudinary.js` | Compatibility re-export |
| `lib/auth-client.js` | `lib/client/auth/auth-client.js` | Compatibility re-export |
| `lib/firebase.js` | `lib/client/firebase/firebase.js` | Compatibility re-export, including default export |
| `lib/db.js` | `lib/client/offline/db.js` | Compatibility re-export |
| `lib/offline-db.js` | `lib/client/offline/offline-db.js` | Compatibility re-export |
| `lib/sync.js` | `lib/client/sync/sync.js` | Compatibility re-export |
| `lib/translations.js` | `lib/client/translations/translations.js` | Compatibility re-export |
| `lib/validations.js` | `lib/shared/validations/validations.js` | Compatibility re-export |
| `lib/api-response.js` | `lib/shared/utils/api-response.js` | Compatibility re-export |
| `lib/utils.js` | `lib/shared/utils/utils.js` | Compatibility re-export |
| `lib/phone.js` | `lib/shared/utils/phone.js` | Compatibility re-export |
| `lib/csv.js` | `lib/shared/utils/csv.js` | Compatibility re-export |
| `lib/serializers.js` | `lib/shared/serializers/serializers.js` | Compatibility re-export |
| `lib/fallback-data.js` | `lib/shared/constants/fallback-data.js` | Compatibility re-export |
| `lib/site.js` | `lib/shared/constants/site.js` | Compatibility re-export |
| `lib/systems.js` | `lib/shared/constants/systems.js` | Compatibility re-export |

### Compatibility Files Created

Compatibility re-exports were retained at every original path listed above. Existing callers can continue importing from `@/lib/*`; compatibility files will not be removed during the migration without explicit approval.

### Import Changes

- Moved server auth now imports Prisma and the OTP provider from `lib/server/*`.
- Moved audit and catalog services now import Prisma from `lib/server/db/prisma`.
- Moved catalog now imports fallback data from `lib/shared/constants/fallback-data`.
- Moved sync now imports IndexedDB queue helpers from `lib/client/offline/db`.
- Moved fallback data now imports site constants from `lib/shared/constants/site`.
- Existing application and route-handler import paths were otherwise preserved through compatibility re-exports.

### Verification Record

- Production build: pending this verification run.
- Lint: pending this verification run.
- Development server startup: pending this verification run.
- Admin login: requires valid configured admin credentials and a live database; no credentials were supplied and `.env` was not read.
- Client login: requires a valid existing account and live database/session provider; not claimed without credentials.
- Phone OTP registration/login: requires Firebase client interaction plus the registration flow’s Firebase ID token, not only the numeric OTP code. Not claimed without completing that token exchange.
- Password reset OTP: requires the same Firebase ID token exchange and an existing account. Not claimed without completing the provider flow.
- POS pages: route/build verification pending; authenticated business data requires a live database.
- PWA/offline functionality: static/service-worker source verification pending; full browser offline testing requires an interactive browser session.

### Remaining Risks

- End-to-end authentication and OTP flows remain dependent on Firebase configuration, valid credentials, browser interaction, and database reachability.
- The current environment previously showed Neon database connectivity limits; API fallback responses do not prove every database operation works.
- Development-server startup requires a clean bounded process check; the prior probe timed out.
- Compatibility re-exports create temporary duplicate paths and should remain until all imports are intentionally migrated and verified.

### Current Migration Status

The `lib/` implementation boundary restructure is complete and documented. This step is verification-only. No further files will be moved until the verification report is reviewed and approved. Recommended next migration step, after approval: move one small server-only service group, beginning with a single low-coupling service such as `lib/audit.js`, while retaining its compatibility re-export and verifying all routes immediately afterward.

### 2026-07-22 - Firebase ID Token Handoff Verification Fix

- Phase status: authentication compatibility fix completed; no additional restructure performed.
- Date and time: 2026-07-22 11:52:34 +07:00.
- Git commit hash: pending user commit.
- Git commit message: pending user commit.
- Changed files:
  - `lib/client/firebase/firebase.js`: added a shared `getFirebaseIdToken` helper that validates the Firebase user and retrieves its ID token.
  - `lib/firebase.js`: preserved the original compatibility export and exposed the new helper.
  - `components/auth/register-form.js`: uses the shared helper after Firebase OTP confirmation.
  - `components/auth/forgot-password-flow.js`: uses the shared helper after Firebase OTP confirmation.
  - `components/public-auth-gate.js`: reads `?auth=register` and `?auth=forgot`, making the existing register/reset entry routes open the intended views.
- Protected files not modified: `prisma/schema.prisma`, `prisma/migrations/**`, and `app/api/auth/[...all]/route.js`.
- Verification:
  - `npm run lint`: passed with 0 errors and 3 existing warnings.
  - `npm run build`: passed; all existing routes compiled.
  - `/?auth=register`: returned 200 and rendered the registration view.
  - `/?auth=forgot`: returned 200 and rendered the password-reset view.
  - `/login`: returned 200.
  - Firebase OTP completion and authenticated session creation remain environment-dependent and were not falsely marked passed; they require browser reCAPTCHA/test-phone configuration and live database access.
- Rollback: restore the previous Firebase export/forms and remove the query-view initialization change. No database rollback is required.

### 2026-07-22 - Firebase API Key Verification

- Phase status: blocked on external Firebase configuration; no further authentication code changes made.
- Date and time: 2026-07-22 12:18:16 +07:00.
- Git commit hash: pending user commit.
- Git commit message: pending user commit.
- Playwright Chromium installation: completed successfully with elevated permission.
- Browser test result: the registration page loaded, but Firebase returned `auth/api-key-not-valid.-please-pass-a-valid-api-key.` before OTP entry.
- Direct Firebase API validation: the supplied key was tested against `identitytoolkit.googleapis.com` and Firebase returned `API_KEY_INVALID` / `API key not valid`.
- Code response: the temporary hardcoded fallback was removed; environment configuration remains authoritative. `.env` was not read or written.
- Required external fix: replace `NEXT_PUBLIC_FIREBASE_API_KEY` with the current Web API key from Firebase Console > Project settings > General > Your apps, ensure the Identity Toolkit API is enabled, then restart the Next.js dev server.
- Verification cannot proceed to OTP/session creation until Firebase accepts the key. The supplied numeric test code cannot be tested while Firebase initialization is rejected.

### 2026-07-26 - Firebase OTP With Better Auth Sessions

- Phase status: completed code migration; live Firebase verification remains dependent on valid Firebase configuration and database connectivity.
- Architecture decision: Firebase owns phone OTP and ID-token verification; Better Auth owns email/password credential sessions and cookies. Better Auth's `phoneNumber` plugin is no longer active.
- Changed authentication behavior:
  - Removed active Better Auth phone-plugin configuration from `lib/server/auth/auth.js`.
  - Removed active Better Auth phone client plugin from `lib/client/auth/auth-client.js`.
  - Added `phoneAuthEmail()` as a stable internal email identifier for phone-backed local accounts.
  - Registration provisions the phone account with that internal email, then creates the Better Auth session through `authClient.signIn.email()`.
  - Existing phone login provisions a missing internal email when needed, then signs in through Better Auth email/password APIs.
  - Password reset keeps the local password, internal email, and Better Auth credential account synchronized.
  - Updated the Firebase test page to verify Firebase OTP first, then test Better Auth session creation.
- Verification:
  - `npm run lint`: passed with 0 errors and 3 existing warnings.
  - `npm run build`: passed; all existing routes compiled.
  - Static reference scan: no active Better Auth phone-plugin or `signIn.phoneNumber` references remain.
  - Protected files were not modified: `prisma/schema.prisma`, `prisma/migrations/**`, and `app/api/auth/[...all]/route.js`.
  - Live route smoke testing was unavailable because no development server was listening at the time of the final check.
- Remaining blockers:
  - The supplied Firebase API key previously returned `API_KEY_INVALID`; it must be replaced in `.env` by the current Firebase Web API key. The assistant did not read or write `.env`.
  - Firebase OTP and the Better Auth session require a reachable Firebase project and PostgreSQL database.

### Verification Results

- Production build: passed. Next.js compiled successfully and generated all existing application, authentication, API, POS, client, manifest, and offline routes.
- Lint: passed with 0 errors and 3 pre-existing warnings:
  - Missing `loadReport` dependency in `app/(pos)/pos/reports/page.jsx`.
  - Native `<img>` warning in `app/(pos)/pos/settings/page.jsx`.
  - Native `<img>` warning in `components/pos/ProductCard.jsx`.
- Development server startup: an existing Next.js development server was already listening on port 3000. A clean second instance was prevented by the existing `.next/dev/lock`; the running server responded successfully, so startup was observed but a fresh restart was not independently verified.
- Admin login: admin login route/page availability verified through `/admin/login` build output and protected `/admin` returned the expected unauthenticated 307 redirect. Successful credential login was not claimed because no admin credentials were supplied and `.env` was not read.
- Client login: `/login` returned 200 and protected `/client` returned the expected unauthenticated 307 redirect. Successful credential login was not claimed because no client credentials were supplied.
- Phone OTP registration: not completed. The UI uses Firebase `signInWithPhoneNumber`, reCAPTCHA, and then requires a Firebase ID token for `/api/auth/register`; the supplied numeric code `666777` alone cannot complete the server registration request.
- Phone OTP login: not completed. Better Auth phone login requires an existing account/session flow and valid credentials; no successful authenticated session was created during this shell-based verification.
- Password reset OTP: not completed. The UI uses Firebase phone verification and the reset endpoint requires the resulting Firebase ID token plus an existing database account; the numeric code alone is insufficient.
- POS pages: all POS routes compiled; unauthenticated `/pos` returned the expected 307 redirect. Authenticated POS data behavior was not claimed without a live authenticated session.
- PWA/offline: `/manifest.webmanifest` and `/offline` returned 200; the build included the PWA route. Service-worker registration and IndexedDB/background-sync behavior require browser DevTools/offline interaction and were not fully exercised here.
- API smoke checks: `/api/health` returned 200, `/api/auth/me` returned expected 401 unauthenticated, and `/api/products` returned 200.
- Additional route checks: `/login` and `/test-phone-login` returned 200; `/admin/login`, `/register`, `/admin`, `/pos`, `/pos/new-sale`, and `/client` returned expected unauthenticated 307 redirects; `/manifest.webmanifest` and `/offline` returned 200.
- Auth contract checks: registration without a Firebase ID token returned expected 400; password reset without a Firebase ID token returned expected 400. These checks confirmed validation behavior only, not successful auth.
- Environment handling: Next.js internally reported `.env` during build/dev execution. The assistant did not open, read, or write `.env`.

### Verification Conclusion

The restructure passes static compilation, lint, route generation, and unauthenticated route smoke checks. Authenticated login, Firebase OTP, password reset, and browser offline behavior remain environment-dependent verification items rather than passed tests. No source files were moved or modified during this verification phase; only this journal was updated.
