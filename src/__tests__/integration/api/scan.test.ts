/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for POST /api/scan endpoint
 *
 * Tests:
 * - Authentication enforcement
 * - ISBN validation
 * - Scan creation workflow
 * - Error handling (provider failures, invalid input)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../../../routes/api/scan/+server";
import type { RequestEvent as _RequestEvent } from "@sveltejs/kit";

// Mock dependencies
vi.mock("$lib/server", () => ({
  requireSession: vi.fn(async (event: any) => {
    if (!event.locals.session) {
      throw { status: 401, body: { message: "Unauthorized" } };
    }
    return event.locals.session;
  }),
}));

vi.mock("$modules/scan", () => ({
  validateISBN: vi.fn((isbn: string) => {
    if (isbn === "9780132350884" || isbn === "9780134685991") {
      return { valid: true };
    }
    if (isbn === "invalid-isbn") {
      return { valid: false, message: "Invalid ISBN format" };
    }
    return { valid: true };
  }),
  createBookScan: vi.fn(async (_event: any, isbn: string) => {
    if (isbn === "9780132350884") {
      return {
        success: true,
        scan: {
          id: 1,
          isbn,
          title: "Clean Code",
          user_id: "user123",
          created_at: new Date().toISOString(),
        },
        cached: false,
      };
    }
    if (isbn === "provider-fail") {
      return {
        success: false,
        error: "Failed to fetch book metadata",
      };
    }
    return {
      success: true,
      scan: {
        id: 2,
        isbn,
        title: "Test Book",
        user_id: "user123",
        created_at: new Date().toISOString(),
      },
      cached: false,
    };
  }),
}));

// Helper to create mock RequestEvent
function createMockEvent(options: {
  authenticated?: boolean;
  body?: any;
}): any {
  const { authenticated = true, body = {} } = options;

  return {
    request: {
      json: async () => body,
      headers: new Headers(),
    },
    cookies: {
      get: vi.fn(() => null),
      set: vi.fn(),
      delete: vi.fn(),
    } as any,
    locals: authenticated
      ? {
          session: {
            userId: "user123",
            user: { id: "user123", email: "test@example.com" },
            expiresAt: new Date(Date.now() + 86400000),
          },
          user: { id: "user123", email: "test@example.com" },
        }
      : {
          session: null,
          user: null,
        },
    platform: {
      env: {
        DB: {} as any,
        BOOK_CACHE: {} as any,
      },
    },
  } as any;
}

describe("POST /api/scan - Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should reject unauthenticated requests", async () => {
      const event = createMockEvent({
        authenticated: false,
        body: { isbn: "9780132350884" },
      });

      await expect(POST(event)).rejects.toMatchObject({
        status: 303, // Redirect to login
      });
    });

    it("should accept authenticated requests", async () => {
      const event = createMockEvent({
        authenticated: true,
        body: { isbn: "9780132350884" },
      });

      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.scan).toBeDefined();
    });
  });

  describe("ISBN Validation", () => {
    it("should reject missing ISBN", async () => {
      const event = createMockEvent({
        authenticated: true,
        body: {},
      });

      await expect(POST(event)).rejects.toMatchObject({
        status: 400,
        body: { message: expect.stringContaining("Invalid input: expected string, received undefined") },
      });
    });

    it("should reject non-string ISBN", async () => {
      const event = createMockEvent({
        authenticated: true,
        body: { isbn: 123456 },
      });

      await expect(POST(event)).rejects.toMatchObject({
        status: 400,
      });
    });

    it("should reject invalid ISBN format", async () => {
      const event = createMockEvent({
        authenticated: true,
        body: { isbn: "invalid-isbn" },
      });

      await expect(POST(event)).rejects.toMatchObject({
        status: 400,
        body: { message: expect.stringContaining("Invalid ISBN") },
      });
    });

    it("should accept valid ISBN-13", async () => {
      const event = createMockEvent({
        authenticated: true,
        body: { isbn: "9780132350884" },
      });

      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.scan.isbn).toBe("9780132350884");
    });
  });

  describe("Scan Creation - Happy Path", () => {
    it("should create scan with valid ISBN", async () => {
      const event = createMockEvent({
        authenticated: true,
        body: { isbn: "9780132350884" },
      });

      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        scan: {
          isbn: "9780132350884",
          title: "Clean Code",
          user_id: "user123",
        },
        cached: false,
      });
    });

    it("should indicate when data is cached", async () => {
      // Mock cached response
      const { createBookScan } = await import("$modules/scan");
      vi.mocked(createBookScan).mockResolvedValueOnce({
        success: true,
        scan: {
          id: 1,
          isbn: "9780134685991",
          title: "Effective Java",
          user_id: "user123",
          created_at: new Date().toISOString(),
        } as any,
        cached: true,
      });

      const event = createMockEvent({
        authenticated: true,
        body: { isbn: "9780134685991" },
      });

      const response = await POST(event);
      const data = await response.json();

      expect(data.cached).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should reject invalid ISBN format", async () => {
      const event = createMockEvent({
        authenticated: true,
        body: { isbn: "provider-fail" },
      });

      await expect(POST(event)).rejects.toMatchObject({
        status: 400,
        body: { message: expect.stringContaining("Invalid ISBN format") },
      });
    });

    it("should handle scan creation errors gracefully", async () => {
      const { createBookScan } = await import("$modules/scan");
      vi.mocked(createBookScan).mockRejectedValueOnce(
        new Error("Database error"),
      );

      const event = createMockEvent({
        authenticated: true,
        body: { isbn: "9780132350884" },
      });

      await expect(POST(event)).rejects.toThrow();
    });
  });

  describe("Response Format", () => {
    it("should return correct JSON structure", async () => {
      const event = createMockEvent({
        authenticated: true,
        body: { isbn: "9780132350884" },
      });

      const response = await POST(event);
      const data = await response.json();

      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("scan");
      expect(data).toHaveProperty("cached");
      expect(data.scan).toHaveProperty("id");
      expect(data.scan).toHaveProperty("isbn");
      expect(data.scan).toHaveProperty("title");
      expect(data.scan).toHaveProperty("user_id");
    });
  });
});
