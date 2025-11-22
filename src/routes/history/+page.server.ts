import type { PageServerLoad } from './$types';
import { requireSession } from '$lib/server';
import { getScanHistory } from '$modules/scan';

export const load: PageServerLoad = async (event) => {
	// Protect this route - require authentication (throws redirect if not logged in)
	const session = await requireSession(event);

	try {
		// Fetch scan history using scan module
		const history = await getScanHistory(event, 100); // Get up to 100 scans

		return {
			user: session.user,
			scans: history.scans,
			totalScans: history.total,
			hasMore: history.hasMore
		};
	} catch (error) {
		console.error('[History] Failed to fetch scans:', error);
		return {
			user: session.user,
			scans: [],
			totalScans: 0,
			hasMore: false,
			error: 'Failed to load scan history'
		};
	}
};
