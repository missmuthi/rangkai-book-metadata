import type { PageServerLoad } from "./$types";
import { requireSession } from "$lib/server/auth";
import { logger } from "$lib/server/logger";
import { getScanHistory } from "$modules/scan";
import {
  getRawDb,
  searchUserScansGeneral,
  searchUserScansByTitle,
  searchUserScansByAuthor,
  searchUserScansBySubject,
  countUserScans,
} from "$lib/server/db";

export const load: PageServerLoad = async (event) => {
  // Protect this route - require authentication (throws redirect if not logged in)
  const session = await requireSession(event);

  const query = event.url.searchParams.get("q") || "";
  const searchType = event.url.searchParams.get("type") || "all";

  logger.info("history_page_load", {
    userId: session.user.id,
    query,
    searchType,
  });

  try {
    const db = getRawDb(event.platform);
    let scans;
    const total = await countUserScans(db, session.user.id);

    // If there's a search query, perform search
    if (query.trim()) {
      switch (searchType) {
        case "title":
          scans = await searchUserScansByTitle(db, session.user.id, query, 100);
          break;
        case "author":
          scans = await searchUserScansByAuthor(
            db,
            session.user.id,
            query,
            100,
          );
          break;
        case "subject":
          scans = await searchUserScansBySubject(
            db,
            session.user.id,
            query,
            100,
          );
          break;
        default:
          scans = await searchUserScansGeneral(db, session.user.id, query, 100);
      }
    } else {
      // No query - show all history
      const history = await getScanHistory(event, 100);
      scans = history.scans;
    }

    return {
      user: session.user,
      scans,
      totalScans: total,
      hasMore: scans.length < total,
      query,
      searchType,
    };
  } catch (error) {
    logger.error("history_fetch_failed", { error });
    return {
      user: session.user,
      scans: [],
      totalScans: 0,
      hasMore: false,
      query: "",
      searchType: "all",
      error: "Failed to load scan history",
    };
  }
};
