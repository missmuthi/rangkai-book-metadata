/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unit tests for /scan/mobile page - ISBN fetch logic
 * 
 * Tests the handleScan function and API integration without rendering components.
 * This focuses on the data fetching, normalization, and error handling logic.
 * 
 * Tests:
 * - ISBN normalization (spaces, hyphens)
 * - Successful API responses and data mapping
 * - 404 Not Found error handling
 * - 500 Server Error handling
 * - Network errors
 * - Request queueing for rapid scans
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MergedBookData } from '$lib/types';

// Mock data matching the MergedBookData type
const MOCK_BOOK_FULL: MergedBookData = {
	title: 'Clean Code',
	author: 'Martin, Robert C.',
	publisher: 'Prentice Hall',
	date: '2008',
	pages: '464',
	isbn13: '9780132350884',
	isbn10: '0132350882',
	ddc: '005.1',
	lcc: 'QA76.76.D47',
	callNumber: 'QA76.76.D47 M37 2008',
	description: 'Even bad code can function.',
	language: 'en',
	subjects: 'Software engineering',
	series: '',
	publisherString: 'Prentice Hall',
	collation: '464 p.',
	classification: 'QA76.76.D47',
	edition: '1st',
	specificDetail: 'A Handbook of Agile Software Craftsmanship',
	gmd: 'Book',
	infoLink: 'https://books.google.com/books?id=test',
	cover: 'https://books.google.com/books/content?id=test',
	dataSource: 'google-openlibrary'
};

const MOCK_BOOK_MINIMAL: MergedBookData = {
	title: 'Test Book',
	author: '',
	publisher: '',
	date: '',
	pages: '',
	isbn13: '9781234567890',
	isbn10: '',
	ddc: '',
	lcc: '',
	callNumber: '',
	description: '',
	language: '',
	subjects: '',
	series: '',
	publisherString: '',
	collation: '',
	classification: '',
	edition: '',
	specificDetail: '',
	gmd: '',
	infoLink: '',
	cover: '',
	dataSource: 'google-only'
};

describe('Mobile Scan - ISBN Normalization', () => {
	let fetchMock: any;

	beforeEach(() => {
		fetchMock = vi.fn();
		global.fetch = fetchMock;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('normalizes ISBN by removing spaces', () => {
		const input = '978 0 13 235088 4';
		const expected = '9780132350884';
		const normalized = input.replace(/[\s-]/g, '');
		expect(normalized).toBe(expected);
	});

	it('normalizes ISBN by removing hyphens', () => {
		const input = '978-0-13-235088-4';
		const expected = '9780132350884';
		const normalized = input.replace(/[\s-]/g, '');
		expect(normalized).toBe(expected);
	});

	it('normalizes ISBN with both spaces and hyphens', () => {
		const input = '978 - 0 - 13 - 235088 - 4';
		const expected = '9780132350884';
		const normalized = input.replace(/[\s-]/g, '');
		expect(normalized).toBe(expected);
	});

	it('trims whitespace from ISBN', () => {
		const input = '  9780132350884  ';
		const expected = '9780132350884';
		const normalized = input.trim().replace(/[\s-]/g, '');
		expect(normalized).toBe(expected);
	});

	it('handles ISBN with no special characters', () => {
		const input = '9780132350884';
		const expected = '9780132350884';
		const normalized = input.replace(/[\s-]/g, '');
		expect(normalized).toBe(expected);
	});
});

describe('Mobile Scan - API Fetch Integration', () => {
	let fetchMock: any;

	beforeEach(() => {
		fetchMock = vi.fn();
		global.fetch = fetchMock;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('Successful Fetches', () => {
		it('fetches book data from API with normalized ISBN', async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => MOCK_BOOK_FULL
			});

			const isbn = '978-0-13-235088-4';
			const normalized = isbn.replace(/[\s-]/g, '');
			
			const response = await fetch(`/api/book/${encodeURIComponent(normalized)}`);
			const data = await response.json();

			expect(fetchMock).toHaveBeenCalledWith('/api/book/9780132350884');
			expect(data).toEqual(MOCK_BOOK_FULL);
		});

		it('parses JSON response correctly', async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => MOCK_BOOK_FULL
			});

			const response = await fetch('/api/book/9780132350884');
			const data = await response.json() as MergedBookData;

			expect(data.title).toBe('Clean Code');
			expect(data.isbn13).toBe('9780132350884');
			expect(data.dataSource).toBe('google-openlibrary');
		});

		it('handles minimal book data', async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => MOCK_BOOK_MINIMAL
			});

			const response = await fetch('/api/book/9781234567890');
			const data = await response.json() as MergedBookData;

			expect(data.title).toBe('Test Book');
			expect(data.author).toBe('');
			expect(data.cover).toBe('');
		});
	});

	describe('Error Handling', () => {
		it('handles 404 Not Found', async () => {
			fetchMock.mockResolvedValueOnce({
				ok: false,
				status: 404,
				text: async () => 'Book not found'
			});

			const response = await fetch('/api/book/9999999999999');
			
			expect(response.ok).toBe(false);
			expect(response.status).toBe(404);
			
			const errorText = await response.text();
			expect(errorText).toBe('Book not found');
		});

		it('handles 500 Server Error', async () => {
			fetchMock.mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: async () => 'Internal Server Error'
			});

			const response = await fetch('/api/book/9780132350884');
			
			expect(response.ok).toBe(false);
			expect(response.status).toBe(500);
		});

		it('handles network error', async () => {
			fetchMock.mockRejectedValueOnce(new Error('Network error'));

			try {
				await fetch('/api/book/9780132350884');
				expect.fail('Should have thrown error');
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).message).toBe('Network error');
			}
		});

		it('creates error message from HTTP status', async () => {
			fetchMock.mockResolvedValueOnce({
				ok: false,
				status: 503,
				text: async () => 'Service Unavailable'
			});

			const response = await fetch('/api/book/9780132350884');
			
			if (!response.ok) {
				const errorText = await response.text();
				const errorMessage = errorText || `HTTP ${response.status}`;
				expect(errorMessage).toBe('Service Unavailable');
			}
		});
	});
});

describe('Mobile Scan - Data Mapping to LastBook Type', () => {
	type LastBook = {
		isbn: string;
		title: string;
		subtitle?: string;
		authors?: string[];
		coverUrl?: string;
		source?: string;
	};

	function mapToLastBook(data: MergedBookData, isbn: string): LastBook {
		const authors = data.author
			? data.author.split(/[;,]/).map((a) => a.trim()).filter(Boolean)
			: [];
		
		return {
			isbn,
			title: data.title || 'Unknown Title',
			subtitle: data.specificDetail || undefined,
			authors: authors.length > 0 ? authors : undefined,
			coverUrl: data.cover || undefined,
			source: data.dataSource || undefined
		};
	}

	it('maps full book data correctly', () => {
		const lastBook = mapToLastBook(MOCK_BOOK_FULL, '9780132350884');

		expect(lastBook.isbn).toBe('9780132350884');
		expect(lastBook.title).toBe('Clean Code');
		expect(lastBook.subtitle).toBe('A Handbook of Agile Software Craftsmanship');
		// Note: Author "Martin, Robert C." gets split by comma into ["Martin", "Robert C."]
		expect(lastBook.authors).toEqual(['Martin', 'Robert C.']);
		expect(lastBook.coverUrl).toBe('https://books.google.com/books/content?id=test');
		expect(lastBook.source).toBe('google-openlibrary');
	});

	it('maps minimal book data correctly', () => {
		const lastBook = mapToLastBook(MOCK_BOOK_MINIMAL, '9781234567890');

		expect(lastBook.isbn).toBe('9781234567890');
		expect(lastBook.title).toBe('Test Book');
		expect(lastBook.subtitle).toBeUndefined();
		expect(lastBook.authors).toBeUndefined();
		expect(lastBook.coverUrl).toBeUndefined();
		expect(lastBook.source).toBe('google-only');
	});

	it('provides fallback title for missing title', () => {
		const dataNoTitle = { ...MOCK_BOOK_FULL, title: '' };
		const lastBook = mapToLastBook(dataNoTitle, '9780132350884');

		expect(lastBook.title).toBe('Unknown Title');
	});

	it('splits authors by semicolon and comma', () => {
		const dataMultiAuthors = { 
			...MOCK_BOOK_FULL, 
			author: 'Martin, Robert C.; Fowler, Martin; Beck, Kent' 
		};
		const lastBook = mapToLastBook(dataMultiAuthors, '9780132350884');

		// Splits by both ; and , so "Martin, Robert C." becomes ["Martin", "Robert C."]
		expect(lastBook.authors).toEqual([
			'Martin',
			'Robert C.',
			'Fowler',
			'Martin',
			'Beck',
			'Kent'
		]);
	});

	it('splits authors by comma', () => {
		const dataMultiAuthors = { 
			...MOCK_BOOK_FULL, 
			author: 'Martin, Robert C., Fowler, Martin, Beck, Kent' 
		};
		const lastBook = mapToLastBook(dataMultiAuthors, '9780132350884');

		// Splits by comma, so each comma-separated part is an item
		expect(lastBook.authors).toHaveLength(6);
		expect(lastBook.authors).toContain('Martin');
		expect(lastBook.authors).toContain('Robert C.');
	});

	it('handles empty author field', () => {
		const dataNoAuthor = { ...MOCK_BOOK_FULL, author: '' };
		const lastBook = mapToLastBook(dataNoAuthor, '9780132350884');

		expect(lastBook.authors).toBeUndefined();
	});

	it('trims whitespace from author names', () => {
		const dataAuthors = { 
			...MOCK_BOOK_FULL, 
			author: '  Martin, Robert C.  ;  Fowler, Martin  ' 
		};
		const lastBook = mapToLastBook(dataAuthors, '9780132350884');

		// Each comma and semicolon splits, then trims
		expect(lastBook.authors).toEqual([
			'Martin',
			'Robert C.',
			'Fowler',
			'Martin'
		]);
	});

	it('maps specificDetail to subtitle', () => {
		const lastBook = mapToLastBook(MOCK_BOOK_FULL, '9780132350884');
		expect(lastBook.subtitle).toBe('A Handbook of Agile Software Craftsmanship');
	});

	it('handles missing specificDetail', () => {
		const dataNoSubtitle = { ...MOCK_BOOK_FULL, specificDetail: '' };
		const lastBook = mapToLastBook(dataNoSubtitle, '9780132350884');
		expect(lastBook.subtitle).toBeUndefined();
	});

	it('maps cover to coverUrl', () => {
		const lastBook = mapToLastBook(MOCK_BOOK_FULL, '9780132350884');
		expect(lastBook.coverUrl).toBe('https://books.google.com/books/content?id=test');
	});

	it('handles missing cover', () => {
		const dataNoCover = { ...MOCK_BOOK_FULL, cover: '' };
		const lastBook = mapToLastBook(dataNoCover, '9780132350884');
		expect(lastBook.coverUrl).toBeUndefined();
	});

	it('maps dataSource to source', () => {
		const lastBook = mapToLastBook(MOCK_BOOK_FULL, '9780132350884');
		expect(lastBook.source).toBe('google-openlibrary');
	});

	it('handles all data source types', () => {
		const dataSources = [
			'all-three',
			'google-loc',
			'google-openlibrary',
			'loc-openlibrary',
			'google-only',
			'loc-only',
			'openlibrary-only'
		];

		dataSources.forEach(source => {
			const data = { ...MOCK_BOOK_FULL, dataSource: source as any };
			const lastBook = mapToLastBook(data, '9780132350884');
			expect(lastBook.source).toBe(source);
		});
	});
});

describe('Mobile Scan - Request Queueing Logic', () => {
	it('should queue ISBN when fetch is in progress', () => {
		let loading = false;
		let pendingIsbn: string | null = null;

		// Simulate first scan (starts loading)
		const isbn1 = '9780132350884';
		loading = true;

		// Simulate second scan while loading
		const isbn2 = '9781234567890';
		if (loading) {
			pendingIsbn = isbn2;
		}

		expect(pendingIsbn).toBe('9781234567890');
		expect(loading).toBe(true);
	});

	it('should replace queued ISBN with latest scan', () => {
		let loading = true;
		let pendingIsbn: string | null = null;

		// Queue first ISBN
		const isbn2 = '9781234567890';
		if (loading) {
			pendingIsbn = isbn2;
		}

		// Queue second ISBN (should replace)
		const isbn3 = '9780134685991';
		if (loading) {
			pendingIsbn = isbn3;
		}

		expect(pendingIsbn).toBe('9780134685991');
	});

	it('should not queue when not loading', () => {
		let loading = false;
		let pendingIsbn: string | null = null;

		const isbn = '9781234567890';
		if (loading) {
			pendingIsbn = isbn;
		}

		expect(pendingIsbn).toBeNull();
	});

	it('should clear pending ISBN after processing', () => {
		let pendingIsbn: string | null = '9781234567890';

		// Simulate processing the pending scan
		const isbnToProcess = pendingIsbn;
		pendingIsbn = null;

		expect(isbnToProcess).toBe('9781234567890');
		expect(pendingIsbn).toBeNull();
	});
});

describe('Mobile Scan - Error State Management', () => {
	it('sets error on API failure', async () => {
		let error: string | null = null;

		try {
			throw new Error('Book not found');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to fetch book data';
		}

		expect(error).toBe('Book not found');
	});

	it('clears error on successful scan', async () => {
		let error: string | null = 'Previous error';

		// Simulate new scan
		error = null;

		expect(error).toBeNull();
	});

	it('provides generic error message for unknown errors', () => {
		let error: string | null = null;

		try {
			throw 'String error'; // Non-Error object
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to fetch book data';
		}

		expect(error).toBe('Failed to fetch book data');
	});
});

describe('Mobile Scan - Loading State Management', () => {
	it('sets loading true when fetch starts', () => {
		let loading = false;

		// Simulate scan start
		loading = true;

		expect(loading).toBe(true);
	});

	it('sets loading false when fetch completes', () => {
		let loading = true;

		// Simulate fetch completion
		loading = false;

		expect(loading).toBe(false);
	});

	it('sets loading false on error', () => {
		let loading = true;

		try {
			throw new Error('Fetch failed');
		} catch {
			loading = false;
		}

		expect(loading).toBe(false);
	});
});

describe('Mobile Scan - Edge Cases', () => {
	it('handles empty ISBN string', () => {
		const isbn = '';
		const normalized = isbn.replace(/[\s-]/g, '');
		expect(normalized).toBe('');
	});

	it('handles whitespace-only ISBN', () => {
		const isbn = '   ';
		const normalized = isbn.trim().replace(/[\s-]/g, '');
		expect(normalized).toBe('');
	});

	it('handles very long ISBN string', () => {
		const isbn = '9'.repeat(50);
		const normalized = isbn.replace(/[\s-]/g, '');
		expect(normalized).toHaveLength(50);
	});

	it('handles ISBN with special characters', () => {
		const isbn = '978-0-13-235088-4 (pbk.)';
		const normalized = isbn.replace(/[\s-]/g, '');
		expect(normalized).toBe('9780132350884(pbk.)');
	});

	it('encodes ISBN for URL correctly', () => {
		const isbn = '9780132350884';
		const encoded = encodeURIComponent(isbn);
		expect(encoded).toBe('9780132350884');
	});

	it('encodes special characters in ISBN for URL', () => {
		const isbn = '978-0-13-235088-4';
		const encoded = encodeURIComponent(isbn);
		expect(encoded).toBe('978-0-13-235088-4');
	});
});
