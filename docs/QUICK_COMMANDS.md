# Quick Commands Reference

## 🧪 Testing OAuth Flow

### 1. Reset Database (Local)

```bash
npx wrangler d1 execute rangkai-scans --local --file=reset-database.sql
```

### 2. Reset Database (Production - ⚠️ Caution)

```bash
npx wrangler d1 execute rangkai-scans --remote --file=reset-database.sql
```

### 3. Check Database Contents

```bash
# View all users
npx wrangler d1 execute rangkai-scans --local --command="SELECT * FROM user;"

# View all sessions
npx wrangler d1 execute rangkai-scans --local --command="SELECT * FROM session;"

# Count records
npx wrangler d1 execute rangkai-scans --local --command="SELECT COUNT(*) as users FROM user;"
npx wrangler d1 execute rangkai-scans --local --command="SELECT COUNT(*) as sessions FROM session;"
```

---

## 🚀 Development

### Start Dev Server

```bash
npm run dev
# Visit http://localhost:5173
```

### TypeScript Check

```bash
npm run check
```

### Build Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

---

## 📊 Monitoring Production

### Tail Deployment Logs

```bash
npx wrangler pages deployment tail --project-name=rangkai-book-metadata --format=pretty
```

### List Recent Deployments

```bash
npx wrangler pages deployment list --project-name=rangkai-book-metadata
```

### Tail Specific Deployment

```bash
npx wrangler pages deployment tail --project-name=rangkai-book-metadata --deployment-id=<deployment-id> --format=pretty
```

---

## 🔐 Managing Secrets

### Set Secret

```bash
npx wrangler pages secret put BETTER_AUTH_SECRET
npx wrangler pages secret put GOOGLE_CLIENT_ID
npx wrangler pages secret put GOOGLE_CLIENT_SECRET
npx wrangler pages secret put BETTER_AUTH_URL
```

### List Secrets

```bash
npx wrangler pages secret list --project-name=rangkai-book-metadata
```

---

## 🗄️ Database Management

### Execute SQL File (Local)

```bash
npx wrangler d1 execute rangkai-scans --local --file=schema.sql
npx wrangler d1 execute rangkai-scans --local --file=migrations/v2.0-auth-migration.sql
```

### Execute SQL File (Remote)

```bash
npx wrangler d1 execute rangkai-scans --remote --file=schema.sql
```

### Execute Single Command

```bash
npx wrangler d1 execute rangkai-scans --local --command="SELECT COUNT(*) FROM scans;"
```

### Backup Database (Remote)

```bash
npx wrangler d1 export rangkai-scans --remote --output=backup-$(date +%Y%m%d).sql
```

---

## 🧹 Cleanup Commands

### Delete All Sessions (Keep Users)

```bash
npx wrangler d1 execute rangkai-scans --local --command="DELETE FROM session;"
```

### Delete Specific User

```bash
# Replace USER_ID with actual user ID
npx wrangler d1 execute rangkai-scans --local --command="DELETE FROM session WHERE userId = 'USER_ID'; DELETE FROM scans WHERE user_id = 'USER_ID'; DELETE FROM user WHERE id = 'USER_ID';"
```

### Clear All Data (Fresh Start)

```bash
npx wrangler d1 execute rangkai-scans --local --file=reset-database.sql
```

---

## 🐛 Debugging

### View Recent Logs

```bash
# Production logs
npx wrangler pages deployment tail --project-name=rangkai-book-metadata --format=pretty

# Look for these patterns:
# [OAuth] ✅ Login successful for user: ...
# [AUTH] Session created for user ...
# [Sign Out] ✅ Session deleted from database
```

### Check Session Cookie

```
1. Open browser DevTools (F12)
2. Go to Application → Cookies
3. Look for "session" cookie
4. Verify HttpOnly, Secure, SameSite=Lax flags
```

### Verify OAuth Configuration

```
1. Visit https://console.cloud.google.com/apis/credentials
2. Find OAuth Client ID
3. Check Authorized redirect URIs:
   - http://localhost:5173/api/auth/callback/google
   - https://rangkai-book-metadata.pages.dev/api/auth/callback/google
```

---

## 🚀 Deployment

### Deploy to Cloudflare Pages

```bash
# Build first
npm run build

# Deploy (auto-triggered by git push to main)
git add .
git commit -m "fix: OAuth callback redirect handling"
git push origin main

# Or manual deploy with Wrangler
npx wrangler pages deploy .svelte-kit/cloudflare
```

### Set Environment Variables

```
1. Go to Cloudflare Dashboard
2. Pages → rangkai-book-metadata → Settings → Environment variables
3. Set for Production:
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - BETTER_AUTH_URL=https://rangkai-book-metadata.pages.dev
   - BETTER_AUTH_SECRET (already set)
```

---

## 📦 Dependencies

### Update Dependencies

```bash
npm update
```

### Install New Package

```bash
npm install <package-name>
```

### Check for Outdated Packages

```bash
npm outdated
```

---

## ✅ Pre-Deployment Checklist

```bash
# Run all checks
npm run check        # TypeScript (must pass)
npm run build        # Production build (must succeed)

# Test locally
npm run preview      # Test production build
# Visit http://localhost:4173

# Verify database
npx wrangler d1 execute rangkai-scans --remote --command="SELECT COUNT(*) FROM user;"

# Check secrets
npx wrangler pages secret list --project-name=rangkai-book-metadata

# Test OAuth flow in production
# 1. Visit https://rangkai-book-metadata.pages.dev/login
# 2. Sign in with Google
# 3. Verify redirect to home page
# 4. Sign out
# 5. Verify redirect to /login
```

---

## 🎯 Common Tasks

### Add a New Route

```bash
# Create new route file
touch src/routes/new-route/+page.svelte
touch src/routes/new-route/+page.server.ts
```

### Add Protected Route

```typescript
// In +page.server.ts
import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.session) {
    throw redirect(303, "/login");
  }

  return {
    user: locals.user,
  };
};
```

### Run Database Migration

```bash
# Create migration file
touch migrations/v2.1-feature-name.sql

# Apply locally
npx wrangler d1 execute rangkai-scans --local --file=migrations/v2.1-feature-name.sql

# Apply to production
npx wrangler d1 execute rangkai-scans --remote --file=migrations/v2.1-feature-name.sql
```

---

**Last Updated:** November 21, 2025
**Version:** 2.0.1
