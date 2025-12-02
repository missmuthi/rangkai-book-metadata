/**
 * Scanner Mode History Store
 *
 * Manages persistent scanning history using Svelte 5 Runes and localStorage.
 * Stores the last 50 scanned books for batch export and review.
 */

import type { MergedBookData } from "$lib/types";
import { normalizeISBN } from "$lib/isbn-helpers";

const HISTORY_KEY = "rangkai-scan-history";
const MAX_HISTORY_ITEMS = 50;

// Browser check for SSR safety
const isBrowser = typeof window !== "undefined";

/**
 * Load history from localStorage
 */
function loadHistoryFromStorage(): MergedBookData[] {
  if (!isBrowser) return [];

  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error("[History Store] Failed to load from localStorage:", err);
    }
    return [];
  }
}

/**
 * Save history to localStorage
 */
function saveHistoryToStorage(items: MergedBookData[]): void {
  if (!isBrowser) return;

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error("[History Store] Failed to save to localStorage:", err);
    }
  }
}

/**
 * Create the history store
 */
function createHistoryStore() {
  // Initialize state from localStorage
  let items = $state<MergedBookData[]>(loadHistoryFromStorage());

  // Helper to save and update items (currently unused but kept for future use)
  function _updateItems(newItems: MergedBookData[]) {
    items = newItems;
    saveHistoryToStorage(items);
  }

  return {
    /**
     * Get all history items (reactive)
     */
    get items() {
      return items;
    },

    /**
     * Get count of items in history
     */
    get count() {
      return items.length;
    },

    /**
     * Add a book to history
     * - Adds to top of list
     * - If book already exists (by ISBN-13), moves it to top
     * - Limits to MAX_HISTORY_ITEMS
     */
    add(book: MergedBookData): void {
      // Normalize incoming ISBN for de-duplication
      const key = normalizeISBN(book.isbn13 || book.isbn10 || book.isbn || "");
      // Remove existing entry if present (match by normalized ISBN)
      const filtered = items.filter((item) => {
        const itemKey = normalizeISBN(
          item.isbn13 || item.isbn10 || item.isbn || "",
        );
        return itemKey !== key;
      });

      // Add to top
      items = [book, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      saveHistoryToStorage(items);
    },

    /**
     * Remove a single book from history by ISBN-13
     */
    remove(isbn13: string): void {
      const key = normalizeISBN(isbn13 || "");
      items = items.filter(
        (item) =>
          normalizeISBN(item.isbn13 || item.isbn10 || item.isbn || "") !== key,
      );
      saveHistoryToStorage(items);
      // console.log(`[History Store] Removed: ${isbn13}`);
    },

    /**
     * Clear all history
     */
    clear(): void {
      items = [];
      saveHistoryToStorage(items);
      // console.log("[History Store] Cleared all history");
    },

    /**
     * Get all items as array (for export)
     */
    getAll(): MergedBookData[] {
      return [...items];
    },

    /**
     * Check if history is empty
     */
    get isEmpty() {
      return items.length === 0;
    },
  };
}

// Export singleton instance
export const scanHistory = createHistoryStore();
