/**
 * Sanitizes a file name by:
 * 1. Removing leading brackets and content inside them (e.g., "[Test] Ciaone" -> "Ciaone")
 * 2. Removing file extensions (e.g., "file.mp4" -> "file")
 *
 * @param fileName The original file name
 * @returns The sanitized file name
 */
export function sanitizeFileName(fileName: string): string {
	let sanitized = fileName.trim()

	// Remove leading brackets and content inside them (e.g., "[Test] Ciaone" -> "Ciaone")
	// Matches patterns like "[...]" at the start, optionally followed by spaces
	sanitized = sanitized.replace(/^\[[^\]]+\]\s*/i, '')

	// Remove file extension (everything after the last dot)
	const lastDotIndex = sanitized.lastIndexOf('.')
	if (lastDotIndex > 0) {
		sanitized = sanitized.substring(0, lastDotIndex)
	}

	return sanitized.trim()
}
