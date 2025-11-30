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
    return Object.entries(obj).reduce((acc, [key, value]) => {
      const cleaned = deepClean(value as any);
      // Keep boolean false or number 0, but remove empty strings/dashes
      if (
        cleaned !== null &&
        cleaned !== undefined &&
        cleaned !== "" &&
        cleaned !== "-"
      ) {
        acc[key as any] = cleaned;
      }
      return acc;
    }, {} as any) as T;
  }

  return obj;
}

/**
 * Standardize Keys: Ensures 'Dewey' becomes 'ddc', etc.
 */
export const normalizeKeys = (aiResult: any) => {
  return {
    ...aiResult,
    ddc: aiResult.ddc || aiResult.dewey || aiResult.DDC,
    lcc: aiResult.lcc || aiResult.LCC,
    isbn: aiResult.isbn || aiResult.ISBN, // Normalize casing
  };
};
