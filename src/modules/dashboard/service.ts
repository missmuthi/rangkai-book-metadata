/**
 * Dashboard Module - Analytics & Statistics
 * 
 * Aggregates user data for dashboard display:
 * - Scan statistics
 * - Recent activity
 * - Performance metrics
 */

import type { RequestEvent } from '@sveltejs/kit';
import { getDB, getUserScans, getUserStats } from '$lib/server';
import type { Scan } from '$lib/server/types';

/**
 * Dashboard statistics
 */
export interface DashboardStats {
	totalScans: number;
	publishedScans: number;
	draftScans: number;
	recentScans: Scan[];
	periodStats?: {
		today: number;
		thisWeek: number;
		thisMonth: number;
	};
}

/**
 * Activity summary
 */
export interface ActivitySummary {
	scansToday: number;
	scansThisWeek: number;
	scansThisMonth: number;
	mostScannedISBNs: Array<{ isbn: string; count: number; title: string }>;
}

/**
 * Get comprehensive dashboard statistics
 * 
 * @param event - SvelteKit RequestEvent (must have authenticated user)
 * @returns Dashboard statistics and recent activity
 */
export async function getDashboardData(event: RequestEvent): Promise<DashboardStats | null> {
	const userId = event.locals.user?.id;
	if (!userId) {
		return null;
	}

	try {
		const db = getDB(event.platform);

		// Fetch stats and recent scans in parallel
		const [stats, recentScans] = await Promise.all([
			getUserStats(db, userId),
			getUserScans(db, userId, 10) // Last 10 scans
		]);

		// Calculate period-based stats
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
		const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

		const periodStats = {
			today: recentScans.filter(s => new Date(s.created_at) >= today).length,
			thisWeek: recentScans.filter(s => new Date(s.created_at) >= weekAgo).length,
			thisMonth: recentScans.filter(s => new Date(s.created_at) >= monthAgo).length
		};

		return {
			totalScans: stats.totalScans,
			publishedScans: stats.publishedScans,
			draftScans: stats.draftScans,
			recentScans,
			periodStats
		};
	} catch (error) {
		console.error('[Dashboard Service] Failed to fetch dashboard data:', error);
		return null;
	}
}

/**
 * Get activity summary for a specific time period
 * 
 * @param event - SvelteKit RequestEvent
 * @param days - Number of days to look back (default: 30)
 */
export async function getActivitySummary(
	event: RequestEvent,
	days: number = 30
): Promise<ActivitySummary | null> {
	const userId = event.locals.user?.id;
	if (!userId) {
		return null;
	}

	try {
		const db = getDB(event.platform);
		const scans = await getUserScans(db, userId, 1000); // Fetch more for analytics

		const now = new Date();
		const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

		// Filter scans by date
		const recentScans = scans.filter(s => new Date(s.created_at) >= cutoffDate);
		const todayScans = scans.filter(s => new Date(s.created_at) >= today);
		const weekScans = scans.filter(s => new Date(s.created_at) >= weekAgo);

		// Count ISBN frequencies
		const isbnCounts = new Map<string, { count: number; title: string }>();
		for (const scan of recentScans) {
			const current = isbnCounts.get(scan.isbn) || { count: 0, title: scan.title };
			isbnCounts.set(scan.isbn, { count: current.count + 1, title: scan.title });
		}

		// Get top 5 most scanned ISBNs
		const mostScannedISBNs = Array.from(isbnCounts.entries())
			.sort((a, b) => b[1].count - a[1].count)
			.slice(0, 5)
			.map(([isbn, data]) => ({ isbn, count: data.count, title: data.title }));

		return {
			scansToday: todayScans.length,
			scansThisWeek: weekScans.length,
			scansThisMonth: recentScans.length,
			mostScannedISBNs
		};
	} catch (error) {
		console.error('[Dashboard Service] Failed to fetch activity summary:', error);
		return null;
	}
}

/**
 * Get scan trends (daily counts for charting)
 */
export async function getScanTrends(
	event: RequestEvent,
	days: number = 30
): Promise<Array<{ date: string; count: number }>> {
	const userId = event.locals.user?.id;
	if (!userId) {
		return [];
	}

	try {
		const db = getDB(event.platform);
		const scans = await getUserScans(db, userId, 1000);

		const now = new Date();
		const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

		// Count scans by date
		const dateCounts = new Map<string, number>();
		for (const scan of scans) {
			const scanDate = new Date(scan.created_at);
			if (scanDate >= cutoffDate) {
				const dateKey = scanDate.toISOString().split('T')[0];
				dateCounts.set(dateKey, (dateCounts.get(dateKey) || 0) + 1);
			}
		}

		// Create array of all dates in range
		const trends: Array<{ date: string; count: number }> = [];
		for (let i = 0; i < days; i++) {
			const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
			const dateKey = date.toISOString().split('T')[0];
			trends.unshift({
				date: dateKey,
				count: dateCounts.get(dateKey) || 0
			});
		}

		return trends;
	} catch (error) {
		console.error('[Dashboard Service] Failed to fetch scan trends:', error);
		return [];
	}
}
