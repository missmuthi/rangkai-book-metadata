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
import { requireSession } from "$lib/server/auth";
import { logger } from "$lib/server/logger";
import { createBookScan, validateISBN } from "$modules/scan";
import { z } from "zod";
import { sanitizeInput } from "$lib/utils";

const scanSchema = z.object({
  isbn: z.string(),
});

export const POST: RequestHandler = async (event) => {
  // Require authentication
  const session = await requireSession(event);

  // Parse request body
  const body = await event.request.json();

  const parseResult = scanSchema.safeParse(body);
  if (!parseResult.success) {
    throw error(400, "ISBN is required and must be a string");
  }
  const { isbn } = parseResult.data;

  const sanitizedIsbn = sanitizeInput(isbn);

  logger.info("scan_request_received", { userId: session.user.id, isbn: sanitizedIsbn });

  // Validate ISBN format
  const validation = validateISBN(sanitizedIsbn);
  if (!validation.valid) {
    throw error(400, validation.message || "Invalid ISBN");
  }

  // Create scan using scan module
  const result = await createBookScan(event, sanitizedIsbn);

  if (!result.success) {
    throw error(500, result.error || "Failed to create scan");
  }

  return json({
    success: true,
    scan: result.scan,
    cached: result.cached,
  });
};
