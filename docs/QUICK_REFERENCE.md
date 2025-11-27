# Quick Reference

Cheat sheet for common commands, workflows, and patterns. Keep this open while developing.

---

## 🚀 Common Commands

### Development

```bash
# Start dev server (http://localhost:5173)
npm run dev

# Start with Wrangler (D1/KV bindings)
npm run dev:wrangler

# Type check (watch mode)
npm run check:watch

# Lint code
npm run lint

# Auto-fix linting errors
npm run lint -- --fix
```

### Testing

```bash
# Run all tests
npm test

# Watch mode (auto-rerun on save)
npm run test:watch

# Run specific test file
npm test -- src/lib/__tests__/merge.test.ts

# Type check
npm run check
```

### Build & Deploy

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Deploy to Cloudflare Pages
npm run deploy

# Full validation (tests + lint + type check)
npm run validate
```

### Database (Wrangler)

```bash
# Execute SQL query
wrangler d1 execute rangkai-scans --command="SELECT * FROM user LIMIT 5"

# Run migration
wrangler d1 execute rangkai-scans --file=./schema.sql

# List tables
wrangler d1 execute rangkai-scans --command="SELECT name FROM sqlite_master WHERE type='table'"

# Describe table schema
wrangler d1 execute rangkai-scans --command="PRAGMA table_info(scan_history)"
```

### KV Cache

```bash
# Get cached value
wrangler kv:key get "book:9786235516981" --namespace-id=YOUR_KV_ID

# Delete cache key
wrangler kv:key delete "book:9786235516981" --namespace-id=YOUR_KV_ID

# List all keys
wrangler kv:key list --namespace-id=YOUR_KV_ID
```

### Logs

```bash
# Tail production logs
wrangler pages deployment tail

# Filter by status code
wrangler pages deployment tail --status 5xx

# Filter by method
wrangler pages deployment tail --method POST
```

---

## 📁 Key File Locations

### Source Code

| Path                                    | What It Does            |
| --------------------------------------- | ----------------------- |
| `src/routes/+page.svelte`               | Main search interface   |
| `src/routes/api/book/[isbn]/+server.ts` | Serverless metadata API |
| `src/lib/api.ts`                        | External API fetchers   |
| `src/lib/merge.ts`                      | Data merging logic      |
| `src/lib/cutter.ts`                     | Call number generation  |
| `src/lib/auth-simple.ts`                | Better Auth config      |

### Configuration

| File                 | Purpose                      |
| -------------------- | ---------------------------- |
| `wrangler.toml`      | Cloudflare bindings (D1, KV) |
| `svelte.config.js`   | SvelteKit config             |
| `tailwind.config.ts` | Tailwind customization       |
| `tsconfig.json`      | TypeScript settings          |
| `schema.sql`         | D1 database schema           |
| `.env.local`         | Local environment variables  |

### Documentation

| File                            | Content               |
| ------------------------------- | --------------------- |
| `docs/SYSTEM_OVERVIEW.md`       | Architecture overview |
| `docs/GETTING_STARTED.md`       | Setup guide           |
| `docs/API_INTEGRATION_GUIDE.md` | API integration       |
| `docs/DEPLOYMENT_GUIDE.md`      | Deployment steps      |
| `docs/README.md`                | Documentation index   |

---

## 🔍 Common Workflows

### Adding a New Feature

```bash
# 1. Create feature branch
git checkout -b feature/your-feature-name

# 2. Make changes
# Edit files...

# 3. Run tests
npm test
npm run check

# 4. Commit
git add .
git commit -m "feat: add your feature"

# 5. Push and create PR
git push origin feature/your-feature-name
```

### Debugging API Integration

```typescript
// Add console logs in src/routes/api/book/[isbn]/+server.ts
console.log("Google Books response:", googleData);
console.log("OpenLibrary response:", openlibData);
console.log("LoC response:", locData);
console.log("Merged result:", merged);

// Check browser Network tab → inspect API calls
// Check Wrangler logs: wrangler pages deployment tail
```

### Fixing a Production Bug

```bash
# 1. Reproduce locally
npm run dev
# Test the bug scenario

# 2. Create hotfix branch
git checkout -b hotfix/bug-description

# 3. Fix + test
npm test
npm run check

# 4. Deploy to production
git commit -m "fix: bug description"
git push origin hotfix/bug-description
# Merge PR → Auto-deploys via CI/CD

# 5. Verify fix in production
# Visit https://rangkai-book-metadata.pages.dev
```

### Running Database Migration

```bash
# 1. Create migration file
touch migrations/$(date +%Y%m%d%H%M%S)_your_migration.sql

# 2. Write SQL
# ALTER TABLE ...

# 3. Test locally (if using Wrangler dev)
wrangler d1 execute rangkai-scans --local --file=./migrations/xxx.sql

# 4. Apply to production
wrangler d1 execute rangkai-scans --file=./migrations/xxx.sql

# 5. Verify
wrangler d1 execute rangkai-scans --command="PRAGMA table_info(your_table)"
```

---

## 🐛 Troubleshooting

### "npm install" Fails

```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### TypeScript Errors on First Run

```bash
npm run prepare  # Regenerate SvelteKit types
# Restart VS Code TypeScript server: CMD+Shift+P → "Restart TS Server"
```

### Port 5173 Already in Use

```bash
lsof -ti:5173 | xargs kill -9  # Kill process
npm run dev -- --port 3000      # Use different port
```

### Google Books API 403

Check `.env.local` has correct API key:

```bash
VITE_GOOGLE_BOOKS_API_KEY=AIzaSy...
```

### Cloudflare Binding Not Found

Check `wrangler.toml` has correct IDs:

```toml
[[d1_databases]]
binding = "DB"
database_id = "your-actual-id"
```

---

## 📊 Data Merging Priorities

| Field       | Priority Order           |
| ----------- | ------------------------ |
| Title       | Google → OL → LoC        |
| Authors     | Merge all (deduplicated) |
| Publisher   | Google → OL              |
| DDC         | **OpenLibrary only**     |
| LCC         | **LoC → OL**             |
| Cover       | Google → OL              |
| Subjects    | **Merge all**            |
| Description | Google → OL              |

---

## 🔐 Environment Variables

### Development (.env.local)

```bash
VITE_GOOGLE_BOOKS_API_KEY=AIzaSy...
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your-oauth-client-id
GOOGLE_CLIENT_SECRET=your-oauth-secret
```

### Production (Cloudflare Pages)

Set in: Pages → Settings → Environment variables

```bash
VITE_GOOGLE_BOOKS_API_KEY=<prod-key>
BETTER_AUTH_SECRET=<secure-random-string>
BETTER_AUTH_URL=https://rangkai-book-metadata.pages.dev
GOOGLE_CLIENT_ID=<prod-oauth-client>
GOOGLE_CLIENT_SECRET=<prod-oauth-secret>
```

---

## 🧪 Testing Patterns

### Unit Test Example

```typescript
// src/lib/__tests__/merge.test.ts
import { describe, test, expect } from "vitest";
import { mergeBookData } from "../merge";

describe("mergeBookData", () => {
  test("prefers Google title over OpenLibrary", () => {
    const result = mergeBookData(
      { title: "Google Title" }, // Google
      { title: "OL Title" }, // OpenLibrary
      null, // LoC
    );

    expect(result.title).toBe("Google Title");
  });
});
```

### API Route Test Example

```typescript
// src/routes/api/book/__tests__/isbn.test.ts
import { describe, test, expect } from "vitest";

describe("GET /api/book/[isbn]", () => {
  test("returns book data for valid ISBN", async () => {
    const response = await GET({
      params: { isbn: "9786235516981" },
      platform: mockPlatform,
    });

    const data = await response.json();
    expect(data.title).toBeDefined();
  });
});
```

---

## 📦 Key Dependencies

| Package         | Version | Purpose             |
| --------------- | ------- | ------------------- |
| `svelte`        | 5.x     | UI framework        |
| `@sveltejs/kit` | 2.x     | SSR, routing        |
| `typescript`    | 5.x     | Type safety         |
| `tailwindcss`   | 3.x     | Styling             |
| `kysely`        | 0.28.x  | Type-safe SQL       |
| `html5-qrcode`  | 2.x     | Barcode scanning    |
| `arctic`        | 3.x     | OAuth (Better Auth) |

---

## 🎨 Code Style

### TypeScript

```typescript
// ✅ Good: Explicit types
function fetchBook(isbn: string): Promise<BookData> {
  // ...
}

// ❌ Bad: Implicit any
function fetchBook(isbn) {
  // ...
}
```

### Svelte 5 Runes

```typescript
// ✅ Good: Use $state for reactive variables
let count = $state(0);
let doubled = $derived(count * 2);

// ❌ Bad: Old Svelte 4 syntax
let count = 0;
$: doubled = count * 2;
```

### Tailwind CSS

```html
<!-- ✅ Good: Utility classes -->
<div class="flex items-center gap-4 p-6 bg-white rounded-lg shadow-md">
  <!-- ❌ Bad: Custom CSS -->
  <div class="my-custom-card"></div>
</div>
```

---

## 🔄 Git Workflow

### Commit Message Format

```
feat: add new feature
fix: fix bug in component
docs: update README
refactor: simplify logic
test: add unit tests
chore: update dependencies
```

### Branch Naming

```
feature/add-batch-import
fix/isbn-validation
hotfix/api-timeout
refactor/data-merging
docs/api-guide
```

---

## 📞 Getting Help

**Documentation:**

- Start: `docs/GETTING_STARTED.md`
- Architecture: `docs/ARCHITECTURE.md`
- APIs: `docs/API_INTEGRATION_GUIDE.md`
- Deploy: `docs/DEPLOYMENT_GUIDE.md`

**Code Issues:**

- Check existing GitHub Issues
- Review related test files
- Add console logs and inspect behavior

**Deployment Issues:**

- Check Cloudflare Pages logs
- Verify environment variables
- Review `wrangler.toml` bindings

---

**Last Updated:** 2025-01-22
