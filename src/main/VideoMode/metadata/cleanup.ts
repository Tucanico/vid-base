import * as fs from 'fs/promises'
import * as path from 'path'
import { shell } from 'electron'
import { VideoFile } from '../../../shared/types/video'
import { loadLibrary, saveLibrary } from './library'

/** Scans the library and the filesystem to find and remove orphaned entries
 *  An orphan is a video entry in the library that no longer has a corresponding
 *  video file on disk, or a thumbnail for a video that no longer exists
 *  @param folderPath The path to the main video folder.
 *  @returns A promise that resolves when the cleanup is complete.
 */
export async function cleanupOrphans(folderPath: string): Promise<void> {
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

	// Helper function to recursively get all files
	const getAllFiles = async (dir: string, basePath: string = dir): Promise<string[]> => {
		const entries = await fs.readdir(dir, { withFileTypes: true })
		const files: string[] = []

		for (const entry of entries) {
			// Skip hidden folders (like .thumbnails)
			if (entry.isDirectory() && entry.name.startsWith('.')) {
				continue
			}

			const fullPath = path.join(dir, entry.name)
			if (entry.isFile()) {
				const ext = path.extname(entry.name).toLowerCase()
				if (videoExtensions.includes(ext) || imageExtensions.includes(ext)) {
					files.push(path.normalize(fullPath))
				}
			} else if (entry.isDirectory()) {
				const subFiles = await getAllFiles(fullPath, basePath)
				files.push(...subFiles)
			}
		}

		return files
	}

	const mediaFilePaths = await getAllFiles(folderPath)

	// 3. Create a Set of normalized existing media paths for quick lookups
	const existingMediaPaths = new Set(mediaFilePaths.map((p) => path.normalize(p)))

	// 4. Find orphaned videos in the library
	const videosToKeep: VideoFile[] = []
	const orphanedVideos: VideoFile[] = []

	for (const video of videos) {
		// Normalize paths for comparison
		const normalizedVideoPath = path.normalize(video.filePath)
		if (existingMediaPaths.has(normalizedVideoPath)) {
			videosToKeep.push(video)
		} else {
			orphanedVideos.push(video)
		}
	}

	// Track if anything was removed
	let somethingRemoved = false

	// 5. Remove orphaned library entries (videos in library.json that don't have files on disk)
	if (orphanedVideos.length > 0) {
		somethingRemoved = true
		const entryNames = orphanedVideos.map((v) => v.fileName)
		console.log(`Removed ${orphanedVideos.length} orphaned library entry(s):`)
		entryNames.forEach((name) => {
			console.log(`  ${name}`)
		})

		// Delete thumbnails of orphaned videos (these are part of the library entry cleanup)
		for (const orphan of orphanedVideos) {
			if (orphan.thumbnailPath) {
				try {
					// Use absolute resolved path for shell.trashItem to handle special characters
					const absoluteThumbPath = path.resolve(orphan.thumbnailPath)
					await shell.trashItem(absoluteThumbPath)
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
						console.error('Error deleting thumbnail:', error)
					}
				}
			}
		}

		// Save the cleaned library
		await saveLibrary(folderPath, videosToKeep, library)
	}

	// 6. Find and delete orphaned thumbnails (thumbnail files that don't have a library entry)
	// This checks for thumbnails that exist on disk but aren't in the library
	const thumbnailsFolder = path.join(folderPath, '.thumbnails')
	const orphanedThumbnailNames: string[] = []
	try {
		const thumbnailFiles = await fs.readdir(thumbnailsFolder)
		// Normalize all thumbnail paths for comparison
		const libraryThumbnailPaths = new Set(
			videosToKeep
				.map((v) => v.thumbnailPath)
				.filter((p): p is string => Boolean(p))
				.map((p) => path.normalize(p))
		)

		for (const thumbFile of thumbnailFiles) {
			const thumbPath = path.join(thumbnailsFolder, thumbFile)
			const normalizedThumbPath = path.normalize(thumbPath)

			// Only delete if the thumbnail is not referenced by any video in the library
			if (!libraryThumbnailPaths.has(normalizedThumbPath)) {
				orphanedThumbnailNames.push(thumbFile)
				somethingRemoved = true
				try {
					// Use the original path for shell.trashItem, but ensure it's properly formatted
					const absoluteThumbPath = path.resolve(thumbPath)
					await shell.trashItem(absoluteThumbPath)
				} catch (error: unknown) {
					// Ignore ENOENT errors (file already deleted)
					if (
						typeof error === 'object' &&
						error !== null &&
						'code' in error &&
						error.code === 'ENOENT'
					) {
						// File not found, ignore
					} else {
						console.error('Error deleting orphaned thumbnail:', error)
					}
				}
			}
		}

		if (orphanedThumbnailNames.length > 0) {
			console.log(`Removed ${orphanedThumbnailNames.length} orphaned thumbnail(s):`)
			for (const name of orphanedThumbnailNames) {
				console.log(`  ${name}`)
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

	if (somethingRemoved) {
		console.log('Cleanup completed.')
	}
}
