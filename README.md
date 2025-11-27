# 📚 Rangkai Book Metadata Harvester

> A modern, intelligent metadata harvesting tool for library cataloging systems (SLiMS). Built with SvelteKit, TypeScript, and Tailwind CSS.

[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-Latest-orange.svg)](https://kit.svelte.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC.svg)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 🎯 Overview

Rangkai Book Metadata Harvester intelligently combines data from **3 authoritative sources** - Google Books API, OpenLibrary API, and Library of Congress (LoC) API - to generate complete, SLiMS-compatible bibliographic records. Designed for Indonesian libraries and catalogers, it automates the tedious process of metadata entry while maintaining data quality and completeness.

### Key Features

- 🔍 **Triple-Source Search** - ISBN or title lookup from Google Books + OpenLibrary + Library of Congress
- 🧠 **Intelligent Data Merging** - "Waterfall of Data" prioritization for optimal accuracy
- 📊 **Authoritative Classification** - DDC (Dewey Decimal) from OpenLibrary + LCC (Library of Congress Classification) from LoC
- 🏛️ **Official LoC Integration** - Authoritative call numbers from U.S. Library of Congress
- 🏷️ **Auto Call Number** - Generates call numbers using DDC/LCC + Cutter-Sanborn + Author + Year
- 🌐 **CORS-Free API** - Server-side proxy eliminates browser CORS restrictions
- 📝 **SLiMS Ready** - Fields mapped to Senayan Library Management System
- 🎨 **Modern UI** - Clean, responsive interface with real-time data source indicators
- ⚡ **Real-time Preview** - Live metadata display with trust badges
- 🖼️ **Cover Image Handling** - Automatic fallback chain for missing covers
- 🔄 **Graceful Degradation** - Works even when sources fail (partial data handling)
- 📈 **Analytics & Telemetry** - Comprehensive event tracking for performance monitoring and optimization
- 💾 **Smart Caching** - LRU cache with analytics tracking for optimal API quota usage
- 🚀 **Performance Optimized** - Input debouncing, code splitting, and lazy loading
- 🔒 **Secure Image Loading** - wsrv.nl proxy with SSRF protection (70% smaller images, privacy-preserving)
- 🗄️ **Cloudflare D1 Database** - Persistent scan history with B-Tree indexed lookups
- 💾 **Cloudflare KV Cache** - 24-hour TTL for instant responses (<100ms cache hits)
- 🛡️ **Production-Grade Security** - SSRF protection, waitUntil pattern, type-safe bindings

## 📋 Version History

### v1.3.0 (November 21, 2025) - **Serverless Architecture** 🚀

- ⚡ **Serverless API**: Frontend now uses `/api/book/[isbn]` endpoint (96% faster for repeated scans)
- 📊 **Edge Optimization**: Cloudflare Workers handle all data fetching and merging
- 💾 **KV-First Caching**: 24-hour TTL eliminates redundant API calls (<100ms cache hits)
- 🗄️ **Background Audit Logging**: D1 database writes via `waitUntil` (zero user-facing latency)
- 🎯 **Single Source of Truth**: Data merging logic centralized in serverless API
- 📈 **Enhanced Analytics**: Cache hit tracking, source availability metrics
- 🔒 **Scanner Mode Compatible**: Auto-add and unjammable scanning work seamlessly with serverless backend
- 📚 **See SERVERLESS_ARCHITECTURE.md** for full migration guide and performance benchmarks

### v1.2.1 (November 21, 2025) - **Production Ready** 🎉

- 🛡️ **SSRF Protection**: Whitelist-based image proxy prevents Server-Side Request Forgery attacks
- 🖼️ **wsrv.nl Image Proxy**: 70% smaller images (WebP), 68% faster load times, privacy-preserving
- ⚡ **Background Writes**: `waitUntil` pattern for non-blocking D1/KV writes (40% faster responses)
- 🗄️ **D1 Database**: Persistent scan history with B-Tree indexed ISBN lookups (99.9% query cost reduction)
- 💾 **KV Cache**: 24-hour TTL, <100ms cache hits for instant responses
- 🔒 **Type-Safe Cloudflare Bindings**: Full TypeScript support for D1, KV, and Workers API
- 📊 **REST API**: `/api/book/[isbn]` endpoint with JSON responses and cache headers
- ✅ **Security Audit PASSED**: Zombie promise prevention, cost optimization, SSRF protection verified

### v1.1.0 (November 20, 2025)

- 🔒 **Fixed CORS errors**: Removed `crossorigin="anonymous"` from images (Google Books doesn't support CORS)
- 🔐 **Image security**: HTTPS enforcement via `getSecureImageUrl()` utility
- 🛡️ **Privacy protection**: `referrerpolicy="no-referrer"` prevents tracking
- ⚡ **Performance**: Lazy loading and async decoding for all images
- 📊 **Analytics**: Comprehensive telemetry system for monitoring
- 💾 **Smart caching**: LRU cache with analytics tracking
- 🚀 **Input optimization**: Debouncing for manual typing, instant for ISBN/scanner

### v0.0.1 (Initial Release)

- 🔍 Triple-source search (Google Books + OpenLibrary + Library of Congress)
- 🧠 Intelligent data merging with "Waterfall of Data" strategy
- 📊 Authoritative classifications (DDC + LCC)
- 🏷️ Auto call number generation
- 🌐 CORS-free API with server-side proxy

## 🚀 Quick Start

### Prerequisites

```bash
node -v  # Requires Node.js 18.x or higher
npm -v   # or yarn/pnpm
```

### Installation

```bash
# Clone the repository
git clone https://github.com/missmuthi/rangkai-book-metadata.git
cd rangkai-book-metadata

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173
```

### Build for Production

```bash
# Create production build
npm run build

# Preview production build locally
npm run preview

# Deploy to Cloudflare Pages
npm run deploy
```

## 📚 Documentation

**New developers start here:**

### Core Documentation (`/docs`)

| Document                                                   | Purpose                                                                | Read When                       |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------- |
| **[System Overview](docs/SYSTEM_OVERVIEW.md)**             | High-level architecture, tech stack, core concepts                     | First time reading the codebase |
| **[Getting Started](docs/GETTING_STARTED.md)**             | Quick setup guide (0 to running in 10 minutes)                         | Setting up local environment    |
| **[Architecture](docs/ARCHITECTURE.md)**                   | Detailed technical architecture, data flow, component boundaries       | Planning major changes          |
| **[API Integration Guide](docs/API_INTEGRATION_GUIDE.md)** | External APIs (Google Books, OpenLibrary, LoC), caching, merging logic | Working with API layer          |
| **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)**           | Production deployment, environment setup, CI/CD                        | Deploying to Cloudflare Pages   |

### Legacy Documentation (Root Directory)

These documents are being migrated to `/docs` but still contain valuable information:

- `ANALYTICS_TELEMETRY.md` - Analytics & monitoring system
- `LOC_INTEGRATION_GUIDE.md` - Library of Congress API integration
- `SERVERLESS_ARCHITECTURE.md` - Cloudflare Workers architecture details
- `AUTHENTICATION_SETUP.md` - Better Auth configuration
- `IMAGE_SECURITY.md` - Image proxy & SSRF protection
- `PERFORMANCE_ANALYSIS.md` - Performance benchmarks
- `MOBILE_SCANNER_IMPROVEMENTS.md` - Mobile barcode scanner features
- `agents.md` - AI agents & automation documentation

**Quick Reference:**

- Need to add a feature? → Read [Architecture](docs/ARCHITECTURE.md) + [System Overview](docs/SYSTEM_OVERVIEW.md)
- API not working? → Read [API Integration Guide](docs/API_INTEGRATION_GUIDE.md)
- Deployment failing? → Read [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- Can't run locally? → Read [Getting Started](docs/GETTING_STARTED.md)

---

## 📖 Usage

### Search by ISBN

1. Enter a valid ISBN-10 or ISBN-13 (with or without hyphens)
2. Click **Search** or press Enter
3. View merged metadata from both sources
4. Copy individual fields or export complete record

### Search by Title

1. Enter book title (minimum 3 characters)
2. Select from up to 10 results
3. Review and edit merged metadata
4. Export to SLiMS-compatible format

### Example Searches

```
ISBN: 9786235516981
ISBN: 978-0-13-468599-1
Title: "Clean Code"
Title: "The Pragmatic Programmer"
```

## 🏗️ Architecture

### Tech Stack

| Layer          | Technology                                           | Purpose                        |
| -------------- | ---------------------------------------------------- | ------------------------------ |
| **Framework**  | SvelteKit                                            | SSR, routing, server functions |
| **Language**   | TypeScript (Strict)                                  | Type safety, IDE support       |
| **Styling**    | Tailwind CSS                                         | Utility-first styling          |
| **APIs**       | Google Books + OpenLibrary + **Library of Congress** | Triple-source metadata         |
| **Deployment** | Cloudflare Pages                                     | Edge computing, CDN            |
| **Testing**    | Vitest + Playwright                                  | Unit & E2E tests               |

### Project Structure

```
rangkai-book-metadata/
├── src/
│   │   ├── lib/
│   │   │   ├── api.ts                # 3-source API service (Google + OL + LoC)
│   │   │   ├── merge.ts              # Data merging & enrichment logic
│   │   │   ├── types.ts              # TypeScript interfaces (incl. LoCBookData)
│   │   │   ├── cutter.ts             # Cutter-Sanborn call number generator
│   │   │   ├── export.ts             # SLiMS CSV/MARC XML export
│   │   │   ├── utils.ts              # Utilities (image security, formatting)
│   │   │   ├── services/
│   │   │   │   └── analytics.ts      # Analytics & telemetry service
│   │   │   └── stores/
│   │   │       └── history.svelte.ts # Scanner mode history store
│   ├── routes/
│   │   ├── +page.svelte          # Main search interface
│   │   ├── +layout.svelte        # App layout wrapper
│   │   └── api/
│   │       └── openlibrary/
│   │           └── +server.ts    # CORS proxy for OpenLibrary
│   ├── app.html                  # HTML template
│   └── app.css                   # Global styles + Tailwind
├── static/                       # Static assets
├── tests/                        # Test suites
├── LOC_INTEGRATION_GUIDE.md      # Library of Congress integration docs
├── ANALYTICS_TELEMETRY.md        # Analytics system documentation
├── IMAGE_SECURITY.md             # Image security & privacy implementation
├── USAGE_EXAMPLES.ts             # Code examples for 3-source API
├── agents.md                     # AI agents & automation docs
├── PERFORMANCE_ANALYSIS.md       # Performance benchmarks
└── svelte.config.js              # SvelteKit configuration
```

## 🤖 Intelligent Data Processing

### Automated Agents

The system employs multiple specialized agents for data harvesting and processing from **3 authoritative sources**:

#### 1. **Google Books API Agent**

- Fetches metadata from Google Books
- Handles ISBN and title searches
- Extracts: title, authors, publisher, dates, ISBNs, descriptions, cover images
- **Priority**: Base metadata (title, cover, description)

#### 2. **OpenLibrary API Agent**

- Server-side proxy at `/api/openlibrary` (eliminates CORS)
- Fetches classifications (DDC, LCC as fallback)
- Extracts: subjects, languages, series, alternate titles
- **Priority**: DDC classifications (exclusive source)

#### 3. **Library of Congress (LoC) API Agent** 🆕

- Direct connection to `https://www.loc.gov/books/`
- No API key required (free, authoritative government source)
- Fetches authoritative LCC call numbers
- Extracts: official classifications, subjects, LCCN identifiers
- **Priority**: LCC classifications (authoritative source)
- **Timeout**: 5 seconds (fail-fast strategy for performance)

#### 4. **Data Merge Agent** (`processAndRenderMergedData`)

**"Waterfall of Data" prioritization strategy:**

```typescript
Title       → Google Books > OpenLibrary > LoC (cleanest formatting)
Authors     → Google Books > OpenLibrary > LoC (most reliable)
Publisher   → Google Books > OpenLibrary (preferred source)
Date        → Google Books > OpenLibrary > LoC (most consistent)
DDC         → OpenLibrary only (exclusive source)
LCC         → LoC > OpenLibrary (LoC is authoritative!)
Cover       → Google > OpenLibrary (LoC has no covers)
Description → Google > OpenLibrary > LoC (best quality)
Subjects    → Combined & deduplicated from all 3 sources
Language    → Google > OpenLibrary > LoC (mapped from ISO codes)
```

#### 5. **Metadata Enrichment Agent**

Generates SLiMS-compatible fields:

- **Call Numbers**: `DDC/LCC + Cutter-Sanborn + TitleInitial + Year`
- **GMD**: General Material Designation from print type
- **Collation**: Page count formatting
- **Language**: ISO 639 code → Full language name
- **Subject Mapping**: Categories → DDC classifications (fallback)

#### 6. **Error Handling & Graceful Degradation Agent**

- Catches network failures gracefully
- **Partial Data Support**: Works with 1, 2, or 3 sources
- **Data Source Tracking**: Shows which sources succeeded
- **Trust Badges**: UI indicates data quality (🏛️ Official LoC, ⚠️ Partial Data)
- Provides fallback placeholder images
- Logs detailed errors for debugging
- **Analytics Integration**: Tracks all errors for monitoring

#### 7. **Analytics & Telemetry Agent** 🆕

Comprehensive event tracking system for performance monitoring:

- **Search Performance**: Tracks timing, result counts, ISBN vs title searches
- **Cache Analytics**: Monitors hit rates, effectiveness per source
- **API Reliability**: Measures success rates, response times per source
- **Error Tracking**: Logs API failures, timeouts, rate limits
- **User Behavior**: Scanner mode usage, export patterns, navigation flows
- **Data Source Attribution**: Which API combinations provide best results
- **Dev/Prod Modes**: Color-coded console logs in dev, structured logging in prod
- **Future-Ready**: Easy integration with Plausible, GA4, or PostHog

See [`ANALYTICS_TELEMETRY.md`](ANALYTICS_TELEMETRY.md) for complete documentation.

### Data Source Status Indicators

The UI displays real-time badges showing which sources are available:

| Status                   | Badge Color | Meaning                                    |
| ------------------------ | ----------- | ------------------------------------------ |
| **All 3 Sources**        | 🟢 Green    | Google + OpenLibrary + LoC (Complete data) |
| **Google + LoC**         | 🔵 Blue     | Authoritative LCC, DDC may be incomplete   |
| **Google + OpenLibrary** | 🟡 Amber    | LCC from OpenLibrary (less authoritative)  |
| **Single Source**        | 🔴 Red      | Limited data, classification incomplete    |

### Field Mapping Reference

| SLiMS Field      | Data Source     | Priority (Waterfall)                    |
| ---------------- | --------------- | --------------------------------------- |
| Title            | All 3           | Google > OpenLibrary > LoC              |
| Authors          | All 3           | Google > OpenLibrary > LoC              |
| Publisher        | Google + OL     | Google > OpenLibrary                    |
| Publication Date | All 3           | Google > OpenLibrary > LoC              |
| Pages/Collation  | Google + OL     | Google > OpenLibrary                    |
| ISBN-13          | Google + OL     | Google > OpenLibrary                    |
| ISBN-10          | Google + OL     | Google > OpenLibrary                    |
| **DDC**          | **OpenLibrary** | **Exclusive**                           |
| **LCC**          | **LoC + OL**    | **LoC > OpenLibrary** 🏛️                |
| Call Number      | **Generated**   | Cutter-Sanborn system                   |
| Language         | All 3           | Google > OpenLibrary > LoC (ISO mapped) |
| Subjects         | All 3           | **Combined & deduplicated**             |
| Cover Image      | Google + OL     | Google > OpenLibrary > Placeholder      |
| GMD              | Google          | From print type                         |

### Subject-to-DDC Auto-Classification

Pattern matching engine maps subjects to Dewey Decimal:

```typescript
"Language" → 400
"English Grammar" → 425
"Mathematics" → 510
"Physics" → 530
"Chemistry" → 540
"Biology" → 570
"Medicine" → 610
"Engineering" → 620
"Fiction/Literature" → 800
"History/Geography" → 900
```

## 🔧 Configuration

### Environment Variables

```bash
# .env.local (never commit this file)
VITE_GOOGLE_BOOKS_API_KEY=your_api_key_here
VITE_APP_VERSION=1.0.0
```

### TypeScript Configuration

Strict mode is **MANDATORY** for all new code:

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "resolveJsonModule": true
  }
}
```

### Tailwind Configuration

Extend the design system in `tailwind.config.ts`:

```typescript
export default {
  theme: {
    extend: {
      colors: {
        primary: "#your-brand-color",
      },
    },
  },
};
```

## 🧪 Testing

### Run Test Suites

```bash
# Unit tests (Vitest)
npm run test:unit

# E2E tests (Playwright)
npm run test:e2e

# All tests
npm test

# Type checking
npm run check

# Coverage report
npm run test:coverage
```

### Current Test Coverage

- ✅ 82 unit tests passing
- ✅ Component rendering tests
- ✅ Data merging logic tests
- ✅ API proxy tests
- ✅ Form validation tests

## 📊 Performance

See [`PERFORMANCE_ANALYSIS.md`](PERFORMANCE_ANALYSIS.md) for detailed benchmarks and [`ANALYTICS_TELEMETRY.md`](ANALYTICS_TELEMETRY.md) for monitoring capabilities.

### Key Metrics

- **Initial Load**: < 500ms (with caching)
- **API Response Time**: 800-1500ms (triple-source fetch with parallel execution)
- **UI Render**: < 100ms (Svelte reactivity)
- **Lighthouse Score**: 95+ (Performance, Accessibility, SEO)
- **Cache Hit Rate**: 60-80% (tracked via analytics)

### Optimization Strategies

- Server-side rendering (SSR) for initial page load
- API response caching (5-minute TTL with LRU eviction)
- Progressive image loading for book covers
- **Input debouncing** (500ms for manual typing, instant for ISBN/scanner)
- **Code splitting** (lazy-loaded export modules)
- **Analytics-driven optimization** (performance metrics tracked in real-time)
- Parallel API fetching (no waterfall delays)

## 🎨 Coding Standards

### SvelteKit Patterns

**Always use generated types:**

```typescript
import type { PageData, PageServerLoad } from "./$types";

export const load = (async ({ fetch, params }) => {
  const data = await fetchData(params.id);
  return { data };
}) satisfies PageServerLoad;
```

**Form actions in `+page.server.ts`:**

```typescript
import { fail } from "@sveltejs/kit";
import type { Actions } from "./$types";

export const actions = {
  search: async ({ request }) => {
    const formData = await request.formData();
    const isbn = formData.get("isbn");

    if (!isbn) {
      return fail(400, { error: "ISBN required" });
    }

    return { success: true, data: await searchBook(isbn) };
  },
} satisfies Actions;
```

### Tailwind CSS Guidelines

**Class ordering** (enforced):

1. Layout (`flex`, `grid`, `relative`)
2. Sizing (`w-full`, `h-screen`)
3. Spacing (`p-4`, `m-2`, `gap-6`)
4. Typography (`text-lg`, `font-bold`)
5. Colors (`bg-white`, `text-gray-700`)
6. Effects (`shadow-md`, `rounded-lg`)
7. States (`hover:bg-blue-100`)
8. Responsive (`md:w-1/2`)

**Avoid `@apply`** - Use utility classes directly in components.

### HTML Semantic Rules

✅ **Use semantic elements:**

```html
<main class="container">
  <header class="mb-8">
    <h1>Search Books</h1>
  </header>
  <section class="search-form">
    <form method="POST">...</form>
  </section>
</main>
```

❌ **Avoid generic divs:**

```html
<div class="container">
  <div class="header">Search Books</div>
  <div class="form">...</div>
</div>
```

## 🐛 Troubleshooting

### Common Issues

**CORS errors when fetching OpenLibrary:**

- ✅ **Fixed**: Use `/api/openlibrary` proxy endpoint (server-side)
- Server-side proxy eliminates browser CORS restrictions

**`processAndRenderMergedData is not defined`:**

- ✅ **Fixed**: Import from `$lib/merge`:
  ```typescript
  import { processAndRenderMergedData } from "$lib/merge";
  ```

**ISBN not found:**

- Try without hyphens: `9786235516981` instead of `978-623-5516-98-1`
- Verify ISBN is correct (check digit validation)
- Try title search as fallback

**Missing cover images:**

- System automatically uses placeholder image
- All images loaded via HTTPS with privacy protection
- Check browser console for image load errors
- Verify Google Books/OpenLibrary have the cover

**TypeScript errors during build:**

- Run `npm run check` to see all type errors
- Ensure strict mode compliance
- Import types from `./$types` for SvelteKit routes

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository** and create a feature branch
2. **Follow coding standards** (see `agents.md`)
3. **Write tests** for new features
4. **Ensure TypeScript strict mode** compliance
5. **Run `npm run check`** before committing
6. **Use semantic commit messages**: `feat:`, `fix:`, `docs:`, etc.
7. **Update documentation** as needed

### Development Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and test
npm run dev
npm run test

# Type check
npm run check

# Commit with semantic message
git commit -m "feat: add export to CSV functionality"

# Push and create PR
git push origin feature/your-feature
```

## ⚡ Performance & Architecture

### High-Performance Data Fetching

**Parallel API Calls (No Waterfalls)**

- Google Books + OpenLibrary + Library of Congress APIs fetch simultaneously
- Eliminates sequential bottlenecks
- Average response time: ~1200ms for triple-source queries
- **Analytics Tracking**: Every API call is timed and logged

**Smart Caching System**

- **LRU Cache** with TTL (5 minutes) and size limits (100 items)
- **Separate caches** for Google Books, OpenLibrary, and Library of Congress
- **Cache hit rates**: 60-80% for repeated searches (tracked via analytics)
- **Memory efficient**: Automatic eviction prevents memory leaks
- **Analytics Integration**: Cache hits/misses logged for optimization insights

**Resilient Error Handling**

- **Retry Logic**: 3 attempts with exponential backoff
- **Circuit Breakers**: Rate limiting prevents API exhaustion
- **Graceful Degradation**: Continues with available data sources
- **Timeout Protection**: 10-second timeouts for Google/OL, 5-second for LoC
- **Error Analytics**: All failures tracked with error type, source, and timing

### Scanner Mode: Mouse-Free Batch Processing

**Unjammable Scanner Loop**

```typescript
// Critical: This logic MUST be preserved
async function handleSearch() {
  try {
    // API calls, data processing...
  } finally {
    // ALWAYS executes - regardless of success/failure/cache
    searchQuery = "";
    await tick();
    input.focus(); // Ready for next barcode scan
  }
}
```

**Key Features:**

- **Debounced title search** (500ms) for typing, instant ISBN processing
- **Instant ISBN processing** (bypasses debounce for scanners)
- **Persistent scan history** with localStorage
- **Batch export** to SLiMS CSV format
- **Real-time analytics** tracking scanner mode usage and performance

### Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   +page.svelte  │────│  BookApiService  │────│  Analytics      │
│                 │    │  (api.ts)        │    │  Service        │
│ • UI Logic      │    │ • Parallel fetch │    │ • Event tracking│
│ • State Mgmt    │    │ • Retry logic    │    │ • Performance   │
│ • Cache Mgmt    │    │ • Error handling │    │ • Monitoring    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         └───────────────────────┘
                 │
        ┌─────────────────┐
        │  Data Sources   │
        │ • Google Books  │
        │ • OpenLibrary   │
        │ • Library of C. │
        │ • Local Cache   │
        └─────────────────┘
```

**Service Layer Benefits:**

- **Separation of Concerns**: UI logic separate from API logic
- **Testability**: API service can be unit tested independently
- **Reusability**: API logic can be used across components
- **Maintainability**: Changes to API logic don't affect UI
- **Observability**: Analytics service tracks all operations

### Performance Metrics Dashboard

Real-time analytics tracking provides insights into:

- **Search Performance**: Average duration, success rate, ISBN vs title ratio
- **Cache Effectiveness**: Hit rate per source (Google, OpenLibrary, LoC)
- **API Reliability**: Success rate and average response time per source
- **Error Frequency**: Types of errors and which APIs fail most
- **User Behavior**: Scanner mode usage, export patterns, navigation flows
- **Data Completeness**: How often all 3 sources provide data vs partial results

**Dev Mode Console:**

```
⚡ [Analytics] cache_hit { cache_type: 'google', is_isbn: true, ... }
🔍 [Analytics] search_performed { type: 'isbn', duration_ms: 1234, ... }
📊 [Analytics] data_source_used { source: 'all-three', is_partial: false, ... }
⏱️ [Analytics] api_timing { source: 'loc', duration_ms: 456, success: true, ... }
```

See [`ANALYTICS_TELEMETRY.md`](ANALYTICS_TELEMETRY.md) for complete event catalog and integration guides.

### Optimization Techniques

1. **Debounced Input**: Prevents excessive API calls during typing (500ms delay)
2. **Smart ISBN Detection**: Instant processing for ISBNs vs debounced titles
3. **Parallel Fetching**: Eliminates waterfall delays (all 3 sources simultaneously)
4. **Intelligent Caching**: LRU cache with analytics tracking reduces API calls
5. **Code Splitting**: Export modules lazy-loaded only when needed
6. **Lazy Loading**: UI components load only when needed
7. **Skeleton Screens**: Prevent layout shift during loading
8. **Performance Monitoring**: Real-time analytics track all optimizations
9. **Secure Image Loading**: HTTPS enforcement, lazy loading, privacy protection (no referrers/cookies)

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Google Books API** - Primary metadata source
- **OpenLibrary API** - Classifications and subjects
- **SvelteKit Team** - Amazing framework
- **Tailwind CSS** - Utility-first CSS framework
- **SLiMS Community** - Library management system inspiration

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/missmuthi/rangkai-book-metadata/issues)
- **Documentation**:
  - Architecture & AI Agents: `agents.md`
  - Performance Benchmarks: `PERFORMANCE_ANALYSIS.md`
  - Analytics & Monitoring: `ANALYTICS_TELEMETRY.md`
  - Library of Congress Integration: `LOC_INTEGRATION_GUIDE.md`
  - Image Security & Privacy: `IMAGE_SECURITY.md`

---

**Built with ❤️ for Indonesian libraries and catalogers**

_Version 2.0.1 - Last updated: November 21, 2025_
