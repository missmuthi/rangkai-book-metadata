import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import { scans, users, accounts, sessions, verification } from "./schema";

/**
 * Initialize a Drizzle ORM instance from platform.env.DB (Cloudflare D1)
 */
export type DrizzleDB = ReturnType<typeof drizzle>;
export function getDrizzleDB(platform: App.Platform | undefined): DrizzleDB {
  const d1 = platform?.env?.DB as unknown as D1Database | undefined;
  if (!d1) {
    throw new Error("D1 database not available in platform context");
  }
  return drizzle(d1);
}

export { scans, users, accounts, sessions, verification };
