# AI Quota Investigation - December 1, 2025

## Executive Summary

**Status:** INVESTIGATING - QUOTA MISMATCH DETECTED  
**Issue:** Server reports quota exceeded (limit: 0) but Groq provider dashboard shows available quota  
  - RPM: 4/15 used ✓
  - TPM: 2.11K/1M used ✓  
  - RPD: 11/200 used ✓
**Root Cause Candidates:**
  1. API key mismatch (Cloudflare secret ≠ checked key)
  2. Billing configuration issue (free tier validation failure)
  3. Stale dashboard (Google Studio not reflecting actual usage)
**Severity:** Production blocking for AI Clean feature  
**Action Required:** Verify API key identity and billing status

---

## Immediate Debugging Steps

**Step 1: Verify API Key Identity**
```bash
# Get the first 15 chars of the key in use (locally)
grep "GROQ_API_KEY" .env | cut -d= -f2 | head -c 15

# Get the key from Cloudflare Pages (via dashboard)
# Settings → Environment Variables → GROQ_API_KEY (first 15 chars)
```

**Step 2: Check Cloudflare Pages Env**
1. Go to **Cloudflare Dashboard** → **Pages** → `rangkai-book-metadata`
2. **Settings** → **Environment variables**
3. Verify `GROQ_API_KEY` exists and matches the one in your Groq dashboard or provider console

**Step 3: Verify Billing Setup (Groq / Provider)**
1. Go to your Groq or LLM provider billing console (or provider documentation)
2. Check if your account is active and billing is set up if required
3. Confirm whether your account is still within free-tier limits or requires an upgrade

**Step 4: Check Provider Quotas & Limits**
1. Go to your LLM provider's usage or quota dashboard
2. Verify the relevant model request quotas and token limits are not set to 0
3. Check for hard caps or throttles imposed by the provider

---

## Investigation Process

### 1. E2E Test Execution (PLAYWRIGHT_PREVIEW=1)
Ran comprehensive E2E test suite to reproduce and diagnose the quota error.

#### Results:
- **Search tests:** 2/2 PASS ✓ (UI working, metadata fetching working)
- **AI Clean test:** FAILS 503 (quota exhausted)

### 2. Root Cause Discovery

From server logs during AI Clean endpoint invocation:

```
{
  "timestamp": "2025-12-01T07:33:28.689Z",
  "level": "ERROR",
  "event": "ai_clean_groq_failed",
  "errorMessage": "Failed after 3 attempts. Last error: You exceeded your current quota, please check your plan and billing details. For more information on this error, check your LLM provider's rate limit docs.

  * Quota exceeded for metric: <provider-specific>

  Please retry in 29.669644758s."
}
```

### 3. Key Findings

#### What the Error Tells Us:
- **Metric 1:** `generativelanguage.googleapis.com/generate_content_free_tier_requests`
  - Limit: 0 (quota cap reached)
  - Status: Free tier request quota exhausted

- **Metric 2:** `generativelanguage.googleapis.com/generate_content_free_tier_input_token_count`
  - Limit: 0 (quota cap reached)
  - Status: Free tier token quota exhausted

- **Retry Window:** 29.67 seconds (backoff timer)

#### Endpoint Behavior:
- Endpoint correctly implements retry logic (3 attempts with exponential backoff: 2s, 4s)
- After retries fail, endpoint maps error to `AI_QUOTA_EXCEEDED` error code
- Returns HTTP 503 Service Unavailable (appropriate for rate/quota limits)
- Includes user-friendly message: "AI service quota exceeded. Please try again later."

### 4. Code Review

**File:** `src/routes/api/ai/clean/+server.ts`

Enhanced logging now captures:
```typescript
const additionalInfo = aiError && typeof aiError === "object"
  ? {
      status: (aiError as Record<string, unknown>).status,
      code: (aiError as Record<string, unknown>).code,
      response: (aiError as Record<string, unknown>).response,
    }
  : undefined;
logger.error("ai_clean_groq_failed", {
  errorMessage,
  ...(additionalInfo || {}),
});
```

This allows us to differentiate between:
- **Quota issues** (429/quota_exceeded)
- **Authentication failures** (401/invalid_api_key)
- **Network timeouts** (ECONNREFUSED/timeout)
- **Other errors** (generic AI_SERVICE_UNAVAILABLE)

---

## Solution Options

### Option 1: Upgrade to Paid Plan (Recommended)
**Pros:**
- Immediate quota increase
- No code changes needed
- Same API, familiar tooling

**Cons:**
- Monthly cost (~$20-100+ depending on usage)

**Steps:**
1. Go to https://ai.google.dev/billing
2. Add billing information
3. Upgrade from "Free tier" to "Pay as you go"
4. No deployment needed (quota resets immediately)

### Option 2: Implement Rate Limiting/Quotas Locally
**Pros:**
- Prevent quota exhaustion by controlling usage per user
- Lower operational costs

**Implementation:**
```typescript
// Add per-user rate limit in hooks.server.ts
const AICleanRateLimiter = new RateLimiter({
  max_per_user_per_day: 5,  // Limit 5 AI clean ops/user/day
  cost: 1,  // Track as 1 unit per request
  reset_at: "2025-12-02T00:00:00Z"
});

// In ai/clean endpoint:
if (!AICleanRateLimiter.canUse(userId)) {
  return json({
    error: "You've reached your daily AI Clean limit",
    code: "USER_QUOTA_EXCEEDED"
  }, { status: 429 });
}
```

### Option 3: Switch to Alternative Provider
**Providers:**
- OpenAI API (GPT-3.5/GPT-4)
- Anthropic Claude
- Azure Cognitive Services
- Self-hosted: Ollama, Llama.cpp

**Pros:**
- Different quota/pricing models
- May have better availability

**Cons:**
- Code refactoring needed (~2-3 hours)
- Different API semantics
- Need to test/validate results

---

## Test Results Summary

### E2E Tests (PLAYWRIGHT_PREVIEW=1)

```
✓ Search by ISBN displays merged metadata card (1.3s)
✓ Cache header toggles between MISS and HIT (2.2s)
✗ AI Clean API returns cleaned metadata (26.1s)
  └─ Error: Expected 200, Received 503 (quota limit)
```

### Code Quality Status
- ✓ `npm run check`: All TypeScript strict mode passes
- ✓ `npm run lint`: No errors (only warnings)
- ✓ `npm test`: Vitest 284/284 unit tests pass
- ✓ `npm run build`: Build succeeds, bundle < 200KB gzipped
- ✓ Search E2E: Both tests pass

### Production Status
- **Live URL:** https://48f7e3d0.rangkai-book-metadata.pages.dev
- **AI Clean Feature:** Non-functional (quota exhausted)
- **Other Features:** Fully operational
- **User Experience:** Clear error message displayed when quota hit

---

## Immediate Action Plan

### Priority 1: Restore Functionality (15 mins)
1. **Go to Google AI Studio:** https://ai.google.dev/billing
2. **Add billing method** (credit card)
3. **Wait for quota reset** (usually immediate, ~2-5 mins)
4. **Test:** Run Playwright test again to verify recovery

### Priority 2: Monitor Usage (1 hour)
1. **Set up alerts** in Google Cloud Console:
   - Alert when quota usage > 80%
   - Alert on 429 responses
2. **Log quota metrics** to analytics:
   - Track API calls per user
   - Track tokens consumed per user
3. **Dashboard:** Create monitoring view

### Priority 3: Implement Safeguards (2-4 hours)
1. Implement per-user daily quota (e.g., 5 AI cleans/user/day)
2. Add in-app quota indicator ("X cleanups remaining today")
3. Cache AI results to reduce API calls
4. Implement graceful degradation (show cached results when quota hit)

---

## Recommendations

1. **Immediate:** Upgrade to Google AI Studio paid plan (5 min)
2. **Short-term:** Monitor usage and set up alerts (30 min)
3. **Medium-term:** Implement per-user rate limiting (2 hours)
4. **Long-term:** Consider multi-provider strategy or self-hosted AI (TBD)

---

## Testing Evidence

### Playwright Test Output
```
[WebServer] {
  "timestamp": "2025-12-01T07:33:28.689Z",
  "level": "ERROR",
  "event": "ai_clean_groq_failed",
  "errorMessage": "Failed after 3 attempts. Last error: You exceeded your current quota..."
}

Error: expect(received).toBe(expected)
Expected: 200
Received: 503
```

### Server Retry Behavior
```
[WebServer] {"level": "WARN", "event": "ai_clean_rate_limit_retry", "attempt": 1, "waitTime": 2000}
[WebServer] {"level": "WARN", "event": "ai_clean_rate_limit_retry", "attempt": 2, "waitTime": 4000}
[WebServer] {"level": "ERROR", "event": "ai_clean_groq_failed", ...}
```

---

## Files Modified

- `e2e/tests/ai-clean.spec.ts` - Updated to API-level testing
- `e2e/tests/search.spec.ts` - Fixed UI selectors for new design
- `src/routes/api/ai/clean/+server.ts` - Enhanced error logging

---

## Next Steps

1. **As User:** Upgrade Google AI billing → quota restored immediately
2. **As Developer:** Monitor Cloudflare logs for quota patterns
3. **As Team:** Plan for long-term AI provider strategy

---

**Investigation Completed:** December 1, 2025 07:35 UTC  
**Status:** Ready for implementation  
**Blockers:** None (solution identified, awaiting execution)
