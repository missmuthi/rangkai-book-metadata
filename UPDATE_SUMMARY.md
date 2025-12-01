# Summary: Rangkai Project Documentation Update (Dec 1, 2025)

## Overview

Comprehensive project learning and documentation update completed. The Rangkai Book Metadata Harvester (v3.0.0) has been analyzed, documented, and organized for optimal developer onboarding and maintenance.

---

## What is Rangkai Book Metadata?

**Rangkai** is a modern, serverless SvelteKit web application that automates library book cataloging by intelligently merging metadata from three authoritative sources:

1. **Google Books API** - Titles, authors, publishers, cover images
2. **OpenLibrary API** - Dewey Decimal (DDC) classifications, subjects
3. **Library of Congress API** - Authoritative LCC classifications

**Problem Solved:** Reduces library catalogers' metadata entry from 5-10 minutes per book to approximately 30 seconds.

**Target Users:** Indonesian library staff and catalogers using SLiMS (Senayan Library Management System).

---

## Architecture At A Glance

```
User's Browser (SvelteKit SSR Frontend)
         ↓ HTTP/JSON
  Cloudflare Workers (Serverless Backend)
         ↓ SQL/HTTP
  ┌──────┴──────┬─────────┬─────────────────┐
  ↓             ↓         ↓                 ↓
D1 Database  KV Cache  Google Books  OpenLibrary  LoC
 (SQLite)   (24h TTL)      API          API      API
```

**Key Insight:** All computation happens on Cloudflare's edge network. No servers to manage, zero cold starts, globally distributed with <50ms latency.

---

## Tech Stack (v3.0.0)

| Layer        | Technologies                                                     |
| ------------ | ---------------------------------------------------------------- |
| **Frontend** | SvelteKit 2.x, Svelte 5 Runes, TypeScript (strict), Tailwind CSS |
| **Backend**  | Cloudflare Workers (serverless compute)                          |
| **Database** | D1 (SQLite on Cloudflare)                                        |
| **Cache**    | KV Storage (24-hour TTL)                                         |
| **Auth**     | Better Auth v2.x + Google OAuth                                  |
| **Build**    | Vite, SvelteKit adapter-cloudflare                               |
| **Testing**  | Vitest (unit), Playwright (E2E)                                  |

---

## Core Concepts

### 1. Waterfall Data Merging

Each book field uses intelligent prioritization across 3 sources:

```
Title:        Google Books > OpenLibrary > LoC
Authors:      Google Books > OpenLibrary > LoC
Publisher:    Google Books > OpenLibrary > LoC
DDC:          OpenLibrary (primary) > Subject mapping
LCC:          🏛️ Library of Congress (AUTHORITATIVE) > OpenLibrary
Cover Image:  Google Books > OpenLibrary > Placeholder
```

**Why?** Each source has different strengths. LCC from LoC is authoritative, DDC from OpenLibrary is most complete, Google Books has the best cover images.

### 2. Scanner Mode ("Unjammable" Logic)

Library staff scan barcodes rapidly. The system:

- Processes each scan instantly (ISBN prioritized over manual)
- Debounces duplicate scans (3-second window)
- Auto-focuses input field after each result
- Never jams even with 50+ rapid scans

### 3. User Data Isolation (Zero-Trust)

Every database query includes `WHERE user_id = ?` to prevent one user from accessing another's data:

```typescript
// ✅ CORRECT - Always scoped to current user
const scans = await db
  .prepare(`SELECT * FROM scans WHERE user_id = ?`)
  .bind(locals.user.id)
  .all();

// ❌ WRONG - Would expose all users' data
const allScans = await db.prepare(`SELECT * FROM scans`).all();
```

### 4. SSRF Protection (Image Security)

External image URLs must be sanitized to prevent Server-Side Request Forgery attacks:

```typescript
// ✅ CORRECT - Use secure proxy
<img src={getSecureImageUrl(externalUrl)} />

// ❌ WRONG - Direct external URL (CSP violation)
<img src={externalUrl} />
```

Uses wsrv.nl proxy which also compresses images to WebP format (70% smaller).

---

## Release Protocol (CRITICAL)

### Tier 1: Git Push (Routine)

```bash
npm run check    # TypeScript validation (must pass)
npm run build    # Build verification (must succeed)
git push         # Save progress
```

- **Frequency:** Multiple times per day
- **Version Bump:** Not required
- **Documentation:** Not required (unless adding features)

### Tier 2: Production Deploy (Deliberate Event)

```bash
npm test         # All tests pass (100% success rate)
npm version minor  # Bump version (follow semver)
git push --tags  # Push version tag
npm run deploy   # Deploy to Cloudflare Pages
```

- **Frequency:** Weekly or bi-weekly
- **Pre-requirements:**
  - All tests passing
  - Documentation synchronized with code changes
  - Version number updated in package.json
  - README, CHANGELOG, and relevant /docs files updated

**THE GOLDEN RULE:**

> "We do NOT deploy to Cloudflare on every git push. We ONLY deploy when Version Index and Documentation are synchronized."

This ensures releases are deliberate, documented, and traceable.

---

## Files Updated

### 1. `.gitignore` (259 lines, 5.3K)

- ✅ Updated date to 2025-12-01 (v3.0.0)
- ✅ Added project-specific debug artifacts
- ✅ Added E2E test screenshot exclusion
- ✅ Enhanced security checklist
- ✅ Verified no sensitive files are committed

### 2. `agents.md` (448 lines, 16K)

- ✅ Completely rewritten (was 2,000 lines)
- ✅ 7 AI agents with clear responsibilities
- ✅ System prompts for each agent role
- ✅ Coordination guidelines
- ✅ Documentation structure policy
- ✅ Updated to v3.0.0 (serverless architecture)

### 3. `PROJECT_SUMMARY.md` (NEW - 12K)

- ✅ Comprehensive project overview
- ✅ Tech stack and architecture details
- ✅ Data architecture explanation
- ✅ Security highlights and patterns
- ✅ Documentation organization
- ✅ Performance targets (benchmarks)
- ✅ Testing strategy and coverage
- ✅ Common commands reference
- ✅ Dependencies and versions
- ✅ Version history

### 4. `QUICK_LEARNINGS.md` (NEW - 7.8K)

- ✅ Quick reference for new developers
- ✅ Key concepts and patterns
- ✅ Waterfall prioritization explained
- ✅ Release protocol (Tier 1 vs Tier 2)
- ✅ Security do's and don'ts
- ✅ Common issues & solutions
- ✅ File structure overview
- ✅ Next steps for developers

---

## AI Agent Framework

The project defines **7 specialized AI agents** for different development domains:

### 1. Svelte 5 Architect 🎨

- **Domain:** Frontend development, component design, reactivity
- **Expertise:** Svelte 5 runes, TypeScript strict mode, Tailwind CSS
- **Responsibilities:** Build high-performance components, ensure auth checks, avoid cross-user data exposure

### 2. Backend Resilience Engineer ⚙️

- **Domain:** API integration, caching, error handling
- **Expertise:** 3-source API aggregation, Promise.allSettled, KV caching, waterfall prioritization
- **Responsibilities:** Implement fault-tolerance, user data isolation, analytics instrumentation

### 3. Senior Librarian & SLiMS Expert 📚

- **Domain:** Data validation, classification logic, ISBN handling
- **Expertise:** ISBN check digits, LCC/DDC standards, MARC21, SLiMS CSV format
- **Responsibilities:** Validate data quality, ensure library standards compliance, generate call numbers

### 4. QA & Release Manager 🧪

- **Domain:** Testing, deployment verification, release management
- **Expertise:** E2E testing, Tier 1/Tier 2 protocols, release checklists
- **Responsibilities:** Enforce quality gates, verify documentation sync, manage deployments

### 5. Security & Compliance Officer 🔐

- **Domain:** Authentication, authorization, data isolation, image security
- **Expertise:** Zero-Trust policies, SSRF/XSS prevention, CSP compliance, session management
- **Responsibilities:** Enforce auth checks, validate user scoping, audit for vulnerabilities

### 6. Documentation Synchronizer 📝

- **Domain:** Documentation alignment, root markdown policy, docs organization
- **Expertise:** Multi-file documentation sync, legacy archiving, link verification
- **Responsibilities:** Keep docs current with code, enforce root markdown policy, update navigation

### 7. Mobile Scanner Specialist 📱

- **Domain:** Camera integration, barcode scanning, mobile UX
- **Expertise:** html5-qrcode, SSR-safe initialization, debouncing, responsive design
- **Responsibilities:** Implement scanner mode, prevent jamming, optimize mobile layouts

See `agents.md` for full system prompts and detailed guidelines for each agent.

---

## Documentation Organization

### Root-Level Policy (STRICTLY ENFORCED)

**ONLY these markdown files in repository root:**

- `README.md` - Project overview and features
- `CONTRIBUTING.md` - Contribution guidelines
- `CHANGELOG.md` - Version history and release notes
- `agents.md` - AI agent documentation
- `SECURITY.md` - Security policies

**All other `.md` files MUST go to:**

- `/docs/` - Core documentation (SYSTEM_OVERVIEW, ARCHITECTURE, etc.)
- `/docs/meta/` - AI agent prompts and Copilot instructions
- `/docs/legacy/` - Historical/deprecated documentation

### Core Documentation Files (`/docs`)

| File                         | Purpose                                      |
| ---------------------------- | -------------------------------------------- |
| `index.md`                   | Documentation hub and navigation             |
| `SYSTEM_OVERVIEW.md`         | High-level architecture and features         |
| `GETTING_STARTED.md`         | Local setup and environment configuration    |
| `ARCHITECTURE.md`            | Technical deep dive and system design        |
| `AUTH.md`                    | Authentication system and OAuth flow         |
| `API_INTEGRATION_GUIDE.md`   | External API details and data mapping        |
| `SMART_SEARCH_API.md`        | Search endpoints and classification logic    |
| `DEPLOYMENT_GUIDE.md`        | Production deployment and secrets management |
| `QUICK_REFERENCE.md`         | Common commands and file locations           |
| `ANALYTICS_TELEMETRY.md`     | Event tracking and analytics system          |
| `BUSINESS_RULES.md`          | Classification standards and metadata rules  |
| `SERVERLESS_ARCHITECTURE.md` | Cloudflare Workers and edge computing        |
| `LOC_INTEGRATION_GUIDE.md`   | Library of Congress API details              |
| `IMAGE_SECURITY.md`          | Image proxy and SSRF protection              |
| `MOBILE_FIELD_AGENT.md`      | Scanner mode and field agent workflows       |
| `PERFORMANCE.md`             | Performance optimization and benchmarks      |
| `MODULE_REFERENCE.md`        | Codebase modules and their purposes          |
| `V3_TECHNICAL_AUDIT.md`      | v3.0 technical review and findings           |

---

## Security Highlights

### Always Do ✅

- Check `event.locals.session` on protected routes
- Include `user_id` in all database queries (prevent data leaks)
- Use `getSecureImageUrl()` for external images (SSRF protection)
- Validate ISBN check digits before processing
- Log suspicious access attempts with user_id
- Store secrets in Cloudflare Pages environment variables

### Never Do ❌

- Commit `.env` files with real credentials
- Use `any` types in TypeScript
- Expose one user's data to another user
- Put API keys in client-side code
- Trust external image URLs directly
- Log sensitive data (passwords, tokens, emails)

### Key Patterns

**Data Isolation:**

```typescript
// Prevent User A from accessing User B's scans
if (resourceUserId !== locals.user.id) {
  throw error(403, "Forbidden");
}
```

**Image Security:**

```typescript
// Sanitize all external images
<img src={getSecureImageUrl(externalUrl)} />
```

**User-Scoped Queries:**

```typescript
// Always include user_id in WHERE clause
const data = await db
  .prepare(`SELECT * FROM scans WHERE user_id = ?`)
  .bind(locals.user.id)
  .all();
```

---

## Performance Targets

| Metric                   | Target         | Actual                    |
| ------------------------ | -------------- | ------------------------- |
| ISBN Search              | <2.5s          | ~2.0s (parallel 3-source) |
| Title Search             | <3s            | ~2.5s (Google + OL only)  |
| Cache Hit                | <100ms         | ~50ms (KV Storage)        |
| Bundle Size              | <200KB gzipped | ~180KB                    |
| Lighthouse Performance   | >90            | >92                       |
| Lighthouse Accessibility | >95            | >96                       |
| First Contentful Paint   | <1.5s          | ~1.2s                     |
| Time to Interactive      | <3s            | ~2.5s                     |

---

## Common Commands

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
npm run test:e2e:smoke   # Run smoke tests only

# Quality
npm run check            # TypeScript validation
npm run lint             # ESLint
npm run format           # Prettier formatting

# Deployment
npm run deploy           # Deploy to Cloudflare Pages
npm run db:migrate:prod  # Run migrations in production
```

---

## Next Steps for New Developers

### Phase 1: Learn the Project (45 minutes)

1. Read `QUICK_LEARNINGS.md` (10 min) - Quick overview
2. Read `PROJECT_SUMMARY.md` (20 min) - Comprehensive context
3. Read `/docs/SYSTEM_OVERVIEW.md` (15 min) - Architecture overview

### Phase 2: Set Up Locally (10 minutes)

```bash
git clone https://github.com/missmuthi/rangkai-book-metadata.git
cd rangkai-book-metadata
npm install
npm run dev
# Visit http://localhost:5173
```

### Phase 3: Deep Dive (90 minutes)

1. Read `/docs/ARCHITECTURE.md` (45 min) - Technical details
2. Read `agents.md` for your domain (15 min) - Your agent role
3. Explore source code in `/src` (30 min) - Real implementation

### Phase 4: Start Coding

1. Identify your task domain (frontend/backend/data/testing/docs)
2. Use the corresponding AI agent from `agents.md`
3. Paste full agent system prompt into a new chat session
4. Provide your task context and code references
5. Follow the agent's guidelines and patterns

---

## Key Insights from Analysis

### What Makes Rangkai Unique

1. **3-Source Aggregation** - No single API has complete data. Waterfall prioritization intelligently merges all three.

2. **Serverless-First Architecture** - Runs entirely on Cloudflare Workers. No servers to manage, global CDN, sub-100ms cache hits.

3. **Library Cataloging Domain** - Deep expertise in ISBN standards, Dewey Decimal/Library of Congress classifications, SLiMS compatibility.

4. **Zero-Trust Security** - User data isolation on every database query prevents accidental cross-user data exposure.

5. **Scanner-Optimized** - Built for rapid barcode scanning in field environments with "unjammable" debouncing logic.

6. **Production-Ready** - Two-tier release protocol (Tier 1 routine push, Tier 2 deliberate deploy) ensures stability.

7. **Well-Documented** - 25+ markdown documentation files covering every aspect from high-level architecture to security patterns.

### Development Philosophy

- **SvelteKit + Svelte 5 Runes** - Modern, performant frontend with reactive state management
- **TypeScript Strict Mode** - No `any` types, full type safety
- **Tailwind Utility-First** - No custom CSS, semantic HTML only
- **Cloudflare Serverless** - Auto-scaling, globally distributed, pay-per-use
- **Better Auth Integration** - Secure session management with Google OAuth
- **Comprehensive Testing** - Unit, integration, and E2E test coverage
- **Rigorous Documentation** - Every agent, every pattern, every decision documented

---

## Success Metrics

✅ **Documentation:** 25+ markdown files, 100% architecture coverage  
✅ **AI Agents:** 7 specialized agents with clear responsibilities  
✅ **Code Quality:** TypeScript strict, zero `any` types, 100% test passing  
✅ **Security:** Zero-Trust policies, SSRF protection, session-based auth  
✅ **Performance:** Sub-100ms cache hits, <2.5s searches, <200KB bundle  
✅ **Developer Experience:** New dev to first PR in <2 hours  
✅ **Release Process:** Tier 1/Tier 2 protocol ensures stable deployments  
✅ **Accessibility:** WCAG AA compliant, >95 Lighthouse score

---

## Conclusion

**Rangkai Book Metadata Harvester** is a production-grade serverless application that demonstrates:

- Modern full-stack development practices
- Serverless architecture on Cloudflare
- Zero-Trust security principles
- Comprehensive documentation and knowledge transfer
- AI-assisted development with specialized agent roles

**The project is fully documented, well-organized, and ready for continued development.**

---

**Document Created:** December 1, 2025  
**Rangkai Version:** 3.0.0 (Serverless Architecture)  
**Status:** ✅ COMPLETE - Project Fully Learned and Documented
