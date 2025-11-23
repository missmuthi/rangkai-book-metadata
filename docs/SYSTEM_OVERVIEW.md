# System Overview

Rangkai Book Metadata is a serverless web application that aggregates bibliographic metadata from three authoritative sources (Google Books, OpenLibrary, Library of Congress) into SLiMS-compatible catalog records. It runs entirely on Cloudflare's edge network using Workers, D1 database, and KV storage for intelligent caching and session management.

**Target Users:** Indonesian library catalogers and field agents who need fast, accurate metadata entry for physical books via ISBN/barcode scanning or manual title search.

---

## ✅ When to Read This Doc

- You're a **new developer** joining the project
- You need a **mental model** of what this system does and how it's structured
- You're writing **onboarding documentation** or explaining the project to stakeholders
- You're planning a **major refactor** and need to understand system boundaries

## 📌 Keep This Updated When…

- The **tech stack** changes (e.g., migrating from Cloudflare to Vercel)
- The **core user flow** changes (e.g., adding batch import via CSV)
- **External API integrations** are added or removed
- The **deployment platform** changes

---

## What Problem Does This Solve?

Library catalogers in Indonesia waste hours manually entering book metadata into SLiMS (Senayan Library Management System). They need to:

1. Look up books by ISBN or title across multiple sources
2. Find authoritative classifications (DDC, LCC) for proper shelving
3. Generate call numbers using Cutter-Sanborn system
4. Handle missing data gracefully (many Indonesian books lack complete metadata)
5. Batch-process large collections efficiently (scanner mode for field agents)

**Rangkai automates this workflow**, reducing metadata entry from 5-10 minutes per book to ~30 seconds.

---

## Core Concepts

### 1. Triple-Source Data Harvesting

We query **3 authoritative APIs in parallel**:

| Source | What We Get | Priority |
|--------|-------------|----------|
| **Google Books** | Title, authors, publisher, dates, covers, descriptions | Primary for basic metadata |
| **OpenLibrary** | DDC classifications, subjects, alternate titles | Exclusive source for DDC |
| **Library of Congress** | LCC call numbers (authoritative), LCCN, subjects | Authoritative for LCC |

**Key Insight:** No single source has complete data. We merge results using a "waterfall prioritization" strategy (see `DATA_MERGING_LOGIC.md`).

### 2. Serverless Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Browser   │────────▶│ Cloudflare Pages │────────▶│ External    │
│  (SvelteKit)│◀────────│    (Workers)     │◀────────│ APIs        │
└─────────────┘         └──────────────────┘         └─────────────┘
                               │      │
                               ▼      ▼
                        ┌──────┐  ┌──────┐
                        │  D1  │  │  KV  │
                        │  DB  │  │Cache │
                        └──────┘  └──────┘
```

- **SvelteKit Frontend:** Server-side rendering, forms, UI state
- **Cloudflare Workers:** API proxy, data merging, authentication
- **D1 Database:** User accounts, scan history (persistent)
- **KV Storage:** API response cache (24-hour TTL), session storage

**Why Serverless?** Zero server maintenance, auto-scaling, sub-100ms cache hits, global CDN distribution.

### 3. Scanner Mode (Field Agent Workflow)

Library staff scan barcodes with USB scanners or mobile cameras. The system:

1. **Debounces title input** (500ms) but processes ISBNs instantly
2. **Focuses input field** after each search (scanner-ready loop)
3. **Stores scan history** in D1 database (persistent across sessions)
4. **Enables batch export** to SLiMS CSV format

**Critical:** The input clearing + focus loop (`finally` block in `handleSearch`) must NEVER break, or scanning stops working.

### 4. Authentication & Multi-User Support

- **Better Auth** library handles OAuth (Google) + email/password
- Sessions stored in D1 with 30-day expiry
- User-scoped scan history (privacy compliance)
- Role-based access control (admin vs cataloger)

---

## Technology Stack

### Frontend

| Layer | Technology | Why We Chose It |
|-------|-----------|-----------------|
| **Framework** | SvelteKit 2 | SSR, file-based routing, form actions, edge compatibility |
| **Language** | TypeScript (strict mode) | Type safety, IDE autocomplete, refactoring confidence |
| **Styling** | Tailwind CSS | Rapid prototyping, design consistency, mobile-first |
| **State Management** | Svelte 5 Runes | Built-in reactivity, no external state library needed |

### Backend

| Layer | Technology | Why We Chose It |
|-------|-----------|-----------------|
| **Runtime** | Cloudflare Workers | Edge computing, auto-scaling, V8 isolates (fast cold starts) |
| **Database** | Cloudflare D1 (SQLite) | Serverless SQL, Kysely ORM, schema migrations |
| **Cache** | Cloudflare KV | Distributed key-value store, 24-hour TTL, <100ms reads |
| **Auth** | Better Auth | OAuth providers, session management, type-safe APIs |

### External APIs

| Service | Purpose | Rate Limits | Fallback Strategy |
|---------|---------|-------------|-------------------|
| **Google Books** | Primary metadata, covers | 1000 req/day (free tier) | Use cache + OpenLibrary fallback |
| **OpenLibrary** | DDC classifications | No official limit (be respectful) | 5-second timeout, fail gracefully |
| **Library of Congress** | LCC call numbers | No API key needed | 5-second timeout, fallback to OpenLibrary LCC |

---

## Key Modules & Directories

### `/src/lib` - Shared Libraries

| File/Folder | Responsibility | Critical? |
|------------|---------------|-----------|
| `api.ts` | External API calls (Google, OL, LoC), retry logic, caching | ⚠️ YES |
| `merge.ts` | Data merging logic (waterfall prioritization) | ⚠️ YES |
| `cutter.ts` | Cutter-Sanborn call number generation | ⚠️ YES |
| `export.ts` | SLiMS CSV/MARC XML export | ⚠️ YES |
| `auth-simple.ts` | Better Auth configuration | ⚠️ YES |
| `isbn-helpers.ts` | ISBN validation, normalization, extraction | Medium |
| `services/analytics.ts` | Telemetry, performance tracking | Low |
| `components/` | Reusable UI components (CameraScanner, etc.) | Medium |

### `/src/routes` - SvelteKit Pages & API Routes

| Route | Purpose | Auth Required? |
|-------|---------|----------------|
| `/` (homepage) | Main search interface | No |
| `/scan/mobile` | Mobile barcode scanner | No |
| `/dashboard` | User scan history, analytics | Yes |
| `/login` | OAuth login page | No |
| `/api/book/[isbn]` | Serverless metadata endpoint | No (public API) |
| `/api/auth/[...all]` | Better Auth endpoints | Varies |
| `/api/scan` | Save scan to D1 database | Yes |

### `/docs` - Documentation (You Are Here)

Centralized documentation for developers, not scattered in code comments.

---

## High-Level Data Flow

### Happy Path: ISBN Lookup

```
1. User scans barcode → Input field receives "9786235516981"
2. Frontend detects ISBN format → Calls `/api/book/9786235516981`
3. Worker checks KV cache → MISS (not cached)
4. Worker queries 3 APIs in parallel:
   ├─ Google Books API → Returns { title, authors, cover, publisher }
   ├─ OpenLibrary API → Returns { DDC: "510", subjects: [...] }
   └─ LoC API → Returns { LCC: "QA76.9.A25", LCCN: "2012345678" }
5. Worker merges data using waterfall logic → Single unified object
6. Worker stores result in KV (24-hour TTL)
7. Worker returns JSON → Frontend renders metadata card
8. User clicks "Add to SLiMS" → POST /api/scan (saves to D1)
```

### Degraded Mode: Single Source Available

If Google Books fails but OpenLibrary succeeds:
- System still returns partial data (no cover, but has DDC)
- UI shows trust badge: "⚠️ Limited Data - OpenLibrary Only"
- User can still export (with warnings about missing fields)

**Resilience Principle:** Always provide the best available data, never fail completely.

---

## Deployment Model

### Local Development

```bash
npm run dev  # Vite dev server on localhost:5173
```

- Uses `.env.local` for API keys
- No D1/KV (uses in-memory mocks or local dev bindings)
- Hot module reload (HMR) for instant feedback

### Production (Cloudflare Pages)

```bash
npm run build   # Creates .svelte-kit/cloudflare output
npm run deploy  # Wrangler pushes to Cloudflare
```

- **Domain:** `rangkai.pages.dev` (auto SSL, global CDN)
- **D1 Database:** `rangkai-scans` (production binding)
- **KV Namespace:** `BOOK_CACHE` (production binding)
- **Environment Variables:** Set via Cloudflare dashboard

**No traditional server** - everything runs on Cloudflare's edge.

---

## Known Limitations & TODOs

### Current Limitations

1. **Google Books API Quota:** 1000 requests/day (free tier)
   - **Mitigation:** KV cache reduces effective API calls by ~70%
   - **TODO:** Add paid tier support or secondary source fallback

2. **No Offline Support:** Requires internet for API calls
   - **TODO:** Service worker cache for previously-fetched books

3. **Scanner Mode Desktop-Only:** Camera scanning works on mobile, but UI optimized for desktop with USB scanners
   - **TODO:** Mobile-first scanner UI redesign

4. **No Batch Import:** Users can't upload CSV of ISBNs
   - **TODO:** Add `/batch-import` route with job queue

5. **Limited Error Monitoring:** Console logs only, no Sentry/LogRocket integration
   - **TODO:** Add error tracking service

### Tech Debt

- `api.ts` has retry logic that could be extracted to a separate `retry.ts` utility
- Some TypeScript types are duplicated between frontend and API routes
- Test coverage is ~45% (goal: 80%)

---

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| **First Load (Cold Cache)** | 1200-1800ms | Parallel API calls + data merge |
| **Cache Hit** | <100ms | KV lookup only |
| **Scanner Mode Loop** | <50ms | Input clear + focus time |
| **Bundle Size** | ~85KB (gzipped) | SvelteKit + Tailwind + minimal deps |
| **Lighthouse Score** | 95+ | Performance, Accessibility, SEO |

**Bottleneck:** External API response times (not under our control).

---

## Security Posture

### What We Protect Against

- **SSRF (Server-Side Request Forgery):** Image proxy whitelists `books.google.com` and `covers.openlibrary.org`
- **XSS (Cross-Site Scripting):** Svelte auto-escapes all user input
- **SQL Injection:** Kysely ORM with parameterized queries
- **Session Hijacking:** HttpOnly cookies, SameSite=Lax, 30-day expiry

### What We DON'T Protect Against (Yet)

- **Rate Limiting:** No brute-force protection on login
- **DDoS:** Cloudflare's default protection only (no custom rules)
- **Audit Logging:** User actions not logged (GDPR compliance TODO)

---

## Next Time You Change X, Update:

- **Add/remove external API** → Update this doc + `API_INTEGRATION_GUIDE.md` + `merge.ts`
- **Change deployment platform** → Update this doc + `DEPLOYMENT_GUIDE.md` + `wrangler.toml`
- **Add new user role** → Update this doc + `AUTHENTICATION_GUIDE.md` + `schema.sql`
- **Change caching strategy** → Update this doc + `api.ts` + performance benchmarks in `PERFORMANCE_ANALYSIS.md`

## Questions This Doc Should Answer But Doesn't Yet:

- How do we handle API key rotation without downtime?
- What's our disaster recovery plan if D1 database is corrupted?
- How do we migrate users from v1 to v2 schema?
- What's the long-term plan for offline mode?
- How do we handle GDPR data deletion requests?
