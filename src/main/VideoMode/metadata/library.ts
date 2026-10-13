import * as fs from 'fs/promises'
import * as path from 'path'
import { VideoFile } from '../../../shared/types/video'
import { Library } from '../../../shared/types/library'
import { deleteFile } from '../../metadata/utils'

// The name of the file used to store the video library metadata
const LIBRARY_FILE = 'library.json'

/** Extracts categories and tags from an array of VideoFile objects
 *  @param videos Array of VideoFile objects
 *  @returns Object with categories (key-value pairs) and tags (simple tags)
 */
function extractCategoriesAndTags(videos: VideoFile[]): {
	categories: Record<string, string[]>
	tags: string[]
} {
	const categories: Record<string, Set<string>> = {}
	const tags = new Set<string>()

	videos.forEach((video) => {
		video.tags.forEach((tag) => {
			if (tag.type === 'kv' && tag.key) {
				// Key-value tag - add to categories
				if (!categories[tag.key]) {
					categories[tag.key] = new Set<string>()
				}
				categories[tag.key].add(tag.value)
			} else {
				// Simple tag
				tags.add(tag.value)
			}
		})
	})

	// Convert Sets to Arrays and sort
	const categoriesArray: Record<string, string[]> = {}
	for (const [key, values] of Object.entries(categories)) {
		categoriesArray[key] = Array.from(values).sort()
	}

	return {
		categories: categoriesArray,
		tags: Array.from(tags).sort()
	}
}

/** Moves an unreadable library.json aside (to library.corrupt-<timestamp>.json) so that rebuilding
 *  the library does not destroy it, and its categories and tags can still be recovered by hand
 *  @param dbPath The path to the unreadable library.json file
 *  @returns A promise that resolves when the file has been moved, or rejects if it could not be
 */
async function moveCorruptLibraryAside(dbPath: string): Promise<void> {
	// Colons and dots are replaced because Windows does not allow colons in file names
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
	const backupPath = path.join(
		path.dirname(dbPath),
		LIBRARY_FILE.replace(/\.json$/, `.corrupt-${timestamp}.json`)
	)
	await fs.rename(dbPath, backupPath)
	console.warn(`Unreadable library moved to ${backupPath}`)
}

/** Loads the video library from a JSON file in the specified folder
 *  An unreadable library.json (invalid JSON or format) is moved aside before null is returned
 *  @param folderPath The path to the folder containing the library.json file
 *  @returns A promise that resolves to a Library object, or null if the library is not found or is invalid
 *  @throws On filesystem errors other than "file not found" (e.g. a drive I/O failure)
 */
export async function loadLibrary(folderPath: string): Promise<Library | null> {
	const dbPath = path.join(folderPath, LIBRARY_FILE)
	try {
		const data = await fs.readFile(dbPath, 'utf-8')
		const parsed = JSON.parse(data)

		// Validate that it's a Library object with files, categories, and tags
		if (
			parsed &&
			parsed.files &&
			Array.isArray(parsed.files) &&
			parsed.categories &&
			parsed.tags
		) {
			return parsed as Library
		} else {
			console.warn(
				'Invalid library format - expected Library object with files, categories, and tags'
			)
			await moveCorruptLibraryAside(dbPath)
			return null
		}
	} catch (error) {
		const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
		// Check if it's a "file not found" error (ENOENT)
		if (code === 'ENOENT') {
			console.log('Library not present, creating it...')
			return null
		}
		// Any other filesystem error (e.g. EIO while a drive spins up) is rethrown so the caller can
		// retry. Returning null would make it look like there is no library, and the next save would
		// overwrite library.json without its existing categories and tags
		if (code) {
			throw error
		}
		// For other errors (e.g. invalid JSON), log them and keep the unreadable file. If it cannot be
		// moved aside, that error propagates: returning null would let the next save overwrite it
		console.error('Error loading library:', error)
		await moveCorruptLibraryAside(dbPath)
		return null
	}
}

/** Saves the video library to a JSON file in the specified folder
 *  Automatically extracts and updates categories and tags from the files
 *  @param folderPath The path to the folder where the library.json file will be saved
 *  @param videos An array of VideoFile objects to save to the library
 *  @param existingLibrary Optional existing library to preserve categories/tags and merge with new ones
 *  @returns A promise that resolves when the library has been saved, or rejects on error
 */
export async function saveLibrary(
	folderPath: string,
	videos: VideoFile[],
	existingLibrary?: Library | null
): Promise<void> {
	const dbPath = path.join(folderPath, LIBRARY_FILE)
	try {
		// Extract categories and tags from the files
		const { categories, tags } = extractCategoriesAndTags(videos)

		// If there's an existing library, merge categories and tags
		let finalCategories = categories
		let finalTags = tags
		if (existingLibrary) {
			// Merge categories
			finalCategories = { ...existingLibrary.categories }
			for (const [key, values] of Object.entries(categories)) {
				if (!finalCategories[key]) {
					finalCategories[key] = []
				}
				const existingSet = new Set(finalCategories[key])
				values.forEach((v) => existingSet.add(v))
				finalCategories[key] = Array.from(existingSet).sort()
			}

			// Merge tags
			const existingTagsSet = new Set(existingLibrary.tags)
			tags.forEach((t) => existingTagsSet.add(t))
			finalTags = Array.from(existingTagsSet).sort()
		}

		const library: Library = {
			files: videos,
			categories: finalCategories,
			tags: finalTags
		}

		// Stringify the library with pretty printing (2-space indentation) for readability
		const data = JSON.stringify(library, null, 2)
		// Write to a temporary file, flush it to the drive, then rename it over library.json.
		// Writing library.json directly empties it first, so a drive disconnecting mid-save would
		// leave a half-written file; with the rename it is always either the old or the new version
		const tmpPath = `${dbPath}.tmp`
		const handle = await fs.open(tmpPath, 'w')
		try {
			await handle.writeFile(data, 'utf-8')
			await handle.sync()
		} finally {
			await handle.close()
		}
		await fs.rename(tmpPath, dbPath)
	} catch (error) {
		console.error('Error saving library:', error)
		// Re-throw the error so the caller knows the save failed (and can retry it)
		throw error
	}
}

/** Removes a video entry from the library without touching the actual files.
 *  @param folderPath The path to the folder containing the library
 *  @param videoId The ID of the video to remove from the library
 *  @returns A promise that resolves when the video entry has been removed
 */
export async function removeVideoEntryFromLibrary(
	folderPath: string,
	videoId: string
): Promise<void> {
	try {
		const library = await loadLibrary(folderPath)
		if (!library) {
			console.warn(
				`Library not found or empty at ${folderPath}. Cannot remove video entry ${videoId}.`
			)
			return
		}

		// Filter out the video to be removed from the library
		const updatedVideos = library.files.filter((video) => video.id !== videoId)
		// Save the updated library back to the JSON file
		await saveLibrary(folderPath, updatedVideos, library)
		console.log(`Video entry ${videoId} removed successfully from library at ${folderPath}.`)
	} catch (error) {
		console.error(`Error removing video entry ${videoId} from library at ${folderPath}:`, error)
	}
}

/** Deletes a video entry from the library, including the video file and its thumbnail
 *  @param folderPath The path to the folder containing the library
 *  @param videoId The ID of the video to delete
 *  @returns A promise that resolves when the video entry has been deleted
 */
export async function deleteVideoEntry(folderPath: string, videoId: string): Promise<void> {
	try {
		const library = await loadLibrary(folderPath)
		if (!library) {
			console.warn(
				`Library not found or empty at ${folderPath}. Cannot delete video ${videoId}.`
			)
			return
		}

		const videoToDelete = library.files.find((video) => video.id === videoId)
		if (!videoToDelete) {
			console.warn(`Video with ID ${videoId} not found in library at ${folderPath}.`)
			return
		}

		// Delete the actual video file from the filesystem
		await deleteFile(videoToDelete.filePath)
		// If a thumbnail exists, delete it as well
		if (videoToDelete.thumbnailPath) {
			await deleteFile(videoToDelete.thumbnailPath)
		}

		// Filter out the deleted video from the library
		const updatedVideos = library.files.filter((video) => video.id !== videoId)
		// Save the updated library back to the JSON file
		await saveLibrary(folderPath, updatedVideos, library)
		console.log(`Video ${videoId} and its files deleted successfully from ${folderPath}.`)
	} catch (error) {
		console.error(`Error deleting video entry ${videoId} from ${folderPath}:`, error)
	}
}
