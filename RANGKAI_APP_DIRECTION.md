# Rangkai – App-Only Direction

Rangkai is an **app-only** project.

## 1. Project Identity

- **Core:** SvelteKit 2 + Svelte 5 app deployed on **Cloudflare Pages + Functions**.
- **Purpose:** An authenticated tool for librarians to:
  - Scan ISBNs
  - Aggregate book metadata from multiple external sources
  - Store and review scan history
- **Non-goals for this repo:**
  - Blog engine
  - Marketing site / landing page
  - General-purpose CMS

If a blog/docs/marketing site is ever needed, it will live in a **separate repo** and point *to* this app. Do not try to turn this repo into a hybrid app+content framework.

---

## 2. Stack Priorities

When suggesting architecture or stack changes:

### ✅ DO Prioritize

1. **Reliable auth on Cloudflare**
   - One clear auth stack (no half-migrations).
   - Clean session handling and route protection.
   - Easy to reason about and debug.

2. **Clean data layer (D1 + KV) via `lib/server`**
   - All D1 access goes through `src/lib/server/db.ts` or equivalent.
   - All KV access goes through `src/lib/server/cache.ts` or equivalent.
   - No direct use of `env.DB`, `env.BOOK_CACHE`, or raw bindings in random routes.

3. **Dedicated metadata engine**
   - Multi-source aggregation lives under something like:
     - `src/lib/server/metadata/`
   - Clear separation between:
     - Providers (`sources/openlibrary.ts`, `sources/google-books.ts`, etc.)
     - Merging/normalization (`merge.ts`, `normalize.ts`)
     - Public API (`fetchBookByIsbn(isbn)`).

4. **Module-based domain structure**
   - Domains such as `scan`, `dashboard`, `auth`, `user` should have their own modules:
     - `src/modules/scan/service.ts`
     - `src/modules/dashboard/service.ts`, etc.
   - `src/routes/**` should stay thin:
     - Receive request
     - Call domain/service functions
     - Return data

5. **Maintainability & clarity**
   - Strong Typescript usage
   - Clear separation of concerns (UI vs server vs domain logic)
   - Predictable error handling and logging

---

## 3. Things NOT To Suggest

### ❌ Do NOT recommend:

1. **Migrating the whole app to another framework**
   - No “rewrite everything” suggestions to:
     - Next.js
     - Nuxt
     - Remix
     - Other meta-frameworks
   - Unless there is a **very specific, hard limitation** that cannot be reasonably solved inside SvelteKit + Cloudflare.
   - If you believe a migration is necessary, you must:
     - Name the exact limitation
     - Explain why it cannot be addressed in the current stack
     - Propose a minimal migration path, not a vague “move to X”.

2. **Adding Astro or other content frameworks inside this repo**
   - No hybrid SvelteKit + Astro app in this project.
   - If content is needed (blog, docs), assume:
     - It will live in a separate repo
     - It may use Astro or something else
     - It will integrate via links and/or shared branding only.

3. **Turning the app into a general CMS**
   - Don’t propose generic “page builder”, “WYSIWYG”, or “full CMS” features unless they directly support:
     - Scanning books
     - Managing metadata
     - Operational needs for librarians.

---

## 4. Recommended File/Folder Conventions

When proposing new files or refactors, prefer these patterns:

- **UI components**
  - `src/lib/components/layout/` – app chrome (Header, Footer, Shell, etc.)
  - `src/lib/components/ui/` – reusable UI atoms/molecules (Button, Input, Card)
  - `src/lib/components/dashboard/` – dashboard-specific components (ScanHistory, Stats)

- **Schemas & types**
  - `src/lib/schemas/scan.ts` – validation for scan forms
  - `src/lib/schemas/book.ts` – internal “Book” model, metadata structure

- **Server & infrastructure**
  - `src/lib/server/auth.ts` – auth/session utilities (getSession, requireSession, roles)
  - `src/lib/server/db.ts` – D1 database wrapper / ORM entrypoint
  - `src/lib/server/cache.ts` – KV helper functions
  - `src/lib/server/metadata/` – metadata engine
    - `sources/*.ts` – external APIs
    - `merge.ts`, `normalize.ts`, `index.ts`

- **Domain modules**
  - `src/modules/scan/service.ts` – orchestrates validation, metadata engine, DB writes
  - `src/modules/dashboard/service.ts` – aggregates scan history, stats, etc.

- **Routes**
  - `src/routes/**` should:
    - Stay as thin as possible
    - Import from `src/lib/server/**` and `src/modules/**`
    - Avoid business logic in Svelte components

---

## 5. What Good Suggestions Look Like

Good suggestions should be:

- **Specific** – e.g. “Create `src/lib/server/metadata/index.ts` with `fetchBookByIsbn(isbn: string)` that calls OpenLibrary + Google Books + LoC, merges them, and returns a normalized `Book` object.”
- **Incremental** – focused refactors, not “rewrite everything”.
- **Aligned with this direction** – they should:
  - Keep SvelteKit + Cloudflare as the core
  - Improve auth, data, metadata, or domain structure
  - Reduce coupling and increase clarity

Avoid generic, framework-agnostic advice that ignores the constraints and identity above.

---

## 6. Optimization Goal

Always optimize for:

- **Long-term app evolution**
- **Clear boundaries between layers**
- **Stable, debuggable auth and data flows**
- **Developer experience for a small team / solo maintainer**

Rangkai is a **focused, app-only tool for librarians**. All architecture decisions should make that reality more robust, not more complicated.
