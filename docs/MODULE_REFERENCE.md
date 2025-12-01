# Module Quick Reference

**Quick lookup guide for Rangkai's domain modules.**

---

## 📚 Scan Module (`$modules/scan`)

### Functions

| Function                                 | Purpose                       | Auth Required | Returns               |
| ---------------------------------------- | ----------------------------- | ------------- | --------------------- |
| `createBookScan(event, isbn)`            | Create new scan with metadata | ✅ Yes        | `ScanResult`          |
| `getScanHistory(event, limit?, offset?)` | Get user's scan history       | ✅ Yes        | `ScanHistoryResult`   |
| `validateISBN(isbn)`                     | Validate ISBN format          | ❌ No         | `{ valid, message? }` |
| `batchCreateScans(event, isbns)`         | Bulk scan creation            | ✅ Yes        | `ScanResult[]`        |

### Usage

```typescript
import { createBookScan, validateISBN } from "$modules/scan";

// Validate ISBN
const check = validateISBN("9780134092669");
if (!check.valid) console.error(check.message);

// Create scan
const result = await createBookScan(event, "9780134092669");
if (result.success) {
  console.log("Scan ID:", result.scan.id);
  console.log("Cached:", result.cached);
}
```

---

## 📊 Dashboard Module (`$modules/dashboard`)

### Functions

| Function                           | Purpose                            | Auth Required | Returns                   |
| ---------------------------------- | ---------------------------------- | ------------- | ------------------------- |
| `getDashboardData(event)`          | Get dashboard stats & recent scans | ✅ Yes        | `DashboardStats \| null`  |
| `getActivitySummary(event, days?)` | Get activity analysis              | ✅ Yes        | `ActivitySummary \| null` |
| `getScanTrends(event, days?)`      | Get daily scan counts              | ✅ Yes        | `Array<{ date, count }>`  |

### Usage

```typescript
import { getDashboardData, getActivitySummary } from "$modules/dashboard";

const dashboard = await getDashboardData(event);
// {
//   totalScans: 150,
//   publishedScans: 120,
//   draftScans: 30,
//   recentScans: [...],
//   periodStats: { today: 5, thisWeek: 23, thisMonth: 67 }
// }

const activity = await getActivitySummary(event, 30);
// {
//   scansToday: 5,
//   scansThisWeek: 23,
//   scansThisMonth: 67,
//   mostScannedISBNs: [{ isbn, count, title }]
// }
```

---

## 🔐 Auth Module (`$modules/auth`)

### Functions

| Function                    | Purpose                          | Auth Required | Throws on Fail       |
| --------------------------- | -------------------------------- | ------------- | -------------------- |
| `getSessionOptional(event)` | Get session (no redirect)        | ❌ No         | No                   |
| `requireRole(event, role)`  | Require specific role            | ✅ Yes        | 403 if wrong role    |
| `requireAdmin(event)`       | Require admin role               | ✅ Yes        | 403 if not admin     |
| `requireLibrarian(event)`   | Require librarian role           | ✅ Yes        | 403 if not librarian |
| `isAdmin(event)`            | Check if admin                   | ❌ No         | No (returns boolean) |
| `isAuthenticated(event)`    | Check if logged in               | ❌ No         | No (returns boolean) |
| `redirectToLogin(event)`    | Redirect to login with returnUrl | ❌ No         | Yes (redirect)       |
| `guardRoute(event, role?)`  | Guard route/layout               | ✅ Yes        | 403 if unauthorized  |

### Usage

```typescript
import {
  requireAdmin,
  getSessionOptional,
  isAuthenticated,
} from "$modules/auth";

// Require admin (throws 403 if not admin)
export const load = async (event) => {
  await requireAdmin(event);
  // Only admins reach here
};

// Optional auth
export const load = async (event) => {
  const session = await getSessionOptional(event);
  return { isLoggedIn: !!session };
};

// Boolean check
export const load = async (event) => {
  const admin = await isAdmin(event);
  const authed = await isAuthenticated(event);
  return { admin, authed };
};
```

---

## 🛣️ Common Patterns

### Protected Route (User)

```typescript
import { requireSession } from "$lib/server";
import { getScanHistory } from "$modules/scan";

export const load = async (event) => {
  await requireSession(event); // Redirect if not logged in
  const history = await getScanHistory(event);
  return { history };
};
```

### Protected Route (Admin)

```typescript
import { requireAdmin } from "$modules/auth";
import { getRawDb, getRecentScansGlobal } from "$lib/server";

export const load = async (event) => {
  await requireAdmin(event); // 403 if not admin
  const db = getRawDb(event.platform);
  const scans = await getRecentScansGlobal(db, 50);
  return { scans };
};
```

### API Endpoint with Validation

```typescript
import { requireSession } from "$lib/server";
import { createBookScan, validateISBN } from "$modules/scan";

export const POST = async (event) => {
  await requireSession(event);
  const { isbn } = await event.request.json();

  // Validate
  const check = validateISBN(isbn);
  if (!check.valid) {
    return error(400, check.message);
  }

  // Create
  const result = await createBookScan(event, isbn);
  return json(result);
};
```

### Dashboard with Analytics

```typescript
import { requireSession } from "$lib/server";
import {
  getDashboardData,
  getActivitySummary,
  getScanTrends,
} from "$modules/dashboard";

export const load = async (event) => {
  await requireSession(event);

  const [dashboard, activity, trends] = await Promise.all([
    getDashboardData(event),
    getActivitySummary(event, 30),
    getScanTrends(event, 30),
  ]);

  return { dashboard, activity, trends };
};
```

---

## 🎯 Module Selection Guide

**When to use which module:**

| Task                   | Module               | Function               |
| ---------------------- | -------------------- | ---------------------- |
| Create a book scan     | `$modules/scan`      | `createBookScan()`     |
| Get user's scan list   | `$modules/scan`      | `getScanHistory()`     |
| Validate ISBN          | `$modules/scan`      | `validateISBN()`       |
| Get dashboard stats    | `$modules/dashboard` | `getDashboardData()`   |
| Get activity trends    | `$modules/dashboard` | `getActivitySummary()` |
| Get chart data         | `$modules/dashboard` | `getScanTrends()`      |
| Protect admin route    | `$modules/auth`      | `requireAdmin()`       |
| Optional auth check    | `$modules/auth`      | `getSessionOptional()` |
| Check if user is admin | `$modules/auth`      | `isAdmin()`            |

---

## 📦 Import Paths

**Always use module aliases for clean imports:**

```typescript
// ✅ CORRECT - Use module aliases
import { createBookScan } from "$modules/scan";
import { getDashboardData } from "$modules/dashboard";
import { requireAdmin } from "$modules/auth";

// ❌ INCORRECT - Don't use relative paths
import { createBookScan } from "../../modules/scan/service";
```

**Available aliases:**

- `$lib` → `src/lib` (infrastructure helpers)
- `$modules` → `src/modules` (domain business logic)

---

## 🔄 Tier 1 vs Tier 2

**Tier 1 (Infrastructure):**

```typescript
import { getRawDb, getUserScans } from "$lib/server";
const db = getRawDb(event.platform);
const scans = await getUserScans(db, userId);
```

**Tier 2 (Domain Modules):**

```typescript
import { getScanHistory } from "$modules/scan";
const history = await getScanHistory(event);
```

**When to use Tier 1:**

- Custom queries not covered by modules
- Building new domain modules
- Direct infrastructure access needed

**When to use Tier 2:**

- Standard operations (scan creation, dashboard, auth)
- Route-level business logic
- Reusable workflows

---

## 🧪 Testing Modules

**Modules are designed to be testable:**

```typescript
import { describe, it, expect } from "vitest";
import { validateISBN } from "$modules/scan";

describe("validateISBN", () => {
  it("validates ISBN-13", () => {
    const result = validateISBN("9780134092669");
    expect(result.valid).toBe(true);
  });

  it("rejects invalid length", () => {
    const result = validateISBN("123");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Invalid ISBN length");
  });
});
```

---

## 📚 Further Reading

- **Tier 1 Summary:** `TIER1_REFACTOR_SUMMARY.md` - Infrastructure layer
- **Tier 2 Implementation:** `TIER2_IMPLEMENTATION.md` - Module architecture
- **API Documentation:** `API_DOCUMENTATION.md` - API endpoints
- **Auth Setup:** `AUTHENTICATION_SETUP.md` - OAuth configuration
