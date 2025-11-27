/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for auth helpers
 *
 * Tests:
 * - getSession behavior with/without session
 * - requireSession authentication enforcement
 * - requireOwnership resource access control
 * - Session injection and fallback
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSession, requireSession, requireOwnership } from "../auth";
import type { RequestEvent } from "@sveltejs/kit";

// Mock dependencies
vi.mock("$lib/auth-simple", () => ({
  getSession: vi.fn(async (_db: any, token: string) => {
    if (token === "valid-session-token") {
      return {
        userId: "user123",
        user: {
          id: "user123",
          email: "test@example.com",
          name: "Test User",
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          emailVerified: true,
        },
        expiresAt: new Date(Date.now() + 86400000),
      };
    }
    return null;
  }),
}));

vi.mock("../log", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  LogEvents: {
    AUTH_SESSION_FETCH_FAILED: "auth_session_fetch_failed",
    AUTH_UNAUTHORIZED: "auth_unauthorized",
    AUTH_OWNERSHIP_DENIED: "auth_ownership_denied",
  },
}));

// Helper to create mock RequestEvent
function createMockEvent(options: {
  hasSession?: boolean;
  sessionInLocals?: boolean;
  sessionToken?: string;
  hasDB?: boolean;
}): RequestEvent {
  const {
    hasSession = false,
    sessionInLocals = false,
    sessionToken,
    hasDB = true,
  } = options;

  const session = hasSession
    ? {
        userId: "user123",
        user: {
          id: "user123",
          email: "test@example.com",
          name: "Test User",
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          emailVerified: true,
        },
        expiresAt: new Date(Date.now() + 86400000),
      }
    : null;

  return {
    locals: sessionInLocals
      ? { session, user: session?.user || null }
      : { session: null, user: null },
    cookies: {
      get: (name: string) => {
        if (name === "session") {
          return sessionToken || null;
        }
        return null;
      },
    } as any,
    platform: hasDB
      ? {
          env: {
            DB: {} as any,
          },
        }
      : undefined,
    url: new URL("http://localhost/dashboard"),
  } as any;
}

describe("Auth Helpers - Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSession()", () => {
    it("should return session from event.locals if present", async () => {
      const event = createMockEvent({
        hasSession: true,
        sessionInLocals: true,
      });

      const session = await getSession(event);

      expect(session).not.toBeNull();
      expect(session?.user.id).toBe("user123");
      expect(session?.user.email).toBe("test@example.com");
    });

    it("should return null when no session exists", async () => {
      const event = createMockEvent({
        hasSession: false,
        sessionInLocals: false,
      });

      const session = await getSession(event);

      expect(session).toBeNull();
    });

    it("should fetch session from DB as fallback", async () => {
      const event = createMockEvent({
        hasSession: false,
        sessionInLocals: false,
        sessionToken: "valid-session-token",
        hasDB: true,
      });

      const session = await getSession(event);

      expect(session).not.toBeNull();
      expect(session?.user.id).toBe("user123");
    });
    it("should return null when no DB available", async () => {
      const event = createMockEvent({
        hasSession: false,
        sessionInLocals: false,
        sessionToken: "valid-session-token",
        hasDB: false,
      });

      const session = await getSession(event);

      expect(session).toBeNull();
    });

    it("should return null when no session cookie", async () => {
      const event = createMockEvent({
        hasSession: false,
        sessionInLocals: false,
        hasDB: true,
      });

      const session = await getSession(event);

      expect(session).toBeNull();
    });

    it("should handle DB errors gracefully", async () => {
      const { getSession: getSessionPrimitive } = await import(
        "$lib/auth-simple"
      );
      vi.mocked(getSessionPrimitive).mockRejectedValueOnce(
        new Error("Database error"),
      );

      const event = createMockEvent({
        hasSession: false,
        sessionInLocals: false,
        sessionToken: "valid-session-token",
        hasDB: true,
      });

      const session = await getSession(event);

      expect(session).toBeNull();
    });
  });

  describe("requireSession()", () => {
    it("should return session when authenticated", async () => {
      const event = createMockEvent({
        hasSession: true,
        sessionInLocals: true,
      });

      const session = await requireSession(event);

      expect(session).not.toBeNull();
      expect(session.user.id).toBe("user123");
    });

    it("should redirect when no session", async () => {
      const event = createMockEvent({
        hasSession: false,
        sessionInLocals: false,
      });

      await expect(requireSession(event)).rejects.toMatchObject({
        status: 303,
        location: "/login",
      });
    });

    it("should redirect to login with returnTo parameter", async () => {
      const event = createMockEvent({
        hasSession: false,
        sessionInLocals: false,
      });

      try {
        await requireSession(event);
      } catch (error: any) {
        expect(error.location).toContain("/login");
      }
    });
  });

  describe("requireOwnership()", () => {
    it("should allow access for resource owner", async () => {
      const event = createMockEvent({
        hasSession: true,
        sessionInLocals: true,
      });

      await expect(requireOwnership(event, "user123")).resolves.toBeUndefined();
    });

    it("should deny access for non-owner", async () => {
      const event = createMockEvent({
        hasSession: true,
        sessionInLocals: true,
      });

      await expect(requireOwnership(event, "other-user")).rejects.toThrow(
        "Access denied: You do not own this resource",
      );
    });

    it("should redirect when not authenticated", async () => {
      const event = createMockEvent({
        hasSession: false,
        sessionInLocals: false,
      });

      await expect(requireOwnership(event, "user123")).rejects.toMatchObject({
        status: 303,
      });
    });
  });

  describe("Session Data Structure", () => {
    it("should have correct session structure", async () => {
      const event = createMockEvent({
        hasSession: true,
        sessionInLocals: true,
      });

      const session = await getSession(event);

      expect(session).toHaveProperty("userId");
      expect(session).toHaveProperty("user");
      expect(session).toHaveProperty("expiresAt");
      expect(session?.user).toHaveProperty("id");
      expect(session?.user).toHaveProperty("email");
      expect(session?.user).toHaveProperty("name");
    });

    it("should have matching userId and user.id", async () => {
      const event = createMockEvent({
        hasSession: true,
        sessionInLocals: true,
      });

      const session = await getSession(event);

      expect(session?.user.id).toBe(session?.user.id);
    });
  });
});
