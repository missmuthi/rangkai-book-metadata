# Deployment Guide

This guide covers deploying Rangkai Book Metadata to Cloudflare Pages (production), managing environment variables, database migrations, and rollback procedures. Follow this for safe, zero-downtime deployments.

**Target Platform:** Cloudflare Pages + Workers + D1 + KV

---

## ✅ When to Read This Doc

- You're **deploying to production** for the first time
- You need to **update environment variables** in production
- You're **rolling back** a broken deployment
- You're **migrating the database schema** (D1 migrations)
- You're **troubleshooting deployment failures**
- You're **setting up CI/CD pipelines**

## 📌 Keep This Updated When…

- **Deployment platform** changes (e.g., switching to Vercel)
- **New environment variables** are added
- **Database migration process** changes
- **Cloudflare bindings** (D1, KV, etc.) are added/removed
- **Build process** changes (new build steps, dependencies)

---

## Prerequisites

### 1. Cloudflare Account Setup

**Create Account:**

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com/)
2. Verify email
3. (Optional) Add payment method for production usage

**Required Services:**

- ✅ Cloudflare Pages (hosting)
- ✅ Cloudflare Workers (serverless API)
- ✅ Cloudflare D1 (database)
- ✅ Cloudflare KV (cache)

**Free Tier Limits:**

- Workers: 100,000 requests/day
- D1: 5 GB storage, 5M reads/day
- KV: 100,000 reads/day, 1,000 writes/day
- Pages: Unlimited bandwidth

### 2. Install Wrangler CLI

```bash
# Install globally
npm install -g wrangler

# Verify installation
wrangler --version  # Should be 3.x or higher

# Login to Cloudflare
wrangler login
```

This opens a browser window to authorize Wrangler.

### 3. Local Environment Setup

**Create `.env.local` (never commit this):**

```bash
# Google Books API Key
VITE_GOOGLE_BOOKS_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# App version (shown in UI footer)
VITE_APP_VERSION=2.0.2

# Better Auth secrets (generate secure random strings)
BETTER_AUTH_SECRET=your-secret-key-here  # Use: openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:5173   # Local dev

# OAuth Credentials (Google, GitHub, etc.)
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
```

**Generate Secure Secrets:**

```bash
# Better Auth secret
openssl rand -base64 32

# OAuth Client Secret (from Google Cloud Console)
# 1. Go to console.cloud.google.com
# 2. APIs & Services → Credentials
# 3. Create OAuth 2.0 Client ID
# 4. Copy Client ID + Client Secret
```

---

## First-Time Production Setup

### Step 1: Create Cloudflare Pages Project

**Via Cloudflare Dashboard:**

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com/)
2. Navigate to **Pages**
3. Click **Create application** → **Connect to Git**
4. Authorize Cloudflare to access your GitHub repository
5. Select repository: `rangkai-book-metadata`
6. Configure build:
   - **Build command:** `npm run build`
   - **Build output directory:** `.svelte-kit/cloudflare`
   - **Root directory:** `/`
7. Click **Save and Deploy**

**Via Wrangler CLI:**

```bash
# From project root
wrangler pages project create rangkai-book-metadata

# Output:
# ✅ Successfully created the 'rangkai-book-metadata' project.
# 🌎 Deploy URL: https://rangkai-book-metadata.pages.dev
```

### Step 2: Create D1 Database

```bash
# Create production database
wrangler d1 create rangkai-scans

# Output:
# ✅ Successfully created DB 'rangkai-scans'!
# 📋 Database ID: c3d6dcc2-e7b8-4537-8b23-67d8921b3233

# Update wrangler.toml with database ID
```

**Update `wrangler.toml`:**

```toml
[[d1_databases]]
binding = "DB"
database_name = "rangkai-scans"
database_id = "c3d6dcc2-e7b8-4537-8b23-67d8921b3233"  # From output above
```

**Run Initial Migration:**

```bash
# Execute schema.sql against D1 database
wrangler d1 execute rangkai-scans --file=./schema.sql

# Output:
# 🌀 Executing on rangkai-scans (c3d6dcc2-e7b8-4537-8b23-67d8921b3233):
# 🚣 Executed 10 commands in 0.5 seconds
```

**Verify Database:**

```bash
# List tables
wrangler d1 execute rangkai-scans --command="SELECT name FROM sqlite_master WHERE type='table';"

# Expected output:
# ┌────────────────┐
# │ name           │
# ├────────────────┤
# │ user           │
# │ session        │
# │ account        │
# │ scan_history   │
# └────────────────┘
```

### Step 3: Create KV Namespace

```bash
# Create KV namespace for book cache
wrangler kv:namespace create BOOK_CACHE

# Output:
# ✅ Successfully created KV namespace!
# 📋 ID: 0844494af5e74ac1b28600f686a060c2

# Update wrangler.toml with KV ID
```

**Update `wrangler.toml`:**

```toml
[[kv_namespaces]]
binding = "BOOK_CACHE"
id = "0844494af5e74ac1b28600f686a060c2"  # From output above
```

### Step 4: Set Environment Variables (Production)

**Via Cloudflare Dashboard:**

1. Go to **Pages** → **rangkai-book-metadata** → **Settings** → **Environment variables**
2. Add production variables:

| Variable Name               | Value                                     | Environment |
| --------------------------- | ----------------------------------------- | ----------- |
| `VITE_GOOGLE_BOOKS_API_KEY` | `AIzaSy...`                               | Production  |
| `BETTER_AUTH_SECRET`        | (generated secret)                        | Production  |
| `BETTER_AUTH_URL`           | `https://rangkai-book-metadata.pages.dev` | Production  |
| `GOOGLE_CLIENT_ID`          | (OAuth client ID)                         | Production  |
| `GOOGLE_CLIENT_SECRET`      | (OAuth client secret)                     | Production  |

**Via Wrangler CLI:**

```bash
# Set environment variables (one-time setup)
wrangler pages secret put BETTER_AUTH_SECRET

# Prompt: Enter the secret value:
# (Paste your generated secret)

wrangler pages secret put GOOGLE_CLIENT_SECRET
# (Paste your OAuth client secret)
```

**⚠️ IMPORTANT:** Never commit `.env.local` or secrets to Git!

### Step 5: Deploy to Production

```bash
# Build the project
npm run build

# Deploy to Cloudflare Pages
npm run deploy

# Or manually:
wrangler pages deploy .svelte-kit/cloudflare
```

**Output:**

```
✨ Compiled Worker successfully
🌍 Uploading... (123 files)
✨ Success! Uploaded 123 files (2.3 MB)
🌎 Deploying to production environment...
✅ Deployment complete!

🚀 https://rangkai-book-metadata.pages.dev
```

**Verify Deployment:**

1. Visit https://rangkai-book-metadata.pages.dev
2. Test ISBN search: `9786235516981`
3. Verify data merging from 3 sources
4. Test authentication (Google login)
5. Check browser console for errors

---

## Continuous Deployment (CI/CD)

### GitHub Actions Workflow

**Create `.github/workflows/deploy.yml`:**

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches:
      - main # Deploy on push to main branch

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Type check
        run: npm run check

      - name: Build
        run: npm run build
        env:
          VITE_GOOGLE_BOOKS_API_KEY: ${{ secrets.GOOGLE_BOOKS_API_KEY }}

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: rangkai-book-metadata
          directory: .svelte-kit/cloudflare
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

**Setup GitHub Secrets:**

1. Go to **GitHub repo** → **Settings** → **Secrets and variables** → **Actions**
2. Add secrets:

| Secret Name             | Value        | How to Get                                     |
| ----------------------- | ------------ | ---------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | (API token)  | Cloudflare Dashboard → My Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | (account ID) | Cloudflare Dashboard → Workers → Account ID    |
| `GOOGLE_BOOKS_API_KEY`  | (API key)    | Google Cloud Console → APIs & Services         |

**Create Cloudflare API Token:**

1. Go to [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use template: **Edit Cloudflare Workers**
4. Permissions:
   - Account → Cloudflare Pages → Edit
   - Account → D1 → Edit (if running migrations)
5. Copy token (only shown once!)

**Test CI/CD:**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add Cloudflare Pages deployment workflow"
git push origin main

# Check GitHub Actions tab for deployment status
```

---

## Database Migrations

### Creating a New Migration

**1. Create Migration File:**

```bash
# Create timestamped migration file
mkdir -p migrations
touch migrations/$(date +%Y%m%d%H%M%S)_add_book_tags.sql
```

**2. Write Migration SQL:**

```sql
-- migrations/20250122120000_add_book_tags.sql

-- Add tags column to scan_history
ALTER TABLE scan_history ADD COLUMN tags TEXT;

-- Create index for faster tag searches
CREATE INDEX idx_scan_history_tags ON scan_history(tags);
```

**3. Test Locally (Optional):**

```bash
# Run against local D1 database
wrangler d1 execute rangkai-scans --local --file=./migrations/20250122120000_add_book_tags.sql
```

**4. Apply to Production:**

```bash
# Execute migration on production D1
wrangler d1 execute rangkai-scans --file=./migrations/20250122120000_add_book_tags.sql

# Verify changes
wrangler d1 execute rangkai-scans --command="PRAGMA table_info(scan_history);"
```

### Rollback Strategy

**⚠️ D1 doesn't support transactions across migrations.**

**Best Practice:** Always create a rollback migration.

**Example Rollback:**

```sql
-- migrations/20250122120001_rollback_add_book_tags.sql

-- Remove tags column
ALTER TABLE scan_history DROP COLUMN tags;

-- Remove index
DROP INDEX IF EXISTS idx_scan_history_tags;
```

**Execute Rollback:**

```bash
wrangler d1 execute rangkai-scans --file=./migrations/20250122120001_rollback_add_book_tags.sql
```

### Migration Checklist

- [ ] Create migration file with timestamp
- [ ] Write forward migration SQL
- [ ] Write rollback migration SQL (if possible)
- [ ] Test on local D1 database
- [ ] Backup production data (if destructive)
- [ ] Apply migration during low-traffic period
- [ ] Verify changes with test query
- [ ] Monitor application for errors
- [ ] Keep rollback migration ready

---

## Deployment Checklist

### Pre-Deployment

- [ ] Run tests locally: `npm test`
- [ ] Run type check: `npm run check`
- [ ] Run lint: `npm run lint`
- [ ] Build locally: `npm run build`
- [ ] Preview build: `npm run preview`
- [ ] Test critical flows (search, export, login)
- [ ] Check CHANGELOG.md is updated
- [ ] Create git tag: `git tag v2.0.2`

### Deployment

- [ ] Merge to `main` branch (triggers CI/CD)
- [ ] Monitor GitHub Actions workflow
- [ ] Wait for deployment to complete (~2-5 minutes)
- [ ] Check deployment URL (from GitHub Actions log)

### Post-Deployment Verification

- [ ] Visit production URL
- [ ] Test ISBN search with known ISBN
- [ ] Verify 3-source data merging
- [ ] Test Google OAuth login
- [ ] Check scanner mode (`/scan/mobile`)
- [ ] Verify D1 database connectivity
- [ ] Check KV cache (inspect response headers: `X-Cache: HIT`)
- [ ] Monitor error logs in Cloudflare Dashboard
- [ ] Check analytics events are firing

### Rollback (If Needed)

- [ ] Identify last known good deployment
- [ ] Revert git commit: `git revert <commit-hash>`
- [ ] Push to trigger new deployment
- [ ] Verify rollback successful

---

## Environment Management

### Environment Variables Strategy

**Development (.env.local):**

```bash
VITE_GOOGLE_BOOKS_API_KEY=<dev-api-key>
BETTER_AUTH_URL=http://localhost:5173
GOOGLE_CLIENT_ID=<dev-oauth-client>
```

**Production (Cloudflare Dashboard):**

```bash
VITE_GOOGLE_BOOKS_API_KEY=<prod-api-key>
BETTER_AUTH_URL=https://rangkai-book-metadata.pages.dev
GOOGLE_CLIENT_ID=<prod-oauth-client>
```

**Staging (Optional):**

```bash
VITE_GOOGLE_BOOKS_API_KEY=<dev-api-key>  # Use dev quota
BETTER_AUTH_URL=https://staging.rangkai-book-metadata.pages.dev
```

### Accessing Environment Variables

**In Server Routes:**

```typescript
// src/routes/api/book/[isbn]/+server.ts
export async function GET({ platform }) {
  const apiKey = platform.env.VITE_GOOGLE_BOOKS_API_KEY;
  // Use apiKey...
}
```

**In Client Code (Vite):**

```typescript
// src/routes/+page.svelte
const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;
```

**⚠️ Only expose to client if necessary!** Server-side secrets should stay in Workers.

---

## Monitoring & Debugging

### Cloudflare Dashboard Metrics

**Navigate to:** Pages → rangkai-book-metadata → Analytics

**Key Metrics:**

- **Requests:** Total HTTP requests per day
- **Bandwidth:** Data transferred
- **Errors:** 4xx/5xx response counts
- **Function Invocations:** Workers API calls
- **D1 Queries:** Database read/write counts
- **KV Operations:** Cache hit/miss rates

### Real-Time Logs

**Tail Workers Logs:**

```bash
wrangler pages deployment tail

# Output:
# [2025-01-22 12:34:56] GET /api/book/9786235516981 - 200 OK (1234ms)
# [2025-01-22 12:34:57] Cache HIT: book:9786235516981
```

**Filter by Status Code:**

```bash
wrangler pages deployment tail --status 5xx

# Shows only 500-level errors
```

### Common Issues & Solutions

**1. "Binding DB not found"**

**Cause:** D1 database not linked in `wrangler.toml`.

**Solution:**

```toml
[[d1_databases]]
binding = "DB"
database_name = "rangkai-scans"
database_id = "your-actual-database-id"
```

**2. "KV key not found"**

**Cause:** Cache miss (expected) or KV namespace not linked.

**Solution:** Check `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "BOOK_CACHE"
id = "your-actual-kv-id"
```

**3. "Google Books API 403 Forbidden"**

**Cause:** API key not set or quota exceeded.

**Solution:**

- Verify `VITE_GOOGLE_BOOKS_API_KEY` in Cloudflare Pages settings
- Check quota usage in Google Cloud Console

**4. "OAuth redirect_uri mismatch"**

**Cause:** Google OAuth client not configured for production URL.

**Solution:**

- Go to Google Cloud Console → OAuth 2.0 Client
- Add authorized redirect URI:
  - `https://rangkai-book-metadata.pages.dev/api/auth/callback/google`

---

## Production Optimization

### Enable CDN Caching

**Add Cache Headers to API Responses:**

```typescript
// src/routes/api/book/[isbn]/+server.ts
return json(data, {
  headers: {
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
    "X-Cache": cacheHit ? "HIT" : "MISS",
  },
});
```

**Benefits:**

- Cloudflare edge caches responses
- Reduces Worker invocations
- Faster response times globally

### Enable Compression

**Cloudflare Auto-Compresses:**

- Gzip/Brotli automatically enabled
- No configuration needed
- ~70% size reduction for JSON/HTML

### Minimize Cold Starts

**Current Cold Start:** ~5-10ms (Workers V8 isolates)

**Optimization:**

- Keep bundle size small (<1MB)
- Avoid heavy dependencies in Workers
- Use lazy loading for infrequent code paths

---

## Security Hardening

### Content Security Policy (CSP)

**Add to `+layout.svelte`:**

```svelte
<svelte:head>
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https://books.google.com https://covers.openlibrary.org; connect-src 'self' https://www.googleapis.com https://openlibrary.org https://www.loc.gov;"
  />
</svelte:head>
```

### HTTPS Enforcement

**Cloudflare Pages Auto-Enables:**

- HTTPS by default
- Auto SSL certificate
- HTTP → HTTPS redirect

### Rate Limiting (Planned)

**Add Cloudflare Rate Limiting Rules:**

1. Go to **Security** → **WAF** → **Rate limiting rules**
2. Create rule:
   - **Rule name:** API rate limit
   - **URI Path:** `/api/*`
   - **Requests:** 100 per 1 minute
   - **Action:** Block with 429 status

---

## Next Time You Change X, Update:

- **Add new environment variable** → Update this doc + `.env.example` + Cloudflare Pages settings
- **Change deployment platform** → Rewrite entire deployment section
- **Add new Cloudflare binding** → Update `wrangler.toml` + binding setup steps
- **Change database schema** → Add migration section + update schema.sql
- **Update build process** → Update GitHub Actions workflow + build commands

## Questions This Doc Should Answer But Doesn't Yet:

- How do we handle zero-downtime deployments with database migrations?
- What's the disaster recovery plan for D1 database corruption?
- How do we set up staging environment separate from production?
- What's the process for rotating API keys without downtime?
- How do we handle secrets in CI/CD for external contributors?
- What's the backup strategy for D1 database?
