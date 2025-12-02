/**
 * Safe JSON parsing helper that narrows `unknown` to `Record<string, unknown>`
 * while keeping compiler happy. Use sparingly for external responses.
 */
export async function parseJsonSafe<T = any>(response: Response): Promise<T> {
  const data = await response.json();
  if (typeof data === "object" && data !== null) {
    return data as T;
  }
  // For non-object responses, return an empty object cast to expected type
  return {} as T;
}

export function isErrorObject(obj: unknown): obj is { error: string } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "error" in obj &&
    typeof (obj as any).error === "string"
  );
}

/**
 * Parse a JSON field that may be a string or an already-parsed object.
 * Returns null if parsing fails.
 */
export function parseJsonStringSafe<T = any>(
  value: string | object | null | undefined,
): T | null {
  if (value == null) return null;
  if (typeof value === "object") return value as T;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return null;
}

export default parseJsonSafe;
