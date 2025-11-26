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
        | UserInteractionEvent
        | AutoAddTriggeredEvent
        | ScanLatencyEvent;

/**
 * Search tracking (ISBN vs Title, with performance metrics)
 */
interface SearchPerformedEvent {
        name: 'search_performed';
        properties: {
                type: 'isbn' | 'title';
                query_length: number;
                duration_ms: number;
                latency_ms: number;
                result_count: number;
                cache_hit?: boolean;
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
interface _CacheMissEvent {
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
		action: 'book_selected' | 'back_to_search' | 'home_navigation' | 'view_raw_data' | 'auto_add_to_batch';
		source?: 'google' | 'openlibrary' | 'scanner_mode';
		is_partial?: boolean;
		timestamp: string;
	};
}

/**
 * Auto-add triggered event (scanner mode continuous workflow)
 */
interface AutoAddTriggeredEvent {
        name: 'auto_add_triggered';
        properties: {
                isbn: string;
		is_partial_data: boolean;
		data_source: string;
		has_google: boolean;
		has_openlibrary: boolean;
		has_loc: boolean;
                timestamp: string;
        };
}

interface ScanLatencyEvent {
        name: 'scan_latency';
        properties: {
                duration: number;
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

                const sanitizedEvent = this.sanitizeEvent(eventData);

                if (this.isDev) {
                        this.logDevMode(sanitizedEvent);
                } else {
                        this.logProdMode(sanitizedEvent);
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
                        'user_interaction': '🖱️',
                        'auto_add_triggered': '🚀',
                        'scan_latency': '⌛'
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
                        'user_interaction': '#6366f1', // indigo
                        'auto_add_triggered': '#22c55e', // lime green
                        'scan_latency': '#0ea5e9' // sky blue
                };
                return colorMap[eventName] || '#000000';
        }

        /**
         * Remove or hash sensitive values before logging
         */
        private sanitizeEvent(event: { name: string; properties: any }) {
                return {
                        ...event,
                        properties: this.sanitizeProperties(event.properties)
                };
        }

        private sanitizeProperties(properties: Record<string, any>): Record<string, any> {
                const sanitizeValue = (value: any, key?: string): any => {
                        if (value === null || value === undefined) return value;

                        if (typeof value === 'object') {
                                if (Array.isArray(value)) {
                                        return value.map(item => sanitizeValue(item));
                                }

                                return Object.entries(value).reduce<Record<string, any>>((acc, [childKey, childValue]) => {
                                        acc[childKey] = sanitizeValue(childValue, childKey);
                                        return acc;
                                }, {});
                        }

                        if (key && this.isSensitiveKey(key)) {
                                if (typeof value === 'string') {
                                        return this.hashSensitiveValue(value);
                                }
                                return '[REDACTED]';
                        }

                        return value;
                };

                return sanitizeValue(properties) as Record<string, any>;
        }

        private isSensitiveKey(key: string): boolean {
                return /(email|token|code|state)/i.test(key);
        }

        private hashSensitiveValue(value: string): string {
                let hash = 0;
                for (let i = 0; i < value.length; i++) {
                        hash = (hash << 5) - hash + value.charCodeAt(i);
                        hash |= 0;
                }
                return `[REDACTED:${Math.abs(hash)}]`;
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
        UserInteractionEvent,
        AutoAddTriggeredEvent,
        ScanLatencyEvent
};
