// Error codes that indicate a transient drive I/O problem (spin-up, bus reset, etc.)
// These are worth retrying; genuine "file not found" errors are not.
const RETRYABLE_CODES = new Set(['EIO', 'EAGAIN', 'EBUSY', 'ETIMEDOUT', 'EREMOTEIO'])

/** Whether `error` is a transient drive I/O error, i.e. one `withRetry` retries
 *  Code that catches filesystem errors to carry on should rethrow these, so the retry can see them
 *  @param error The caught error
 *  @returns true if the error's code is one of RETRYABLE_CODES
 */
export function isTransientDriveError(error: unknown): boolean {
	const code =
		error && typeof error === 'object' && 'code' in error
			? (error as NodeJS.ErrnoException).code
			: null
	return Boolean(code && RETRYABLE_CODES.has(code))
}

/** Retries `fn` up to `maxAttempts` times on transient drive errors, with exponential back-off.
 *  Only errors that reach it are retried: a function that catches its own errors defeats it.
 *  The whole of `fn` runs again on each attempt, so it must be safe to run more than once.
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	maxAttempts = 3,
	initialDelayMs = 2000
): Promise<T> {
	let delay = initialDelayMs
	let lastError: unknown
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn()
		} catch (error) {
			lastError = error
			if (isTransientDriveError(error) && attempt < maxAttempts) {
				const code = (error as NodeJS.ErrnoException).code
				console.warn(
					`Drive I/O error (${code}) on attempt ${attempt}/${maxAttempts} — retrying in ${delay}ms…`
				)
				await new Promise((resolve) => setTimeout(resolve, delay))
				delay *= 2
			} else {
				throw error
			}
		}
	}
	throw lastError
}
