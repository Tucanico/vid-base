export const formatFileSize = (bytes?: number): string | undefined => {
	if (bytes === undefined || bytes === null) return undefined
	const units = ['B', 'KB', 'MB', 'GB', 'TB']
	let size = bytes
	let unitIndex = 0
	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024
		unitIndex++
	}
	return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
}

export const formatDuration = (seconds?: number, includeSeconds = false): string | undefined => {
	if (seconds === undefined || seconds === null) return undefined
	const hours = Math.floor(seconds / 3600)
	const minutes = Math.floor((seconds % 3600) / 60)
	const secs = Math.floor(seconds % 60)

	if (!includeSeconds) {
		return hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`
	}

	const parts: string[] = []
	if (hours > 0) parts.push(`${hours}h`)
	if (minutes > 0) parts.push(`${minutes}m`)
	if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)

	return parts.join('')
}
