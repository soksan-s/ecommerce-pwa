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
- No source files were moved.
- No imports were changed.
- No Prisma schema or migration files were modified.
- `app/api/auth/[...all]/route.js` was not modified.
- Verification performed:
  - `npm run lint` completed with 0 errors and 3 warnings.
  - `npm run build` was not run because it may implicitly read `.env`.
  - Development server verification was not run because it may implicitly read `.env`.

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

No files moved yet.

## Import Changes

No imports changed yet.

## Compatibility Re-export Files Created

No compatibility re-export files created yet.

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
- Git does not track empty directories. The Phase 0 target directories exist in the working tree, but the current commit would only include `docs/migration-plan.md` unless placeholder files are explicitly approved.

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
