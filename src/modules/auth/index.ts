/**
 * Auth Module - Public API
 */

export { 
	hasRole,
	getSessionOptional,
	requireRole,
	requireAdmin,
	requireLibrarian,
	isAdmin,
	isAuthenticated,
	getUserOptional,
	redirectToLogin,
	guardRoute
} from './service';

export type { UserRole } from './service';
