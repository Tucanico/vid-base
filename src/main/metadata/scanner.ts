import * as fs from 'fs/promises'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { ExiftoolTags, ParsedTag } from '../../shared/types/metadata'
import { VideoFile } from '../../shared/types/video'
import { generateThumbnail } from './thumbnails'
import { ourExiftool } from './utils'

export function parseTags(rawString: string): ParsedTag[] {
	if (!rawString) return []

	return rawString
		.split(/[;,]/)
		.map((segment) => {
			const clean = segment.trim()
			if (!clean) return null

			// if it's a key-value
			if (clean.includes(':')) {
				const [key, ...rest] = clean.split(':')
				return {
					type: 'kv',
					key: key.trim().toLowerCase(),
					value: rest.join(':').trim(),
					original: clean
				} as ParsedTag
			} else {
				return {
					type: 'simple',
					value: clean,
					original: clean
				} as ParsedTag
			}
		})
		.filter(Boolean) as ParsedTag[]
}

export async function getFilesRecursively(dir: string): Promise<string[]> {
	let results: string[] = []

	// 'withFileTypes: true' is essential to understand if it's a file or folder
	const list = await fs.readdir(dir, { withFileTypes: true })

	const videoExtensions = ['.mp4', '.mkv', '.mov', '.avi', '.wmv', '.m4v']

	for (const entry of list) {
		const fullPath = path.join(dir, entry.name)

		if (entry.isDirectory()) {
			// RECURSION: If it finds a folder, it calls itself!
			const subFolderFiles = await getFilesRecursively(fullPath)
			results = results.concat(subFolderFiles)
		} else if (entry.isFile()) {
			const ext = path.extname(entry.name).toLowerCase()
			if (videoExtensions.includes(ext)) {
				results.push(fullPath)
			}
		}
	}
	return results
}

export async function scanDirectory(dirPath: string): Promise<VideoFile[]> {
	const allFilePaths = await getFilesRecursively(dirPath)

	const videoExtensions = ['.mp4', '.mkv', '.mov', '.avi', '.wmv', '.m4v']
	const results: VideoFile[] = []

	for (const fullPath of allFilePaths) {
		// Since fullPath is the entire path, we extract the file name for the UI
		const file = path.basename(fullPath)
		const ext = path.extname(file).toLowerCase()

		if (videoExtensions.includes(ext)) {
			try {
				// Read Metadata
				const meta: ExiftoolTags = await ourExiftool.read(fullPath)

				const potentialTags = [
					meta.Category,
					meta.XPKeywords,
					meta.Keywords,
					meta.Subject,
					meta.Description
				]

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

				// Generate Thumbnail
				const thumbPath = await generateThumbnail(fullPath)

				results.push({
					id: uuidv4(),
					fileName: file,
					filePath: fullPath,
					thumbnailPath: thumbPath,
					rawTags: rawString,
					tags: parseTags(rawString)
				})
			} catch (err) {
				console.error(`Error reading ${file}:`, err)
			}
		}
	}
	return results
}
