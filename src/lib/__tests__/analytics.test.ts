import { describe, it, expect } from "vitest";
import { Analytics } from "$lib/services/analytics";

describe("Analytics Event Types", () => {
  it("allows tracking cache_set events", () => {
    Analytics.track("cache_set", {
      cache_type: "kv",
      key: "book:9780134092669",
      key_type: "book",
      is_isbn: true,
      ttl: 86400,
      success: true,
    });
  });

  it("allows tracking metadata_source_degraded events", () => {
    Analytics.track("metadata_source_degraded", {
      provider: "openlibrary",
      status: 503,
      reason: "503 Service Temporarily Unavailable",
      fallback: "google_books",
    });
  });
});
