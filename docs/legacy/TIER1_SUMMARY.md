# Tier 1 Refactoring Summary

## Current State Analysis

### Auth Stack

**Status**: ✅ Already well-structured

- **Active Stack**: Custom auth in `src/lib/auth-simple.ts` using `arctic` for Google OAuth
- **Helpers**: `src/lib/server/auth.ts` provides:
  - `getSession(event)` - get current session
  - `requireSession(event)` - require auth or redirect
  - `getUser(event)` - get user object
  - `requireUser(event)` - require user or redirect
  - `canAccessResource()` / `requireOwnership()` - authorization helpers
- **Hooks**: `src/hooks.server.ts` injects session into `event.locals`
- **Dependencies**: `arctic` (used), no `@auth/sveltekit` or `better-auth`

**Findings**:

- Auth layer is already centralized and well-designed
- All routes use helpers (e.g., dashboard uses `requireSession()`)
- No unused auth dependencies to remove

### Data Layer (D1 & KV)

**Status**: ✅ Already centralized

**D1 (`src/lib/server/db.ts`)**:

- User queries: `findUserByEmail()`, `findUserById()`
- Scan queries: `getUserScans()`, `getScanById()`, `createScan()`, `updateScanStatus()`, `deleteScan()`
- All properly scoped to `user_id`
- TypeScript types for `User`, `Scan`, `D1Database`

**KV (`src/lib/server/cache.ts`)**:

- Generic operations: `cacheGet()`, `cacheSet()`, `cacheDelete()`, `cacheHas()`
- Book cache: `getBookCache()`, `setBookCache()`, `deleteBookCache()`
- Rate limiting: `isRateLimited()`, `incrementRateLimit()`
- Clear key naming via `CacheKeys` object
- TTL constants in `CacheTTL`

**Findings**:

- Data layer is already excellent
- No direct `env.DB` or `env.BOOK_CACHE` usage in routes
- Dashboard already uses `getRawDb()` and `getUserScans()`

### Metadata Fetching

**Status**: ⚠️ Needs restructuring

**Current Structure**:

- `src/lib/api.ts` (443 lines) - `BookApiService` class with static methods
- `src/lib/merge.ts` - merging logic for 3-source waterfall
- `/api/openlibrary/+server.ts` - CORS proxy for OpenLibrary

**Issues**:

- API logic lives in `lib/` instead of `lib/server/metadata/`
- No clear separation between source fetchers and merge logic
- Routes may still do HTTP calls directly

### Routes

**Status**: ✅ Dashboard is thin, need to check scan route

**Dashboard** (`/dashboard/+page.server.ts`):

- Already uses `requireSession()`, `getRawDb()`, `getUserScans()`
- Business logic properly delegated to helpers
- This is the ideal pattern!

## Tier 1 Checklist

### 1. Auth Stack Clarity ✅ Mostly Done

- [x] Identify active auth stack (custom + arctic)
- [x] Central `src/lib/server/auth.ts` exists with helpers
- [x] Routes use auth helpers (verified dashboard)
- [ ] **TODO**: Verify all protected routes use helpers (scan, api routes)
- [ ] **TODO**: Add JSDoc comments to document auth flow in `auth.ts`

### 2. Clean Data Layer ✅ Already Done

- [x] `src/lib/server/db.ts` as D1 entrypoint
- [x] `src/lib/server/cache.ts` as KV entrypoint
- [x] TypeScript types for entities
- [x] No direct binding usage in routes

### 3. Metadata Engine Skeleton ⚠️ Primary Work Needed

- [ ] **TODO**: Create `src/lib/server/metadata/` folder
- [ ] **TODO**: Create `sources/google-books.ts` (extract from `api.ts`)
- [ ] **TODO**: Create `sources/openlibrary.ts` (extract from `api.ts`)
- [ ] **TODO**: Create `sources/loc.ts` (extract from `api.ts` if exists)
- [ ] **TODO**: Move `src/lib/merge.ts` to `src/lib/server/metadata/merge.ts`
- [ ] **TODO**: Create `src/lib/server/metadata/normalize.ts` (or combine with merge)
- [ ] **TODO**: Create `src/lib/server/metadata/index.ts` façade:
  - `fetchBookByIsbn(isbn: string)`
  - Re-export source types
- [ ] **TODO**: Refactor `/api/openlibrary` route to use metadata engine
- [ ] **TODO**: Update imports in existing code

### 4. Thin Routes

- [x] Dashboard uses helpers (already good)
- [ ] **TODO**: Check scan route (if it exists)
- [ ] **TODO**: Check `/api/book/[isbn]` route
- [ ] **TODO**: Ensure API routes call metadata engine, not raw HTTP

## Implementation Plan (Step by Step)

### Step 1: Document Current Auth (Small PR)

- Add comprehensive JSDoc to `src/lib/server/auth.ts`
- Create a simple `AUTH_FLOW.md` if needed
- Verify all protected routes use helpers

### Step 2: Create Metadata Engine Structure (Medium PR)

- Create folder structure
- Move and refactor source fetchers
- Create façade with minimal changes to behavior
- Update imports incrementally

### Step 3: Refactor Routes (Small PR per route)

- Update `/api/openlibrary` to use metadata engine
- Update any other routes that do direct HTTP calls
- Verify no behavior changes

## Success Criteria

- ✅ All routes use `getSession()`/`requireSession()` (no direct cookie access)
- ✅ All D1 queries go through `db.ts` helpers
- ✅ All KV operations go through `cache.ts` helpers
- ✅ All metadata fetching goes through `src/lib/server/metadata/` façade
- ✅ Routes are thin (5-20 lines of orchestration)
- ✅ TypeScript strict mode passes
- ✅ No observable behavior changes
