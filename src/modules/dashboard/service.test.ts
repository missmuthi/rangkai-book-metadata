/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDashboardData, getActivitySummary, getScanTrends } from "./service";
import type { RequestEvent } from "@sveltejs/kit";
import type { Scan } from "$lib/server/types";

// Mock dependencies
vi.mock("$lib/server/db", () => ({
  getDB: vi.fn(() => mockDB),
  getUserScans: vi.fn((_db, _userId, limit) => {
    return Promise.resolve(mockScans.slice(0, limit));
  }),
  getUserStats: vi.fn((_db, _userId) => {
    return Promise.resolve({
      totalScans: mockScans.length,
      publishedScans: mockScans.filter((s) => s.status === "published").length,
      draftScans: mockScans.filter((s) => s.status === "draft").length,
    });
  }),
}));

vi.mock("$lib/server/log", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  LogEvents: {
    DB_QUERY_FAILED: "db_query_failed",
  },
}));

// Mock data
const mockDB = {} as any;

const createMockScan = (
  id: number,
  isbn: string,
  title: string,
  status: "draft" | "published",
  daysAgo: number = 0,
): Scan => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);

  return {
    id,
    user_id: "user123",
    isbn,
    title,
    json_data: "{}",
    status,
    created_at: date.toISOString(),
    updated_at: date.toISOString(),
  };
};

const mockScans: Scan[] = [
  createMockScan(1, "9780132350884", "Clean Code", "published", 0),
  createMockScan(2, "9780134685991", "Effective Java", "draft", 1),
  createMockScan(3, "9780135957059", "Pragmatic Programmer", "published", 5),
  createMockScan(4, "9780132350884", "Clean Code", "draft", 10), // Duplicate ISBN
  createMockScan(5, "9780262033848", "Intro to Algorithms", "published", 20),
];

// Helper to create mock RequestEvent
function createMockEvent(userId?: string): RequestEvent {
  return {
    locals: {
      user: userId ? { id: userId, email: "test@example.com" } : undefined,
      session: userId ? { userId, expiresAt: new Date() } : undefined,
    },
    platform: {
      env: {
        DB: mockDB,
      },
    },
  } as any;
}

describe("Dashboard Module - Analytics & Statistics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDashboardData", () => {
    it("should return comprehensive dashboard statistics", async () => {
      const event = createMockEvent("user123");
      const result = await getDashboardData(event);

      expect(result).not.toBeNull();
      expect(result?.totalScans).toBe(5);
      expect(result?.publishedScans).toBe(3);
      expect(result?.draftScans).toBe(2);
      expect(result?.recentScans).toHaveLength(5);
    });

    it("should return null for unauthenticated user", async () => {
      const event = createMockEvent(); // No userId
      const result = await getDashboardData(event);

      expect(result).toBeNull();
    });

    it("should calculate period-based stats correctly", async () => {
      const event = createMockEvent("user123");
      const result = await getDashboardData(event);

      expect(result?.periodStats).toBeDefined();
      expect(result?.periodStats?.today).toBeGreaterThanOrEqual(0);
      expect(result?.periodStats?.thisWeek).toBeGreaterThanOrEqual(
        result?.periodStats?.today || 0,
      );
      expect(result?.periodStats?.thisMonth).toBeGreaterThanOrEqual(
        result?.periodStats?.thisWeek || 0,
      );
    });

    it("should limit recent scans to 10 items", async () => {
      const event = createMockEvent("user123");
      const result = await getDashboardData(event);

      expect(result?.recentScans).toBeDefined();
      expect(result?.recentScans.length).toBeLessThanOrEqual(10);
    });

    it("should handle database errors gracefully", async () => {
      const { getUserStats } = await import("$lib/server");
      vi.mocked(getUserStats).mockRejectedValueOnce(
        new Error("DB connection failed"),
      );

      const event = createMockEvent("user123");
      const result = await getDashboardData(event);

      expect(result).toBeNull();
    });

    it("should handle empty scan history (new user)", async () => {
      const { getUserScans, getUserStats } = await import("$lib/server");
      vi.mocked(getUserScans).mockResolvedValueOnce([]);
      vi.mocked(getUserStats).mockResolvedValueOnce({
        totalScans: 0,
        publishedScans: 0,
        draftScans: 0,
      });

      const event = createMockEvent("user123");
      const result = await getDashboardData(event);

      expect(result).not.toBeNull();
      expect(result?.totalScans).toBe(0);
      expect(result?.recentScans).toHaveLength(0);
    });
  });

  describe("getActivitySummary", () => {
    it("should return activity summary with ISBN frequency", async () => {
      const event = createMockEvent("user123");
      const result = await getActivitySummary(event, 30);

      expect(result).not.toBeNull();
      expect(result?.scansToday).toBeGreaterThanOrEqual(0);
      expect(result?.scansThisWeek).toBeGreaterThanOrEqual(0);
      expect(result?.scansThisMonth).toBeGreaterThanOrEqual(0);
      expect(result?.mostScannedISBNs).toBeDefined();
    });

    it("should return null for unauthenticated user", async () => {
      const event = createMockEvent();
      const result = await getActivitySummary(event);

      expect(result).toBeNull();
    });

    it("should count ISBN frequencies correctly", async () => {
      const event = createMockEvent("user123");
      const result = await getActivitySummary(event, 30);

      expect(result?.mostScannedISBNs).toBeDefined();
      expect(result?.mostScannedISBNs.length).toBeGreaterThan(0);

      // Clean Code appears twice in mock data
      const cleanCode = result?.mostScannedISBNs.find(
        (item) => item.isbn === "9780132350884",
      );
      expect(cleanCode?.count).toBe(2);
    });

    it("should limit most scanned ISBNs to top 5", async () => {
      const event = createMockEvent("user123");
      const result = await getActivitySummary(event, 30);

      expect(result?.mostScannedISBNs.length).toBeLessThanOrEqual(5);
    });

    it("should sort most scanned ISBNs by frequency descending", async () => {
      const event = createMockEvent("user123");
      const result = await getActivitySummary(event, 30);

      const counts = result?.mostScannedISBNs.map((item) => item.count) || [];
      const sortedCounts = [...counts].sort((a, b) => b - a);
      expect(counts).toEqual(sortedCounts);
    });

    it("should filter scans by time period (30 days)", async () => {
      const event = createMockEvent("user123");
      const result = await getActivitySummary(event, 30);

      // All mock scans are within 30 days
      expect(result?.scansThisMonth).toBe(5);
    });

    it("should calculate today vs week vs month correctly", async () => {
      const event = createMockEvent("user123");
      const result = await getActivitySummary(event, 30);

      expect(result).not.toBeNull();
      // Today scans should be <= week scans <= month scans
      expect(result!.scansToday).toBeLessThanOrEqual(result!.scansThisWeek);
      expect(result!.scansThisWeek).toBeLessThanOrEqual(result!.scansThisMonth);
    });
  });

  describe("getScanTrends", () => {
    it("should return daily scan trends for specified period", async () => {
      const event = createMockEvent("user123");
      const result = await getScanTrends(event, 7);

      expect(result).toHaveLength(7); // 7 days of data
      expect(result[0]).toHaveProperty("date");
      expect(result[0]).toHaveProperty("count");
    });

    it("should return empty array for unauthenticated user", async () => {
      const event = createMockEvent();
      const result = await getScanTrends(event);

      expect(result).toHaveLength(0);
    });

    it("should include all days in range even with 0 scans", async () => {
      const event = createMockEvent("user123");
      const result = await getScanTrends(event, 30);

      expect(result).toHaveLength(30);

      // Check that all days are present
      const dates = result.map((item) => item.date);
      expect(dates).toHaveLength(30);
      expect(new Set(dates).size).toBe(30); // All dates unique
    });

    it("should format dates as ISO strings (YYYY-MM-DD)", async () => {
      const event = createMockEvent("user123");
      const result = await getScanTrends(event, 7);

      result.forEach((item) => {
        expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it("should order trends chronologically (oldest to newest)", async () => {
      const event = createMockEvent("user123");
      const result = await getScanTrends(event, 7);

      // Dates should be in ascending order
      for (let i = 1; i < result.length; i++) {
        expect(new Date(result[i].date) >= new Date(result[i - 1].date)).toBe(
          true,
        );
      }
    });

    it("should handle database errors gracefully", async () => {
      const { getUserScans } = await import("$lib/server");
      vi.mocked(getUserScans).mockRejectedValueOnce(
        new Error("DB connection failed"),
      );

      const event = createMockEvent("user123");
      const result = await getScanTrends(event);

      expect(result).toHaveLength(0);
    });

    it("should filter scans outside the time window", async () => {
      const event = createMockEvent("user123");
      const result = await getScanTrends(event, 7); // Last 7 days

      // Scans older than 7 days should not be counted
      const totalCount = result.reduce((sum, item) => sum + item.count, 0);
      // Based on mock data: scans at 0, 1, 5 days ago are within 7 days
      expect(totalCount).toBe(3);
    });
  });
});
