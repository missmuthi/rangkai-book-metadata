import type { PageServerLoad } from "./$types";
import { requireSession } from "$lib/server/auth";
import { getDashboardData } from "$modules/dashboard";
import { logger } from "$lib/server/logger";

export const load: PageServerLoad = async (event) => {
  // Protect this route - require authentication (throws redirect if not logged in)
  const session = await requireSession(event);

  try {
    // Fetch dashboard data using dashboard module
    const dashboardData = await getDashboardData(event);

    if (!dashboardData) {
      return {
        user: session.user,
        scans: [],
        totalScans: 0,
        error: "Failed to load dashboard data",
      };
    }

    return {
      user: session.user,
      scans: dashboardData.recentScans,
      totalScans: dashboardData.totalScans,
      stats: {
        total: dashboardData.totalScans,
        published: dashboardData.publishedScans,
        draft: dashboardData.draftScans,
        ...dashboardData.periodStats,
      },
    };
  } catch (error) {
    logger.error("dashboard_load_failed", { error });
    return {
      user: session.user,
      scans: [],
      totalScans: 0,
      error: "Failed to load dashboard",
    };
  }
};
