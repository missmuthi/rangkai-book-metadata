import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createGoogleAuth,
  upsertUser,
  createSession as _createSession,
  deleteSession as _deleteSession,
  getSession as _getSession,
} from "../auth";

// Mock D1 Database
const mockD1 = {
  prepare: vi.fn(),
};

describe("auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createGoogleAuth", () => {
    it("throws error if credentials missing", () => {
      const env = { BETTER_AUTH_URL: "http://localhost" };
      expect(() => createGoogleAuth(env as any)).toThrow(
        "Missing Google OAuth credentials",
      );
    });

    it("creates Google instance with correct config", () => {
      const env = {
        BETTER_AUTH_URL: "https://app.com",
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "secret",
      };
      const google = createGoogleAuth(env as any);
      expect(google).toBeDefined();
    });
  });

  // Since we don't have a real D1 environment in unit tests easily, we mock the DB behavior
  describe("upsertUser", () => {
    it("creates new user if not exists", async () => {
      mockD1.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null), // No existing user
        run: vi.fn().mockResolvedValue({}),
      });

      const userId = await upsertUser(
        mockD1 as any,
        "test@example.com",
        "Test User",
        "pic.jpg",
      );
      expect(userId).toBeDefined();
      expect(mockD1.prepare).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO user"),
      );
    });
  });
});
