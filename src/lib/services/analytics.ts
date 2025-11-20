/**
 * Centralized Analytics & Telemetry Service for Rangkai
 * 
 * Provides structured event tracking with dev/prod modes.
 * Future-ready for integration with Plausible, Google Analytics, or PostHog.
 */

import type { MergedBookData } from '../types';

// --- Event Type Definitions ---

/**
 * Comprehensive event catalog for Rangkai analytics
 */
export type AnalyticsEvent = 
	| SearchPerformedEvent
	| CacheHitEvent
	| DataSourceUsedEvent
	| ScannerModeToggledEvent
	| BatchExportEvent
	| SingleExportEvent
	| ErrorOccurredEvent
	| ApiTimingEvent
	| UserInteractionEvent;

/**
 * Search tracking (ISBN vs Title, with performance metrics)
 */
interface SearchPerformedEvent {
	name: 'search_performed';
	properties: {
		type: 'isbn' | 'title';
		query_length: number;
		duration_ms: number;
		result_count: number;
		timestamp: string;
	};
}

/**
 * Cache hit tracking (with cache type and key)
 */
interface CacheHitEvent {
	name: 'cache_hit';
	properties: {
		cache_type: 'google' | 'openlibrary' | 'loc';
		key: string;
		is_isbn: boolean;
		timestamp: string;
	};
}

/**
 * Cache miss tracking
 */
interface CacheMissEvent {
	name: 'cache_miss';
	properties: {
		cache_type: 'google' | 'openlibrary' | 'loc';
		key: string;
		is_isbn: boolean;
		timestamp: string;
	};
}

/**
 * Data source tracking (which APIs succeeded/failed)
 */
interface DataSourceUsedEvent {
	name: 'data_source_used';
	properties: {
		source: MergedBookData['dataSource'];
		has_google: boolean;
		has_openlibrary: boolean;
		has_loc: boolean;
		is_partial: boolean;
		timestamp: string;
	};
}

/**
 * Scanner mode toggle tracking
 */
interface ScannerModeToggledEvent {
	name: 'scanner_mode_toggled';
	properties: {
		enabled: boolean;
		timestamp: string;
	};
}

/**
 * Batch export tracking
 */
interface BatchExportEvent {
	name: 'batch_export';
	properties: {
		count: number;
		format: 'csv' | 'marcxml';
		timestamp: string;
	};
}

/**
 * Single book export tracking
 */
interface SingleExportEvent {
	name: 'single_export';
	properties: {
		format: 'csv' | 'marcxml';
		isbn?: string;
		timestamp: string;
	};
}

/**
 * Error tracking (API failures, parsing errors, network issues)
 */
interface ErrorOccurredEvent {
	name: 'error_occurred';
	properties: {
		error_type: 'api_503' | 'api_timeout' | 'parse_error' | 'network_error' | 'rate_limit' | 'unknown';
		source: 'google' | 'openlibrary' | 'loc' | 'general';
		message?: string;
		timestamp: string;
	};
}

/**
 * API timing tracking (performance monitoring)
 */
interface ApiTimingEvent {
	name: 'api_timing';
	properties: {
		source: 'google' | 'openlibrary' | 'loc';
		endpoint: string;
		duration_ms: number;
		success: boolean;
		timestamp: string;
	};
}

/**
 * User interaction tracking (clicks, navigation)
 */
interface UserInteractionEvent {
	name: 'user_interaction';
	properties: {
		action: 'book_selected' | 'back_to_search' | 'home_navigation' | 'view_raw_data';
		source?: 'google' | 'openlibrary';
		timestamp: string;
	};
}

// --- Analytics Service Implementation ---

/**
 * Singleton Analytics Service
 * 
 * Usage:
 * ```typescript
 * import { Analytics } from '$lib/services/analytics';
 * 
 * Analytics.track('search_performed', {
 *   type: 'isbn',
 *   query_length: 13,
 *   duration_ms: 1234,
 *   result_count: 1
 * });
 * ```
 */
class AnalyticsService {
	private static instance: AnalyticsService;
	private isDev: boolean;
	private enabled: boolean;

	private constructor() {
		// Check if we're in development mode
		this.isDev = import.meta.env.DEV;
		this.enabled = true; // Can be toggled via user preferences later
	}

	/**
	 * Get singleton instance
	 */
	public static getInstance(): AnalyticsService {
		if (!AnalyticsService.instance) {
			AnalyticsService.instance = new AnalyticsService();
		}
		return AnalyticsService.instance;
	}

	/**
	 * Track an analytics event
	 * 
	 * @param name - Event name (typed from AnalyticsEvent)
	 * @param properties - Event properties (typed based on event name)
	 */
	public track<T extends AnalyticsEvent>(
		name: T['name'],
		properties: Omit<T['properties'], 'timestamp'>
	): void {
		if (!this.enabled) return;

		// Add timestamp
		const eventData = {
			name,
			properties: {
				...properties,
				timestamp: new Date().toISOString()
			}
		};

		if (this.isDev) {
			this.logDevMode(eventData);
		} else {
			this.logProdMode(eventData);
		}
	}

	/**
	 * Dev mode logging with colors and emojis
	 */
	private logDevMode(event: { name: string; properties: any }): void {
		const emoji = this.getEventEmoji(event.name);
		const color = this.getEventColor(event.name);

		console.log(
			`%c${emoji} [Analytics] ${event.name}`,
			`color: ${color}; font-weight: bold;`,
			event.properties
		);
	}

	/**
	 * Production mode logging (console.info with prefix)
	 * Future: Replace with actual analytics service (Plausible, GA, PostHog)
	 */
	private logProdMode(event: { name: string; properties: any }): void {
		console.info('[Analytics]', event.name, event.properties);

		// TODO: Send to analytics service
		// Example for Plausible:
		// if (window.plausible) {
		//   window.plausible(event.name, { props: event.properties });
		// }

		// Example for Google Analytics:
		// if (window.gtag) {
		//   window.gtag('event', event.name, event.properties);
		// }
	}

	/**
	 * Get emoji for event type
	 */
	private getEventEmoji(eventName: string): string {
		const emojiMap: Record<string, string> = {
			'cache_hit': '⚡',
			'cache_miss': '💨',
			'search_performed': '🔍',
			'data_source_used': '📊',
			'scanner_mode_toggled': '📱',
			'batch_export': '📦',
			'single_export': '💾',
			'error_occurred': '❌',
			'api_timing': '⏱️',
			'user_interaction': '🖱️'
		};
		return emojiMap[eventName] || '📌';
	}

	/**
	 * Get color for event type
	 */
	private getEventColor(eventName: string): string {
		const colorMap: Record<string, string> = {
			'cache_hit': '#10b981', // green
			'cache_miss': '#6b7280', // gray
			'search_performed': '#3b82f6', // blue
			'data_source_used': '#8b5cf6', // purple
			'scanner_mode_toggled': '#f59e0b', // amber
			'batch_export': '#ec4899', // pink
			'single_export': '#06b6d4', // cyan
			'error_occurred': '#ef4444', // red
			'api_timing': '#14b8a6', // teal
			'user_interaction': '#6366f1' // indigo
		};
		return colorMap[eventName] || '#000000';
	}

	/**
	 * Enable/disable analytics
	 */
	public setEnabled(enabled: boolean): void {
		this.enabled = enabled;
	}

	/**
	 * Check if analytics is enabled
	 */
	public isEnabled(): boolean {
		return this.enabled;
	}
}

// Export singleton instance
export const Analytics = AnalyticsService.getInstance();

// Export types for use in other modules
export type {
	SearchPerformedEvent,
	CacheHitEvent,
	DataSourceUsedEvent,
	ScannerModeToggledEvent,
	BatchExportEvent,
	SingleExportEvent,
	ErrorOccurredEvent,
	ApiTimingEvent,
	UserInteractionEvent
};
