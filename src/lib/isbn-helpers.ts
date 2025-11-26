/**
 * ISBN Helper Utilities
 * Reusable functions for ISBN normalization and validation
 */

import { isValidISBN10, isValidISBN13 } from './utils';

/**
 * Normalize ISBN by removing spaces, hyphens, and converting to uppercase
 */
export function normalizeISBN(isbn: string): string {
	return isbn.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Type guard to check if a string is a valid ISBN (10 or 13)
 */
export function isValidISBN(isbn: string): boolean {
	const normalized = normalizeISBN(isbn);
	return isValidISBN10(normalized) || isValidISBN13(normalized);
}

/**
 * Extract ISBN-like patterns from scanned text
 * Handles cases where barcode scanners include extra characters
 */
export function extractISBN(text: string): string | null {
	const normalized = normalizeISBN(text);
	
	// Try to find 13-digit ISBN
	const isbn13Match = normalized.match(/\d{13}/);
	if (isbn13Match && isValidISBN13(isbn13Match[0])) {
		return isbn13Match[0];
	}
	
	// Try to find 10-digit ISBN (with possible X)
	const isbn10Match = normalized.match(/\d{9}[\dX]/);
	if (isbn10Match && isValidISBN10(isbn10Match[0])) {
		return isbn10Match[0];
	}
	
	// Return normalized text if no pattern found (let API handle validation)
	return normalized || null;
}

/**
 * Format ISBN for display (adds hyphens for readability)
 */
export function formatISBN(isbn: string): string {
	const normalized = normalizeISBN(isbn);
	
	if (normalized.length === 13) {
		// Format: 978-0-123-45678-9
		return `${normalized.slice(0, 3)}-${normalized.slice(3, 4)}-${normalized.slice(4, 7)}-${normalized.slice(7, 12)}-${normalized.slice(12)}`;
	} else if (normalized.length === 10) {
		// Format: 0-123-45678-9
		return `${normalized.slice(0, 1)}-${normalized.slice(1, 4)}-${normalized.slice(4, 9)}-${normalized.slice(9)}`;
	}
	
	return normalized;
}

/**
 * Clean ISBN input from barcode scanners
 * Strips all non-alphanumeric characters (dashes, spaces)
 */
export function cleanISBN(input: string): string {
	return input.replace(/[^a-zA-Z0-9X]/gi, '');
}
