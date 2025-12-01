# Project Summary: Rangkai Book Metadata Harvester

## 📖 Overview

**Rangkai Book Metadata Harvester** is a modern, serverless web application (v3.0.0) that intelligently automates bibliographic metadata harvesting for Indonesian library cataloging systems (SLiMS - Senayan Library Management System).

### Mission

Reduce library catalogers' metadata entry time from 5-10 minutes per book to ~30 seconds by intelligently aggregating data from **3 authoritative sources** and providing SLiMS-compatible exports.

---

## 🎯 Key Features

### Core Capabilities

- **Triple-Source Search** - ISBN or title lookup from Google Books + OpenLibrary + Library of Congress
- **Intelligent Data Merging** - "Waterfall of Data" prioritization for optimal accuracy
- **Authoritative Classification** - DDC (Dewey Decimal) + LCC (Library of Congress Classification)
- **Auto Call Number Generation** - Using DDC/LCC + Cutter-Sanborn + Author + Year
- **Scanner Mode** - Rapid barcode scanning with "unjammable" logic
- **SSRF-Protected Image Proxy** - Secure image loading via wsrv.nl (70% smaller, privacy-preserving)
- **SLiMS-Compatible Export** - CSV with UTF-8 BOM and MARC21 XML support
- **Session-Based Auth** - Better Auth + Google OAuth integration
- **Analytics & Telemetry** - Comprehensive event tracking for optimization

### Technical Strengths

- ⚡ **Performance:** <100ms cache hits, sub-2.5s ISBN searches
- 🔒 **Security:** Zero-Trust policy, XSS/SSRF protection, user data isolation
- 📊 **Reliability:** Graceful degradation (works with 1-3 sources)
- 🌍 **Global Reach:** Cloudflare Pages CDN, <50ms edge responses
- 📈 **Scalability:** Serverless architecture, auto-scaling on Cloudflare Workers

---

## 🏗️ Technical Architecture

### Tech Stack

- **Frontend:** SvelteKit 2.x + Svelte 5 Runes + TypeScript Strict
- **Styling:** Tailwind CSS 3.x (utility-first approach)
- **Backend:** Cloudflare Workers (serverless compute)
- **Database:** D1 (SQLite on Cloudflare)
- **Cache:** KV Storage (24-hour TTL for book metadata)
- **Auth:** Better Auth v2.x with Google OAuth
- **Build:** Vite + SvelteKit adapter-cloudflare
- **Testing:** Vitest (unit) + Playwright (E2E)

### System Layers

```
┌─────────────────────────────────┐
│   SvelteKit Frontend (SSR)       │
│   Svelte 5 + Tailwind + TS      │
└──────────────┬──────────────────┘
               │ HTTP/JSON
               ▼
┌─────────────────────────────────┐
│  Cloudflare Workers (API Layer) │
│  • Data merging (3-source)      │
│  • Session management           │
│  • KV cache lookup              │
│  • Analytics events             │
└──────────────┬──────────────────┘
               │ SQL/HTTP/KV
       ┌───────┼────────┬─────────────┐
       ▼       ▼        ▼             ▼
    ┌──────┐┌──────┐┌──────────────┐┌─────────┐
    │ D1DB ││  KV  ││External APIs ││getImage │
    └──────┘└──────┘└──────────────┘└─────────┘
```

### Serverless Advantages

- **No infrastructure management** - Cloudflare handles scaling
- **Global distribution** - Edge computing for <50ms latency
- **Pay-per-use** - Cost-effective for variable traffic
- **Zero cold starts** - Always available Workers
- **Background processing** - `waitUntil` for non-blocking D1 writes

---

## 📊 Data Architecture

### 3-Source Data Harvesting

| Source              | Primary Use                         | Timeout | Priority      |
| ------------------- | ----------------------------------- | ------- | ------------- |
| Google Books API    | Title/Authors/Publisher/Dates/Cover | 10s     | Primary       |
| OpenLibrary API     | DDC Classification/Subjects         | 10s     | Primary       |
| Library of Congress | LCC (Authoritative)                 | 5s      | Authoritative |

### Waterfall Prioritization Example

```
Title: "Clean Code"
→ Google Books (has it) ✅ Use Google version
→ Stops fallback chain

LCC Classification: "QA76.73.J38"
→ Library of Congress (has authoritative)  ✅ Use LoC
→ Stops fallback chain

If LoC fails:
→ OpenLibrary (has fallback) ✅ Use OL
→ Otherwise use subject mapping

DDC: "005.133"
→ OpenLibrary (primary) ✅ Use OL
→ If unavailable, map from subjects
```

### Data Merge Result

```json
{
  "title": "Clean Code: A Handbook of Agile Software Craftsmanship",
  "authors": ["Robert C. Martin"],
  "isbn13": "9780132350884",
  "publisher": "Prentice Hall",
  "year": "2008",
  "ddc": "005.133",
  "lcc": "QA76.95 .M38 2008",
  "callNumber": "005.133 M38 C 2008",
  "coverUrl": "https://wsrv.nl/?url=...", // SSRF-protected
  "trust": "✅ Complete (3 sources)",
  "dataSource": {
    "title": "google",
    "ddc": "openlibrary",
    "lcc": "loc",
    "authors": "google"
  }
}
```

---

## 🔐 Security Highlights

### Authentication & Authorization

- Better Auth v2.x with Google OAuth
- Session-based auth (no JWT tokens in local storage)
- User data isolation: `WHERE user_id = ? ` on all queries
- Session expiration: graceful redirect to login

### Data Protection

- User-scoped database queries (prevents cross-user data leaks)
- SSRF protection on image URLs (wsrv.nl proxy)
- CSP headers enforcement
- XSS prevention via Svelte's reactivity model
- CORS validation on all API endpoints

### Deployment Security

- Environment variables in Cloudflare Pages secrets (not in code)
- Zero API keys in client-side code
- User-Agent headers on all external API calls
- Input validation on all form fields

---

## 📚 Documentation Structure

### Core Documentation (`/docs`)

- `SYSTEM_OVERVIEW.md` - High-level architecture
- `GETTING_STARTED.md` - Local setup guide
- `ARCHITECTURE.md` - Technical deep dive
- `API_INTEGRATION_GUIDE.md` - Data mapping & sources
- `DEPLOYMENT_GUIDE.md` - Production deployment
- `BUSINESS_RULES.md` - Classification standards
- `IMAGE_SECURITY.md` - SSRF protection patterns
- `ANALYTICS_TELEMETRY.md` - Event tracking system
- `QUICK_REFERENCE.md` - Common commands
- Plus: AUTH, SERVERLESS_ARCHITECTURE, LOC_INTEGRATION, MOBILE_FIELD_AGENT, etc.

### Root-Level Policy

✅ **Only these in root:**

- `README.md`
- `CONTRIBUTING.md`
- `CHANGELOG.md`
- `agents.md` (AI agent documentation)
- `SECURITY.md`

❌ **All other `.md` files go to:**

- `/docs/` (core documentation)
- `/docs/meta/` (AI agent prompts, Copilot instructions)
- `/docs/legacy/` (historical documentation)

---

## 🤖 AI Agent Framework

This project uses **7 specialized AI agents** for different development domains:

### Agent Roles

1. **Svelte 5 Architect** 🎨 - Frontend development with Svelte 5 runes
2. **Backend Resilience Engineer** ⚙️ - API integration, caching, error handling
3. **Senior Librarian & SLiMS Expert** 📚 - Data validation, classification logic
4. **QA & Release Manager** 🧪 - Testing, deployment, release protocol
5. **Security & Compliance Officer** 🔐 - Auth, data isolation, CSP
6. **Documentation Synchronizer** 📝 - Docs alignment with code
7. **Mobile Scanner Specialist** 📱 - Camera, barcode scanning, UX

**See `agents.md` for full agent responsibilities and system prompts.**

---

## 🚀 Release Protocol

### Tier 1: Git Push (Routine)

```bash
npm run check    # TypeScript validation
npm run build    # Build verification
git push origin main
```

- Multiple times per day
- No version bump needed

### Tier 2: Production Deploy (Deliberate)

```bash
npm run check && npm test  # All checks pass
npm version minor          # Bump version
npm run deploy             # Build & deploy to Cloudflare Pages
```

- Only when Version + Documentation synchronized
- Weekly or bi-weekly cadence
- Pre-deploy checklist required

**RULE:** "We do NOT deploy to Cloudflare on every change. We ONLY deploy when Version Index and Documentation are synchronized."

---

## 📈 Performance Targets

- **ISBN Search:** <2.5s (parallel 3-source)
- **Title Search:** <3s (Google + OpenLibrary)
- **Cache Hit:** <100ms
- **Bundle Size:** <200KB gzipped
- **Lighthouse Performance:** >90
- **Lighthouse Accessibility:** >95
- **First Contentful Paint:** <1.5s
- **Time to Interactive:** <3s

---

## 🧪 Testing Strategy

### Test Coverage

- **Unit Tests:** Vitest (data merging, ISBN validation, classification logic)
- **Integration Tests:** API endpoint mocking and error scenarios
- **E2E Tests:** Playwright (scanner mode, user flows, auth boundaries)
- **Manual Testing:** Network failures, malformed data, edge cases

### Critical Test Scenarios

1. All 3 APIs success (happy path)
2. Partial failures (1-2 sources down)
3. ISBN edge cases (malformed, invalid check digits)
4. Scanner mode "unjammable" (rapid scans <500ms apart)
5. User data isolation (User A cannot access User B's data)
6. Cache behavior (hits, TTL, LRU eviction)
7. Network resilience (offline mode, timeouts)

---

## 📦 Dependencies & Versions

### Runtime

- Node.js 18.x or higher
- TypeScript 5.x (strict mode mandatory)

### Frontend

- SvelteKit 2.x
- Svelte 5.x (with runes)
- Tailwind CSS 3.x
- Better Auth 2.x

### Backend

- Cloudflare Workers API
- Cloudflare D1 (SQLite)
- Cloudflare KV Storage

### Testing

- Vitest (unit tests)
- Playwright (E2E tests)

---

## 🔧 Common Commands

```bash
# Development
npm run dev              # Start dev server (localhost:5173)
npm run dev:full        # Dev with full Cloudflare stack

# Building
npm run build            # Production build
npm run preview          # Test production build locally

# Testing
npm test                 # Run unit tests
npm test:watch           # Watch mode
npm run test:e2e         # Run E2E tests

# Quality
npm run check            # TypeScript validation
npm run lint             # ESLint
npm run format           # Prettier format

# Deployment
npm run deploy           # Deploy to Cloudflare Pages
npm run db:migrate:prod  # Run migrations in production
```

---

## 📞 Getting Help

### New Developers: Start Here

1. Read `/docs/SYSTEM_OVERVIEW.md` (15 min)
2. Run `npm install && npm run dev` (local setup)
3. Read `/docs/ARCHITECTURE.md` (30 min technical deep dive)
4. Check `/docs/QUICK_REFERENCE.md` for common commands

### Developers: Agent Frameworks

- Need to code a feature? → Use appropriate AI agent from `agents.md`
- Example: "I'm building a frontend component" → Use **Svelte 5 Architect** prompt

### Contributing

- See `CONTRIBUTING.md` for code standards
- Follow `agents.md` agent guidelines
- Use Tier 1 (push) and Tier 2 (deploy) protocols

---

## 📊 Project Stats

- **Lines of Code:** ~15,000+ (frontend + backend + tests)
- **Documentation:** 25+ markdown files
- **API Sources:** 3 (Google Books, OpenLibrary, Library of Congress)
- **Test Coverage:** Unit + Integration + E2E
- **Performance Score:** Lighthouse >90 (Performance), >95 (Accessibility)
- **Bundle Size:** <200KB gzipped
- **Global Deployment:** Cloudflare Pages (200+ edge locations)

---

## 📝 Version History

### v3.0.0 (December 2025) - Current

- ✅ Serverless architecture (Cloudflare Workers)
- ✅ Svelte 5 runes
- ✅ Better Auth integration
- ✅ 3-source data merging
- ✅ D1 + KV persistence
- ✅ Analytics telemetry
- ✅ SSRF-protected images

### v1.3.0 (November 2025)

- KV caching layer
- Background audit logging via `waitUntil`
- Edge optimization

### v1.2.1 (November 2025)

- SSRF protection (wsrv.nl proxy)
- D1 database integration
- Security audit passed

### v1.1.0 (November 2025)

- Library of Congress API integration
- Fixed CORS issues
- Image security improvements

---

**End of Summary**
**Last Updated:** December 1, 2025
**Project:** Rangkai Book Metadata Harvester v3.0.0
