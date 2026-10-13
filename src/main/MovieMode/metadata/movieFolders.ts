import * as fs from 'fs/promises'
import * as path from 'path'
import { Movie } from '../../../shared/types/movie'
import { isTransientDriveError } from '../../driveRetry'
import { matchMovieToFolder } from './folderNames'
import { formatFileSize } from './excelValues'

// Walks the movies folder: finds movie folders (folders containing a video), matches them to the
// archive's movies, and measures them. Drive errors are rethrown rather than skipped, because a
// folder that could not be read looks like a missing movie, and missing movies are deleted from
// the Excel file (see parseMovieExcel)

/**
 * Calculates the total size of a folder recursively
 * @param folderPath Path to the folder
 * @returns Total size in bytes
 */
export async function calculateFolderSize(folderPath: string): Promise<number> {
	let totalSize = 0
	try {
		const entries = await fs.readdir(folderPath, { withFileTypes: true })
		for (const entry of entries) {
			const fullPath = path.join(folderPath, entry.name)
			if (entry.isDirectory()) {
				// Skip hidden folders
				if (entry.name.startsWith('.')) continue
				totalSize += await calculateFolderSize(fullPath)
			} else if (entry.isFile()) {
				try {
					const stats = await fs.stat(fullPath)
					totalSize += stats.size
				} catch (error) {
					// A drive error is rethrown rather than giving a size that is too small
					if (isTransientDriveError(error)) throw error
					// If stat fails, skip this file
					continue
				}
			}
		}
	} catch (error) {
		if (isTransientDriveError(error)) throw error
		// If readdir fails, return 0
		return 0
	}
	return totalSize
}

/**
 * Recursively searches for movie folders and matches them with movies from Excel
 * If a folder matches a movie, it doesn't recurse into it (it IS the movie folder)
 * Also calculates folder size if not provided in Excel
 * @param currentPath Current directory being searched
 * @param movies Array of movies from Excel to match
 * @param matchedMovies Set of movie IDs that have already been matched
 * @param rootPath Root path of the movies folder (for relative paths)
 */
export async function searchMovieFoldersRecursively(
	currentPath: string,
	movies: Movie[],
	matchedMovies: Set<string>,
	rootPath: string
): Promise<void> {
	try {
		const entries = await fs.readdir(currentPath, { withFileTypes: true })

		for (const entry of entries) {
			// Skip hidden folders
			if (entry.name.startsWith('.')) continue

			if (entry.isDirectory()) {
				const folderPath = path.join(currentPath, entry.name)

				const hasVideo = await folderContainsVideo(folderPath, false)
				if (!hasVideo) {
					// No video files here, keep searching deeper
					await searchMovieFoldersRecursively(folderPath, movies, matchedMovies, rootPath)
					continue
				}

				// Try to match this folder with an unmatched movie
				for (const movie of movies) {
					if (matchedMovies.has(movie.id)) continue // Skip already matched movies

					if (matchMovieToFolder(movie.title, entry.name)) {
						movie.folderPath = folderPath
						// Calculate folder size if not provided in Excel
						if (!movie.sizeBytes) {
							try {
								movie.sizeBytes = await calculateFolderSize(folderPath)
								if (movie.sizeBytes) {
									movie.size = formatFileSize(movie.sizeBytes)
								}
							} catch (error) {
								console.warn(`Could not calculate size for folder ${folderPath}:`, error)
							}
						}
						matchedMovies.add(movie.id)
						break // Found a match, stop searching
					}
				}

				// If this folder matched a movie, don't recurse into it.
				// Folders with videos are treated as movie folders; only folders
				// without videos are recursed into (handled above).
			}
		}
	} catch (error) {
		// A drive error is rethrown: skipping the folder would leave its movies unmatched, and
		// parseMovieExcel deletes the rows of unmatched movies from the Excel file. Any error on the
		// root is rethrown too: with the root unreadable no movie can be matched, so every row would go
		if (isTransientDriveError(error) || currentPath === rootPath) throw error
		console.error(`Error searching directory ${currentPath}:`, error)
		// Continue searching other directories
	}
}

/**
 * Checks if a folder contains at least one video file
 * @param folderPath Path to the folder to check
 * @returns true if folder contains at least one video file
 */
async function folderContainsVideo(
	folderPath: string,
	recursive: boolean = true
): Promise<boolean> {
	const videoExtensions = [
		'.mp4',
		'.mkv',
		'.mov',
		'.avi',
		'.wmv',
		'.m4v',
		'.webm',
		'.flv',
		'.mpg',
		'.mpeg'
	]

	try {
		const entries = await fs.readdir(folderPath, { withFileTypes: true })

		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (!recursive) continue
				// Recursively check subdirectories
				const subFolderPath = path.join(folderPath, entry.name)
				if (await folderContainsVideo(subFolderPath, true)) {
					return true
				}
			} else if (entry.isFile()) {
				const ext = path.extname(entry.name).toLowerCase()
				if (videoExtensions.includes(ext)) {
					return true
				}
			}
		}
	} catch (error) {
		// A drive error is rethrown: "no video" would make a movie folder look empty
		if (isTransientDriveError(error)) throw error
		console.error(`Error checking folder ${folderPath}:`, error)
	}

	return false
}

/**
 * Finds all movie folders that don't match any existing movies
 * A movie folder is defined as a folder that contains at least one video file
 * @param moviesFolderPath Root path containing movie folders
 * @param existingMovies Movies already in Excel
 * @returns Array of unmatched folder paths and names
 */
export async function findUnmatchedMovieFolders(
	moviesFolderPath: string,
	existingMovies: Movie[]
): Promise<Array<{ folderPath: string; folderName: string }>> {
	const unmatchedFolders: Array<{ folderPath: string; folderName: string }> = []
	const matchedFolderPaths = new Set(
		existingMovies.filter((m) => m.folderPath).map((m) => m.folderPath!)
	)

	async function searchFolders(currentPath: string): Promise<void> {
		try {
			const entries = await fs.readdir(currentPath, { withFileTypes: true })

			for (const entry of entries) {
				if (entry.name.startsWith('.')) continue

				if (entry.isDirectory()) {
					const folderPath = path.join(currentPath, entry.name)

					// Check if this folder is already matched to a movie
					if (matchedFolderPaths.has(folderPath)) {
						// This folder is already matched, don't recurse
						continue
					}

					// Check if this folder matches any existing movie title
					const matchesExisting = existingMovies.some((movie) =>
						matchMovieToFolder(movie.title, entry.name)
					)

					if (!matchesExisting) {
						// Check if this folder contains at least one video file (definition of a movie folder)
						const hasVideo = await folderContainsVideo(folderPath, false)
						if (hasVideo) {
							// This is an unmatched movie folder - could be a new movie
							unmatchedFolders.push({ folderPath, folderName: entry.name })
						} else {
							// No video files, recurse to find nested movie folders
							await searchFolders(folderPath)
						}
					} else {
						// It matches an existing movie but folderPath wasn't set - recurse to find nested movies
						await searchFolders(folderPath)
					}
				}
			}
		} catch (error) {
			// A drive error is rethrown rather than missing the movie folders below this one
			if (isTransientDriveError(error)) throw error
			console.error(`Error searching folder ${currentPath}:`, error)
		}
	}

	await searchFolders(moviesFolderPath)
	return unmatchedFolders
}
