# Rangkai v3.0 Technical Audit (Principal Engineer Report)

## 1) Architecture Review

- **Routing / SSR boundaries**
  - API routes already thin and rely on metadata + cache layers (`/api/book/[isbn]` uses KV + metadata engine + waitUntil). However, route logic still mixes metrics and logging instead of delegating to services.
  - Auth route `/api/auth/[...all]` hand-codes path matching; split handlers (`/api/auth/google`, `/api/auth/callback/google`, `/api/auth/sign-out`) would be clearer and safer.
  - Public layouts lack explicit auth guards; session injection happens in `hooks.server.ts` but +layout/+page loads do not consistently call `requireSession`.
- **Auth flow**
  - Custom Arctic + D1 session layer is simple and Cloudflare-friendly, but state/cookie handling is duplicated in the route and lacks replay/CSRF rotation after callback.
  - Session cookie is `secure`/`httpOnly` but lacks `SameSite=strict` for dashboard-only UX; there is no refresh/rolling window and no device binding beyond user-agent string.
- **Metadata engine / API architecture**
  - Sources and merge logic live under `src/lib/server/metadata`, which is a solid separation. `fetchBookByIsbn` is the single façade, but routes/modules sometimes bypass domain modules for caching concerns.
  - Error surfaces from external providers bubble up as 404; more granular status per source would help UI banners.
- **D1 schema & queries**
  - Schema is minimal (scans + auth tables) with indexes on user_id/isbn, good for per-user access. No unique constraint on `(user_id, isbn, created_at)` so duplicates are possible; no migrations for status/history transitions.
  - DB helpers always throw if platform DB missing—good guard—but write path returns last-insert via SELECT rather than `last_insert_rowid()`.
- **Utilities/components**
  - ISBN helpers and merge utilities are comprehensive, but they live at `$lib` instead of `$modules/scan` which blurs infra vs domain boundaries.
  - Component composition is shallow; CameraScanner is standalone without context provider for scan/session state.

### Strengths

- Clear separation between metadata engine, cache, and DB helpers enables Cloudflare portability.
- KV caching with waitUntil plus D1 persistence matches Pages Functions constraints.
- Mobile scan page already optimized for single-purpose scanning with success flash and control bar.

### Weaknesses

- Auth routing and session handling live in a monolithic `[...all]` handler; no dedicated callback route, no nonce/state rotation after login, and errors leak detailed console logs.
- Missing SSR/client fences: CameraScanner imports `html5-qrcode` dynamically but UI page still runs fetches directly inside client component rather than via load/actions.
- Domain modules exist but are underused by routes; +page endpoints still perform orchestration themselves.

### Architecture Risks

- **Security:** state/cookie reuse and broad logging in auth callback; no CSRF on logout; no origin check on redirect URIs.
- **Reliability:** cache failures fall back gracefully, but metadata engine does not enforce per-source timeouts or retries, so long-tail hangs can delay responses.
- **Data quality:** duplicate scans possible; no de-duplication or idempotency keys when users rapidly scan.

### Recommended Refactors

- **Tier-0:** Extract `/api/auth/google` and `/api/auth/callback/google` into dedicated route files; centralize OAuth state validation + cookie lifecycle helper in `$lib/server/auth`.
- **Tier-1:** Introduce `src/lib/server/metadata/timeout.ts` to wrap provider calls with per-source timeouts/retries and annotate source status in responses; add DB unique index on `(user_id, isbn, created_at)` or add `uuid` scan ids.
- **Tier-2:** Move scanner orchestration into `$modules/scan` (`handleScanEvent`, `fetchAndPersistScan`) and shift `/scan/mobile` to call an action or load that persists scan + telemetry.

## 2) Code Quality Review

- **Svelte 5 runes:** Pages/components use `$state` but not `$effect`/`$derived`; CameraScanner manually manages lifecycle instead of reactive runes for visibility/wake-lock.
- **Typing:** Many helpers typed, but APIs return `any` JSON in places; auth callback uses untyped `fetch` response; KV helpers are generic yet callers often ignore nullability.
- **Error handling:** Mixed patterns—routes throw `error()` correctly, but modules return `{ success, error }` unions without discriminated types; CameraScanner swallow errors silently.
- **Structure:** Module aliases exist but routes still inline business logic; tests live in multiple places but lack coverage for scanner and OAuth flows.

**Quality Grade:** **B-** (typed core, but auth/UX gaps and inconsistent layering reduce safety).

**Fix First**

1. Harden OAuth flow (state rotation, CSRF on logout, split routes, typed Google profile fetch).
2. Add per-source timeout/retry with structured source status in `/api/book/[isbn]` responses.
3. Move scanner fetch/persist to a server action and add SSR guard for non-browser contexts.
4. Add idempotent scan writes and stricter typing for merge outputs.
5. Add lint/check enforcement in CI and clear logging policies (no PII in server logs).

## 3) Mobile Field Agent (Camera Scanner)

- **Crash points:** html5-qrcode init failures bubble as generic messages; resume/pause calls ignore rejection; no cleanup for pending `Html5Qrcode.start` promises on rapid navigation.
- **Performance bottlenecks:** Beep uses AudioContext per component (ok) but fetch path serially processes pending scans; no batching or back-pressure; wake lock errors logged each time visibility toggles.
- **Edge cases:** Switching cameras stops/starts without re-requesting permissions; autopause default may pause during scanning causing missed scans; debounce is time-based only (no tolerance for partial scans).
- **Production needs:** Add visibility/$effect guard to stop scanner on route destroy, ensure `pendingIsbn` queue drains with bounded length, add accessibility text for control bar buttons, and expose latency metrics (start→response) to D1/KV for monitoring.

## 4) Security & OAuth Audit

- **Findings:**
  - Callback trusts `state` cookie without rotating it post-login; code verifier stored for 10 minutes even after use; no replay nonce binding to session token.
  - Redirect path is fixed to `'/'`; no returnUrl validation and no origin allowlist for BETTER_AUTH_URL.
  - Session cookie lacks `SameSite=strict` and does not set `Secure`/`HttpOnly` attributes dynamically for dev/preview.
  - Sign-out is unauthenticated POST; no CSRF token/check, so cross-site POST could clear sessions.
  - Logging prints full OAuth URLs and user emails in console.

- **Hardening Checklist:**
  - Rotate and delete `state`/`code_verifier` cookies immediately after callback; add nonce->session binding persisted in D1.
  - Introduce `RETURN_TO` param validated against internal allowlist before redirecting.
  - Add CSRF token or double-submit cookie for sign-out; enforce `SameSite=strict` in prod.
  - Mask email in logs; wrap OAuth errors in structured audit events without secrets.
  - Limit callback to GET with explicit handler and per-env allowed origins.

## 5) API & Data Layer

- **API map:** `/api/book/[isbn]` (metadata fetch + KV), `/api/openlibrary` (direct search), `/api/scan` (persist), `/api/dashboard/stats` (analytics), `/api/auth/**` (OAuth), `/api/book/search` missing (title search handled client-side?).
- **Data flow:** Client → `/api/book/[isbn]` → cache (KV) → metadata engine (Google/OpenLibrary/LoC) → merge → response → optional cache write → modules persist via `/api/scan`.
- **Failure modes:** Provider timeouts bubble as 404; cache read/write errors logged but not surfaced; D1 failures convert to 500 in modules but routes sometimes return partial data without source flags.
- **Caching:** KV read/write already; add `ETag`/`If-None-Match` for idempotent responses; add per-user in-memory LRU for rapid scans; cache source health to skip unhealthy providers for 2–5 minutes.

## 6) Testing & QA

- **Current coverage:** Unit tests for merge/ISBN/cutter/export; integration tests for `/api/book`, `/api/scan`, `/api/dashboard`, and auth helpers. No tests for CameraScanner, mobile page, OAuth callback happy/sad paths, or KV/cache fallbacks.
- **High-priority gaps:**
  - Playwright smoke for `/scan/mobile` (camera mocked) and `/login` → OAuth redirect.
  - Vitest for auth `[...all]` with invalid state/code, expired cookies, CSRF on sign-out.
  - Tests for metadata engine timeouts/retries and source-status banners.
- **Coverage plan (90–95% meaningful):** Add mocked `html5-qrcode` unit tests, contract tests for merge outputs per provider, and API contract tests for cache headers + rate limiting.

## 7) Performance Review

- **Bottlenecks:** `/api/book` waits on full metadata fetch before returning; no per-source timeouts; bundle likely heavy from `html5-qrcode` unless dynamically imported (it is, but still shipped to scanner page only). No lazy-loading of dashboard charts/components observed.
- **Optimization opportunities:**
  - Return preliminary cached data immediately and stream updates via SSE or revalidation endpoint.
  - Add `maxDuration` per provider and fail-fast with partial data; annotate response times for UX telemetry.
  - Use route-level `prerender = false` fences to avoid SSR of scanner; add `loading='lazy'` for non-critical images (already used for cover).
  - Measure bundle size with `vite-bundle-visualizer`; code-split dashboard widgets.

## 8) UX & UI

- **Score:** B (mobile-first focus is good; accessibility and state cues need work).
- **Issues:**
  - Error toasts are plain text; no retry/scan-again CTA.
  - Control bar lacks ARIA labels/pressed states; wake-lock/permission states not surfaced.
  - No offline indicator or cached-history display for field use; success flash is brief but no haptic feedback.
  - Layout lacks skip links and keyboard affordances for scanner controls.

## 9) Release Maturity Score

- **Production Maturity Index:** **62/100**
  - Stability: 12/20 (core routes tested, but OAuth/scanner gaps)
  - Scalability: 10/20 (no rate limiting/circuit breakers)
  - Maintainability: 14/20 (module structure present but inconsistently used)
  - Readability: 14/20 (typed helpers, verbose logging, mixed patterns)
  - Dev onboarding: 12/20 (docs exist; missing single runbook)
  - Deployment safety: 10/20 (no automated CI gates, manual logs with PII)

## 10) Roadmap (v2.1 → v3.0)

- **Phase A (24–48h) – Immediate Fixes**
  - Hard-code split OAuth routes with state rotation + CSRF logout; add SameSite=strict cookies.
  - Add per-source timeout + status flags in metadata engine and surface in `/api/book` responses.
  - SSR guard scanner route and move scanning fetch to server action with D1 persistence.
- **Phase B (1–2 weeks) – Stability & Reliability**
  - Implement rate limiting + circuit breaker cache for providers; add idempotent scan keys.
  - Add KV-backed source health + fallback banners; enrich logs with request IDs sans PII.
  - Add Vitest suites for OAuth edge cases, metadata retries, cache headers; Playwright smoke for `/scan/mobile`.
- **Phase C (1–2 weeks) – Performance & UX Polish**
  - Code-split scanner/dashboard bundles; add LCP-focused skeletons and prefetch hints.
  - Add latency metrics from scanner to `/api/book` response headers and dashboard charts.
  - Improve accessibility: ARIA on controls, skip links, focus rings, offline indicator, haptics.
- **Phase D – New Features**
  - Mobile enhancements: offline queue for scans, optional manual ISBN keypad, SLiMS CSV export with validations.
  - Provider expansion toggle with feature flags; add LoC subject browsing and call-number suggestions.
- **Phase E – Production Hardening**
  - CI gates (lint/check/test/build), migration scripts for schema/index updates.
  - Secrets management via Pages env with rotate scripts; audit logging with redaction.
  - SLOs + alerts on latency/cache hit rate; blue/green deployments with canary.
