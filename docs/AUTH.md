# Authentication System Documentation

> **Version:** 2.1  
> **Last Updated:** November 28, 2025  
> **Status:** Production-Ready

This document provides a comprehensive guide to the Rangkai authentication system, including architecture, OAuth flow, configuration, and troubleshooting.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [OAuth 2.0 Flow](#oauth-20-flow)
3. [Environment Variables](#environment-variables)
4. [Cookie Configuration](#cookie-configuration)
5. [Database Schema](#database-schema)
6. [Code Reference](#code-reference)
7. [Troubleshooting](#troubleshooting)
8. [Security Considerations](#security-considerations)

---

## Architecture Overview

Rangkai uses a lightweight, custom authentication system built on:

- **[Arctic](https://arctic.js.org/)** - OAuth 2.0 library for Google authentication
- **Cloudflare D1** - SQLite database for user and session storage
- **SvelteKit Hooks** - Request interception for session injection

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Browser                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SvelteKit Application                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   hooks.server.ts                        │    │
│  │  • Intercepts ALL requests                               │    │
│  │  • Reads session cookie                                  │    │
│  │  • Injects session/user into event.locals               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                │                                 │
│          ┌─────────────────────┼─────────────────────┐          │
│          ▼                     ▼                     ▼          │
│  ┌───────────────┐   ┌───────────────────┐   ┌──────────────┐  │
│  │ /api/auth/    │   │ /api/auth/        │   │ Protected    │  │
│  │ google        │   │ callback/google   │   │ Routes       │  │
│  │               │   │                   │   │              │  │
│  │ Initiates     │   │ Handles callback  │   │ Check        │  │
│  │ OAuth flow    │   │ Creates session   │   │ locals.user  │  │
│  └───────────────┘   └───────────────────┘   └──────────────┘  │
│                                │                                 │
└────────────────────────────────┼────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Services                           │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │   Google OAuth 2.0   │    │        Cloudflare D1           │ │
│  │   Authorization      │    │   ┌─────────┐  ┌─────────┐     │ │
│  │   Server             │    │   │  user   │  │ session │     │ │
│  └─────────────────────┘    │   │  table  │  │  table  │     │ │
│                              │   └─────────┘  └─────────┘     │ │
│                              └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

| File                                             | Purpose                                                |
| ------------------------------------------------ | ------------------------------------------------------ |
| `src/lib/auth.ts`                                | Core auth functions (session management, OAuth client) |
| `src/hooks.server.ts`                            | Request interception, session injection                |
| `src/routes/api/auth/google/+server.ts`          | OAuth initiation endpoint                              |
| `src/routes/api/auth/callback/google/+server.ts` | OAuth callback handler                                 |
| `src/routes/api/auth/sign-out/+server.ts`        | Session termination                                    |

---

## OAuth 2.0 Flow

Rangkai implements the OAuth 2.0 Authorization Code flow with PKCE (Proof Key for Code Exchange).

### Flow Diagram

```
User                    Rangkai App                Google OAuth              D1 Database
  │                          │                          │                         │
  │  1. Click "Sign in"      │                          │                         │
  │ ─────────────────────▶   │                          │                         │
  │                          │                          │                         │
  │                          │  2. Generate state +     │                         │
  │                          │     code_verifier        │                         │
  │                          │     Store in cookies     │                         │
  │                          │                          │                         │
  │  3. Redirect to Google   │                          │                         │
  │ ◀───────────────────────│                          │                         │
  │                          │                          │                         │
  │ ───────────────────────────────────────────────▶   │                         │
  │         4. User authenticates with Google          │                         │
  │ ◀──────────────────────────────────────────────────│                         │
  │                          │                          │                         │
  │  5. Redirect to callback │                          │                         │
  │     with ?code=...&state=... │                      │                         │
  │ ─────────────────────▶   │                          │                         │
  │                          │                          │                         │
  │                          │  6. Validate state       │                         │
  │                          │     (compare cookies)    │                         │
  │                          │                          │                         │
  │                          │  7. Exchange code ─────▶ │                         │
  │                          │     for tokens           │                         │
  │                          │ ◀───────────────────────│                         │
  │                          │                          │                         │
  │                          │  8. Fetch user info ───▶ │                         │
  │                          │ ◀───────────────────────│                         │
  │                          │                          │                         │
  │                          │  9. Upsert user ────────────────────────────────▶ │
  │                          │     Create session ─────────────────────────────▶ │
  │                          │ ◀─────────────────────────────────────────────────│
  │                          │                          │                         │
  │  10. Set session cookie  │                          │                         │
  │      Redirect to /       │                          │                         │
  │ ◀────────────────────────│                          │                         │
  │                          │                          │                         │
```

### Step-by-Step Breakdown

#### Step 1-3: Initiation (`/api/auth/google`)

```typescript
// Generate PKCE values
const state = crypto.randomUUID();
const codeVerifier = generateCodeVerifier();

// Store in cookies for callback verification
cookies.set("google_oauth_state", state, { ... });
cookies.set("google_code_verifier", codeVerifier, { ... });

// Redirect to Google
const authUrl = await google.createAuthorizationURL(state, codeVerifier, scopes);
throw redirect(302, authUrl.toString());
```

#### Step 4-5: Google Authentication

User authenticates with Google and grants consent. Google redirects to:

```
https://your-app.pages.dev/api/auth/callback/google?code=...&state=...
```

#### Step 6-10: Callback (`/api/auth/callback/google`)

```typescript
// Validate state (CSRF protection)
if (state !== storedState) {
  throw redirect(302, "/login?error=invalid_state");
}

// Exchange code for tokens
const tokens = await google.validateAuthorizationCode(code, codeVerifier);

// Fetch user info
const googleUser = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
  headers: { Authorization: `Bearer ${tokens.accessToken()}` }
});

// Create user and session in D1
const userId = await upsertUser(db, googleUser.email, ...);
const sessionToken = generateSessionToken();
await createSession(db, userId, sessionToken);

// Set session cookie
cookies.set("session", sessionToken, { ... });
throw redirect(303, "/");
```

---

## Environment Variables

### Required Variables

| Variable               | Description                               | Example (Dev)                      | Example (Prod)                            |
| ---------------------- | ----------------------------------------- | ---------------------------------- | ----------------------------------------- |
| `BETTER_AUTH_URL`      | Your app's public URL (no trailing slash) | `http://localhost:5173`            | `https://rangkai-book-metadata.pages.dev` |
| `GOOGLE_CLIENT_ID`     | OAuth client ID from Google Cloud Console | `123...apps.googleusercontent.com` | Same                                      |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret                       | `GOCSPX-...`                       | Same (use Cloudflare secrets)             |
| `BETTER_AUTH_SECRET`   | Secret for session encryption (32+ chars) | `dev-secret-32-chars-minimum`      | Use cryptographically random value        |

### Setting Environment Variables

#### Local Development (`.dev.vars`)

Create a `.dev.vars` file in the project root (gitignored):

```bash
BETTER_AUTH_URL=http://localhost:5173
BETTER_AUTH_SECRET=development-secret-minimum-32-characters
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

#### Cloudflare Pages (Production)

1. Go to Cloudflare Dashboard → Pages → Your Project → Settings → Environment Variables
2. Add each variable for the **Production** environment
3. For `GOOGLE_CLIENT_SECRET`, use **Encrypt** for security

```bash
# Or via Wrangler CLI
wrangler pages secret put GOOGLE_CLIENT_SECRET
wrangler pages secret put BETTER_AUTH_SECRET
```

### Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project → APIs & Services → Credentials
3. Edit your OAuth 2.0 Client ID
4. Add **Authorized redirect URIs**:

**Development:**

```
http://localhost:5173/api/auth/callback/google
```

**Production:**

```
https://rangkai-book-metadata.pages.dev/api/auth/callback/google
https://your-custom-domain.com/api/auth/callback/google
```

⚠️ **Critical:** The redirect URI must **exactly match** what's computed in code. No trailing slashes, correct protocol.

---

## Cookie Configuration

### OAuth State Cookies (Temporary)

| Cookie                   | Purpose                  | Max Age | Secure          | HttpOnly | SameSite |
| ------------------------ | ------------------------ | ------- | --------------- | -------- | -------- |
| `google_oauth_state`     | CSRF protection          | 10 min  | Context-aware\* | Yes      | Lax      |
| `google_code_verifier`   | PKCE verification        | 10 min  | Context-aware\* | Yes      | Lax      |
| `google_oauth_timestamp` | Replay attack prevention | 10 min  | Context-aware\* | Yes      | Lax      |

### Session Cookie (Persistent)

| Cookie    | Purpose             | Max Age | Secure          | HttpOnly | SameSite |
| --------- | ------------------- | ------- | --------------- | -------- | -------- |
| `session` | User authentication | 7 days  | Context-aware\* | Yes      | Lax      |

**\* Context-aware:** Secure=true for HTTPS (production), Secure=false for HTTP (localhost).

---

## Database Schema

### User Table

```sql
CREATE TABLE user (
  id TEXT PRIMARY KEY,           -- UUID
  email TEXT NOT NULL UNIQUE,    -- From Google profile
  name TEXT,                     -- Display name
  image TEXT,                    -- Profile picture URL
  emailVerified INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Session Table

```sql
CREATE TABLE session (
  id TEXT PRIMARY KEY,           -- UUID
  token TEXT NOT NULL UNIQUE,    -- 64-char hex token
  userId TEXT NOT NULL,          -- FK to user.id
  expiresAt INTEGER NOT NULL,    -- Unix timestamp (ms)
  userAgent TEXT,                -- Browser/device info
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);
```

---

## Code Reference

### Creating a Protected Route

```typescript
// src/routes/dashboard/+page.server.ts
import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  // Require authentication
  if (!locals.session) {
    throw redirect(303, "/login");
  }

  return {
    user: locals.user,
  };
};
```

### Accessing User in Components

```svelte
<script lang="ts">
  import type { PageData } from "./$types";

  let { data } = $props<{ data: PageData }>();

  // Reactive authentication check
  let isLoggedIn = $derived(!!data.user);
</script>

{#if isLoggedIn}
  <p>Welcome, {data.user.name}!</p>
{:else}
  <a href="/login">Sign In</a>
{/if}
```

### Sign Out Handler

```svelte
<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";

  async function handleSignOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    await invalidateAll();
    goto("/login");
  }
</script>

<button onclick={handleSignOut}>Sign Out</button>
```

---

## Troubleshooting

### Common Errors

#### ❌ "Invalid OAuth callback" (400 Bad Request)

**Symptoms:** User is redirected to `/login?error=...` after clicking Google sign-in.

**Causes & Solutions:**

1. **State mismatch (most common)**
   - Cookies may not be persisting between requests
   - Check browser developer tools → Application → Cookies
   - Ensure `sameSite: "lax"` is set (not `strict`)

2. **Cookies blocked in development**
   - Ensure you're accessing via `localhost`, not `127.0.0.1`
   - Disable browser extensions that block cookies

3. **Redirect URI mismatch**
   - Compare the URI in Google Cloud Console with the one in logs
   - Enable debug mode: `/api/auth/google?debug=true`
   - Check for trailing slash differences

4. **HTTPS/HTTP mismatch**
   - Production requires HTTPS; Google won't callback to HTTP
   - Ensure `BETTER_AUTH_URL` uses `https://` in production

#### ❌ "redirect_uri_mismatch" from Google

**Symptoms:** Google shows error page about redirect URI.

**Solution:**

1. Enable debug logging: `?debug=true` on the login URL
2. Copy the **exact** redirect URI from server logs
3. Add it to Google Cloud Console → Credentials → OAuth 2.0 Client IDs

```
Redirect URIs in Google Console must be EXACTLY:
https://rangkai-book-metadata.pages.dev/api/auth/callback/google
```

#### ❌ Session Not Persisting

**Symptoms:** User appears logged in, then logged out on next page.

**Causes & Solutions:**

1. **Secure cookie on HTTP**
   - In development, ensure you're using `http://localhost:5173`
   - The code automatically uses `secure: false` for localhost

2. **Cookie path mismatch**
   - All cookies must use `path: "/"`

3. **D1 database not connected**
   - Check `wrangler.toml` for correct D1 binding
   - Run `wrangler d1 list` to verify database exists

#### ❌ "Platform not configured" (500 Error)

**Symptoms:** OAuth endpoints return 500 error.

**Solution:**

- Ensure you're running with Cloudflare bindings:
  ```bash
  npm run dev  # Uses wrangler pages dev
  ```
- Not `vite dev` directly (no platform bindings)

### Debug Mode

Append `?debug=true` to OAuth endpoints for verbose logging:

```
/api/auth/google?debug=true
/api/auth/callback/google?debug=true
```

This logs:

- Raw vs normalized `BETTER_AUTH_URL`
- Computed redirect URI
- OAuth state comparison
- Cookie presence checks

---

## Security Considerations

### PKCE (Proof Key for Code Exchange)

Rangkai uses PKCE to prevent authorization code interception attacks:

```typescript
// 1. Generate code verifier (high entropy)
const codeVerifier = crypto.getRandomValues(new Uint8Array(32));

// 2. Send hash of verifier to Google
// Arctic handles this internally with createAuthorizationURL()

// 3. Send original verifier on callback
// Google verifies hash(verifier) matches original
```

### State Parameter (CSRF Protection)

The `state` parameter prevents cross-site request forgery:

```typescript
// 1. Generate random state
const state = crypto.randomUUID();

// 2. Store in cookie
cookies.set("google_oauth_state", state);

// 3. Compare on callback
if (url.searchParams.get("state") !== cookies.get("google_oauth_state")) {
  throw error(400, "Invalid state");
}
```

### Session Token Security

- **64 characters of hex** (256 bits of entropy)
- Stored as **httpOnly cookie** (not accessible via JavaScript)
- **7-day expiration** with database-enforced TTL
- **Secure flag** enabled in production (HTTPS only)

### Recommendations

1. **Never log secrets** - Client secrets, session tokens
2. **Use Cloudflare secrets** for sensitive env vars
3. **Rotate secrets** if they're ever exposed
4. **Monitor failed logins** via error redirects

---

## Appendix: Quick Reference

### OAuth Endpoints

| Endpoint                    | Method | Purpose               |
| --------------------------- | ------ | --------------------- |
| `/api/auth/google`          | GET    | Initiate OAuth flow   |
| `/api/auth/callback/google` | GET    | Handle OAuth callback |
| `/api/auth/sign-out`        | POST   | Terminate session     |

### SvelteKit Locals

```typescript
// Available in +page.server.ts, +server.ts, hooks
event.locals.session; // SessionData | null
event.locals.user; // User | null
```

### Session Data Structure

```typescript
interface SessionData {
  session: {
    token: string;
    userId: string;
    expiresAt: Date;
  };
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    emailVerified: number;
    createdAt: string;
    updatedAt: string;
  };
}
```

---

**Need Help?** Check the [main documentation](/docs/README.md) or open an issue on GitHub.
