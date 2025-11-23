# Getting Started

This guide gets you from zero to running the Rangkai Book Metadata application locally in under 10 minutes. It assumes you're on macOS/Linux and have basic command-line knowledge.

**Goal:** Run the dev server, search for an ISBN, see merged metadata, and understand the codebase structure.

---

## ✅ When to Read This Doc

- You're a **new developer** setting up your local environment for the first time
- You need to **run the app quickly** without understanding all internals
- You're **troubleshooting dev setup** issues
- You're writing a **CI/CD setup** and need to replicate the build process

## 📌 Keep This Updated When…

- **Prerequisites change** (e.g., Node version bumps)
- **Environment variables** are added/removed
- **Setup scripts** are added (e.g., `npm run setup-db`)
- **Common setup errors** are discovered and solved

---

## Prerequisites

Install these tools before proceeding:

### 1. Node.js & npm

**Required Version:** Node.js 18.x or higher

```bash
# Check current version
node -v  # Should be v18.0.0 or higher
npm -v   # Should be 9.x or higher

# Install via nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### 2. Git

```bash
# Verify git is installed
git --version  # Should be 2.x or higher
```

### 3. VS Code (Recommended)

Download from [code.visualstudio.com](https://code.visualstudio.com/)

**Recommended Extensions:**
- Svelte for VS Code
- Tailwind CSS IntelliSense
- ESLint
- TypeScript + JavaScript
- Prettier

---

## Quick Setup (5 Minutes)

### Step 1: Clone the Repository

```bash
git clone https://github.com/missmuthi/rangkai-book-metadata.git
cd rangkai-book-metadata
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs:
- SvelteKit + Svelte 5
- TypeScript + type definitions
- Tailwind CSS
- Cloudflare Wrangler (dev tooling)
- Testing libraries (Vitest)

**Expected output:** `added 437 packages` (numbers may vary)

### Step 3: Create Environment Variables

```bash
# Copy example env file
cp .env.example .env.local

# Edit with your API key
nano .env.local  # or use VS Code
```

Add your Google Books API key:

```bash
# .env.local
VITE_GOOGLE_BOOKS_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**How to get a Google Books API key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Books API"
4. Create credentials → API Key
5. Copy the key into `.env.local`

**⚠️ NEVER commit `.env.local` to git!** It's already in `.gitignore`.

### Step 4: Run the Development Server

```bash
npm run dev
```

**Expected output:**
```
  VITE v7.1.10  ready in 1234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## First Test: Search for a Book

### Test ISBN Lookup

1. In the search box, enter: `9786235516981`
2. Click "Search" or press Enter
3. Wait 1-2 seconds
4. You should see merged metadata from 3 sources

**What's happening behind the scenes:**
- Frontend calls `/api/book/9786235516981`
- API route fetches from Google Books, OpenLibrary, Library of Congress
- Data merging logic combines results (see `src/lib/merge.ts`)
- Result cached in memory for subsequent requests

### Test Title Search

1. Clear the search box
2. Enter: `Clean Code`
3. Wait for results
4. Select a book from dropdown (if multiple results)

**Note:** Title searches are slower (3-5 seconds) because they query multiple books, not just one ISBN.

---

## Project Structure Overview

Once you're inside the codebase, here's how to navigate:

```
rangkai-book-metadata/
│
├── src/
│   ├── lib/                    # Shared utilities, business logic
│   │   ├── api.ts              # ⭐ External API calls
│   │   ├── merge.ts            # ⭐ Data merging logic
│   │   ├── cutter.ts           # Call number generation
│   │   ├── export.ts           # SLiMS export formats
│   │   ├── auth-simple.ts      # Better Auth config
│   │   └── components/         # Reusable UI components
│   │       └── CameraScanner.svelte  # Barcode scanning
│   │
│   ├── routes/                 # SvelteKit file-based routing
│   │   ├── +page.svelte        # ⭐ Main search interface
│   │   ├── +layout.svelte      # App wrapper (nav, footer)
│   │   ├── scan/
│   │   │   └── mobile/+page.svelte  # Mobile scanner UI
│   │   ├── dashboard/+page.svelte   # User history
│   │   └── api/                # Server-side API routes
│   │       ├── book/[isbn]/+server.ts   # ⭐ Main API endpoint
│   │       ├── scan/+server.ts          # Save scan to DB
│   │       └── auth/[...all]/+server.ts # Better Auth handlers
│   │
│   ├── app.html                # HTML template
│   └── app.css                 # Global styles + Tailwind imports
│
├── docs/                       # 📚 Documentation (you are here)
│   ├── SYSTEM_OVERVIEW.md
│   ├── GETTING_STARTED.md
│   └── ...
│
├── static/                     # Static assets (images, favicon)
├── tests/                      # Test suites (Vitest)
│
├── wrangler.toml               # Cloudflare deployment config
├── schema.sql                  # D1 database schema
├── package.json                # Dependencies & scripts
├── svelte.config.js            # SvelteKit config
├── tailwind.config.ts          # Tailwind customization
└── tsconfig.json               # TypeScript config
```

**Key files to explore first:**
1. `src/routes/+page.svelte` - Main UI logic
2. `src/lib/api.ts` - How we fetch from external APIs
3. `src/lib/merge.ts` - Waterfall prioritization logic
4. `src/routes/api/book/[isbn]/+server.ts` - Serverless endpoint

---

## Common Tasks

### Run Tests

```bash
# Run all tests (unit + integration)
npm test

# Watch mode (auto-rerun on file save)
npm run test:watch

# Type checking
npm run check
```

### Lint Code

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint -- --fix
```

### Build for Production

```bash
# Create optimized production build
npm run build

# Output: .svelte-kit/cloudflare/
```

### Preview Production Build Locally

```bash
npm run preview

# Opens on http://localhost:4173
```

---

## Troubleshooting Setup Issues

### Issue: `npm install` Fails

**Symptom:** `ERESOLVE unable to resolve dependency tree`

**Solution:**
```bash
# Clear npm cache
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Issue: Port 5173 Already in Use

**Symptom:** `Error: Port 5173 is already in use`

**Solution:**
```bash
# Find and kill the process
lsof -ti:5173 | xargs kill -9

# Or use a different port
npm run dev -- --port 3000
```

### Issue: TypeScript Errors on First Run

**Symptom:** Red squiggly lines in VS Code, errors about `$types`

**Solution:**
```bash
# Regenerate SvelteKit types
npm run prepare

# Or restart VS Code's TypeScript server
# CMD+Shift+P → "TypeScript: Restart TS Server"
```

### Issue: Google Books API Returns 403

**Symptom:** "API key not valid" error in console

**Solution:**
1. Verify API key in `.env.local` is correct
2. Check that "Books API" is enabled in Google Cloud Console
3. Ensure no extra spaces/quotes around the key in `.env.local`

### Issue: D1 Database Not Found (Local Dev)

**Symptom:** "Binding DB not found" error

**Solution:**
Local dev doesn't use D1. The app should mock database calls. If you need D1 locally:

```bash
# Use Wrangler dev mode instead of Vite
npm run dev:wrangler
```

---

## Next Steps

Now that you have the app running:

1. **Read `SYSTEM_OVERVIEW.md`** - Understand the architecture
2. **Read `API_INTEGRATION_GUIDE.md`** - Learn how external APIs work
3. **Explore `src/lib/merge.ts`** - See data merging logic
4. **Try Scanner Mode** - Go to `/scan/mobile` and use your phone camera
5. **Make a small change** - Edit UI text in `src/routes/+page.svelte` and see HMR in action

---

## Development Workflow

### Daily Workflow

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install new dependencies (if package.json changed)
npm install

# 3. Start dev server
npm run dev

# 4. Make changes, see instant updates

# 5. Run tests before committing
npm test
npm run check

# 6. Commit with semantic message
git commit -m "feat: add title autocomplete"
```

### Before Creating a PR

```bash
# Run full validation suite
npm run validate  # Runs tests, lint, type-check

# Build to ensure no production errors
npm run build
```

---

## Environment Variables Reference

| Variable | Required? | Purpose | Example |
|----------|-----------|---------|---------|
| `VITE_GOOGLE_BOOKS_API_KEY` | Yes (local dev) | Google Books API access | `AIzaSy...` |
| `VITE_APP_VERSION` | No | Shown in UI footer | `2.0.2` |
| `DATABASE_URL` | No (prod only) | D1 database connection | Auto-injected by Cloudflare |
| `KV_BOOK_CACHE` | No (prod only) | KV cache binding | Auto-injected by Cloudflare |

**Local vs Production:**
- Local dev uses `.env.local` (not committed)
- Production uses Cloudflare Pages environment variables (set in dashboard)

---

## Getting Help

### Documentation

- **System Architecture:** `docs/SYSTEM_OVERVIEW.md`
- **API Integration:** `docs/API_INTEGRATION_GUIDE.md`
- **Deployment:** `docs/DEPLOYMENT_GUIDE.md`
- **Legacy Docs:** Root-level `.md` files (being migrated to `/docs`)

### Code Examples

- **API Usage:** `USAGE_EXAMPLES.ts` (root directory)
- **Analytics Events:** `ANALYTICS_TELEMETRY.md`
- **Testing Patterns:** `src/lib/__tests__/`

### Community

- **GitHub Issues:** Report bugs or request features
- **Pull Requests:** Contribute code improvements
- **Discussions:** Ask questions (GitHub Discussions)

---

## Next Time You Change X, Update:

- **Add new environment variable** → Update this doc + `.env.example` + Cloudflare dashboard
- **Change Node version** → Update this doc + `.nvmrc` + CI/CD config
- **Add new setup script** → Update this doc's "Common Tasks" section
- **Discover new setup gotcha** → Add to "Troubleshooting" section

## Questions This Doc Should Answer But Doesn't Yet:

- How do I set up the mobile camera scanner for local testing?
- What's the process for testing Cloudflare Workers locally?
- How do I seed the D1 database with test data?
- What's the recommended VS Code debugging configuration?
- How do I run E2E tests with Playwright?
