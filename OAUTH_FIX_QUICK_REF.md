# OAuth Redirect URI Fix - Quick Reference

## 🎯 What Was Fixed

**Problem:** Google OAuth returning `redirect_uri_mismatch` error.

**Root Causes:**
1. No URL normalization (trailing slashes could cause `//api/auth` double-slashes)
2. No validation or debug logging
3. Local `.env` using production URL instead of localhost

**Solution:**
1. Added `normalizeBaseUrl()` helper to strip trailing slashes
2. Added debug logging to show exact redirect URI being sent
3. Fixed `.env` to use `http://localhost:5173` for local development

---

## 🚀 Deployment Commands

```bash
# 1. Verify configuration
./verify-oauth-config.sh

# 2. Check TypeScript
npm run check

# 3. Deploy to production
npm run build && npm run deploy

# 4. Monitor production logs
npx wrangler pages deployment tail --project-name=rangkai-book-metadata --format=pretty
```

---

## ✅ Expected Logs (Production)

```
[OAuth Config] Base URL: https://rangkai-book-metadata.pages.dev
[OAuth Config] Redirect URI: https://rangkai-book-metadata.pages.dev/api/auth/callback/google
[OAuth] Initiating Google login flow
[OAuth] Authorization URL: https://accounts.google.com/o/oauth2/v2/auth?...
[OAuth] ✅ Login successful for user: user@example.com
```

---

## ⚠️ Production Environment Variable

**CRITICAL:** Verify Cloudflare Pages environment variable:

```
BETTER_AUTH_URL = https://rangkai-book-metadata.pages.dev
```

**NO trailing slash!**

Update in: Cloudflare Dashboard → Pages → rangkai-book-metadata → Settings → Environment variables

---

## 📋 Google Cloud Console

Authorized redirect URIs must contain:

**Development:**
```
http://localhost:5173/api/auth/callback/google
```

**Production:**
```
https://rangkai-book-metadata.pages.dev/api/auth/callback/google
```

Remove any URIs with:
- `google2` in the path
- Double slashes (`//api/auth`)
- Trailing slashes
- Wrong domains

---

## 🔍 Troubleshooting

**If OAuth still fails:**

1. Check browser console for exact redirect URI being sent
2. Compare with Google Cloud Console authorized URIs
3. Verify Cloudflare `BETTER_AUTH_URL` has NO trailing slash
4. Clear browser cookies and try fresh login
5. Check production logs for actual error

**Common issues:**

| Error | Cause | Fix |
|-------|-------|-----|
| `//api/auth` in URL | Trailing slash in env var | Remove trailing slash from `BETTER_AUTH_URL` |
| `redirect_uri_mismatch` | URL not in Google Console | Add exact URL from logs to Google Console |
| Works locally, fails in prod | Wrong Cloudflare secret | Update `BETTER_AUTH_URL` in Cloudflare |

---

## 📝 Files Changed

- `src/lib/auth-simple.ts` - Added URL normalization and logging
- `src/routes/api/auth/[...all]/+server.ts` - Added OAuth flow logging
- `.env` - Changed to localhost for local development
- `verify-oauth-config.sh` - New verification script
- `OAUTH_REDIRECT_FIX.md` - Detailed implementation guide

---

**Status:** ✅ Ready for deployment
**Next:** Deploy and verify production logs show correct redirect URI
