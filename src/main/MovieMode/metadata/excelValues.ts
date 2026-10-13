// Parsing and formatting of the values stored in the movie archive's Excel cells

/**
 * Parses a comma-separated string into an array, trimming whitespace
 * Handles cases with one or two spaces before commas
 */
export function parseArrayField(value: string | undefined): string[] {
	if (!value || typeof value !== 'string') return []
	return value
		.split(/\s*,\s*/) // Split on comma with optional whitespace before and after
		.map((item) => item.trim())
		.filter((item) => item.length > 0)
}

/**
 * Parses duration values from Excel into seconds.
 * Supports raw seconds or formatted strings like "1h26m", "45m", "30s".
 */
export function parseDurationValue(value: unknown): number | undefined {
	if (value === undefined || value === null || value === '') return undefined
	if (typeof value === 'number') return value

	const raw = String(value).trim().toLowerCase()
	if (!raw) return undefined

	const hasUnits = /[hms]/.test(raw)
	const match = raw.match(
		/^(?:(\d+(?:\.\d+)?)h)?\s*(?:(\d+(?:\.\d+)?)m)?\s*(?:(\d+(?:\.\d+)?)s)?$/
	)

	if (match && (match[1] || match[2] || match[3])) {
		const hours = parseFloat(match[1] || '0')
		const minutes = parseFloat(match[2] || '0')
		const seconds = parseFloat(match[3] || '0')
		return Math.round(hours * 3600 + minutes * 60 + seconds)
	}

	if (hasUnits) return undefined

	const parsed = parseFloat(raw)
	return isNaN(parsed) ? undefined : parsed
}

/**
 * Parses size values from Excel into bytes.
 * Supports raw bytes or formatted strings like "1.5 GB", "500 MB".
 */
export function parseSizeValue(value: unknown): number | undefined {
	if (value === undefined || value === null || value === '') return undefined
	if (typeof value === 'number') return value

	const raw = String(value).trim()
	if (!raw) return undefined

	const normalized = raw.replace(',', '.')
	const unitMatch = normalized.match(/^([\d.]+)\s*([KMGT]?B)$/i)
	if (unitMatch) {
		const amount = parseFloat(unitMatch[1])
		if (isNaN(amount)) return undefined
		const unit = unitMatch[2].toUpperCase()
		const powers: Record<string, number> = { B: 0, KB: 1, MB: 2, GB: 3, TB: 4 }
		const power = powers[unit]
		if (power === undefined) return undefined
		return Math.round(amount * 1024 ** power)
	}

	if (/[a-z]/i.test(normalized)) return undefined

	const parsed = parseFloat(normalized)
	return isNaN(parsed) ? undefined : parsed
}

/**
 * Converts director name from "Surname, Name" format to "Name Surname" format
 */
export function formatDirectorName(director: string): string {
	// Check if it's in "Surname, Name" format
	if (director.includes(',')) {
		const parts = director.split(',').map((p) => p.trim())
		if (parts.length === 2) {
			// Return "Name Surname"
			return `${parts[1]} ${parts[0]}`
		}
	}
	// If not in that format, return as is
	return director.trim()
}

/**
 * Formats duration in seconds to "1h26m" format
 * @param seconds Duration in seconds
 * @returns Formatted string like "1h26m" or "45m"
 */
export function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600)
	const minutes = Math.floor((seconds % 3600) / 60)
	if (hours > 0) {
		return `${hours}h${minutes}m`
	}
	return `${minutes}m`
}

/**
 * Formats file size in bytes to human-readable format
 * @param bytes Size in bytes
 * @returns Formatted string like "1.5 GB" or "500 MB"
 */
export function formatFileSize(bytes: number): string {
	const units = ['B', 'KB', 'MB', 'GB', 'TB']
	let size = bytes
	let unitIndex = 0
	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024
		unitIndex++
	}
	return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
}
