import * as fs from 'fs/promises'
import * as path from 'path'
import { shell } from 'electron'
import { VideoFile } from '../../shared/types/video'
import { loadLibrary, saveLibrary } from './library'

/** Scans the library and the filesystem to find and remove orphaned entries
 *  An orphan is a video entry in the library that no longer has a corresponding
 *  video file on disk, or a thumbnail for a video that no longer exists
 *  @param folderPath The path to the main video folder.
 *  @returns A promise that resolves when the cleanup is complete.
 */
export async function cleanupOrphans(folderPath: string): Promise<void> {
	console.log('🚮 Starting cleanup of orphaned files...')

	// 1. Load the library from library.json
	const library = await loadLibrary(folderPath)
	if (!library) {
		// Library not found - this is expected for new folders, no cleanup needed
		return
	}
	const videos = library.files

	// 2. Get all actual media file paths from the filesystem (videos and images)
	const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.m4v']
	const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif']
	const allFiles = await fs.readdir(folderPath, { recursive: true, withFileTypes: true })
	const mediaFilePaths = allFiles
		.filter((file) => {
			if (!file.isFile()) return false
			const ext = path.extname(file.name).toLowerCase()
			return videoExtensions.includes(ext) || imageExtensions.includes(ext)
		})
		.map((file) => path.join(file.path, file.name))

	// 3. Create a Set of existing media paths for quick lookups
	const existingMediaPaths = new Set(mediaFilePaths)

	// 4. Find orphaned videos in the library
	const videosToKeep: VideoFile[] = []
	const orphanedVideos: VideoFile[] = []

	for (const video of videos) {
		if (existingMediaPaths.has(video.filePath)) {
			videosToKeep.push(video)
		} else {
			orphanedVideos.push(video)
		}
	}

	if (orphanedVideos.length === 0) {
		console.log('✅ No orphaned library entries found.')
	} else {
		console.log(`🔪 Found ${orphanedVideos.length} orphaned library entries to remove.`)

		// 5. Delete thumbnails of orphaned videos
		for (const orphan of orphanedVideos) {
			if (orphan.thumbnailPath) {
				try {
					await shell.trashItem(path.normalize(orphan.thumbnailPath))
					console.log(`🗑️ Moved orphaned thumbnail to trash: ${orphan.thumbnailPath}`)
				} catch (error: unknown) {
					// Ignore errors if the file doesn't exist, but log others
					if (
						typeof error === 'object' &&
						error !== null &&
						'code' in error &&
						error.code === 'ENOENT'
					) {
						// File not found, ignore
					} else {
						console.error(`Error deleting thumbnail ${orphan.thumbnailPath}:`, error)
					}
				}
			}
		}

		// 6. Save the cleaned library
		await saveLibrary(folderPath, videosToKeep, library)
		console.log('💾 Saved cleaned library file.')
	}

	// 7. Find and delete orphaned thumbnails that don't have a library entry
	const thumbnailsFolder = path.join(folderPath, '.thumbnails')
	try {
		const thumbnailFiles = await fs.readdir(thumbnailsFolder)
		const libraryThumbnailPaths = new Set(
			videosToKeep.map((v) => v.thumbnailPath).filter(Boolean)
		)

		for (const thumbFile of thumbnailFiles) {
			const thumbPath = path.join(thumbnailsFolder, thumbFile)
			if (!libraryThumbnailPaths.has(thumbPath)) {
				try {
					await shell.trashItem(path.normalize(thumbPath))
					console.log(`🗑️ Moved orphaned thumbnail to trash (no library entry): ${thumbPath}`)
				} catch (error: unknown) {
					console.error(`Error deleting orphaned thumbnail ${thumbPath}:`, error)
				}
			}
		}
	} catch (error: unknown) {
		if (
			typeof error === 'object' &&
			error !== null &&
			'code' in error &&
			error.code === 'ENOENT'
		) {
			// If the folder doesn't exist, there's nothing to clean up
		} else {
			console.error('Error reading thumbnails folder for cleanup:', error)
		}
	}

	console.log('🚮 Cleanup complete.')
}
