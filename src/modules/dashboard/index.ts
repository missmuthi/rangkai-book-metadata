/**
 * Dashboard Module - Public API
 */

export { 
	getDashboardData, 
	getActivitySummary,
	getScanTrends
} from './service';

export type { DashboardStats, ActivitySummary } from './service';
