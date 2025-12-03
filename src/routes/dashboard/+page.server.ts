import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { getDashboardData } from "$modules/dashboard";
import { logger } from "$lib/server/logger";

export const load: PageServerLoad = async (event) => {
  const { session } = event.locals;
  if (!session) {
    // Should be handled by hooks, but safe fallback for types
    throw redirect(303, "/login");
  }

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
