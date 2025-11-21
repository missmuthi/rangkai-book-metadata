import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	// Protect this route - require authentication
	if (!locals.session || !locals.user) {
		throw redirect(303, '/login');
	}

	// At this point, locals.user is guaranteed to exist
	const userId = locals.user.id;

	// Fetch ALL user's scan history from D1
	const db = platform?.env?.DB;
	if (!db) {
		console.error('[History] D1 database not available');
		return {
			user: locals.user,
			scans: [],
			totalScans: 0,
			error: 'Database unavailable'
		};
	}

	try {
		// Query all scans for this user (most recent first)
		const result = await db
			.prepare(
				`SELECT isbn, title, json_data, status, created_at 
				FROM scans 
				WHERE user_id = ? 
				ORDER BY created_at DESC`
			)
			.bind(userId)
			.all();

		// Count total scans
		const totalScans = result.results?.length || 0;

		return {
			user: locals.user,
			scans: result.results || [],
			totalScans
		};
	} catch (error) {
		console.error('[History] Failed to fetch scans:', error);
		return {
			user: locals.user,
			scans: [],
			totalScans: 0,
			error: 'Failed to load scan history'
		};
	}
};
