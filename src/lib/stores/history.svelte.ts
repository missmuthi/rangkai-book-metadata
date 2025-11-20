/**
 * Scanner Mode History Store
 * 
 * Manages persistent scanning history using Svelte 5 Runes and localStorage.
 * Stores the last 50 scanned books for batch export and review.
 */

import type { MergedBookData } from '$lib/types';

const HISTORY_KEY = 'rangkai-scan-history';
const MAX_HISTORY_ITEMS = 50;

// Browser check for SSR safety
const isBrowser = typeof window !== 'undefined';

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
		console.error('[History Store] Failed to load from localStorage:', err);
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
		console.error('[History Store] Failed to save to localStorage:', err);
	}
}

/**
 * Create the history store
 */
function createHistoryStore() {
	// Initialize state from localStorage
	let items = $state<MergedBookData[]>(loadHistoryFromStorage());
	
	// Sync to localStorage whenever items change
	$effect(() => {
		saveHistoryToStorage(items);
	});
	
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
			// Remove existing entry if present (match by ISBN-13)
			const filtered = items.filter(item => item.isbn13 !== book.isbn13);
			
			// Add to top
			items = [book, ...filtered].slice(0, MAX_HISTORY_ITEMS);
			
			console.log(`[History Store] Added: ${book.title} (${book.isbn13})`);
		},
		
		/**
		 * Remove a single book from history by ISBN-13
		 */
		remove(isbn13: string): void {
			items = items.filter(item => item.isbn13 !== isbn13);
			console.log(`[History Store] Removed: ${isbn13}`);
		},
		
		/**
		 * Clear all history
		 */
		clear(): void {
			items = [];
			console.log('[History Store] Cleared all history');
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
		}
	};
}

// Export singleton instance
export const scanHistory = createHistoryStore();
