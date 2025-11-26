/**
 * Utility functions for performance optimization
 */

/**
 * Secure Image URL Helper
 * Converts HTTP image URLs to HTTPS to prevent mixed content warnings
 * Ensures privacy and security for Cloudflare Pages deployment
 * 
 * @param url - Image URL (potentially HTTP)
 * @returns Secure HTTPS URL or original if already secure/null
 */
export function getSecureImageUrl(url: string | null | undefined): string {
	if (!url || url === '' || url === '-') {
		return ''; // Return empty string for invalid URLs
	}

	// Validate data: URIs - only allow safe image types
	if (url.startsWith('data:')) {
		const safeImageDataUri = /^data:image\/(svg\+xml|png|jpeg|gif|webp);base64,/i;

		if (safeImageDataUri.test(url)) {
			return url; // Safe data URI
		}

		// Reject dangerous data URIs (e.g., data:text/html, data:application/javascript)
		console.warn('[Security] Blocked unsafe data: URI:', url.substring(0, 50));
		return ''; // Return empty to prevent XSS
	}

	// Validate URL scheme - prevent javascript:, file:, etc.
	try {
		const urlObj = new URL(url);
		if (!['http:', 'https:'].includes(urlObj.protocol)) {
			console.warn(`[Security] Blocked dangerous URL scheme: ${urlObj.protocol}`);
			return '';
		}
	} catch {
		// Invalid URL format
		return '';
	}

	// Force HTTPS for all HTTP URLs (critical for Cloudflare Pages)
	let secureUrl = url.replace(/^http:\/\//i, 'https://');

	// Optional: Remove tracking parameters while preserving image ID
	// This is conservative - only removes known benign params
	try {
		const urlObj = new URL(secureUrl);
		
		// Remove common tracking parameters (optional privacy enhancement)
		const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'referrer'];
		trackingParams.forEach(param => urlObj.searchParams.delete(param));
		
		secureUrl = urlObj.toString();
	} catch {
		// If URL parsing fails, return the HTTPS-forced version
		// This handles relative URLs or malformed URLs gracefully
	}

	return secureUrl;
}

/**
 * Debounce function calls to prevent excessive API calls during typing
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: ReturnType<typeof setTimeout> | null = null;

	return (...args: Parameters<T>) => {
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
}

/**
 * Throttle function calls to limit execution frequency
 */
export function throttle<T extends (...args: any[]) => any>(
	func: T,
	limit: number
): (...args: Parameters<T>) => void {
	let inThrottle = false;

	return (...args: Parameters<T>) => {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => inThrottle = false, limit);
		}
	};
}

/**
 * HTTP error class with status code support
 */
export class HttpError extends Error {
	constructor(public status: number, message: string) {
		super(message);
		this.name = 'HttpError';
	}
}

/**
 * Enhanced retry mechanism with circuit breaker for API rate limits
 * 
 * Circuit Breaker Logic:
 * - 503 Service Unavailable: Don't retry (service is down)
 * - 429 Too Many Requests: Don't retry (rate limited)
 * - 4xx Client Errors: Don't retry (bad request)
 * - Network/Timeout: Retry with exponential backoff
 */
export async function retry<T>(
	operation: () => Promise<T>,
	maxRetries: number = 3,
	initialDelay: number = 1000
): Promise<T> {
	let lastError: Error;

	for (let i = 0; i < maxRetries; i++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error as Error;
			
			// Circuit Breaker: Don't retry on certain HTTP errors
			if (error instanceof HttpError || (error as any).status) {
				const status = error instanceof HttpError ? error.status : (error as any).status;
				const message = error instanceof Error ? error.message : 'Unknown error';
				
				// Don't retry on rate limits, service unavailable, or client errors
				if (status === 503 || status === 429 || (status >= 400 && status < 500)) {
					console.warn(`[Circuit Breaker] Not retrying HTTP ${status}: ${message}`);
					throw error;
				}
			}
			
			// Check if error message indicates rate limiting or service issues
			const errorMsg = lastError.message.toLowerCase();
			if (errorMsg.includes('rate limit') || errorMsg.includes('503') || errorMsg.includes('429') || errorMsg.includes('temporarily unavailable')) {
				console.warn(`[Circuit Breaker] Detected rate limit/service issue, aborting retries`);
				throw lastError;
			}
			
			// Exponential backoff for retryable errors (network issues, timeouts)
			if (i < maxRetries - 1) {
				const backoffDelay = initialDelay * Math.pow(2, i);
				console.log(`[Retry ${i + 1}/${maxRetries}] Waiting ${backoffDelay}ms before retry...`);
				await new Promise(resolve => setTimeout(resolve, backoffDelay));
			}
		}
	}

	throw lastError!;
}

/**
 * Check if device is online (with fallback for older browsers)
 */
export function isOnline(): boolean {
	if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
		return navigator.onLine;
	}
	return true; // Assume online if can't detect
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
	const units = ['B', 'KB', 'MB', 'GB'];
	let size = bytes;
	let unitIndex = 0;

	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}

	return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Generate a simple hash for cache keys
 */
export function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return hash.toString(36);
}

/**
 * ISBN Utilities for Smart Prefetching
 */

/**
 * Calculate ISBN-10 check digit
 * Algorithm: (11 - (sum of (digit * weight) mod 11)) mod 11
 * If result is 10, use 'X'
 */
function calculateISBN10CheckDigit(isbn9: string): string {
	let sum = 0;
	for (let i = 0; i < 9; i++) {
		sum += parseInt(isbn9[i]) * (10 - i);
	}
	const checkDigit = (11 - (sum % 11)) % 11;
	return checkDigit === 10 ? 'X' : checkDigit.toString();
}

/**
 * Calculate ISBN-13 check digit
 * Algorithm: (10 - (sum of (digit * weight[1,3,1,3...]) mod 10)) mod 10
 */
function calculateISBN13CheckDigit(isbn12: string): string {
	let sum = 0;
	for (let i = 0; i < 12; i++) {
		const weight = i % 2 === 0 ? 1 : 3;
		sum += parseInt(isbn12[i]) * weight;
	}
	const checkDigit = (10 - (sum % 10)) % 10;
	return checkDigit.toString();
}

/**
 * Validate ISBN-10 format and checksum
 */
export function isValidISBN10(isbn: string): boolean {
	if (!/^\d{9}[\dX]$/.test(isbn)) return false;
	
	const expected = calculateISBN10CheckDigit(isbn.substring(0, 9));
	return isbn[9] === expected;
}

/**
 * Validate ISBN-13 format and checksum
 */
export function isValidISBN13(isbn: string): boolean {
	if (!/^\d{13}$/.test(isbn)) return false;
	
	const expected = calculateISBN13CheckDigit(isbn.substring(0, 12));
	return isbn[12] === expected;
}

/**
 * Convert ISBN-13 to ISBN-10
 * Only valid for ISBNs starting with 978 (Bookland)
 * Returns null if conversion is not possible or ISBN is invalid
 */
export function convertISBN13to10(isbn13: string): string | null {
	// Remove any hyphens or spaces
	const cleaned = isbn13.replace(/[-\s]/g, '');
	
	// Validate format
	if (cleaned.length !== 13) return null;
	if (!cleaned.startsWith('978')) return null; // Only 978 prefix can be converted
	if (!isValidISBN13(cleaned)) {
		console.warn(`[ISBN] Invalid ISBN-13 checksum: ${isbn13}`);
		return null;
	}
	
	// Extract the 9 digits after 978 prefix
	const isbn9 = cleaned.substring(3, 12);
	
	// Calculate ISBN-10 check digit
	const checkDigit = calculateISBN10CheckDigit(isbn9);
	
	return isbn9 + checkDigit;
}

/**
 * Convert ISBN-10 to ISBN-13
 * Adds 978 prefix and recalculates check digit
 * Returns null if ISBN is invalid
 */
export function convertISBN10to13(isbn10: string): string | null {
	// Remove any hyphens or spaces
	const cleaned = isbn10.replace(/[-\s]/g, '');
	
	// Validate format
	if (cleaned.length !== 10) return null;
	if (!isValidISBN10(cleaned)) {
		console.warn(`[ISBN] Invalid ISBN-10 checksum: ${isbn10}`);
		return null;
	}
	
	// Add 978 prefix and take first 9 digits of ISBN-10
	const isbn12 = '978' + cleaned.substring(0, 9);
	
	// Calculate ISBN-13 check digit
	const checkDigit = calculateISBN13CheckDigit(isbn12);
	
	return isbn12 + checkDigit;
}

/**
 * Detect if a string is an ISBN (10 or 13)
 */
export function isISBN(str: string): boolean {
	const cleaned = str.replace(/[-\s]/g, '');
	return /^\d{10}$|^\d{9}X$|^\d{13}$/.test(cleaned);
}

/**
 * Get the sibling ISBN (convert 10↔13)
 * Returns null if conversion is not possible
 */
export function getISBNSibling(isbn: string): string | null {
	const cleaned = isbn.replace(/[-\s]/g, '');
	
	if (/^\d{13}$/.test(cleaned)) {
		return convertISBN13to10(cleaned);
	} else if (/^\d{10}$|^\d{9}X$/.test(cleaned)) {
		return convertISBN10to13(cleaned);
	}
	
	return null;
}