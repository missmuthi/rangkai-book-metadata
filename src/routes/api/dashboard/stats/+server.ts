/**
 * Dashboard API - Get dashboard statistics
 * 
 * GET /api/dashboard/stats
 * 
 * Returns:
 * - Scan statistics
 * - Recent activity
 * - Period-based metrics
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireSession } from '$lib/server';
import { getDashboardData, getActivitySummary } from '$modules/dashboard';

export const GET: RequestHandler = async (event) => {
	// Require authentication
	await requireSession(event);

	// Get query parameters
	const includeActivity = event.url.searchParams.get('activity') === 'true';

	try {
		// Fetch dashboard data
		const dashboardData = await getDashboardData(event);

		if (!dashboardData) {
			throw error(500, 'Failed to fetch dashboard data');
		}

		// Optionally include detailed activity summary
		let activitySummary = undefined;
		if (includeActivity) {
			activitySummary = await getActivitySummary(event, 30);
		}

		return json({
			stats: {
				total: dashboardData.totalScans,
				published: dashboardData.publishedScans,
				draft: dashboardData.draftScans,
				...dashboardData.periodStats
			},
			recentScans: dashboardData.recentScans,
			activity: activitySummary
		});
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'Unknown error';
		throw error(500, `Failed to fetch dashboard data: ${errorMessage}`);
	}
};
