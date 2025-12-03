import { describe, it, expect, vi, beforeEach } from "vitest";
import { handle } from "../hooks.server";
import type { RequestEvent } from "@sveltejs/kit";

// Mock dependencies
vi.mock("$lib/server/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("$lib/server/rate-limiter", () => {
  class MockRateLimiter {
    async check() {
      return true;
    }
  }
  return {
    RateLimiter: MockRateLimiter,
  };
});

vi.mock("$lib/server/cache", () => ({
  getKV: vi.fn().mockReturnValue(null),
}));

vi.mock("$lib/auth", () => ({
  getSession: vi.fn().mockResolvedValue(null),
}));

describe("Centralized Route Protection", () => {
  const createMockEvent = (
    pathname: string,
    hasSession = false,
  ): RequestEvent => {
    const mockEvent = {
      url: new URL(`http://localhost${pathname}`),
      request: new Request(`http://localhost${pathname}`, {
        headers: new Headers(),
      }),
      cookies: {
        get: vi.fn().mockReturnValue(hasSession ? "mock-session-token" : null),
        set: vi.fn(),
        delete: vi.fn(),
        serialize: vi.fn(),
        getAll: vi.fn(),
      },
      locals: {
        session: hasSession
          ? {
              id: "test-session",
              userId: "test-user",
              expiresAt: new Date(Date.now() + 3600000),
              user: {
                id: "test-user",
                email: "test@example.com",
                name: "Test User",
                createdAt: new Date(),
                updatedAt: new Date(),
                emailVerified: true,
              },
            }
          : null,
        user: hasSession
          ? {
              id: "test-user",
              email: "test@example.com",
              name: "Test User",
              createdAt: new Date(),
              updatedAt: new Date(),
              emailVerified: true,
            }
          : null,
      },
      platform: null,
      getClientAddress: vi.fn().mockReturnValue("127.0.0.1"),
      route: { id: pathname },
      params: {},
      isDataRequest: false,
      isSubRequest: false,
      setHeaders: vi.fn(),
      fetch: vi.fn(),
    } as unknown as RequestEvent;

    return mockEvent;
  };

  const mockResolve = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response("OK", {
        status: 200,
        headers: new Headers(),
      }),
    ),
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Public Routes", () => {
    const publicRoutes = ["/", "/login", "/features", "/privacy", "/terms"];

    publicRoutes.forEach((route) => {
      it(`should allow unauthenticated access to ${route}`, async () => {
        const event = createMockEvent(route, false);
        const response = await handle({ event, resolve: mockResolve });

        expect(response.status).not.toBe(401);
        expect(response.status).not.toBe(303);
        expect(mockResolve).toHaveBeenCalled();
      });
    });

    it("should allow unauthenticated access to /api/auth/* routes", async () => {
      const event = createMockEvent("/api/auth/login", false);
      const response = await handle({ event, resolve: mockResolve });

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(303);
      expect(mockResolve).toHaveBeenCalled();
    });

    it("should allow access to static assets like /favicon.ico", async () => {
      const event = createMockEvent("/favicon.ico", false);
      const response = await handle({ event, resolve: mockResolve });

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(303);
      expect(mockResolve).toHaveBeenCalled();
    });

    it("should allow access to /robots.txt", async () => {
      const event = createMockEvent("/robots.txt", false);
      const response = await handle({ event, resolve: mockResolve });

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(303);
      expect(mockResolve).toHaveBeenCalled();
    });
  });

  describe("Protected API Routes", () => {
    it("should return 401 for unauthenticated /api/book/* requests", async () => {
      const event = createMockEvent("/api/book/9780134685991", false);
      const response = await handle({ event, resolve: mockResolve });

      expect(response.status).toBe(401);
      expect(await response.text()).toBe("Unauthorized");
      expect(mockResolve).not.toHaveBeenCalled();
    });

    it("should return 401 for unauthenticated /api/scan requests", async () => {
      const event = createMockEvent("/api/scan", false);
      const response = await handle({ event, resolve: mockResolve });

      expect(response.status).toBe(401);
      expect(await response.text()).toBe("Unauthorized");
      expect(mockResolve).not.toHaveBeenCalled();
    });

    it("should return 401 for unauthenticated /api/ai/clean requests", async () => {
      const event = createMockEvent("/api/ai/clean", false);
      const response = await handle({ event, resolve: mockResolve });

      expect(response.status).toBe(401);
      expect(mockResolve).not.toHaveBeenCalled();
    });

    it("should allow authenticated access to /api/book/*", async () => {
      const event = createMockEvent("/api/book/9780134685991", true);
      const response = await handle({ event, resolve: mockResolve });

      expect(response.status).toBe(200);
      expect(mockResolve).toHaveBeenCalled();
    });

    it("should allow authenticated access to /api/scan", async () => {
      const event = createMockEvent("/api/scan", true);
      const response = await handle({ event, resolve: mockResolve });

      expect(response.status).toBe(200);
      expect(mockResolve).toHaveBeenCalled();
    });
  });

  describe("Protected Page Routes", () => {
    it("should redirect unauthenticated user from /scan to /login", async () => {
      const event = createMockEvent("/scan", false);
      const response = await handle({ event, resolve: mockResolve });

      expect(response.status).toBe(303);
      expect(response.headers.get("Location")).toBe("/login");
      expect(mockResolve).not.toHaveBeenCalled();
    });

    it("should redirect unauthenticated user from /history to /login", async () => {
      const event = createMockEvent("/history", false);
      const response = await handle({ event, resolve: mockResolve });

      expect(response.status).toBe(303);
      expect(response.headers.get("Location")).toBe("/login");
      expect(mockResolve).not.toHaveBeenCalled();
    });

    it("should redirect unauthenticated user from /dashboard to /login", async () => {
      const event = createMockEvent("/dashboard", false);
      const response = await handle({ event, resolve: mockResolve });

      expect(response.status).toBe(303);
      expect(response.headers.get("Location")).toBe("/login");
      expect(mockResolve).not.toHaveBeenCalled();
    });

    it("should allow authenticated user to access /scan", async () => {
      const event = createMockEvent("/scan", true);
      const response = await handle({ event, resolve: mockResolve });

      expect(response.status).toBe(200);
      expect(mockResolve).toHaveBeenCalled();
    });

    it("should allow authenticated user to access /history", async () => {
      const event = createMockEvent("/history", true);
      const response = await handle({ event, resolve: mockResolve });

      expect(response.status).toBe(200);
      expect(mockResolve).toHaveBeenCalled();
    });
  });

  describe("Security Headers", () => {
    it("should add security headers to all responses", async () => {
      const event = createMockEvent("/", false);
      const response = await handle({ event, resolve: mockResolve });

      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("Strict-Transport-Security")).toContain(
        "max-age=31536000",
      );
      expect(response.headers.get("Content-Security-Policy")).toBeTruthy();
    });

    it("should include CSP header with proper directives", async () => {
      const event = createMockEvent("/", false);
      const response = await handle({ event, resolve: mockResolve });

      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
    });
  });

  describe("publicRoutes Configuration", () => {
    it("should define all expected public routes", async () => {
      // Test that the publicRoutes list is working as expected
      const publicPaths = ["/", "/login", "/features", "/privacy", "/terms"];

      for (const path of publicPaths) {
        const event = createMockEvent(path, false);
        const response = await handle({ event, resolve: mockResolve });

        // Should not redirect or return 401 for public routes
        expect(response.status).not.toBe(401);
        expect(response.status).not.toBe(303);
      }
    });

    it("should protect routes not in publicRoutes list", async () => {
      const protectedPaths = [
        "/scan",
        "/history",
        "/dashboard",
        "/export",
        "/settings",
      ];

      for (const path of protectedPaths) {
        const event = createMockEvent(path, false);
        const response = await handle({ event, resolve: mockResolve });

        // Should redirect to login
        expect(response.status).toBe(303);
        expect(response.headers.get("Location")).toBe("/login");
      }
    });
  });
});
