/**
 * Utilities for metadata cleaning and normalization
 */
export function deepClean<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj
      .map((v) => deepClean(v))
      .filter(
        (v) => v !== null && v !== undefined && v !== "" && v !== "-",
      ) as unknown as T;
  }

  if (obj !== null && typeof obj === "object") {
    return Object.entries(obj).reduce(
      (acc, [key, value]) => {
        const cleaned = deepClean(value);
        // Keep boolean false or number 0, but remove empty strings/dashes
        if (
          cleaned !== null &&
          cleaned !== undefined &&
          cleaned !== "" &&
          cleaned !== "-"
        ) {
          (acc as Record<string, unknown>)[key] = cleaned;
        }
        return acc;
      },
      {} as Record<string, unknown>,
    ) as T;
  }

  return obj;
}

export interface AIResultInput {
  ddc?: string;
  dewey?: string;
  DDC?: string;
  lcc?: string;
  LCC?: string;
  isbn?: string;
  ISBN?: string;
  [key: string]: unknown;
}

/**
 * Standardize Keys: Ensures 'Dewey' becomes 'ddc', etc.
 */
export const normalizeKeys = (aiResult: AIResultInput): AIResultInput => {
  return {
    ...aiResult,
    ddc: aiResult.ddc || aiResult.dewey || aiResult.DDC,
    lcc: aiResult.lcc || aiResult.LCC,
    isbn: aiResult.isbn || aiResult.ISBN, // Normalize casing
  };
};
