/**
 * Scan API - Create new book scan
 *
 * POST /api/scan
 * Body: { isbn: string }
 *
 * Uses the scan module for business logic orchestration
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireSession } from "$lib/server";
import { logger } from "$lib/server/log";
import { createBookScan, validateISBN } from "$modules/scan";

export const POST: RequestHandler = async (event) => {
  // Require authentication
  const session = await requireSession(event);

  // Parse request body
  const body = await event.request.json();
  const { isbn } = body;

  logger.info("scan_request_received", { userId: session.user.id, isbn });

  if (!isbn || typeof isbn !== "string") {
    throw error(400, "ISBN is required and must be a string");
  }

  // Validate ISBN format
  const validation = validateISBN(isbn);
  if (!validation.valid) {
    throw error(400, validation.message || "Invalid ISBN");
  }

  // Create scan using scan module
  const result = await createBookScan(event, isbn);

  if (!result.success) {
    throw error(500, result.error || "Failed to create scan");
  }

  return json({
    success: true,
    scan: result.scan,
    cached: result.cached,
  });
};
