import type { Handle, HandleServerError } from '@sveltejs/kit';

/**
 * Global error handler for server-side errors
 * Logs complete error details to console for debugging
 */
export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const errorId = crypto.randomUUID();
	
	// Log comprehensive error details to server console
	console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	console.error('🔴 SERVER ERROR CAUGHT');
	console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	console.error('Error ID:', errorId);
	console.error('Status Code:', status);
	console.error('Message:', message);
	console.error('Route:', event.route?.id || 'unknown');
	console.error('URL:', event.url.toString());
	console.error('Method:', event.request.method);
	console.error('Timestamp:', new Date().toISOString());
	console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	
	// Log full error object and stack trace
	if (error instanceof Error) {
		console.error('Error Name:', error.name);
		console.error('Error Message:', error.message);
		console.error('Stack Trace:');
		console.error(error.stack || 'No stack trace available');
		
		// Log any additional properties on the error object
		const errorKeys = Object.keys(error).filter(key => !['name', 'message', 'stack'].includes(key));
		if (errorKeys.length > 0) {
			console.error('Additional Error Properties:');
			errorKeys.forEach(key => {
				console.error(`  ${key}:`, (error as any)[key]);
			});
		}
	} else {
		// Handle non-Error objects
		console.error('Non-Error object thrown:');
		console.error(error);
	}
	
	console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
	
	// Return sanitized error to client
	return {
		message: `An error occurred (ID: ${errorId})`,
		errorId
	};
};

/**
 * Optional: Global request handler
 * Useful for logging all requests or adding custom headers
 */
export const handle: Handle = async ({ event, resolve }) => {
	// Log incoming requests in development
	if (import.meta.env.DEV) {
		console.log(`[${event.request.method}] ${event.url.pathname}`);
	}
	
	try {
		const response = await resolve(event);
		return response;
	} catch (error) {
		// This shouldn't normally be needed (handleError catches it)
		// but provides an extra safety net
		console.error('⚠️ Uncaught error in handle hook:', error);
		throw error;
	}
};
