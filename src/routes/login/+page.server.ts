import type { PageServerLoad } from './$types';

/**
 * Load session data for login page
 * Used to auto-redirect already logged-in users
 */
export const load: PageServerLoad = async ({ locals }) => {
	return {
		session: locals.session,
		user: locals.user
	};
};
