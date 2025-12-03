import { generateObject, generateText } from "ai";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseJsonSafe } from "$lib/utils/json";
import { POST } from "../../../routes/api/ai/clean/+server";

interface CleanedData {
  scan_id?: number;
  ddc?: string;
  lcc?: string;
  title?: string;
  code?: string;
  [key: string]: unknown;
}

// Mock dependencies
vi.mock("ai", () => ({ generateObject: vi.fn(), generateText: vi.fn() }));

vi.mock("$lib/server/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock DB helper
vi.mock("$lib/server/db", () => ({
  getRawDb: vi.fn(
    (platform: Record<string, unknown>) =>
      (platform.env as Record<string, unknown>).DB || null,
  ),
  getDrizzleDB: vi.fn((_platform: Record<string, unknown>) => undefined),
}));

// Simple helper to create a mock D1-like database
function createMockDB() {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    _statements: statements,
    prepare(_sql: string) {
      return {
        bind: (..._args: unknown[]) => ({
          run: async () => ({ meta: { last_row_id: 999, changes: 1 } }),
          first: async () => null,
        }),
        first: async () => null,
        run: async () => ({ meta: { last_row_id: 999, changes: 1 } }),
      };
    },
  };
  return db;
}

function createMockEvent({
  body,
  isAuthenticated = true,
}: {
  body: unknown;
  isAuthenticated?: boolean;
}) {
  return {
    request: {
      json: async () => body,
    } as Request,
    locals: {
      session: isAuthenticated ? { id: "session-1" } : null,
      user: isAuthenticated
        ? { id: "user-1", email: "test@example.com" }
        : null,
    } as App.Locals,
    platform: {
      env: {
        DB: createMockDB(),
        GROQ_API_KEY: "TEST_KEY",
        GOOGLE_GENERATIVE_AI_API_KEY: "TEST_KEY",
      },
    } as App.Platform,
  } as Parameters<typeof POST>[0];
}

describe("POST /api/ai/clean - Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const event = createMockEvent({
      body: { title: "Test" },
      isAuthenticated: false,
    });
    const res = await POST(event);
    expect(res.status).toBe(401);
    const data = (await parseJsonSafe(res)) as CleanedData;
    expect(data.code).toBe("NO_SESSION");
  });

  it("saves cleaned metadata and returns scan_id when AI returns success", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        title: "Clean Code",
        ddc: "005.133",
        lcc: "QA76.73.J38",
        changes: ["Generated DDC: 005.133", "Generated LCC: QA76.73.J38"],
      },
    } as ReturnType<typeof generateObject> extends Promise<infer T>
      ? T
      : never);

    const body = {
      title: "Clean Code",
      authors: ["Robert C. Martin"],
      isbn13: "9780132350884",
    };
    const event = createMockEvent({ body });

    const res = await POST(event);
    const data = (await parseJsonSafe(res)) as CleanedData;
    console.warn("FALLBACK POST RESPONSE", { status: res.status, body: data });
    expect(res.status).toBe(200);
    expect(data.scan_id).toBeDefined();
    expect(data.ddc).toBe("005.133");
    expect(data.lcc).toBe("QA76.73.J38");
  });

  it("updates existing scan if user+isbn already present, avoiding duplicate insert", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        title: "Existing Book",
        ddc: "005.123",
        lcc: "QA76.12",
      },
    } as ReturnType<typeof generateObject> extends Promise<infer T>
      ? T
      : never);

    // Mock DB with an existing scan (id 42) returned on SELECT
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const db = {
      _statements: statements,
      prepare(_sql: string) {
        return {
          bind: (..._args: unknown[]) => ({
            run: async () => ({ meta: { last_row_id: 999, changes: 1 } }),
            first: async () => ({ id: 42 }),
          }),
          first: async () => ({ id: 42 }),
          run: async () => ({ meta: { last_row_id: 42, changes: 1 } }),
        };
      },
    };

    const body = {
      title: "Existing Book",
      authors: ["Existing Author"],
      isbn13: "9780132350884",
    };
    const event = createMockEvent({ body });
    // Override platform DB to our mocked DB
    if (event.platform) {
      (event.platform.env as Record<string, unknown>).DB = db;
    }

    const res = await POST(event);
    const data = (await parseJsonSafe(res)) as CleanedData;

    expect(res.status).toBe(200);
    expect(data.scan_id).toBe(42);
  });

  it("falls back to generateText when model does not support json_schema", async () => {
    vi.mocked(generateObject).mockRejectedValue(
      new Error("This model does not support response format `json_schema`"),
    );
    const textOutput = JSON.stringify({
      title: "Fallback Title",
      ddc: "005.100",
      lcc: "QA76.1",
      changes: ["Generated DDC: 005.100"],
    });
    // The Vercel AI SDK returns `text` directly on the result object
    vi.mocked(generateText).mockResolvedValue({
      text: textOutput,
    } as unknown as ReturnType<typeof generateText> extends Promise<infer T>
      ? T
      : never);

    const event = createMockEvent({ body: { title: "Fallback" } });
    const res = await POST(event);
    const data = (await parseJsonSafe(res)) as CleanedData;
    console.warn("FALLBACK POST RESPONSE", { status: res.status, body: data });
    expect(res.status).toBe(200);
    expect(data.title).toBe("Fallback Title");
    expect(data.ddc).toBe("005.100");
  });
});
