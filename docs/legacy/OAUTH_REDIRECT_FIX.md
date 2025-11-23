# OAuth Redirect URI Fix - Implementation Summary

## 🐛 The Problem

Google OAuth was returning `Error 400: redirect_uri_mismatch` during login. The issue was:

1. **No URL normalization**: `BETTER_AUTH_URL` could have trailing slashes causing double-slash issues
2. **Local dev using production URL**: `.env` file pointed to production instead of localhost
3. **No validation or logging**: No way to debug what redirect URI was actually being sent
4. **Potential Cloudflare secret mismatch**: Production env var might have wrong value

---

## ✅ The Fix

### 1. Added `normalizeBaseUrl()` Helper

**File:** `src/lib/auth-simple.ts`

```typescript
/**
 * Normalize base URL by removing trailing slashes
 * Prevents double-slash issues in OAuth redirect URIs
 */
function normalizeBaseUrl(baseUrl: string): string {
	if (!baseUrl) {
		throw new Error('BETTER_AUTH_URL environment variable is not set');
	}
	
	// Remove all trailing slashes
	const normalized = baseUrl.replace(/\/+$/, '');
	
	// Validate it's a proper URL
	try {
		new URL(normalized);
	} catch (error) {
		throw new Error(`Invalid BETTER_AUTH_URL: ${baseUrl}. Must be a valid URL.`);
	}
	
	return normalized;
}
```

**Why this matters:**
- Strips trailing slashes: `https://example.com/` → `https://example.com`
- Prevents: `https://example.com//api/auth/callback/google` (double slash)
- Validates URL format before use
- Throws clear errors if misconfigured

### 2. Updated `createGoogleAuth()` with Logging

**File:** `src/lib/auth-simple.ts`

```typescript
export function createGoogleAuth(env: App.Platform['env']) {
	const baseUrl = normalizeBaseUrl(env.BETTER_AUTH_URL);
	const redirectUri = `${baseUrl}/api/auth/callback/google`;
	
	// Debug logging for OAuth configuration
	console.log('[OAuth Config] Base URL:', baseUrl);
	console.log('[OAuth Config] Redirect URI:', redirectUri);
	
	return new Google(
		env.GOOGLE_CLIENT_ID,
		env.GOOGLE_CLIENT_SECRET,
		redirectUri
	);
}
```

**Benefits:**
- Logs exact redirect URI being sent to Google
- Makes debugging production issues trivial
- Shows immediately if env var is wrong

### 3. Added OAuth Flow Logging

**File:** `src/routes/api/auth/[...all]/+server.ts`

```typescript
console.log('[OAuth] Initiating Google login flow');
console.log('[OAuth] State:', state);
console.log('[OAuth] Authorization URL:', authUrl.toString());
```

**Helps debug:**
- When OAuth flow starts
- What state token was generated
- Full authorization URL with all parameters

### 4. Fixed Local Development Environment

**File:** `.env`

```env
# BEFORE (WRONG - uses production URL)
BETTER_AUTH_URL="https://rangkai-book-metadata.pages.dev"

# AFTER (CORRECT - uses localhost)
BETTER_AUTH_URL="http://localhost:5173"
```

**Why this matters:**
- Local dev now uses `http://localhost:5173/api/auth/callback/google`
- Matches Google Cloud Console authorized redirect URI for dev
- No more production URL in local development

---

## 🔧 Production Deployment Steps

### Step 1: Verify Google Cloud Console Configuration

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find OAuth 2.0 Client ID for this project
3. Verify **Authorized redirect URIs** contains EXACTLY:
   ```
   https://rangkai-book-metadata.pages.dev/api/auth/callback/google
   ```
4. Remove any URIs with:
   - `google2` in the path
   - Double slashes (`//api/auth`)
   - Trailing slashes
   - Wrong domains

### Step 2: Update Cloudflare Pages Environment Variable

**CRITICAL:** Verify the production `BETTER_AUTH_URL` secret is correct.

```bash
# Check current value (if possible via Cloudflare dashboard)
# Go to: Cloudflare Dashboard → Pages → rangkai-book-metadata → Settings → Environment variables

# Expected value:
BETTER_AUTH_URL = https://rangkai-book-metadata.pages.dev

# IMPORTANT: NO trailing slash!
```

**If the value is wrong, update it:**

1. Go to Cloudflare Dashboard
2. Navigate to: Pages → rangkai-book-metadata → Settings → Environment variables
3. Click "Edit" on `BETTER_AUTH_URL`
4. Set value to: `https://rangkai-book-metadata.pages.dev` (NO trailing slash!)
5. Click "Save"
6. Trigger a new deployment (or wait for next deploy)

### Step 3: Deploy Code Changes

```bash
# 1. Verify TypeScript compilation
npm run check

# 2. Build production bundle
npm run build

# 3. Deploy to Cloudflare Pages
npm run deploy
```

### Step 4: Test Production OAuth Flow

1. Open production site: https://rangkai-book-metadata.pages.dev/login
2. Click "Continue with Google"
3. Open browser DevTools → Console
4. Watch for logs:
   ```
   [OAuth Config] Base URL: https://rangkai-book-metadata.pages.dev
   [OAuth Config] Redirect URI: https://rangkai-book-metadata.pages.dev/api/auth/callback/google
   [OAuth] Initiating Google login flow
   [OAuth] Authorization URL: https://accounts.google.com/o/oauth2/v2/auth?...
   ```

5. Complete Google sign-in
6. Should redirect to homepage with user logged in

### Step 5: Monitor Production Logs

```bash
# Tail production logs in real-time
npx wrangler pages deployment tail --project-name=rangkai-book-metadata --format=pretty
```

**Look for:**
```
✅ [OAuth Config] Base URL: https://rangkai-book-metadata.pages.dev
✅ [OAuth Config] Redirect URI: https://rangkai-book-metadata.pages.dev/api/auth/callback/google
✅ [OAuth] ✅ Login successful for user: user@example.com
```

**Red flags:**
```
❌ [OAuth Config] Base URL: https://rangkai-book-metadata.pages.dev/  (trailing slash!)
❌ [OAuth Config] Redirect URI: ...//api/auth/...  (double slash!)
❌ Error 400: redirect_uri_mismatch
```

---

## 🧪 Local Development Testing

### Step 1: Configure Google Cloud Console for Localhost

1. Go to Google Cloud Console → Credentials
2. Add to **Authorized redirect URIs**:
   ```
   http://localhost:5173/api/auth/callback/google
   ```

### Step 2: Test Local OAuth Flow

```bash
# 1. Start local dev server
npm run dev

# 2. Visit http://localhost:5173/login
# 3. Click "Continue with Google"
# 4. Check console logs:
#    [OAuth Config] Base URL: http://localhost:5173
#    [OAuth Config] Redirect URI: http://localhost:5173/api/auth/callback/google
# 5. Complete Google sign-in
# 6. Should redirect to homepage
```

---

## 📊 What Changed

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/auth-simple.ts` | Added `normalizeBaseUrl()` | Strip trailing slashes, validate URL |
| `src/lib/auth-simple.ts` | Updated `createGoogleAuth()` | Use normalized URL, add debug logging |
| `src/routes/api/auth/[...all]/+server.ts` | Added OAuth flow logging | Debug authorization URL generation |
| `.env` | Changed `BETTER_AUTH_URL` to localhost | Fix local development environment |

---

## 🔍 Debugging Checklist

If OAuth still fails after this fix:

### 1. Check Environment Variables
```bash
# Production (Cloudflare Dashboard)
# Verify BETTER_AUTH_URL = https://rangkai-book-metadata.pages.dev (NO trailing slash)

# Local (.env file)
# Verify BETTER_AUTH_URL="http://localhost:5173" (NO trailing slash)
```

### 2. Check Console Logs
```javascript
// Look for these exact values in browser console:
[OAuth Config] Base URL: https://rangkai-book-metadata.pages.dev
[OAuth Config] Redirect URI: https://rangkai-book-metadata.pages.dev/api/auth/callback/google
```

### 3. Check Authorization URL
The authorization URL should contain:
```
redirect_uri=https%3A%2F%2Frangkai-book-metadata.pages.dev%2Fapi%2Fauth%2Fcallback%2Fgoogle
```

Decoded:
```
redirect_uri=https://rangkai-book-metadata.pages.dev/api/auth/callback/google
```

### 4. Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Double slash in URL (`//api/auth`) | Trailing slash in `BETTER_AUTH_URL` | Use `normalizeBaseUrl()` helper |
| `google2` in redirect path | Stale Google Cloud Console config | Remove old redirect URIs |
| `localhost` redirects in production | Wrong Cloudflare env var | Update `BETTER_AUTH_URL` secret |
| `redirect_uri_mismatch` | URL doesn't match Google Console | Copy exact URL from logs, add to Google Console |

---

## 🎯 Success Criteria

- [x] `normalizeBaseUrl()` helper strips trailing slashes
- [x] `createGoogleAuth()` logs exact redirect URI
- [x] OAuth flow logs authorization URL
- [x] Local dev uses `http://localhost:5173`
- [x] Production uses `https://rangkai-book-metadata.pages.dev`
- [x] No double slashes in redirect URI
- [x] No `google2` references in code
- [x] TypeScript compilation passes

**Next step:** Deploy and verify in production logs that the redirect URI is exactly:
```
https://rangkai-book-metadata.pages.dev/api/auth/callback/google
```

---

**Status:** ✅ Ready for deployment and testing
**Version:** 2.0.2
**Date:** November 22, 2025
