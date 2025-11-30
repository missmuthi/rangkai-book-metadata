import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * Health Check Endpoint
 *
 * Returns the status of critical system dependencies:
 * - D1 Database binding
 * - Database connectivity
 * - Table availability
 *
 * Use this endpoint to diagnose production issues:
 * curl https://rangkai-book-metadata.pages.dev/api/health
 */
export const GET: RequestHandler = async ({ platform }) => {
  const timestamp = new Date().toISOString();

  const checks: Record<string, string | number> = {
    d1_binding: "not_available",
    d1_query: "not_tested",
    scans_count: -1,
  };

  // Check 1: D1 Binding Availability
  if (!platform) {
    return json(
      {
        status: "degraded",
        timestamp,
        message: "Platform context not available (local dev without wrangler?)",
        checks,
        hint: "Run with: npm run dev:wrangler",
      },
      { status: 503 },
    );
  }

  if (!platform.env) {
    return json(
      {
        status: "degraded",
        timestamp,
        message: "Platform.env not available",
        checks,
        hint: "Check Cloudflare Pages bindings configuration",
      },
      { status: 503 },
    );
  }

  if (!platform.env.DB) {
    return json(
      {
        status: "unhealthy",
        timestamp,
        message: "D1 Database binding (DB) not configured",
        checks,
        hint: 'Add D1 binding named "DB" in Cloudflare Dashboard → Pages → Settings → Bindings',
      },
      { status: 503 },
    );
  }

  checks.d1_binding = "available";

  // Check 2: D1 Query Test
  try {
    const result = await platform.env.DB.prepare(
      "SELECT COUNT(*) as count FROM scans",
    ).first<{ count: number }>();
    checks.d1_query = "success";
    checks.scans_count = result?.count ?? 0;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Check if it's a "table doesn't exist" error
    if (errorMessage.includes("no such table")) {
      checks.d1_query = "table_missing";
      return json(
        {
          status: "unhealthy",
          timestamp,
          message: "D1 tables not created - migrations needed",
          checks,
          hint: "Run: npx wrangler d1 execute rangkai-scans --remote --file=./schema.sql",
        },
        { status: 503 },
      );
    }

    checks.d1_query = `error: ${errorMessage}`;
    return json(
      {
        status: "unhealthy",
        timestamp,
        message: "D1 query failed",
        checks,
        error: errorMessage,
      },
      { status: 503 },
    );
  }

  // All checks passed
  return json({
    status: "healthy",
    timestamp,
    checks,
    version: "2.0.2",
  });
};
