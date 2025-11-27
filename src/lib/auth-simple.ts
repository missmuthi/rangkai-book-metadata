/**
 * Lightweight Authentication with Arctic (OAuth) + D1 Sessions
 *
 * This replaces Better Auth with a simpler, D1-native approach:
 * - Arctic handles Google OAuth
 * - Manual session management with D1
 * - No complex ORM dependencies
 */

import { Google } from "arctic";

// Import D1Database type from App namespace
type D1Database = App.Platform["env"]["DB"];

/**
 * Normalize base URL by removing trailing slashes
 * Prevents double-slash issues in OAuth redirect URIs
 *
 * @param baseUrl - Raw base URL from environment variable
 * @returns Normalized URL without trailing slash
 */
function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl) {
    throw new Error("BETTER_AUTH_URL environment variable is not set");
  }

  // Remove all trailing slashes
  const normalized = baseUrl.replace(/\/+$/, "");

  // Validate it's a proper URL
  try {
    new URL(normalized);
  } catch (error) {
    throw new Error(
      `Invalid BETTER_AUTH_URL: ${baseUrl}. Must be a valid URL.`,
    );
  }

  return normalized;
}

/**
 * Create Google OAuth client with normalized redirect URI
 *
 * Redirect URI format: {BETTER_AUTH_URL}/api/auth/callback/google
 * Example: https://rangkai-book-metadata.pages.dev/api/auth/callback/google
 */
export function createGoogleAuth(env: App.Platform["env"]) {
  const baseUrl = normalizeBaseUrl(env.BETTER_AUTH_URL);
  const redirectUri = `${baseUrl}/api/auth/callback/google`;

  // Debug logging for OAuth configuration
  console.log("[OAuth Config] Base URL:", baseUrl);
  console.log("[OAuth Config] Redirect URI:", redirectUri);

  return new Google(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  );
}

/**
 * Generate a secure random session token
 */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * Create a new user session
 * Handles duplicate session tokens gracefully
 */
export async function createSession(
  db: D1Database,
  userId: string,
  token: string,
  userAgent?: string,
): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const now = Date.now();

  try {
    await db
      .prepare(
        `INSERT INTO session (id, token, userId, expiresAt, userAgent, createdAt, updatedAt)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(), // Generate session id
        token,
        userId,
        expiresAt.getTime(),
        userAgent || null,
        now,
        now,
      )
      .run();

    console.log(
      `[AUTH] Session created for user ${userId}, expires: ${expiresAt.toISOString()}`,
    );
  } catch (error) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("🔴 DATABASE ERROR in createSession");
    console.error("User ID:", userId);
    console.error(
      "Error:",
      JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
    );
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    throw error;
  }
}

/**
 * Get session by token
 * Returns full SessionData with complete User entity
 */
export async function getSession(
  db: D1Database,
  token: string,
): Promise<{ user: any; session: any } | null> {
  const result = await db
    .prepare(
      `SELECT 
				s.token, s.userId, s.expiresAt,
				u.id, u.email, u.name, u.image, u.emailVerified, u.createdAt, u.updatedAt
			FROM session s
			JOIN user u ON s.userId = u.id
			WHERE s.token = ? AND s.expiresAt > ?`,
    )
    .bind(token, Date.now())
    .first();

  if (!result) return null;

  return {
    session: {
      token: result.token as string,
      userId: result.userId as string,
      expiresAt: new Date(result.expiresAt as number),
    },
    user: {
      id: result.id as string,
      email: result.email as string,
      name: result.name as string | null,
      image: result.image as string | null,
      emailVerified: result.emailVerified as number,
      createdAt: result.createdAt as string,
      updatedAt: result.updatedAt as string,
    },
  };
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(
  db: D1Database,
  token: string,
): Promise<void> {
  await db.prepare(`DELETE FROM session WHERE token = ?`).bind(token).run();
}

/**
 * Create or update user from OAuth data
 * Handles duplicate email constraints gracefully
 */
export async function upsertUser(
  db: D1Database,
  email: string,
  name: string | null,
  image: string | null,
): Promise<string> {
  try {
    // Check if user exists
    const existing = await db
      .prepare(`SELECT id FROM user WHERE email = ?`)
      .bind(email)
      .first<{ id: string }>();

    if (existing) {
      // Update existing user
      console.log(
        `[AUTH] Updating existing user: ${email} (ID: ${existing.id})`,
      );
      await db
        .prepare(
          `UPDATE user SET name = ?, image = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        )
        .bind(name, image, existing.id)
        .run();
      return existing.id;
    }

    // Create new user
    const userId = crypto.randomUUID();
    console.log(`[AUTH] Creating new user: ${email} (ID: ${userId})`);
    await db
      .prepare(
        `INSERT INTO user (id, email, name, image, emailVerified, createdAt, updatedAt)
				 VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
      .bind(userId, email, name, image)
      .run();

    return userId;
  } catch (error) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("🔴 DATABASE ERROR in upsertUser");
    console.error("Email:", email);
    console.error(
      "Error:",
      JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
    );
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    throw error; // Re-throw to be caught by OAuth handler
  }
}
