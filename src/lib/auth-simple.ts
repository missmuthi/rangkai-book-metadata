/**
 * Lightweight Authentication with Arctic (OAuth) + D1 Sessions
 * 
 * This replaces Better Auth with a simpler, D1-native approach:
 * - Arctic handles Google OAuth
 * - Manual session management with D1
 * - No complex ORM dependencies
 */

import { Google } from 'arctic';

// Import D1Database type from App namespace
type D1Database = App.Platform['env']['DB'];

/**
 * Create Google OAuth client
 */
export function createGoogleAuth(env: App.Platform['env']) {
	return new Google(
		env.GOOGLE_CLIENT_ID,
		env.GOOGLE_CLIENT_SECRET,
		`${env.BETTER_AUTH_URL}/api/auth/callback/google`
	);
}

/**
 * Generate a secure random session token
 */
export function generateSessionToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new user session
 */
export async function createSession(
	db: D1Database,
	userId: string,
	token: string
): Promise<void> {
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
	
	await db
		.prepare(
			`INSERT INTO session (token, userId, expiresAt, createdAt, updatedAt)
			 VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
		)
		.bind(token, userId, expiresAt.getTime())
		.run();
}

/**
 * Get session by token
 */
export async function getSession(
	db: D1Database,
	token: string
): Promise<{ user: any; session: any } | null> {
	const result = await db
		.prepare(
			`SELECT 
				s.token, s.userId, s.expiresAt,
				u.id, u.email, u.name, u.image, u.createdAt
			FROM session s
			JOIN user u ON s.userId = u.id
			WHERE s.token = ? AND s.expiresAt > ?`
		)
		.bind(token, Date.now())
		.first();
	
	if (!result) return null;
	
	return {
		session: {
			token: result.token as string,
			userId: result.userId as string,
			expiresAt: new Date(result.expiresAt as number)
		},
		user: {
			id: result.id as string,
			email: result.email as string,
			name: result.name as string | null,
			image: result.image as string | null
		}
	};
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(db: D1Database, token: string): Promise<void> {
	await db.prepare(`DELETE FROM session WHERE token = ?`).bind(token).run();
}

/**
 * Create or update user from OAuth data
 */
export async function upsertUser(
	db: D1Database,
	email: string,
	name: string | null,
	image: string | null
): Promise<string> {
	// Check if user exists
	const existing = await db
		.prepare(`SELECT id FROM user WHERE email = ?`)
		.bind(email)
		.first<{ id: string }>();
	
	if (existing) {
		// Update existing user
		await db
			.prepare(`UPDATE user SET name = ?, image = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`)
			.bind(name, image, existing.id)
			.run();
		return existing.id;
	}
	
	// Create new user
	const userId = crypto.randomUUID();
	await db
		.prepare(
			`INSERT INTO user (id, email, name, image, emailVerified, createdAt, updatedAt)
			 VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
		)
		.bind(userId, email, name, image)
		.run();
	
	return userId;
}
