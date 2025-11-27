# Architecture

This document describes the technical architecture of Rangkai Book Metadata, focusing on system layers, data flow, component boundaries, and key design decisions. It's intended for developers who need to understand how everything fits together before making structural changes.

**TL;DR:** A serverless SvelteKit app running on Cloudflare Workers that aggregates book metadata from 3 external APIs using parallel fetching, intelligent caching, and waterfall data merging.

---

## ✅ When to Read This Doc

- You're planning a **major refactor** (e.g., switching from Cloudflare to Vercel)
- You need to **add a new external API** integration
- You're **debugging performance issues** and need to understand bottlenecks
- You're **onboarding senior developers** who need the full technical picture
- You're writing **ADRs (Architecture Decision Records)** for a change

## 📌 Keep This Updated When…

- **Core architecture changes** (e.g., switching from D1 to PostgreSQL)
- **New layers or services** are added (e.g., background job queue)
- **Data flow patterns** change (e.g., moving from pull to push model)
- **Third-party integrations** are added/removed

---

## System Layers

Rangkai follows a **3-tier serverless architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  (SvelteKit SSR + Client-Side Hydration)                    │
│                                                              │
│  • Server-rendered HTML (SEO, fast FCP)                     │
│  • Progressive enhancement (works without JS)               │
│  • Svelte 5 runes for reactive state                        │
│  • Tailwind for styling                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/JSON
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│  (Cloudflare Workers - Edge Runtime)                        │
│                                                              │
│  • API Routes (/api/book, /api/scan, etc.)                  │
│  • Better Auth (session management)                         │
│  • Data merging logic (waterfall prioritization)           │
│  • Caching strategy (KV lookups)                            │
│  • Request/response transformations                         │
└──────────────────────┬──────────────────────────────────────┘
                       │ SQL/KV/HTTP
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────┐  │
│  │ D1 Database │  │ KV Storage  │  │ External APIs      │  │
│  │ (SQLite)    │  │ (Cache)     │  │ • Google Books     │  │
│  │             │  │             │  │ • OpenLibrary      │  │
│  │ • Users     │  │ • Book data │  │ • Library of Cong. │  │
│  │ • Scans     │  │ • Sessions  │  │                    │  │
│  │ • Sessions  │  │ (24h TTL)   │  │                    │  │
│  └─────────────┘  └─────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Modules & Responsibilities

### Presentation Layer

#### `/src/routes/+page.svelte` - Main Search Interface

**Responsibilities:**

- Render search form (ISBN or title input)
- Display merged book metadata
- Handle user interactions (copy field, export to SLiMS)
- Manage scanner mode state (auto-clear input)

**Key State:**

```typescript
let searchQuery = $state("");
let mergedData = $state<MergedBookData | null>(null);
let loading = $state(false);
let error = $state<string | null>(null);
```

**Critical Logic:**

- **Debouncing:** Title input debounced 500ms, ISBN instant
- **Scanner Loop:** `finally` block ensures input always clears + refocuses
- **Cache Check:** Calls `/api/book/[isbn]` which handles KV cache

#### `/src/routes/scan/mobile/+page.svelte` - Mobile Scanner

**Responsibilities:**

- Initialize camera via `html5-qrcode` library
- Extract ISBN from barcode (EAN-13, UPC-A)
- Display real-time scan results
- Provide camera controls (pause/resume, switch camera)

**Why Separate Route?**

- Desktop uses keyboard/USB scanner input
- Mobile uses camera-based barcode detection
- Different UX patterns (camera permissions, viewfinder)

#### `/src/lib/components/CameraScanner.svelte` - Reusable Scanner

**Responsibilities:**

- Wrapper around `html5-qrcode` library
- SSR-safe initialization (browser-only)
- Emit `scan` events to parent
- Handle camera permissions errors gracefully

**Lifecycle:**

```typescript
onMount(() => {
  // Initialize scanner (browser-only)
  Html5Qrcode.getCameras() → Select rear camera
  html5Qrcode.start() → Begin scanning
});

onDestroy(() => {
  // Cleanup to prevent memory leaks
  html5Qrcode.stop()
  html5Qrcode.clear()
});
```

---

### Application Layer

#### `/src/routes/api/book/[isbn]/+server.ts` - Serverless Metadata Endpoint

**Purpose:** Single source of truth for book metadata fetching.

**Flow:**

```typescript
export async function GET({ params, platform }) {
  const isbn = params.isbn;

  // 1. Validate ISBN format
  if (!isValidISBN(isbn)) return json({ error: "Invalid ISBN" }, 400);

  // 2. Check KV cache (24-hour TTL)
  const cached = await platform.env.BOOK_CACHE.get(isbn);
  if (cached)
    return json(JSON.parse(cached), { headers: { "X-Cache": "HIT" } });

  // 3. Fetch from 3 APIs in parallel
  const [google, openlib, loc] = await Promise.allSettled([
    fetchGoogleBooks(isbn),
    fetchOpenLibrary(isbn),
    fetchLibraryOfCongress(isbn),
  ]);

  // 4. Merge using waterfall strategy
  const merged = mergeBookData(google, openlib, loc);

  // 5. Store in KV cache
  await platform.env.BOOK_CACHE.put(isbn, JSON.stringify(merged), {
    expirationTtl: 86400,
  });

  // 6. Background: Save to D1 audit log
  platform.context.waitUntil(saveToDatabase(platform.env.DB, merged));

  return json(merged);
}
```

**Why This Pattern?**

- **Separation of concerns:** Frontend doesn't know about caching/merging
- **Testability:** Can mock `platform.env` in tests
- **Reusability:** Other routes can import this logic
- **Performance:** Edge caching at Cloudflare PoPs globally

#### `/src/lib/api.ts` - External API Service

**Responsibilities:**

- Fetch from Google Books, OpenLibrary, Library of Congress
- Retry logic (3 attempts with exponential backoff)
- Timeout enforcement (10s for Google/OL, 5s for LoC)
- Error normalization

**Example: Google Books Fetcher**

```typescript
async function fetchGoogleBooks(isbn: string): Promise<GoogleBookData | null> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${API_KEY}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      return transformGoogleBooksResponse(data); // Normalize shape
    } catch (error) {
      if (attempt === 3) return null; // Give up after 3 tries
      await sleep(Math.pow(2, attempt) * 100); // Exponential backoff
    }
  }
}
```

**Why Retry Logic?**

- External APIs occasionally timeout or return 500s
- Retries increase success rate from ~85% to ~98%
- Exponential backoff prevents hammering failing services

#### `/src/lib/merge.ts` - Data Merging Engine

**Purpose:** Combine data from 3 sources using waterfall prioritization.

**Waterfall Strategy:**

```typescript
function mergeBookData(
  google: GoogleBookData | null,
  openlib: OpenLibraryData | null,
  loc: LoCBookData | null,
): MergedBookData {
  return {
    // Priority: Google > OpenLibrary > LoC
    title: google?.title || openlib?.title || loc?.title || "Unknown",

    // Priority: Google > OpenLibrary > LoC
    authors: google?.authors || openlib?.authors || loc?.authors || [],

    // Exclusive sources
    ddc: openlib?.ddc || null, // Only OpenLibrary has DDC
    lcc: loc?.lcc || openlib?.lcc || null, // LoC is authoritative

    // Best available cover
    cover: google?.cover || openlib?.cover || null, // LoC has no covers

    // Merge and deduplicate subjects
    subjects: [
      ...new Set([
        ...(google?.subjects || []),
        ...(openlib?.subjects || []),
        ...(loc?.subjects || []),
      ]),
    ],

    // Data source tracking for UI
    dataSource: getSourceIndicator(google, openlib, loc),
  };
}
```

**Why Waterfall?**

- Each source has strengths/weaknesses
- Google Books has best covers/descriptions
- OpenLibrary has DDC classifications (exclusive)
- Library of Congress has authoritative LCC
- No single source is complete

**Conflict Resolution:**

- Title: Prefer Google (cleanest formatting)
- Classifications: Prefer authoritative source (LoC for LCC)
- Subjects: Combine all sources (more is better)

---

### Data Layer

#### D1 Database (SQLite on Cloudflare)

**Schema Overview:**

```sql
-- Better Auth tables
user (id, email, name, emailVerified, createdAt, updatedAt)
session (id, userId, token, expiresAt, ipAddress, userAgent)
account (id, userId, providerId, accessToken, refreshToken)

-- App tables
scan_history (id, userId, isbn, bookTitle, scannedAt)
```

**Access Pattern:**

```typescript
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

const db = new Kysely({
  dialect: new D1Dialect({ database: platform.env.DB }),
});

// Type-safe query
const scans = await db
  .selectFrom("scan_history")
  .where("userId", "=", userId)
  .orderBy("scannedAt", "desc")
  .limit(100)
  .execute();
```

**Why D1?**

- Serverless SQL (no connection pooling needed)
- Integrated with Cloudflare Workers
- Kysely provides type-safe query builder
- Good for relational data (users, scans)

**Limitations:**

- Max 100,000 rows per query (not an issue for this app)
- Write latency ~50-100ms (acceptable for audit logs)

#### KV Storage (Cloudflare Key-Value)

**Purpose:** Cache external API responses to reduce quota usage.

**Data Model:**

```typescript
Key: `book:${isbn}` (e.g., "book:9786235516981")
Value: JSON.stringify(MergedBookData)
TTL: 86400 seconds (24 hours)
```

**Access Pattern:**

```typescript
// Read
const cached = await env.BOOK_CACHE.get(`book:${isbn}`);
if (cached) return JSON.parse(cached);

// Write
await env.BOOK_CACHE.put(`book:${isbn}`, JSON.stringify(data), {
  expirationTtl: 86400,
});

// Delete (manual cache invalidation)
await env.BOOK_CACHE.delete(`book:${isbn}`);
```

**Why KV?**

- Extremely low latency (<100ms globally)
- Automatic replication to all Cloudflare PoPs
- Cheap ($0.50 per million reads)
- Perfect for read-heavy cache

**Limitations:**

- Eventually consistent (writes take ~60s to propagate)
- No transactions (not needed for cache)
- Max value size 25MB (books are ~10KB)

---

## Data Flow Diagrams

### Happy Path: ISBN Search with Cache Hit

```
┌─────┐                ┌──────────┐                ┌──────┐
│ User│                │ Workers  │                │  KV  │
└──┬──┘                └────┬─────┘                └───┬──┘
   │                        │                          │
   │ GET /api/book/123      │                          │
   │───────────────────────▶│                          │
   │                        │                          │
   │                        │ GET book:123             │
   │                        │─────────────────────────▶│
   │                        │                          │
   │                        │ { title: "...", ... }    │
   │                        │◀─────────────────────────│
   │                        │                          │
   │ { title: "...", ... }  │                          │
   │◀───────────────────────│                          │
   │ X-Cache: HIT           │                          │
   │                        │                          │
```

**Response Time:** ~50-100ms (KV read + JSON parse)

### Cache Miss: Full Fetch with Parallel APIs

```
┌─────┐    ┌─────────┐    ┌────────┐  ┌──────┐  ┌─────┐
│ User│    │ Workers │    │ Google │  │  OL  │  │ LoC │
└──┬──┘    └────┬────┘    └───┬────┘  └───┬──┘  └──┬──┘
   │            │               │           │        │
   │ GET /api   │               │           │        │
   │───────────▶│               │           │        │
   │            │               │           │        │
   │            │ KV check      │           │        │
   │            │──────▶X MISS  │           │        │
   │            │               │           │        │
   │            │ ┌──────────────────────────────┐   │
   │            │ │ Promise.allSettled([...])    │   │
   │            │ └──────────────────────────────┘   │
   │            │ GET /volumes   │           │        │
   │            │───────────────▶│           │        │
   │            │                │           │        │
   │            │ GET /books     │           │        │
   │            │────────────────────────────▶│        │
   │            │                │           │        │
   │            │ GET /search    │           │        │
   │            │────────────────────────────────────▶│
   │            │                │           │        │
   │            │ { ... }        │           │        │
   │            │◀───────────────│           │        │
   │            │                │           │        │
   │            │ { ... }        │           │        │
   │            │◀────────────────────────────│        │
   │            │                │           │        │
   │            │ { ... }        │           │        │
   │            │◀────────────────────────────────────│
   │            │                │           │        │
   │            │ ┌──────────────────────┐  │        │
   │            │ │ merge() waterfall    │  │        │
   │            │ └──────────────────────┘  │        │
   │            │                │           │        │
   │            │ PUT KV cache   │           │        │
   │            │─────────▶      │           │        │
   │            │                │           │        │
   │ { merged } │                │           │        │
   │◀───────────│                │           │        │
   │ X-Cache:   │                │           │        │
   │  MISS      │                │           │        │
```

**Response Time:** ~1200-1800ms (slowest API + merge time)

---

## Component Boundaries

### What Belongs Where?

| Concern                    | Layer        | Files                    |
| -------------------------- | ------------ | ------------------------ |
| **UI Rendering**           | Presentation | `src/routes/*.svelte`    |
| **Form Validation**        | Presentation | `src/routes/*.svelte`    |
| **API Calls**              | Application  | `src/lib/api.ts`         |
| **Data Merging**           | Application  | `src/lib/merge.ts`       |
| **Caching Strategy**       | Application  | `src/routes/api/**/*.ts` |
| **Database Queries**       | Data         | `src/lib/server/*.ts`    |
| **External API Contracts** | Data         | `src/lib/types.ts`       |

**Rule of Thumb:**

- If it touches the DOM → Presentation Layer
- If it transforms data → Application Layer
- If it persists data → Data Layer

---

## Key Design Decisions

### 1. Why Serverless Instead of Traditional Server?

**Decision:** Use Cloudflare Workers (serverless) instead of Node.js server.

**Rationale:**

- **Auto-scaling:** No capacity planning needed
- **Global edge:** <50ms latency worldwide
- **No ops:** No server maintenance, OS patching, etc.
- **Cost:** Pay-per-request (~$5/month for 1M requests)

**Tradeoffs:**

- Limited runtime (10s CPU time per request)
- No long-running background jobs (use Durable Objects or Queues)
- Cold start latency (~5-10ms, acceptable)

### 2. Why 3 External APIs Instead of 1?

**Decision:** Aggregate Google Books + OpenLibrary + Library of Congress.

**Rationale:**

- No single source has complete metadata
- DDC classifications only in OpenLibrary
- Authoritative LCC only in Library of Congress
- Best covers/descriptions in Google Books

**Tradeoffs:**

- Increased complexity (3 API contracts to maintain)
- Slower response time (1200ms vs 400ms for single source)
- More failure modes (any API can fail)

**Mitigation:** Parallel fetching + graceful degradation.

### 3. Why KV Cache Instead of In-Memory Cache?

**Decision:** Use Cloudflare KV (distributed) instead of Worker memory.

**Rationale:**

- Workers are stateless (each request may hit different instance)
- KV cache shared globally across all Workers
- Persists across deployments
- Lower API quota usage (70% cache hit rate)

**Tradeoffs:**

- Slight latency increase (~50ms KV read vs ~1ms memory)
- Eventual consistency (60s propagation delay)

**Why It Works:** Book metadata rarely changes, 24-hour TTL acceptable.

### 4. Why Kysely ORM Instead of Raw SQL?

**Decision:** Use Kysely type-safe query builder for D1.

**Rationale:**

- Type safety (autocomplete for table/column names)
- Prevents SQL injection (parameterized queries)
- Better refactoring (TypeScript catches breaking changes)

**Tradeoffs:**

- Slight learning curve (DSL syntax)
- Marginal runtime overhead (~1-2ms per query)

**Why It's Worth It:** Fewer bugs, faster development.

---

## Performance Bottlenecks

### Current Bottlenecks

1. **External API latency** (1200ms)
   - **Mitigation:** KV cache reduces to <100ms for 70% of requests
2. **Parallel API timeout handling** (5-10s worst case)
   - **Mitigation:** Fail-fast with 5s timeout for LoC

3. **D1 write latency** (50-100ms)
   - **Mitigation:** Use `waitUntil` for background writes (non-blocking)

### Optimization Opportunities

- [ ] Add Redis/Upstash for faster cache (10ms vs 50ms)
- [ ] Pre-fetch popular ISBNs during off-peak hours
- [ ] Implement stale-while-revalidate caching pattern
- [ ] Add CDN caching headers for static API responses

---

## Security Architecture

### Threat Model

| Threat                                 | Mitigation                   | Status             |
| -------------------------------------- | ---------------------------- | ------------------ |
| **SSRF (Server-Side Request Forgery)** | Whitelist image domains      | ✅ Implemented     |
| **SQL Injection**                      | Kysely parameterized queries | ✅ Implemented     |
| **XSS (Cross-Site Scripting)**         | Svelte auto-escaping         | ✅ Built-in        |
| **Session Hijacking**                  | HttpOnly cookies, SameSite   | ✅ Implemented     |
| **API Key Leakage**                    | Server-side env vars only    | ✅ Implemented     |
| **DDoS**                               | Cloudflare rate limiting     | ⚠️ Default only    |
| **Brute Force Login**                  | Rate limiting                | ❌ Not implemented |

### Authentication Flow

```
1. User clicks "Sign in with Google"
   ↓
2. Better Auth redirects to Google OAuth
   ↓
3. Google redirects back to /api/auth/callback
   ↓
4. Better Auth creates session in D1, sets cookie
   ↓
5. User redirected to /dashboard
   ↓
6. Subsequent requests include session cookie
   ↓
7. Middleware checks session validity (D1 lookup)
```

**Session Lifecycle:**

- Created on login (30-day expiry)
- Refreshed on each request (extends expiry)
- Deleted on logout or expiry
- Stored in D1 `session` table

---

## Deployment Architecture

### Cloudflare Pages + Workers

```
┌─────────────────────────────────────────────────────┐
│ Cloudflare Global Network (300+ PoPs)              │
│                                                     │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐ │
│  │ Edge PoP   │   │ Edge PoP   │   │ Edge PoP   │ │
│  │ (London)   │   │ (Tokyo)    │   │ (NYC)      │ │
│  │            │   │            │   │            │ │
│  │ • Workers  │   │ • Workers  │   │ • Workers  │ │
│  │ • KV Read  │   │ • KV Read  │   │ • KV Read  │ │
│  │ • Pages    │   │ • Pages    │   │ • Pages    │ │
│  └────────────┘   └────────────┘   └────────────┘ │
│         │                │                │        │
│         └────────────────┴────────────────┘        │
│                          │                         │
│                 ┌────────▼────────┐                │
│                 │ Origin D1 DB    │                │
│                 │ (Single Region) │                │
│                 └─────────────────┘                │
└─────────────────────────────────────────────────────┘
```

**Key Points:**

- Static assets cached globally (CDN)
- Workers execute at nearest PoP to user
- KV reads are local (fast)
- D1 writes go to origin region (slower, acceptable)

---

## Scalability Considerations

### Current Limits

| Resource             | Current Usage | Limit              | Headroom |
| -------------------- | ------------- | ------------------ | -------- |
| **Workers Requests** | ~1,000/day    | 100,000/day (free) | 100x     |
| **D1 Rows**          | ~500          | 100,000 (free)     | 200x     |
| **KV Reads**         | ~700/day      | 100,000/day (free) | 142x     |
| **KV Writes**        | ~300/day      | 1,000/day (free)   | 3x       |

### Scaling Strategy

**0-10K users:**

- Current architecture handles easily
- No changes needed

**10K-100K users:**

- Upgrade to Cloudflare paid plan ($5-20/month)
- Add Redis cache for faster reads
- Optimize D1 queries (add indexes)

**100K+ users:**

- Migrate D1 to PostgreSQL (better scaling)
- Add background job queue (Cloudflare Queues)
- Implement CDN caching for API responses
- Consider regional D1 replicas

---

## Testing Strategy

### Test Pyramid

```
       ┌────────────┐
       │    E2E     │  ← 10% (Playwright, critical paths)
       └────────────┘
      ┌──────────────┐
      │ Integration  │  ← 30% (API routes, data merging)
      └──────────────┘
     ┌────────────────┐
     │     Unit       │  ← 60% (Pure functions, utilities)
     └────────────────┘
```

**Unit Tests:** `src/lib/__tests__/*.test.ts`

- Pure functions (ISBN validation, data transformers)
- Mock external APIs
- Fast (<1s total runtime)

**Integration Tests:** `src/routes/api/__tests__/*.test.ts`

- Test full API routes with real D1/KV (dev bindings)
- Mock external APIs only
- Medium speed (~5-10s total)

**E2E Tests:** `tests/e2e/*.spec.ts`

- Full user flows (search → view → export)
- Real browser automation (Playwright)
- Slow (~30-60s total)

**Coverage Goal:** 80% (currently ~45%)

---

## Next Time You Change X, Update:

- **Add new external API** → Update this doc + `API_INTEGRATION_GUIDE.md` + `merge.ts` + flow diagrams
- **Change database schema** → Update this doc + `schema.sql` + data layer section
- **Switch cloud provider** → Rewrite deployment section + update all binding references
- **Add new layer/service** → Update system layers diagram + component boundaries table
- **Change caching strategy** → Update data flow diagrams + KV section

## Questions This Doc Should Answer But Doesn't Yet:

- How do we handle database migrations in production?
- What's the rollback process if a deployment breaks?
- How do we monitor Workers performance in production?
- What's the disaster recovery plan for D1 database corruption?
- How do we handle schema versioning for API responses?
- What's the long-term plan for supporting other library systems (beyond SLiMS)?
