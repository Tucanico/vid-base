import * as path from 'path'

// Reading movie information from folder names, and matching folders to the archive's titles

/**
 * Sanitizes a string for matching by:
 * - Converting to lowercase
 * - Removing special characters (keeping only alphanumeric and spaces)
 * - Normalizing whitespace
 */
function sanitizeForMatching(str: string): string {
	return str
		.toLowerCase()
		.replace(/[^\w\s]/g, '') // Remove special characters
		.replace(/\s+/g, ' ') // Normalize whitespace
		.trim()
}

/**
 * Removes common suffixes from folder names (years, language codes, etc.)
 * Examples: "12 Monkey (1995 - Terry Gilliam)" -> "12 Monkey"
 */
export function removeFolderSuffixes(folderName: string): string {
	// Remove content in parentheses and brackets
	let cleaned = folderName.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '')
	// Remove trailing spaces and dashes
	cleaned = cleaned.replace(/[\s-]+$/, '').trim()
	return cleaned
}

/**
 * Extracts the year from a folder name if present
 * Formats: "12 Monkey (1995 - Terry Gilliam)" or "12 Monkey (1995)" or "12 Monkey (1995 - Terry Gilliam) [EN]"
 * The year is typically the first 4 digits after the opening parenthesis
 * @param folderName Name of the folder
 * @returns Year as number if found, undefined otherwise
 */
export function extractYearFromFolderName(folderName: string): number | undefined {
	// Look for pattern: (YYYY or (YYYY - or (YYYY)
	const yearMatch = folderName.match(/\((\d{4})/)
	if (yearMatch) {
		const year = parseInt(yearMatch[1], 10)
		if (!isNaN(year) && year >= 1900 && year <= 2100) {
			// Reasonable year range
			return year
		}
	}
	return undefined
}

/**
 * Matches a movie title with a folder name
 * Handles variations like:
 * - "12 Monkeys" -> "12 Monkeys (1995 - Terry Gilliam)"
 * - "21 Grams" -> "21 Grams (2003)"
 * - "300" -> "300"
 * - "8 Mile" -> "8 Mile (2002) [EN]"
 */
export function matchMovieToFolder(movieTitle: string, folderName: string): boolean {
	// Remove suffixes from folder name
	const cleanedFolder = removeFolderSuffixes(folderName)

	// Sanitize both for comparison
	const sanitizedMovie = sanitizeForMatching(movieTitle)
	const sanitizedFolder = sanitizeForMatching(cleanedFolder)

	// Check if folder name starts with movie title (or vice versa for short titles)
	if (sanitizedFolder.startsWith(sanitizedMovie)) {
		return true
	}

	// Check if movie title starts with folder name (for cases like "300")
	if (sanitizedMovie.startsWith(sanitizedFolder)) {
		return true
	}

	return false
}

/**
 * Extracts language code from folder name or parent folder
 * Looks for patterns like "[ES]", "[EN]" in folder name
 * Or checks parent folder names like "EN", "ENG", "IT", "ITA"
 * @param folderName Name of the movie folder
 * @param folderPath Full path to the movie folder
 * @returns Language code (default: "EN")
 */
export function extractLanguage(folderName: string, folderPath: string): string {
	// First, try to extract from folder name pattern like "[ES]" or "[EN]"
	const bracketMatch = folderName.match(/\[([A-Z]{2,3})\]/i)
	if (bracketMatch) {
		const langCode = bracketMatch[1].toUpperCase()
		// Map common codes
		if (langCode === 'ENG') return 'EN'
		if (langCode === 'ITA') return 'IT'
		return langCode
	}

	// Check parent folder name
	const parentFolder = path.basename(path.dirname(folderPath))
	const parentUpper = parentFolder.toUpperCase()

	// Check for language folders
	if (parentUpper === 'EN' || parentUpper === 'ENG') return 'EN'
	if (parentUpper === 'IT' || parentUpper === 'ITA') return 'IT'
	if (parentUpper === 'ES' || parentUpper === 'ESP') return 'ES'
	if (parentUpper === 'FR' || parentUpper === 'FRA') return 'FR'
	if (parentUpper === 'DE' || parentUpper === 'GER') return 'DE'

	// Default to EN if not found
	return 'EN'
}
