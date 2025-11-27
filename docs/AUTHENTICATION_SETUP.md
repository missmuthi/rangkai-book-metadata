# 🔐 Authentication Setup Guide (Better Auth + D1)

## Overview

Rangkai v2.0 implements multi-user authentication using **Better Auth** with Cloudflare D1 database and Google OAuth.

## ✅ Completed Implementation

### 1. Database Schema (v2.0)

**File:** `schema.sql`

Better Auth tables created:

- **user**: User profiles (id, name, email, image, timestamps)
- **session**: Active sessions (token, expiresAt, userId)
- **account**: OAuth provider accounts (providerId, accountId, userId)
- **verification**: Email verification tokens

Multi-user scans table:

- Added `user_id TEXT` foreign key → `user(id) ON DELETE CASCADE`
- Added `status TEXT DEFAULT 'draft'` for scan lifecycle management
- Added composite index `idx_scans_user_created` for efficient user queries

### 2. Server Configuration

**File:** `src/lib/auth.ts`

Exports:

- `getAuthWithPlatform(db, baseURL)`: Initialize auth with D1 context
- `Auth` type for TypeScript support

Configuration:

- Google OAuth (requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- Email/password authentication (optional)
- 7-day session expiration
- SQLite compatibility for D1

### 3. Client Configuration

**File:** `src/lib/auth-client.ts`

Exports:

- `signInWithGoogle()`: Initiate Google OAuth flow
- `handleSignOut()`: Sign out and redirect to home
- `getCurrentSession()`: Get active session
- All Better Auth client methods (signIn, signOut, signUp, useSession, etc.)

### 4. API Routes

**File:** `src/routes/api/auth/[...all]/+server.ts`

Handles:

- `POST /api/auth/sign-in`: Sign in with credentials
- `POST /api/auth/sign-up`: Create new account
- `POST /api/auth/sign-out`: End session
- `GET /api/auth/session`: Get current session
- `GET /api/auth/callback/google`: OAuth callback

All methods: GET, POST, PUT, DELETE, PATCH

### 5. Session Injection

**File:** `src/hooks.server.ts`

Updated `handle` hook:

- Fetches session from Better Auth on every request
- Injects `event.locals.session` and `event.locals.user`
- Available in all routes via `locals` or `data`
- Gracefully handles missing platform context (local dev)

### 6. TypeScript Definitions

**File:** `src/app.d.ts`

Added `App.Locals` interface:

```typescript
interface Locals {
  session: {
    user: { id; name; email; image };
    session: { token; expiresAt; userId };
  } | null;
  user: { id; name; email; image } | null;
}
```

### 7. Layout with User Menu

**File:** `src/routes/+layout.svelte`

Features:

- Sticky header with auth status
- User avatar dropdown menu (when authenticated)
- Login button (when not authenticated)
- Links to Dashboard, History, Sign Out
- Responsive design (mobile + desktop)
- Click-outside to close dropdown

**File:** `src/routes/+layout.server.ts`

Passes session data from `locals` to all pages:

```typescript
export const load = async ({ locals }) => ({
  session: locals.session,
  user: locals.user,
});
```

### 8. Login Page

**File:** `src/routes/login/+page.svelte`

Features:

- Google OAuth button
- Loading states
- Error handling
- "Continue without signing in" option
- Redirects to `/dashboard` after successful login
- Modern gradient design

### 9. Environment Variables

**File:** `.env.example`

Required variables:

```bash
BETTER_AUTH_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## 🚀 Deployment Checklist

### ⏳ TODO: Apply Database Schema

```bash
# Remote (Production)
npx wrangler d1 execute rangkai-scans --remote --file=./schema.sql

# Local (Development)
npx wrangler d1 execute rangkai-scans --local --file=./schema.sql
```

**Verify tables created:**

```bash
npx wrangler d1 execute rangkai-scans --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

Expected output:

```
user, session, account, verification, scans
```

### ⏳ TODO: Configure Google OAuth

1. **Go to Google Cloud Console:**
   https://console.cloud.google.com/apis/credentials

2. **Create OAuth 2.0 Client ID:**
   - Application type: "Web application"
   - Authorized redirect URIs:
     - Development: `http://localhost:5173/api/auth/callback/google`
     - Production: `https://rangkai-book-metadata.pages.dev/api/auth/callback/google`

3. **Copy credentials to environment variables:**

   ```bash
   # Local: Create .env file
   cp .env.example .env
   # Edit .env and add your credentials

   # Production: Set in Cloudflare Pages
   # Dashboard → Pages → rangkai-book-metadata → Settings → Environment variables
   # Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
   ```

### ⏳ TODO: Set Production Environment Variables

Go to Cloudflare Pages dashboard:
https://dash.cloudflare.com → Pages → rangkai-book-metadata → Settings → Environment variables

Add:

- `BETTER_AUTH_URL` = `https://rangkai-book-metadata.pages.dev`
- `GOOGLE_CLIENT_ID` = `your-production-client-id`
- `GOOGLE_CLIENT_SECRET` = `your-production-client-secret`

Click "Save and Deploy"

### ⏳ TODO: Test Authentication Flow

1. **Local Testing:**

   ```bash
   npm run dev
   # Visit http://localhost:5173/login
   # Click "Sign in with Google"
   # Verify redirect to /dashboard
   # Check session in header dropdown
   ```

2. **Production Testing:**
   - Deploy to Cloudflare Pages
   - Visit production URL
   - Test Google OAuth flow
   - Verify session persistence
   - Test sign out

---

## 🧪 Manual Testing Checklist

- [ ] Google OAuth login works (creates user record in D1)
- [ ] Session persists across page refreshes (cookie-based)
- [ ] User avatar appears in header dropdown
- [ ] Dropdown menu shows correct user name/email
- [ ] "Sign Out" clears session and redirects to home
- [ ] Protected routes redirect to `/login` if not authenticated
- [ ] `/login` page redirects to `/dashboard` if already authenticated
- [ ] Session expires after 7 days (automatic cleanup)
- [ ] Multiple users can sign in independently
- [ ] User scans are associated with `user_id` in database

---

## 🔍 Troubleshooting

### "Database not configured" error

- **Cause:** Missing `platform.env.DB` binding
- **Fix:** Check `wrangler.toml` has D1 database binding
- **Local dev:** Run with `npm run dev` (uses Wrangler)

### "Failed to initialize database adapter"

- **Cause:** Better Auth trying to connect during build time
- **Fix:** Already implemented - auth is lazy-loaded at runtime

### OAuth redirect mismatch

- **Cause:** Redirect URI not authorized in Google Console
- **Fix:** Add exact callback URL to Google OAuth credentials

### Session not persisting

- **Cause:** Cookie domain mismatch or missing cookies
- **Fix:** Check `BETTER_AUTH_URL` matches current domain

### TypeScript errors in auth files

- **Cause:** Missing `@types/node` for `process.env` access
- **Fix:** Already installed - `npm install --save-dev @types/node`

---

## 📊 Database Queries (Examples)

### Get all users

```sql
SELECT id, name, email, createdAt FROM user ORDER BY createdAt DESC;
```

### Get active sessions

```sql
SELECT s.token, s.expiresAt, u.name, u.email
FROM session s
JOIN user u ON s.userId = u.id
WHERE s.expiresAt > datetime('now');
```

### Get user's scans

```sql
SELECT isbn, title, authors, created_at
FROM scans
WHERE user_id = 'user-id-here'
ORDER BY created_at DESC
LIMIT 10;
```

### Delete expired sessions (automatic cleanup)

```sql
DELETE FROM session WHERE expiresAt < datetime('now');
```

---

## 🔒 Security Best Practices

1. **Environment Variables:**
   - ✅ NEVER commit `.env` to git (already in `.gitignore`)
   - ✅ Use different credentials for dev/staging/production
   - ✅ Rotate `GOOGLE_CLIENT_SECRET` regularly

2. **OAuth Configuration:**
   - ✅ Restrict authorized redirect URIs to known domains
   - ✅ Enable 2FA on Google Cloud Console account
   - ✅ Review OAuth consent screen settings

3. **Session Management:**
   - ✅ 7-day expiration (configurable in `auth.ts`)
   - ✅ Secure cookies with `cookiePrefix: 'rangkai'`
   - ✅ Automatic cleanup of expired sessions

4. **Database Security:**
   - ✅ Foreign key constraints with `ON DELETE CASCADE`
   - ✅ Indexed queries for performance
   - ✅ User data isolated by `user_id`

---

## 📚 References

- **Better Auth Documentation:** https://www.better-auth.com/docs
- **Cloudflare D1:** https://developers.cloudflare.com/d1/
- **Google OAuth Setup:** https://console.cloud.google.com/apis/credentials
- **SvelteKit Hooks:** https://kit.svelte.dev/docs/hooks

---

## 🎯 Next Steps (v2.1+)

Potential enhancements:

- [ ] Email verification flow (currently disabled)
- [ ] Password reset functionality
- [ ] User profile editing page
- [ ] Dashboard with scan history visualization
- [ ] Batch scan upload for authenticated users
- [ ] Export user's scan history (CSV/JSON)
- [ ] Admin role and permissions
- [ ] OAuth with additional providers (GitHub, Microsoft)
- [ ] Two-factor authentication (2FA)
- [ ] User analytics and usage tracking

---

**Status:** ✅ Implementation complete, ready for Google OAuth setup and database migration
**Version:** v2.0
**Date:** 2024-11-21
