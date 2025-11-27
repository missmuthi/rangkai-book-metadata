# Fix: Scanned Books Not Saving to History

## 🔍 Problem
After logging in with Google and scanning books (QR code or ISBN), no books appear in the history page.

## ✅ Root Cause
**You're running the app with `npm run dev` which doesn't have access to the D1 database.** The session and history saving features require Cloudflare platform context to work.

## 🚀 Solution

### Step 1: Build the app first
```bash
npm run build
```

### Step 2: Run with Wrangler (with D1 database access)
```bash
npm run dev:wrangler
```

The app will be available at: `http://localhost:8788`

### Why this matters:
- `npm run dev` → Vite dev server → **No D1 database** → Sessions don't work → History not saved
- `npm run dev:wrangler` → Wrangler Pages → **With D1 database** → Sessions work → History saved ✅

## 🔧 Alternative: Enhanced Dev Script (Recommended)

Add this script to your `package.json` for a better development experience:

```json
{
  "scripts": {
    "dev:full": "npm run build && npm run dev:wrangler"
  }
}
```

Then run:
```bash
npm run dev:full
```

## 🧪 Verify It's Working

### 1. Check server console
When you scan a book, you should see:
```
✅ [DB Log] Scan saved for user {user-id}
✅ [KV Write] {isbn} cached
```

### 2. Check browser console
The scanner now logs:
```
[Scanner] Looking up ISBN: 9780134685991
[Scanner] Session status: Authenticated
[Scanner] ✅ Book fetched successfully
[Scanner] Book saved to history: Yes
```

### 3. Check history page
Navigate to `/history` - you should see your scanned books listed.

## 🐛 Troubleshooting

### Issue: "Session status: Not authenticated"
**Cause**: Not logged in
**Fix**: Go to `/login` and sign in with Google

### Issue: 401 Unauthorized error
**Cause**: Running with `npm run dev` instead of `npm run dev:wrangler`
**Fix**: Stop the dev server and run `npm run dev:wrangler`

### Issue: "D1_ERROR" in console
**Cause**: D1 database not initialized
**Fix**: 
```bash
# Check if D1 binding is configured
cat wrangler.toml | grep -A 3 d1_databases

# Initialize database if needed
wrangler d1 execute DB --local --file=schema.sql
```

### Issue: Build takes too long
**Workaround**: Keep the build running in watch mode in one terminal:
```bash
# Terminal 1
npm run build -- --watch

# Terminal 2
npm run dev:wrangler
```

## 📊 How It Works Now

```
┌─────────────────────────────────────────────────────────────┐
│ User scans ISBN → Mobile Scanner                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ GET /api/book/[isbn]                                         │
│ ├─ Check auth: locals.session ✓                             │
│ ├─ Fetch metadata (Google Books, OpenLibrary, LoC)          │
│ ├─ Save to D1: createScan(db, userId, isbn, ...)            │
│ └─ Cache to KV: cacheSet(kv, isbn, metadata)                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ D1 Database (scans table)                                    │
│ ├─ user_id: "abc123..."                                     │
│ ├─ isbn: "9780134685991"                                    │
│ ├─ title: "Effective Java"                                  │
│ └─ created_at: 2024-01-27T...                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ User visits /history → Shows scanned books ✓                │
└─────────────────────────────────────────────────────────────┘
```

## 📝 What Changed

### 1. Added debug logging to mobile scanner
File: `src/routes/scan/mobile/+page.svelte`
- Logs authentication status
- Logs scan success/failure
- Helps identify issues quickly

### 2. Enhanced API error messages
File: `src/routes/api/book/[isbn]/+server.ts`
- Better error message when auth fails
- Hints to use `dev:wrangler` instead of `dev`

### 3. Created diagnostic guide
File: `diagnose-scan-history.md`
- Comprehensive troubleshooting steps
- Test procedures
- Architecture overview

## 🎯 Quick Start Checklist

- [ ] Stop current dev server (`Ctrl+C`)
- [ ] Run `npm run build`
- [ ] Run `npm run dev:wrangler`
- [ ] Navigate to `http://localhost:8788`
- [ ] Log in with Google
- [ ] Scan a book (use ISBN: `9780134685991` for testing)
- [ ] Check browser console for `[Scanner] ✅ Book fetched successfully`
- [ ] Check server console for `✅ [DB Log] Scan saved`
- [ ] Visit `/history` to see your scan

## 💡 Pro Tips

1. **Keep it running**: Once you've built the app, you can keep `dev:wrangler` running and make changes to Svelte files - they'll hot reload

2. **Database changes**: If you modify database schema, you need to:
   ```bash
   wrangler d1 execute DB --local --file=schema.sql
   ```

3. **Clear session**: If you need to test fresh login:
   ```javascript
   // In browser console
   document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
   location.reload()
   ```

4. **Check database**: View your scans directly:
   ```bash
   wrangler d1 execute DB --local --command="SELECT * FROM scans ORDER BY created_at DESC LIMIT 10"
   ```

---

**Summary**: The issue was that the app needs Cloudflare platform context (D1 + KV) to save scans to history. Running with `npm run dev:wrangler` instead of `npm run dev` provides this context and fixes the issue.
