/**
 * Utility functions for performance optimization
 */

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