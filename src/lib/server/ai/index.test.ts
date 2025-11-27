import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiService } from './index';
import { generateObject } from 'ai';

// Mock dependencies
vi.mock('ai', () => ({
  generateObject: vi.fn()
}));

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn()
}));

// Mock environment
vi.mock('$env/dynamic/private', () => ({
  env: {
    GOOGLE_GENERATIVE_AI_API_KEY: 'mock-api-key'
  }
}));

describe('AiService', () => {
  const mockBook = {
    title: 'THE HOBBIT',
    author: 'Tolkien, J.R.R.',
    publisher: 'Houghton Mifflin',
    date: '2012',
    description: 'A hobbit goes on an adventure.',
    isbn13: '9780547928227',
    isbn10: '054792822X',
    pages: '300',
    ddc: '823.912',
    lcc: 'PR6039.O32 H6 2012',
    callNumber: '823.912 TOL h 2012',
    language: 'English',
    subjects: 'Fantasy',
    series: '',
    publisherString: 'Houghton Mifflin',
    collation: '',
    classification: '',
    edition: '',
    specificDetail: '',
    gmd: '',
    infoLink: '',
    cover: ''
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return cleaned metadata on success', async () => {
    const mockCleanedData = {
      title: 'The Hobbit',
      authors: ['J. R. R. Tolkien'],
      publisher: 'Houghton Mifflin',
      description: 'Bilbo Baggins, a hobbit who enjoys a comfortable, unambitious life, is whisked away by the wizard Gandalf and a company of thirteen dwarves. He finds himself caught up in a plot to raid the treasure hoard of Smaug the Magnificent, a large and very dangerous dragon.',
      publishedDate: '2012'
    };

    (generateObject as any).mockResolvedValue({
      object: mockCleanedData
    });

    const result = await aiService.cleanMetadata(mockBook);

    expect(result.title).toBe('The Hobbit');
    expect(result.author).toBe('J. R. R. Tolkien');
    expect(result.publisher).toBe('Houghton Mifflin');
    expect(result.description).toBe(mockCleanedData.description);
    expect(result.date).toBe('2012');
  });

  it('should handle partial updates correctly', async () => {
    // Only title and author returned
    const mockCleanedData = {
      title: 'The Hobbit',
      authors: ['J. R. R. Tolkien']
    };

    (generateObject as any).mockResolvedValue({
      object: mockCleanedData
    });

    const result = await aiService.cleanMetadata(mockBook);

    expect(result.title).toBe('The Hobbit');
    expect(result.author).toBe('J. R. R. Tolkien');
    expect(result.publisher).toBeUndefined(); // Should not be in result
  });

  it('should return warning on error', async () => {
    (generateObject as any).mockRejectedValue(new Error('AI Error'));

    const result = await aiService.cleanMetadata(mockBook);

    expect(result).toEqual({ aiWarning: 'AI cleaning service unavailable' });
  });

  it('should return empty object if API key is missing', async () => {
    // Override mock for this test
    vi.resetModules();
    vi.doMock('$env/dynamic/private', () => ({
      env: {
        GOOGLE_GENERATIVE_AI_API_KEY: ''
      }
    }));

    // Re-import to apply new mock
    const { aiService: serviceWithoutKey } = await import('./index');

    const result = await serviceWithoutKey.cleanMetadata(mockBook);
    expect(result).toEqual({});
  });
});
