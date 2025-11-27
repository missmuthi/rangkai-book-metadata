# Scan History Diagnostic Guide

## Issue

Scanned books are not being saved to history after:

1. Logging in with Google
2. Scanning QR code or ISBN
3. No books appear in /history

## Root Cause Analysis

### Current Flow

```
Mobile Scanner → fetchFromServerless() → GET /api/book/[isbn] → createScan() → D1 Database
```

### Authentication Check in `/api/book/[isbn]`

```typescript
// Line 70-72 in src/routes/api/book/[isbn]/+server.ts
if (!locals.session || !locals.user) {
  return json(
    { error: "Unauthorized: Please log in to save scans" },
    { status: 401 },
  );
}
```

### Session Injection in `hooks.server.ts`

```typescript
// Lines 84-109
if (event.platform?.env?.DB) {
  const { getSession } = await import("$lib/auth-simple");
  const sessionToken = event.cookies.get("session");

  if (sessionToken) {
    const sessionData = await getSession(event.platform.env.DB, sessionToken);
    if (sessionData) {
      event.locals.session = sessionData;
      event.locals.user = sessionData.user;
    }
  }
}
```

## Diagnostic Steps

### 1. Check if session cookie exists

```javascript
// In browser console
document.cookie.split(";").find((c) => c.includes("session"));
```

**Expected**: Should see something like `session=abc123...`
**If missing**: Login failed or cookie not set

### 2. Check API response when scanning

```javascript
// In browser DevTools → Network tab
// Look for request to /api/book/[isbn]
// Check:
// - Status: Should be 200, not 401
// - Response headers: Should have X-Cache: HIT or MISS
// - Response body: Should contain book data
```

**If 401 Unauthorized**:

- Session cookie not sent
- Session expired
- Platform context missing (local dev without D1)

### 3. Check platform context

The code requires `event.platform?.env?.DB` to be available. This is only present in:

- Cloudflare Pages deployment
- Local dev with `wrangler pages dev` or proper D1 binding

**If using `npm run dev`**:

- D1 database is NOT available
- Session will always be null
- History saving will fail silently

### 4. Check database write logs

```javascript
// Server console should show:
// ✅ [DB Log] Scan saved for user {userId}
```

**If missing**:

- Database write failed
- Platform context missing
- User ID not set

## Solution Options

### Option 1: Use Wrangler for local dev (RECOMMENDED)

```bash
# Instead of npm run dev
npm run preview:wrangler
# or
wrangler pages dev .svelte-kit/cloudflare --compatibility-date=2024-01-01
```

### Option 2: Add better error handling

The mobile scanner needs to:

1. Check for 401 responses
2. Show clear error message to user
3. Redirect to login if needed

### Option 3: Add debug logging

Add console.log in mobile scanner to verify:

1. Session data is present in PageData
2. API call succeeds
3. Response contains scan ID

## Quick Test

### Test 1: Verify authentication

```bash
# Navigate to /history page
# Expected: Should NOT redirect to /login
# Expected: Should show "Your Scan History" page
```

### Test 2: Manual API call

```javascript
// In browser console (while logged in)
fetch("/api/book/9780134685991", {
  credentials: "include", // Important: sends cookies
})
  .then((r) => r.json())
  .then(console.log)
  .catch(console.error);
```

**Expected response**:

```json
{
  "title": "Effective Java",
  "author": "Joshua Bloch",
  "isbn13": "9780134685991",
  ...
}
```

### Test 3: Check scan history

```javascript
// After scanning a book, immediately check
fetch("/api/history")
  .then((r) => r.json())
  .then(console.log);
```

**Expected**: Should show array of scans including the just-scanned book

## Files to Check

1. `src/hooks.server.ts` (line 84-109) - Session injection
2. `src/routes/api/book/[isbn]/+server.ts` (line 70-72, 150-157) - Auth check & DB write
3. `src/routes/scan/mobile/+page.svelte` (line 33-51) - API call
4. `src/lib/api.ts` (line 277-317) - fetchFromServerless implementation

## Environment Requirements

**Required for history saving**:

- ✅ Logged in with Google OAuth
- ✅ Valid session cookie
- ✅ Platform context with D1 database (`event.platform?.env?.DB`)
- ✅ Running with Wrangler (not plain `npm run dev`)

## Next Steps

1. **Verify you're running with Wrangler**, not plain `npm run dev`
2. **Check browser console** for any errors when scanning
3. **Check Network tab** for 401 responses
4. **Check server console** for database write logs
5. **Try manual API call** from browser console to isolate issue
