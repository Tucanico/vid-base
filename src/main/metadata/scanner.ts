import * as fs from 'fs/promises'
import * as path from 'path'
import * as fsSync from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { ExiftoolTags, ParsedTag } from '../../shared/types/metadata'
import { VideoFile, MediaType } from '../../shared/types/video'
import { generateThumbnail } from './thumbnails'
import { ourExiftool } from './utils'

/** Parses a raw string of tags into an array of structured ParsedTag objects
 *  (tags can be simple strings or key-value pairs, separated by commas or semicolons)
 *  @param rawString The raw string of tags to parse
 *  @returns An array of ParsedTag objects
 */

export function parseTags(rawString: string): ParsedTag[] {
	return parseTagsWithFavorite(rawString).tags
}

export function parseTagsWithFavorite(rawString: string): {
	tags: ParsedTag[]
	favourited: boolean
} {
	if (!rawString) return { tags: [], favourited: false }

	let favourited = false
	const tags = rawString
		.split(/[;,]/)
		.map((segment) => {
			const clean = segment.trim()
			if (!clean) return null
			if (clean.toLowerCase() === 'fav') {
				favourited = true
				return null
			}

			// If the segment contains a colon, treat it as a key-value pair
			if (clean.includes(':')) {
				const [key, ...rest] = clean.split(':')
				return {
					type: 'kv',
					key: key.trim().toLowerCase(),
					value: rest.join(':').trim(),
					original: clean
				} as ParsedTag
			}
			// Otherwise, treat it as a simple tag
			return {
				type: 'simple',
				value: clean,
				original: clean
			} as ParsedTag
		})
		.filter(Boolean) as ParsedTag[]

	return { tags, favourited }
}

function buildRawTagString(tags: ParsedTag[], favourited: boolean): string {
	const parts = tags.map((t) => (t.type === 'kv' ? `${t.key}:${t.value}` : t.value))
	if (favourited) {
		parts.push('fav')
	}
	return parts.join('; ')
}

/** Recursively walks a directory and returns a flat list of all file paths
 *  Skips hidden folders (folders starting with a dot)
 *  @param dir The directory to start from
 *  @returns A promise that resolves to an array of full file paths
 */
export async function getFilesRecursively(dir: string): Promise<string[]> {
	let results: string[] = []
	const list = await fs.readdir(dir, { withFileTypes: true })

	const videoExtensions = ['.mp4', '.mkv', '.mov', '.avi', '.wmv', '.m4v']
	const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif']

	for (const entry of list) {
		// Skip hidden folders (folders starting with a dot, like .thumbnails)
		if (entry.isDirectory() && entry.name.startsWith('.')) {
			continue
		}

		const fullPath = path.join(dir, entry.name)

		if (entry.isDirectory()) {
			// If it's a directory, recurse into it and concatenate the results
			const subFolderFiles = await getFilesRecursively(fullPath)
			results = results.concat(subFolderFiles)
		} else if (entry.isFile()) {
			// If it's a file, check if it has a valid video or image extension
			const ext = path.extname(entry.name).toLowerCase()
			if (videoExtensions.includes(ext) || imageExtensions.includes(ext)) {
				results.push(fullPath)
			}
		}
	}
	return results
}

/** Scans a directory for media files (videos and images), extracts metadata, generates thumbnails, and returns a list of VideoFile objects
 *  @param dirPath The path to the directory to scan
 *  @returns A promise that resolves to an array of VideoFile objects
 */
export async function scanDirectory(dirPath: string): Promise<VideoFile[]> {
	const allFilePaths = await getFilesRecursively(dirPath)
	const results: VideoFile[] = []

	for (const fullPath of allFilePaths) {
		const file = path.basename(fullPath)
		try {
			// Read metadata from the file using exiftool
			const meta: ExiftoolTags = await ourExiftool.read(fullPath)

			// An array of potential metadata fields that might contain tags
			// We will use the first one that is found and has content
			const potentialTags = [
				meta.Category,
				meta.XPKeywords,
				meta.Keywords,
				meta.Subject,
				meta.Description
			]

			// Find the first tag field that has a non-empty value
			const foundTags = potentialTags.find(
				(val) =>
					(Array.isArray(val) && val.length > 0) ||
					(typeof val === 'string' && val.trim() !== '')
			)

			let rawString = ''
			if (Array.isArray(foundTags)) {
				rawString = foundTags.map(String).join('; ')
			} else if (typeof foundTags === 'string') {
				rawString = foundTags
			}

			// Determine media type
			const ext = path.extname(fullPath).toLowerCase()
			const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif']
			const mediaType: MediaType = imageExtensions.includes(ext) ? 'image' : 'video'

			// Generate a thumbnail only for videos
			let thumbPath: string | undefined = undefined
			if (mediaType === 'video') {
				thumbPath = await generateThumbnail(fullPath)
			}

			// Extract file size and duration
			let fileSize: number | undefined = undefined
			let duration: number | undefined = undefined

			// Get file size from filesystem stats
			try {
				const stats = await fs.stat(fullPath)
				fileSize = stats.size
			} catch {
				// If stat fails, try to get from metadata
				if (meta.FileSize) {
					fileSize =
						typeof meta.FileSize === 'number'
							? meta.FileSize
							: parseInt(String(meta.FileSize), 10)
				}
			}

			// Get duration from metadata (for videos)
			if (mediaType === 'video' && meta.Duration) {
				const durationValue =
					typeof meta.Duration === 'number' ? meta.Duration : parseFloat(String(meta.Duration))
				if (!isNaN(durationValue)) {
					duration = durationValue
				}
			}

			const { tags, favourited } = parseTagsWithFavorite(rawString)
			// Create a new VideoFile object with the extracted data
			results.push({
				id: uuidv4(),
				fileName: file,
				filePath: fullPath,
				mediaType: mediaType,
				thumbnailPath: thumbPath,
				rawTags: rawString,
				tags,
				favourited,
				fileSize: fileSize,
				duration: duration
			})
		} catch (err) {
			console.error(`Error reading ${file}:`, err)
		}
	}
	return results
}

/** Smart scan that uses library.json metadata when available, but always scans for new files
 *  @param dirPath The path to the directory to scan
 *  @param existingFiles Optional array of VideoFile objects from library.json files array
 *  @returns A promise that resolves to an array of VideoFile objects
 */
export async function scanDirectoryWithLibrary(
	dirPath: string,
	existingFiles: VideoFile[] | null = null
): Promise<VideoFile[]> {
	const allFilePaths = await getFilesRecursively(dirPath)
	const results: VideoFile[] = []

	// Create a map of existing library entries by filePath for quick lookup
	const libraryMap = new Map<string, VideoFile>()
	if (existingFiles) {
		for (const video of existingFiles) {
			libraryMap.set(video.filePath, video)
		}
	}

	// Helper function to determine media type from file extension
	const getMediaType = (filePath: string): MediaType => {
		const ext = path.extname(filePath).toLowerCase()
		const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif']
		return imageExtensions.includes(ext) ? 'image' : 'video'
	}

	for (const fullPath of allFilePaths) {
		const file = path.basename(fullPath)
		const existingEntry = libraryMap.get(fullPath)
		const mediaType = getMediaType(fullPath)

		if (existingEntry) {
			// File exists in library.json - use its metadata
			// For backward compatibility, if mediaType is missing, detect it
			const entryMediaType = existingEntry.mediaType || mediaType
			const favourited =
				typeof existingEntry.favourited === 'boolean'
					? existingEntry.favourited
					: existingEntry.tags.some(
						(tag) => tag.type === 'simple' && tag.value.toLowerCase() === 'fav'
					)
			const cleanedTags = existingEntry.tags.filter(
				(tag) => !(tag.type === 'simple' && tag.value.toLowerCase() === 'fav')
			)

			// For videos, check if thumbnail exists, if not generate it
			// For images, no thumbnail needed (use image itself)
			let thumbPath = existingEntry.thumbnailPath
			if (entryMediaType === 'video' && (!thumbPath || !fsSync.existsSync(thumbPath))) {
				// Thumbnail doesn't exist, generate it
				thumbPath = await generateThumbnail(fullPath)
			}

			// Update file size from filesystem (in case file was modified)
			let fileSize = existingEntry.fileSize
			try {
				const stats = await fs.stat(fullPath)
				fileSize = stats.size
			} catch {
				// If stat fails, keep existing fileSize
			}

			// Use existing metadata but update thumbnail path, mediaType, and fileSize if needed
			results.push({
				...existingEntry,
				mediaType: entryMediaType,
				thumbnailPath: thumbPath,
				fileSize: fileSize,
				tags: cleanedTags,
				favourited,
				rawTags: buildRawTagString(cleanedTags, favourited)
			})
		} else {
			// New file - scan it normally
			try {
				// Read metadata from the file using exiftool
				const meta: ExiftoolTags = await ourExiftool.read(fullPath)

				// An array of potential metadata fields that might contain tags
				const potentialTags = [
					meta.Category,
					meta.XPKeywords,
					meta.Keywords,
					meta.Subject,
					meta.Description
				]

				// Find the first tag field that has a non-empty value
				const foundTags = potentialTags.find(
					(val) =>
						(Array.isArray(val) && val.length > 0) ||
						(typeof val === 'string' && val.trim() !== '')
				)

				let rawString = ''
				if (Array.isArray(foundTags)) {
					rawString = foundTags.map(String).join('; ')
				} else if (typeof foundTags === 'string') {
					rawString = foundTags
				}

				// Generate a thumbnail only for videos
				let thumbPath: string | undefined = undefined
				if (mediaType === 'video') {
					thumbPath = await generateThumbnail(fullPath)
				}

				// Extract file size and duration
				let fileSize: number | undefined = undefined
				let duration: number | undefined = undefined

				// Get file size from filesystem stats
				try {
					const stats = await fs.stat(fullPath)
					fileSize = stats.size
				} catch {
					// If stat fails, try to get from metadata
					if (meta.FileSize) {
						fileSize =
							typeof meta.FileSize === 'number'
								? meta.FileSize
								: parseInt(String(meta.FileSize), 10)
					}
				}

				// Get duration from metadata (for videos)
				if (mediaType === 'video' && meta.Duration) {
					const durationValue =
						typeof meta.Duration === 'number'
							? meta.Duration
							: parseFloat(String(meta.Duration))
					if (!isNaN(durationValue)) {
						duration = durationValue
					}
				}

				const { tags, favourited } = parseTagsWithFavorite(rawString)
				// Create a new VideoFile object with the extracted data
				results.push({
					id: uuidv4(),
					fileName: file,
					filePath: fullPath,
					mediaType: mediaType,
					thumbnailPath: thumbPath,
					rawTags: rawString,
					tags,
					favourited,
					fileSize: fileSize,
					duration: duration
				})
			} catch (err) {
				console.error(`Error reading ${file}:`, err)
			}
		}
	}
	return results
}
