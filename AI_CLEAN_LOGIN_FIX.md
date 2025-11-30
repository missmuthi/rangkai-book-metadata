# AI Clean Login Failure - Diagnostic Fix

## Problem
When clicking "AI Clean" button in production, the operation fails with an error message.

## Root Cause Analysis
The AI Clean endpoint (`/api/ai/clean/+server.ts`) requires authentication but was returning a generic "Unauthorized" error without diagnostic information. This made it impossible to determine the exact cause of the failure.

## Changes Made

### 1. Enhanced Server-Side Logging (`/api/ai/clean/+server.ts`)
Added comprehensive logging to track authentication flow:
- Session existence check
- User existence check  
- Platform/environment availability check
- Database connection verification

```typescript
console.warn('[AI Clean] Authentication check started');
console.warn('[AI Clean] locals.session exists:', !!locals.session);
console.warn('[AI Clean] locals.user exists:', !!locals.user);
console.warn('[AI Clean] platform exists:', !!platform);
console.warn('[AI Clean] platform.env exists:', !!platform?.env);
console.warn('[AI Clean] DB exists:', !!platform?.env?.DB);
```

### 2. Improved Error Messages
Changed from generic "Unauthorized" to specific error messages:
- `"Authentication required. Please log in again."` with code `NO_SESSION`
- `"Database unavailable. This may be a deployment configuration issue."` with code `NO_DATABASE`

### 3. Frontend Error Display (`BookDetailModal.svelte`)
Enhanced error handling to show the actual error message from the server:
```typescript
try {
    const errorData = await res.json();
    errorMessage = errorData.error || errorMessage;
} catch {
    const errorText = await res.text();
    errorMessage = errorText || errorMessage;
}
toast = errorMessage; // Display specific error to user
```

### 4. Session Loading Diagnostics (`hooks.server.ts`)
Added logging for authentication failures in API routes:
- Logs when session token is missing
- Logs when session token is invalid/expired
- Logs when platform.env.DB is unavailable

## Debugging in Production

### Step 1: Check Browser Console
After clicking "AI Clean", check the browser console for:
```
[BookDetailModal] AI clean failed: <error details>
```

### Step 2: Check Production Logs
Look for these log entries in Cloudflare Pages logs:

**Authentication Check:**
```
[AI Clean] Authentication check started
[AI Clean] locals.session exists: false/true
[AI Clean] locals.user exists: false/true
[AI Clean] platform exists: false/true
[AI Clean] DB exists: false/true
```

**Session Loading (from hooks.server.ts):**
```
[Auth] No session token found for /api/ai/clean
[Auth] Invalid/expired session token for /api/ai/clean
[Auth] No platform.env.DB available for /api/ai/clean
```

### Step 3: Identify the Issue

| Log Output | Issue | Solution |
|------------|-------|----------|
| `locals.session exists: false` | Session not loaded in hooks | Check if user is logged in, session may have expired |
| `locals.user exists: false` | User not loaded in hooks | Check if user is logged in, session may have expired |
| `DB exists: false` | Database binding missing | Check Cloudflare Pages environment bindings |
| `No session token found` | User not logged in or cookie cleared | User needs to log in again |
| `Invalid/expired session token` | Session expired | User needs to log in again |

## Common Production Issues

### Issue 1: Session Expired
**Symptoms:** User was logged in, but AI Clean suddenly fails
**Cause:** Session cookie expired (7-day expiry)
**Solution:** User must log in again

### Issue 2: Database Binding Missing
**Symptoms:** AI Clean fails for all users
**Cause:** Cloudflare Pages environment variable `DB` not bound
**Solution:** Check Cloudflare Pages settings → Functions → D1 Bindings

### Issue 3: Cookie Not Being Sent
**Symptoms:** Session exists in database but not recognized
**Cause:** SameSite cookie policy or CORS issue
**Solution:** Check cookie settings and ensure requests are same-origin

## Testing Instructions

### Local Testing
```bash
# Start dev server
npm run dev

# Test AI Clean:
# 1. Log in with Google
# 2. Scan a book or search for one
# 3. Click "AI Clean" button
# 4. Check console for diagnostic logs
```

### Production Testing
1. Deploy changes to production
2. Log in to the application
3. Scan or search for a book
4. Click "AI Clean" button
5. If it fails, check:
   - Browser console for error message
   - Cloudflare Pages logs for diagnostic output

## Next Steps

1. Deploy these changes to production
2. Reproduce the AI Clean failure
3. Collect the diagnostic logs
4. Based on the logs, determine if it's:
   - Session expiry issue → User needs to re-authenticate
   - Database binding issue → Fix Cloudflare Pages configuration
   - Code bug → Further investigation needed

## Files Modified
- `src/routes/api/ai/clean/+server.ts` - Enhanced auth logging and error messages
- `src/lib/components/BookDetailModal.svelte` - Better error display
- `src/hooks.server.ts` - Session loading diagnostics
