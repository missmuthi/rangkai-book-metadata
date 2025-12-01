import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../../routes/api/ai/clean/+server';

// Mock dependencies
vi.mock('ai', () => ({ generateObject: vi.fn(), generateText: vi.fn() }));

vi.mock('$lib/server/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

// Mock DB helper
vi.mock('$lib/server/db', () => ({
  getDB: vi.fn((platform: any) => platform.env.DB || null),
}));

// Simple helper to create a mock D1-like database
function createMockDB() {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    _statements: statements,
    prepare(sql: string) {
      return {
        bind: (...args: unknown[]) => ({
          run: async () => ({ meta: { last_row_id: 999, changes: 1 } }),
          first: async () => null,
        }),
        first: async () => null,
        run: async () => ({ meta: { last_row_id: 999, changes: 1 } }),
      } as any;
    },
  };
  return db;
}

function createMockEvent({ body, isAuthenticated = true }:{ body: unknown; isAuthenticated?: boolean }) {
  return {
    request: {
      json: async () => body,
    },
    locals: {
      session: isAuthenticated ? { id: 'session-1' } : null,
      user: isAuthenticated ? { id: 'user-1', email: 'test@example.com' } : null,
    },
    platform: { env: { DB: createMockDB(), GROQ_API_KEY: 'TEST_KEY', GOOGLE_GENERATIVE_AI_API_KEY: 'TEST_KEY' } },
  } as any;
}

describe('POST /api/ai/clean - Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    const event = createMockEvent({ body: { title: 'Test' }, isAuthenticated: false });
    const res = await POST(event as any);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe('NO_SESSION');
  });

  it('saves cleaned metadata and returns scan_id when AI returns success', async () => {
    const { generateObject } = await import('ai') as any;
    (generateObject as any).mockResolvedValue({ object: { title: 'Clean Code', ddc: '005.133', lcc: 'QA76.73.J38', changes: ['Generated DDC: 005.133', 'Generated LCC: QA76.73.J38'] } });

    const body = { title: 'Clean Code', authors: ['Robert C. Martin'], isbn13: '9780132350884' };
    const event = createMockEvent({ body });

    const res = await POST(event as any);
    const data = await res.json();
    console.warn('FALLBACK POST RESPONSE', { status: res.status, body: data });
    expect(res.status).toBe(200);
    expect(data.scan_id).toBeDefined();
    expect(data.ddc).toBe('005.133');
    expect(data.lcc).toBe('QA76.73.J38');
  });

  it('falls back to generateText when model does not support json_schema', async () => {
    const { generateObject, generateText } = await import('ai') as any;
    (generateObject as any).mockRejectedValue(new Error('This model does not support response format `json_schema`'));
    const textOutput = JSON.stringify({ title: 'Fallback Title', ddc: '005.100', lcc: 'QA76.1', changes: ['Generated DDC: 005.100'] });
    (generateText as any).mockResolvedValue({ output_text: textOutput });

    const event = createMockEvent({ body: { title: 'Fallback' } });
    const res = await POST(event as any);
    const data = await res.json();
    console.warn('FALLBACK POST RESPONSE', { status: res.status, body: data });
    expect(res.status).toBe(200);
    expect(data.title).toBe('Fallback Title');
    expect(data.ddc).toBe('005.100');
  });
});
