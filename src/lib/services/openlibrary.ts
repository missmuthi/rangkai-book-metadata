import { error } from "@sveltejs/kit";
import { logger } from "$lib/server/logger";

export async function queryOpenLibrary(
  query: string,
  isIsbn: boolean,
  limit: string | number = 10,
) {
  if (!query) {
    throw error(400, { message: 'Query parameter "q" is required' });
  }

  let apiUrl: string;
  if (isIsbn) {
    apiUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${query}&format=json&jscmd=data`;
  } else {
    apiUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}`;
  }

  try {
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
      },
    });

    if (!response.ok) {
      logger.error("openlibrary_api_error", {
        status: response.status,
        statusText: response.statusText,
      });

      if (response.status === 429 || response.status === 503) {
        logger.warn("openlibrary_rate_limit_or_unavailable", {});
        return {
          error: "OpenLibrary temporarily unavailable",
          retryAfter: response.headers.get("Retry-After") || "60",
        };
      }

      return { error: `OpenLibrary API error: ${response.statusText}` };
    }

    const data = await response.json();

    return data;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logger.error("openlibrary_fetch_error", { error: errorMessage });
    return { error: `Failed to fetch from OpenLibrary: ${errorMessage}` };
  }
}
