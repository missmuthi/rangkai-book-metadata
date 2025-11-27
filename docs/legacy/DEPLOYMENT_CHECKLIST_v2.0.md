# 🔐 Rangkai v2.0 - Production Deployment Checklist

# Zero-Trust Security Protocol for Identity Layer Deployment

## ══════════════════════════════════════════════════════════════

## PHASE 1: PRE-DEPLOYMENT VERIFICATION

## ══════════════════════════════════════════════════════════════

### 1.1 Code Quality Checks (Local)

```bash
# Verify TypeScript compilation
npm run check

# Run tests
npm test

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

**Expected Results:**

- ✅ 0 TypeScript errors
- ✅ All tests passing
- ✅ Build completes successfully
- ✅ Preview runs without errors

### 1.2 Security Audit (Local)

```bash
# Check .gitignore is properly configured
cat .gitignore | grep -E "\.env|\.wrangler|better-auth-secret"

# Verify no secrets in code
grep -r "GOOGLE_CLIENT_SECRET\|BETTER_AUTH_SECRET" src/ --exclude-dir=node_modules

# Audit npm packages
npm audit --production
```

**Expected Results:**

- ✅ .env, .wrangler/, better-auth-secret.txt are ignored
- ✅ No hardcoded secrets found in src/
- ✅ No critical vulnerabilities (or documented/accepted)

### 1.3 Database Backup (CRITICAL)

```bash
# Export current production database BEFORE migration
npx wrangler d1 export rangkai-scans --remote --output=backup-pre-v2-$(date +%Y%m%d-%H%M%S).sql

# Verify backup file exists and is not empty
ls -lh backup-pre-v2-*.sql
```

**Expected Results:**

- ✅ Backup file created (size > 0 bytes)
- ✅ File saved in safe location (NOT committed to git)
- ✅ Backup tested (can be imported if needed)

## ══════════════════════════════════════════════════════════════

## PHASE 2: GOOGLE OAUTH SETUP

## ══════════════════════════════════════════════════════════════

### 2.1 Create OAuth 2.0 Credentials

**Navigate to:**
https://console.cloud.google.com/apis/credentials

**Steps:**

1. Select project or create new project: "Rangkai Book Metadata"
2. Click "CREATE CREDENTIALS" → "OAuth client ID"
3. Application type: **Web application**
4. Name: "Rangkai Production"

**Authorized JavaScript origins:**

```
https://rangkai-book-metadata.pages.dev
```

**Authorized redirect URIs:**

```
https://rangkai-book-metadata.pages.dev/api/auth/callback/google
```

5. Click "CREATE"
6. **COPY** Client ID and Client Secret (you'll need these in Phase 3)

**Security Checklist:**

- [ ] OAuth consent screen configured (external, non-sensitive scopes)
- [ ] Test users added (if app is in testing mode)
- [ ] Redirect URIs match production URL EXACTLY
- [ ] 2FA enabled on Google Cloud Console account

### 2.2 Generate Better Auth Secret

```bash
# Generate a cryptographically secure secret (32+ characters)
openssl rand -base64 32

# Or use Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Expected Output:** Random string like `dGhpcyBpcyBhIHNlY3JldCBrZXkgZm9yIGJldHRlciBhdXRo==`

**CRITICAL:**

- ✅ Store this secret securely (password manager)
- ✅ NEVER commit to git
- ✅ Use different secret for dev/staging/production

## ══════════════════════════════════════════════════════════════

## PHASE 3: CLOUDFLARE PAGES SECRETS CONFIGURATION

## ══════════════════════════════════════════════════════════════

### 3.1 Navigate to Cloudflare Pages Dashboard

```
https://dash.cloudflare.com → Pages → rangkai-book-metadata → Settings → Environment variables
```

### 3.2 Set Production Environment Variables

**Option A: Via Cloudflare Dashboard (Recommended for Production)**

Click "Add environment variable" and add:

| Variable Name        | Value                                     | Environment |
| -------------------- | ----------------------------------------- | ----------- |
| BETTER_AUTH_SECRET   | `<output from Phase 2.2>`                 | Production  |
| BETTER_AUTH_URL      | `https://rangkai-book-metadata.pages.dev` | Production  |
| GOOGLE_CLIENT_ID     | `<from Google Cloud Console>`             | Production  |
| GOOGLE_CLIENT_SECRET | `<from Google Cloud Console>`             | Production  |

**Option B: Via Wrangler CLI (Alternative)**

```bash
# Set Better Auth Secret
echo "<your-generated-secret>" | npx wrangler pages secret put BETTER_AUTH_SECRET --project-name=rangkai-book-metadata

# Set Better Auth URL
echo "https://rangkai-book-metadata.pages.dev" | npx wrangler pages secret put BETTER_AUTH_URL --project-name=rangkai-book-metadata

# Set Google Client ID
echo "<your-google-client-id>" | npx wrangler pages secret put GOOGLE_CLIENT_ID --project-name=rangkai-book-metadata

# Set Google Client Secret
echo "<your-google-client-secret>" | npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name=rangkai-book-metadata
```

**Verification:**

```bash
# List configured secrets (values will be masked)
npx wrangler pages secret list --project-name=rangkai-book-metadata
```

**Expected Output:**

```
BETTER_AUTH_SECRET: ******** (set)
BETTER_AUTH_URL: ******** (set)
GOOGLE_CLIENT_ID: ******** (set)
GOOGLE_CLIENT_SECRET: ******** (set)
```

## ══════════════════════════════════════════════════════════════

## PHASE 4: DATABASE MIGRATION

## ══════════════════════════════════════════════════════════════

### 4.1 Test Migration on Local Database (Optional but Recommended)

```bash
# Apply migration to local D1
npx wrangler d1 execute rangkai-scans --local --file=./migrations/v2.0-auth-migration.sql

# Verify tables created locally
npx wrangler d1 execute rangkai-scans --local --command="SELECT name FROM sqlite_master WHERE type='table';"
```

**Expected Output:**

```
user, session, account, verification, scans
```

### 4.2 Apply Migration to Production Database

```bash
# ⚠️ CRITICAL: This modifies production data
# Ensure backup from Phase 1.3 exists before proceeding

# Apply migration to remote D1
npx wrangler d1 execute rangkai-scans --remote --file=./migrations/v2.0-auth-migration.sql
```

### 4.3 Verify Migration Success

```bash
# Check all tables exist
npx wrangler d1 execute rangkai-scans --remote --command="SELECT name FROM sqlite_master WHERE type='table';"

# Verify scans table has new columns
npx wrangler d1 execute rangkai-scans --remote --command="PRAGMA table_info(scans);"

# Count scans by user (should show system-user-legacy-import if data exists)
npx wrangler d1 execute rangkai-scans --remote --command="SELECT user_id, COUNT(*) as count FROM scans GROUP BY user_id;"

# Check indexes
npx wrangler d1 execute rangkai-scans --remote --command="SELECT name FROM sqlite_master WHERE type='index' AND tbl_name IN ('scans', 'user', 'session');"
```

**Expected Results:**

- ✅ 5 tables: user, session, account, verification, scans
- ✅ scans table has columns: id, user_id, isbn, title, json_data, status, created_at, updated_at
- ✅ All indexes created (10 total: 5 for Better Auth, 5 for scans)
- ✅ Existing scans assigned to 'system-user-legacy-import' (if any existed)

## ══════════════════════════════════════════════════════════════

## PHASE 5: DEPLOYMENT

## ══════════════════════════════════════════════════════════════

### 5.1 Commit and Push Code

```bash
# Stage all v2.0 changes
git add .

# Commit with descriptive message
git commit -m "feat: v2.0 - Multi-user authentication with Better Auth

- Add Better Auth with Google OAuth integration
- Implement user-scoped data isolation (scans table)
- Add session management via hooks.server.ts
- Create login page and user menu UI
- Update database schema with user/session/account tables
- Harden .gitignore for secrets management
- Update agents.md with v2.0 security constraints"

# Push to main branch (triggers Cloudflare Pages deployment)
git push origin main
```

### 5.2 Monitor Deployment

**Cloudflare Pages Dashboard:**

```
https://dash.cloudflare.com → Pages → rangkai-book-metadata → Deployments
```

**Watch build logs for:**

- ✅ Build succeeds (npm run build completes)
- ✅ No TypeScript errors
- ✅ Deployment completes
- ✅ New deployment URL is active

### 5.3 Smoke Test (Production)

**Test Authentication Flow:**

```
1. Visit: https://rangkai-book-metadata.pages.dev/login
2. Click "Sign in with Google"
3. Authorize with Google account
4. Verify redirect to /dashboard (or /home)
5. Check user menu in header (avatar, name, email)
6. Test "Sign Out" button
7. Verify redirect to home page after sign out
```

**Test Protected Routes:**

```
1. Sign out (if signed in)
2. Visit: https://rangkai-book-metadata.pages.dev/dashboard
3. Verify redirect to /login (unauthorized)
4. Sign in again
5. Verify access to /dashboard (authorized)
```

**Test Book Search (Authenticated):**

```
1. Sign in
2. Search for ISBN: 9780134092669
3. Verify book data displays
4. Check that scan is saved to database with user_id
```

## ══════════════════════════════════════════════════════════════

## PHASE 6: POST-DEPLOYMENT VERIFICATION

## ══════════════════════════════════════════════════════════════

### 6.1 Database Health Check

```bash
# Verify user was created after first OAuth login
npx wrangler d1 execute rangkai-scans --remote --command="SELECT id, name, email, createdAt FROM user LIMIT 5;"

# Check active sessions
npx wrangler d1 execute rangkai-scans --remote --command="SELECT userId, token, expiresAt FROM session WHERE expiresAt > unixepoch() LIMIT 5;"

# Verify scans are user-scoped
npx wrangler d1 execute rangkai-scans --remote --command="SELECT s.id, s.isbn, s.user_id, u.email FROM scans s JOIN user u ON s.user_id = u.id LIMIT 10;"
```

### 6.2 Security Audit

```bash
# Verify secrets are not exposed in client bundle
curl -s https://rangkai-book-metadata.pages.dev/_app/immutable/chunks/*.js | grep -i "client_secret\|better_auth_secret"

# Expected: No matches (secrets should not be in client code)

# Check CSP headers
curl -I https://rangkai-book-metadata.pages.dev | grep -i "content-security-policy"

# Verify HTTPS is enforced
curl -I http://rangkai-book-metadata.pages.dev | grep -i "location"
# Expected: Redirect to HTTPS
```

### 6.3 Performance Monitoring

**Lighthouse Audit:**

```bash
# Install Lighthouse CLI (if not installed)
npm install -g lighthouse

# Run audit
lighthouse https://rangkai-book-metadata.pages.dev --output html --output-path lighthouse-v2.0.html --view
```

**Expected Scores:**

- ✅ Performance: >90
- ✅ Accessibility: >95
- ✅ Best Practices: >95
- ✅ SEO: >90

## ══════════════════════════════════════════════════════════════

## PHASE 7: ROLLBACK PLAN (IF ISSUES OCCUR)

## ══════════════════════════════════════════════════════════════

### 7.1 Immediate Rollback (Revert Deployment)

**Option A: Via Cloudflare Dashboard**

```
1. Go to: Pages → rangkai-book-metadata → Deployments
2. Find previous deployment (v1.3.0)
3. Click "..." menu → "Rollback to this deployment"
4. Confirm rollback
```

**Option B: Via Git Revert**

```bash
# Revert the last commit
git revert HEAD

# Push revert commit
git push origin main

# Cloudflare will auto-deploy the reverted version
```

### 7.2 Database Rollback (If Migration Failed)

```bash
# Restore from backup (created in Phase 1.3)
npx wrangler d1 execute rangkai-scans --remote --file=backup-pre-v2-YYYYMMDD-HHMMSS.sql

# Verify restoration
npx wrangler d1 execute rangkai-scans --remote --command="SELECT COUNT(*) FROM scans;"
```

### 7.3 Post-Rollback Cleanup

```bash
# Remove environment variables (if rolling back completely)
npx wrangler pages secret delete BETTER_AUTH_SECRET --project-name=rangkai-book-metadata
npx wrangler pages secret delete GOOGLE_CLIENT_SECRET --project-name=rangkai-book-metadata

# Or keep them for next attempt (recommended)
```

## ══════════════════════════════════════════════════════════════

## PHASE 8: DOCUMENTATION & TEAM NOTIFICATION

## ══════════════════════════════════════════════════════════════

### 8.1 Update CHANGELOG.md

```markdown
## [2.0.0] - 2024-11-21

### 🔐 Added (Identity Layer)

- Multi-user authentication with Better Auth
- Google OAuth integration (primary login method)
- User-scoped scan history (privacy and data isolation)
- Session management with 7-day expiration
- Protected routes with authentication middleware
- User menu in header (avatar, dashboard, sign out)
- Login page with Google OAuth button

### 🗄️ Database Changes

- Added `user` table (Better Auth)
- Added `session` table (Better Auth)
- Added `account` table (OAuth providers)
- Added `verification` table (email verification)
- Modified `scans` table: added `user_id` foreign key, `status` column
- Created 10 indexes for performance

### 🔒 Security

- Environment variable management for OAuth secrets
- User data isolation (one user cannot access another's scans)
- Session-based authentication (no JWT in localStorage)
- CSP-compliant image handling
- Hardened .gitignore for secrets management

### 📚 Documentation

- Created AUTHENTICATION_SETUP.md
- Updated agents.md with v2.0 security constraints
- Added migration guide (migrations/v2.0-auth-migration.sql)
- Updated .env.example with OAuth credentials template

### ⚠️ Breaking Changes

- All scans now require user authentication
- Existing scans assigned to 'system-user-legacy-import'
- Protected routes redirect to /login if not authenticated
```

### 8.2 Notify Team/Users

**Internal Team:**

```
Subject: 🚀 Rangkai v2.0 Deployed - Multi-User Authentication Live

The Identity Layer (v2.0) is now live in production!

Key Changes:
- Users must sign in with Google to save scans
- All scan data is now user-scoped (privacy compliant)
- New user menu in header with dashboard access
- Session-based authentication (7-day expiration)

Testing:
- Production URL: https://rangkai-book-metadata.pages.dev
- Test login with your Google account
- Report any issues to: [issue tracker URL]

Rollback Plan:
- Deployment can be rolled back via Cloudflare dashboard
- Database backup exists: backup-pre-v2-YYYYMMDD.sql
```

**End Users (If applicable):**

```
📢 New Feature: User Accounts!

You can now sign in with your Google account to:
- Save your scan history across devices
- Access your scans from anywhere
- Keep your data private and secure

To get started:
1. Click "Login" in the top-right corner
2. Sign in with Google
3. Start scanning books!

Note: Signing in is optional. You can still use Rangkai without an account,
but your scans won't be saved.
```

## ══════════════════════════════════════════════════════════════

## DEPLOYMENT COMPLETION CHECKLIST

## ══════════════════════════════════════════════════════════════

Mark each item as completed:

### Pre-Deployment

- [ ] npm run check passes (0 errors)
- [ ] npm test passes (100%)
- [ ] npm run build succeeds
- [ ] Database backup created
- [ ] .gitignore verified (no secrets exposed)

### Google OAuth Setup

- [ ] OAuth client created in Google Cloud Console
- [ ] Redirect URIs configured correctly
- [ ] Client ID and Client Secret obtained
- [ ] OAuth consent screen configured

### Secrets Configuration

- [ ] BETTER_AUTH_SECRET generated (32+ chars)
- [ ] All 4 environment variables set in Cloudflare Pages
- [ ] Secrets verified with `wrangler pages secret list`

### Database Migration

- [x] Migration tested locally (optional but Recommended)
- [x] Migration applied to production
- [x] All 5 tables exist (user, session, account, verification, scans)
- [x] All 10 indexes created
- [x] Existing scans migrated successfully

### Deployment

- [ ] Code committed and pushed to main
- [ ] Cloudflare Pages build completed
- [ ] Deployment status: Success
- [ ] Production URL active

### Testing

- [ ] Google OAuth login works
- [ ] User menu displays correctly
- [ ] Sign out works
- [ ] Protected routes redirect to /login
- [ ] Book search saves to database with user_id
- [ ] Multiple users can sign in independently

### Security

- [ ] No secrets in client bundle (verified with curl)
- [ ] HTTPS enforced
- [ ] CSP headers present
- [ ] No console errors in production

### Documentation

- [ ] CHANGELOG.md updated
- [ ] Team notified
- [ ] Rollback plan documented
- [ ] Backup location recorded

## ══════════════════════════════════════════════════════════════

## SUCCESS CRITERIA

## ══════════════════════════════════════════════════════════════

Deployment is considered successful when:

✅ All checklist items above are marked complete
✅ Google OAuth login works end-to-end
✅ User data is isolated (tested with 2+ users)
✅ No secrets exposed in client code or logs
✅ Database migration completed without errors
✅ Lighthouse scores meet targets (>90 performance)
✅ No critical errors in Cloudflare Pages logs
✅ Rollback plan tested and documented

## ══════════════════════════════════════════════════════════════

## SUPPORT & TROUBLESHOOTING

## ══════════════════════════════════════════════════════════════

**Common Issues:**

1. **"OAuth redirect URI mismatch"**
   - Verify redirect URIs in Google Cloud Console match production URL exactly
   - Check for trailing slashes (should not have trailing slash)

2. **"Database not configured"**
   - Verify D1 binding in wrangler.toml
   - Check Cloudflare Pages bindings in dashboard

3. **"Session not persisting"**
   - Verify BETTER_AUTH_URL matches current domain
   - Check cookie settings (SameSite, Secure, HttpOnly)

4. **"Unauthorized" errors**
   - Verify environment variables are set correctly
   - Check GOOGLE_CLIENT_SECRET is correct (not Client ID)

**Contact:**

- GitHub Issues: https://github.com/missmuthi/rangkai-book-metadata/issues
- Email: [your-support-email]
- Slack: #rangkai-support

## ══════════════════════════════════════════════════════════════

## NEXT STEPS (Post-Deployment)

## ══════════════════════════════════════════════════════════════

After successful deployment:

1. **Monitor for 24 hours:**
   - Check Cloudflare Analytics for errors
   - Review D1 query performance
   - Monitor session creation rate

2. **User Feedback:**
   - Collect feedback on authentication UX
   - Track Google OAuth success rate
   - Identify friction points in flow

3. **Performance Optimization:**
   - Review cache hit rates
   - Optimize database queries (add indexes if needed)
   - Consider implementing refresh tokens

4. **Future Enhancements:**
   - Email verification flow
   - Password reset functionality
   - User profile editing
   - Dashboard with analytics

═══════════════════════════════════════════════════════════════
🎉 Deployment Complete! Welcome to Rangkai v2.0!
═══════════════════════════════════════════════════════════════
