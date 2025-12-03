# Quick Project Learnings

## What is Rangkai Book Metadata?

A serverless SvelteKit web app that automates library book cataloging by intelligently merging metadata from Google Books, OpenLibrary, and Library of Congress APIs. Target: 30 seconds per book instead of 5-10 minutes.

## Core Tech Stack

- **Frontend:** SvelteKit + Svelte 5 Runes + TypeScript + Tailwind CSS
- **Backend:** Cloudflare Workers (serverless)
- **Database:** D1 (SQLite)
- **Cache:** KV Storage (24-hour TTL)
- **Auth:** Better Auth + Google OAuth

## Key Features

1. **Triple-Source Search** - Search by ISBN or title across 3 APIs
2. **Waterfall Data Merging** - Intelligent prioritization (Google > OpenLibrary > LoC)
3. **Authoritative Classifications** - DDC + LCC (with LoC as authoritative source)
4. **Auto Call Number Generation** - Cutter-Sanborn system
5. **Scanner Mode** - Rapid barcode scanning with "unjammable" logic
6. **SLiMS Export** - CSV with UTF-8 BOM
7. **Session Auth** - Better Auth with Google OAuth
8. **Analytics** - Event tracking system

## Architecture Pattern

```
Browser → SvelteKit (SSR) → Cloudflare Workers → APIs
                               ↓
                         D1 Database + KV Cache
```

## Important Files

| File                                    | Purpose                                           |
| --------------------------------------- | ------------------------------------------------- |
| `agents.md`                             | AI agent framework (7 agents with specific roles) |
| `.gitignore`                            | Git ignore rules (updated for v3.0.0)             |
| `src/hooks.server.ts`                   | Global request handler + auth                     |
| `src/lib/merge.ts`                      | Data merging logic (waterfall)                    |
| `src/routes/api/book/[isbn]/+server.ts` | Book search API endpoint                          |
| `/docs/SYSTEM_OVERVIEW.md`              | High-level architecture                           |
| `/docs/ARCHITECTURE.md`                 | Technical deep dive                               |
| `/docs/API_INTEGRATION_GUIDE.md`        | API details                                       |

## Key Concepts

### Waterfall Prioritization

```
Field: Title
Priority: Google Books > OpenLibrary > LoC
Use: First source that has the data
```

### 3-Source APIs

| Source              | Strength                     | Timeout |
| ------------------- | ---------------------------- | ------- |
| Google Books        | Titles, authors, publishers  | 10s     |
| OpenLibrary         | DDC classification, subjects | 10s     |
| Library of Congress | Authoritative LCC            | 5s      |

### Data Merge Example

If searching for ISBN "9780132350884":

1. Query all 3 APIs in parallel
2. Google returns: title, authors, publisher, cover
3. OpenLibrary returns: DDC classification, subjects
4. LoC returns: LCC classification
5. Merge them intelligently → Complete book record

### SLiMS CSV Export

```csv
Title,Authors,ISBN,Publisher,Year,Classification,CallNumber,Collation,GMD,Language
"Clean Code","Robert C. Martin","9780132350884","Prentice Hall","2008","005.133","005.133 M38 C 2008","464 pages","book","English"
```

## Release Protocol (CRITICAL)

### Tier 1: Git Push (Routine)

```bash
npm run check    # Must pass
npm run build    # Must succeed
git push         # Save progress
```

- Multiple times per day
- No version bump needed

### Tier 2: Production Deploy (Deliberate)

```bash
npm test         # 100% pass required
npm version minor  # Bump version
npm run deploy   # Deploy to Cloudflare
```

- Only when docs + version synchronized
- **RULE:** "We do NOT deploy on every push. We ONLY deploy when Version and Docs are synchronized."

## Security Highlights

✅ **Always Do:**

- Check `event.locals.session` on protected routes
- Include `user_id` in all DB queries (prevent cross-user leaks)
- Use `getSecureImageUrl()` for external images (SSRF protection)
- Validate ISBN check digits
- Log suspicious access attempts

❌ **Never Do:**

- Commit `.env` files with secrets
- Use `any` types in TypeScript
- Expose one user's data to another
- Put API keys in client code
- Trust external image URLs directly

## Common Commands

```bash
npm run dev              # Local dev (5173)
npm run build            # Production build
npm test                 # Unit tests
npm run test:e2e         # E2E tests
npm run check            # TypeScript validation
npm run deploy           # Deploy to Cloudflare Pages
npm run db:migrate:prod  # Run database migrations
```

## File Structure

```
/src
  ├── hooks.server.ts       # Global auth + request handling
  ├── app.html              # HTML template
  ├── app.css               # Global styles (Tailwind)
  ├── /lib
  │   ├── merge.ts          # Data merging logic
  │   ├── api.ts            # API helper functions
  │   ├── auth.ts           # Auth utilities
  │   └── /components       # Svelte components
  ├── /routes
  │   ├── +layout.server.ts # Layout with session
  │   ├── +page.svelte      # Home page
  │   ├── /api
  │   │   ├── /book         # Book search endpoint
  │   │   └── /scan         # Scan history endpoint
  │   └── /scans            # Scan history pages
  ├── /server
  │   ├── db.ts             # Database utilities
  │   └── /ai               # AI cleaning endpoints

/docs
  ├── index.md              # Documentation hub
  ├── SYSTEM_OVERVIEW.md    # Architecture overview
  ├── ARCHITECTURE.md       # Technical details
  ├── API_INTEGRATION_GUIDE.md
  ├── DEPLOYMENT_GUIDE.md
  ├── QUICK_REFERENCE.md
  └── /meta, /legacy        # Agent prompts, historical docs

/e2e
  ├── tests/
  │   ├── search.spec.ts    # ISBN search tests
  │   └── ai-clean.spec.ts  # AI cleaning tests
  └── README.md             # E2E testing guide
```

## AI Agent Framework

The project uses **7 specialized AI agents** for different development domains:

1. **Svelte 5 Architect** - Frontend with Svelte 5
2. **Backend Resilience Engineer** - APIs & caching
3. **Senior Librarian** - Data validation
4. **QA & Release Manager** - Testing & releases
5. **Security Officer** - Auth & data isolation
6. **Documentation Synchronizer** - Docs alignment
7. **Mobile Scanner Specialist** - Camera & UX

See `agents.md` for detailed system prompts and responsibilities.

## Performance Targets

- ISBN search: <2.5s
- Cache hit: <100ms
- Bundle size: <200KB gzipped
- Lighthouse Performance: >90
- First Contentful Paint: <1.5s

## Common Issues & Solutions

### "Cannot find module" errors

- Run `npm run check` to validate TypeScript
- Check imports use correct paths from `/src`
- Verify file extensions (`.ts`, `.svelte`)

### Build fails

- Run `npm run check` first
- Clear `.svelte-kit` cache: `rm -rf .svelte-kit`
- Ensure all types are imported correctly

### Tests fail

- Check database mocks are set up
- Verify test data matches API response format
- Use `--watch` mode to debug: `npm test -- --watch`

### E2E tests fail

- Ensure preview server is running: `npm run build && npm run preview`
- Check Playwright browser installed: `npx playwright install`
- Use `--debug` flag: `npx playwright test --debug`

## Documentation Policy

✅ **Root-level files (only these):**

- `README.md`
- `CONTRIBUTING.md`
- `CHANGELOG.md`
- `agents.md`
- `SECURITY.md`

❌ **Everything else goes to:**

- `/docs/` - Core documentation
- `/docs/meta/` - AI agent prompts
- `/docs/legacy/` - Historical docs

## Next Steps for New Developers

1. **Learn the project:** Read `PROJECT_SUMMARY.md` (this file, 10 min)
2. **Understand architecture:** Read `/docs/SYSTEM_OVERVIEW.md` (15 min)
3. **Set up locally:** `npm install && npm run dev` (5 min)
4. **Dive deep:** Read `/docs/ARCHITECTURE.md` (30 min)
5. **Read agent framework:** Review `agents.md` for your domain (10 min)
6. **Start coding:** Choose relevant agent prompt, follow guidelines

## Key References

- **SvelteKit Docs:** https://kit.svelte.dev/docs
- **Svelte 5:** https://svelte.dev/docs/svelte/what-is-svelte
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Cloudflare Pages:** https://developers.cloudflare.com/pages/
- **Better Auth:** https://www.better-auth.com/docs

---

**Last Updated:** December 1, 2025
**Version:** 3.0.0
**Project:** Rangkai Book Metadata Harvester
