/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for GET /api/dashboard/stats endpoint
 *
 * Tests:
 * - Authentication enforcement
 * - Stats calculation with scans
 * - Empty state (no scans)
 * - Optional activity parameter
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../../../routes/api/dashboard/stats/+server";
import type { RequestEvent } from "@sveltejs/kit";

// Mock dependencies
vi.mock("$lib/server", () => ({
  requireSession: vi.fn(async (event: any) => {
    if (!event.locals.session) {
      throw { status: 401, body: { message: "Unauthorized" } };
    }
    return event.locals.session;
  }),
}));

vi.mock("$modules/dashboard", () => ({
  getDashboardData: vi.fn(async (event: any) => {
    if (!event.locals.session) {
      return null;
    }

    // Simulate data based on test scenario
    const hasScans = event._testHasScans !== false;

    if (!hasScans) {
      return {
        totalScans: 0,
        publishedScans: 0,
        draftScans: 0,
        periodStats: {
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
        },
        recentScans: [],
      };
    }

    return {
      totalScans: 10,
      publishedScans: 7,
      draftScans: 3,
      periodStats: {
        today: 2,
        thisWeek: 5,
        thisMonth: 10,
      },
      recentScans: [
        {
          id: 1,
          isbn: "9780132350884",
          title: "Clean Code",
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          isbn: "9780134685991",
          title: "Effective Java",
          created_at: new Date().toISOString(),
        },
      ],
    };
  }),
  getActivitySummary: vi.fn(async (_event: any, _days: number) => {
    return {
      totalScans: 10,
      uniqueISBNs: 8,
      averagePerDay: 0.33,
      busiestDay: { date: "2024-11-20", count: 3 },
      dailyActivity: [
        { date: "2024-11-20", count: 3 },
        { date: "2024-11-21", count: 2 },
      ],
    };
  }),
}));

// Helper to create mock RequestEvent
function createMockEvent(options: {
  authenticated?: boolean;
  activityParam?: boolean;
  hasScans?: boolean;
}): any {
  const {
    authenticated = true,
    activityParam = false,
    hasScans = true,
  } = options;

  const url = new URL("http://localhost/api/dashboard/stats");
  if (activityParam) {
    url.searchParams.set("activity", "true");
  }

  return {
    url,
    request: {} as any,
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
      },
    },
    _testHasScans: hasScans,
  } as any;
}

describe("GET /api/dashboard/stats - Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should reject unauthenticated requests", async () => {
      const event = createMockEvent({ authenticated: false });

      await expect(GET(event)).rejects.toMatchObject({
        status: 401,
      });
    });

    it("should accept authenticated requests", async () => {
      const event = createMockEvent({ authenticated: true });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
    });
  });

  describe("Stats with Scans - Happy Path", () => {
    it("should return comprehensive stats for user with scans", async () => {
      const event = createMockEvent({ authenticated: true, hasScans: true });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        stats: {
          total: 10,
          published: 7,
          draft: 3,
          today: 2,
          thisWeek: 5,
          thisMonth: 10,
        },
        recentScans: expect.arrayContaining([
          expect.objectContaining({
            isbn: expect.any(String),
            title: expect.any(String),
          }),
        ]),
      });
    });

    it("should include recentScans in response", async () => {
      const event = createMockEvent({ authenticated: true, hasScans: true });

      const response = await GET(event);
      const data = await response.json();

      expect(data.recentScans).toBeDefined();
      expect(Array.isArray(data.recentScans)).toBe(true);
      expect(data.recentScans.length).toBeGreaterThan(0);
    });
  });

  describe("Empty State - No Scans", () => {
    it("should return zero stats for user with no scans", async () => {
      const event = createMockEvent({ authenticated: true, hasScans: false });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toMatchObject({
        total: 0,
        published: 0,
        draft: 0,
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
      });
      expect(data.recentScans).toEqual([]);
    });
  });

  describe("Activity Parameter", () => {
    it("should not include activity by default", async () => {
      const event = createMockEvent({
        authenticated: true,
        activityParam: false,
      });

      const response = await GET(event);
      const data = await response.json();

      expect(data.activity).toBeUndefined();
    });

    it("should include activity when ?activity=true", async () => {
      const event = createMockEvent({
        authenticated: true,
        activityParam: true,
      });

      const response = await GET(event);
      const data = await response.json();

      expect(data.activity).toBeDefined();
      expect(data.activity).toMatchObject({
        totalScans: expect.any(Number),
        uniqueISBNs: expect.any(Number),
        averagePerDay: expect.any(Number),
        busiestDay: expect.objectContaining({
          date: expect.any(String),
          count: expect.any(Number),
        }),
        dailyActivity: expect.any(Array),
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle null dashboard data gracefully", async () => {
      const { getDashboardData } = await import("$modules/dashboard");
      vi.mocked(getDashboardData).mockResolvedValueOnce(null);

      const event = createMockEvent({ authenticated: true });

      await expect(GET(event)).rejects.toMatchObject({
        status: 500,
        body: {
          message: expect.stringContaining("Failed to fetch dashboard data"),
        },
      });
    });

    it("should handle database errors", async () => {
      const { getDashboardData } = await import("$modules/dashboard");
      vi.mocked(getDashboardData).mockRejectedValueOnce(
        new Error("Database connection failed"),
      );

      const event = createMockEvent({ authenticated: true });

      await expect(GET(event)).rejects.toMatchObject({
        status: 500,
        body: {
          message: expect.stringContaining("Failed to fetch dashboard data"),
        },
      });
    });

    it("should handle activity summary errors gracefully", async () => {
      const { getActivitySummary } = await import("$modules/dashboard");
      vi.mocked(getActivitySummary).mockRejectedValueOnce(
        new Error("Activity query failed"),
      );

      const event = createMockEvent({
        authenticated: true,
        activityParam: true,
      });

      // Should still succeed, but without activity data or with error
      await expect(GET(event)).rejects.toThrow();
    });
  });

  describe("Response Format", () => {
    it("should return correct JSON structure", async () => {
      const event = createMockEvent({ authenticated: true });

      const response = await GET(event);
      const data = await response.json();

      expect(data).toHaveProperty("stats");
      expect(data).toHaveProperty("recentScans");
      expect(data.stats).toHaveProperty("total");
      expect(data.stats).toHaveProperty("published");
      expect(data.stats).toHaveProperty("draft");
      expect(data.stats).toHaveProperty("today");
      expect(data.stats).toHaveProperty("thisWeek");
      expect(data.stats).toHaveProperty("thisMonth");
    });
  });
});
