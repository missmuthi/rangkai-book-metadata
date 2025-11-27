/**
 * Modules - Domain-Driven Business Logic
 *
 * Module structure follows domain-driven design:
 * - Each module represents a business domain (scan, dashboard, auth)
 * - Modules orchestrate infrastructure helpers (db, cache, metadata)
 * - Routes delegate to modules for business logic
 *
 * Usage:
 * ```typescript
 * import { createBookScan } from '$modules/scan';
 * import { getDashboardData } from '$modules/dashboard';
 * import { requireAdmin } from '$modules/auth';
 * ```
 */

// Scan domain
export * from "./scan";

// Dashboard domain
export * from "./dashboard";

// Auth domain (enhanced)
export * from "./auth";
