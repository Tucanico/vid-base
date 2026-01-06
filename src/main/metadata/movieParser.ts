import * as fs from 'fs/promises'
import * as path from 'path'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import { v4 as uuidv4 } from 'uuid'
import { Movie, MovieArchive } from '../../shared/types/movie'

/**
 * Parses a comma-separated string into an array, trimming whitespace
 * Handles cases with one or two spaces before commas
 */
function parseArrayField(value: string | undefined): string[] {
	if (!value || typeof value !== 'string') return []
	return value
		.split(/\s*,\s*/) // Split on comma with optional whitespace before and after
		.map((item) => item.trim())
		.filter((item) => item.length > 0)
}

/**
 * Converts director name from "Surname, Name" format to "Name Surname" format
 */
function formatDirectorName(director: string): string {
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
function removeFolderSuffixes(folderName: string): string {
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
function extractYearFromFolderName(folderName: string): number | undefined {
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
function matchMovieToFolder(movieTitle: string, folderName: string): boolean {
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
 * Parses an Excel file and returns a MovieArchive
 * Expected columns: LQ, TITOLO, REGISTA, ANNO, LINGUA, ATTORI RILEVANTI, GENERE, TIPO, Check, NOTE
 * @param filePath Path to the Excel file
 * @param moviesFolderPath Path to the folder containing movie folders (optional)
 * @returns A promise that resolves to a MovieArchive object
 */
export async function parseMovieExcel(
	filePath: string,
	moviesFolderPath?: string
): Promise<MovieArchive> {
	try {
		// Read the Excel file
		const workbook = XLSX.readFile(filePath)

		// Small delay to ensure Windows releases any file locks from the read operation
		await new Promise((resolve) => setTimeout(resolve, 100))

		// Get the first sheet
		const sheetName = workbook.SheetNames[0]
		const worksheet = workbook.Sheets[sheetName]

		// Convert to JSON with header row
		const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as unknown[][]

		if (data.length < 2) {
			throw new Error('Excel file must have at least a header row and one data row')
		}

		// First row is headers
		const headers = data[0].map((h: unknown) => String(h).trim())

		// Find column indices
		const lqIndex = headers.findIndex((h: string) => h.toUpperCase() === 'LQ')
		const titoloIndex = headers.findIndex((h: string) => h.toUpperCase() === 'TITOLO')
		const registaIndex = headers.findIndex((h: string) => h.toUpperCase() === 'REGISTA')
		const annoIndex = headers.findIndex((h: string) => h.toUpperCase() === 'ANNO')
		const linguaIndex = headers.findIndex((h: string) => h.toUpperCase() === 'LINGUA')
		const attoriIndex = headers.findIndex(
			(h: string) => h.toUpperCase() === 'ATTORI RILEVANTI' || h.toUpperCase() === 'ATTORI'
		)
		const genereIndex = headers.findIndex((h: string) => h.toUpperCase() === 'GENERE')
		const tipoIndex = headers.findIndex((h: string) => h.toUpperCase() === 'TIPO')
		const checkIndex = headers.findIndex((h: string) => h.toUpperCase() === 'CHECK')
		const durataIndex = headers.findIndex((h: string) => h.toUpperCase() === 'DURATA')
		const dimensioniIndex = headers.findIndex((h: string) => h.toUpperCase() === 'DIMENSIONI')
		const noteIndex = headers.findIndex((h: string) => h.toUpperCase() === 'NOTE')

		if (titoloIndex === -1 || registaIndex === -1) {
			throw new Error('Excel file must have TITOLO and REGISTA columns')
		}

		// Parse movies from data rows
		const movies: Movie[] = []
		const categories: Record<string, Set<string>> = {
			LQ: new Set(),
			TITLE: new Set(),
			DIRECTOR: new Set(),
			YEAR: new Set(),
			LANGUAGE: new Set(),
			ACTORS: new Set(),
			GENRES: new Set(),
			TYPE: new Set(),
			Check: new Set(),
			DURATION: new Set(),
			SIZE: new Set(),
			NOTES: new Set()
		}

		// Process data rows (skip header row)
		for (let i = 1; i < data.length; i++) {
			const row = data[i]

			// Skip empty rows
			if (!row || row.length === 0) continue

			const titolo = String(row[titoloIndex] || '').trim()
			const regista = String(row[registaIndex] || '').trim()

			// Skip rows without title or director
			if (!titolo || !regista) continue

			// Format director name from "Surname, Name" to "Name Surname"
			const director = formatDirectorName(regista)

			// Parse year
			let anno: number | undefined = undefined
			if (annoIndex !== -1 && row[annoIndex]) {
				const yearValue = row[annoIndex]
				if (typeof yearValue === 'number') {
					anno = yearValue
				} else {
					const parsed = parseInt(String(yearValue), 10)
					if (!isNaN(parsed)) {
						anno = parsed
					}
				}
			}

			// Parse actors and genres (split by comma)
			const attori = attoriIndex !== -1 ? parseArrayField(String(row[attoriIndex] || '')) : []
			const genere = genereIndex !== -1 ? parseArrayField(String(row[genereIndex] || '')) : []

			// Parse duration (in seconds)
			let duration: number | undefined = undefined
			if (durataIndex !== -1 && row[durataIndex]) {
				const durataValue = row[durataIndex]
				if (typeof durataValue === 'number') {
					duration = durataValue
				} else {
					const parsed = parseFloat(String(durataValue))
					if (!isNaN(parsed)) {
						duration = parsed
					}
				}
			}

			// Parse size (in bytes)
			let size: number | undefined = undefined
			if (dimensioniIndex !== -1 && row[dimensioniIndex]) {
				const dimensioniValue = row[dimensioniIndex]
				if (typeof dimensioniValue === 'number') {
					size = dimensioniValue
				} else {
					const parsed = parseFloat(String(dimensioniValue))
					if (!isNaN(parsed)) {
						size = parsed
					}
				}
			}

			const movie: Movie = {
				id: uuidv4(),
				lq: lqIndex !== -1 ? String(row[lqIndex] || '').trim() : undefined,
				title: titolo,
				director: director,
				year: anno,
				language: linguaIndex !== -1 ? String(row[linguaIndex] || '').trim() : undefined,
				actors: attori,
				genres: genere,
				type: tipoIndex !== -1 ? String(row[tipoIndex] || '').trim() : undefined,
				check: checkIndex !== -1 ? String(row[checkIndex] || '').trim() : undefined,
				duration: duration,
				size: size,
				notes: noteIndex !== -1 ? String(row[noteIndex] || '').trim() : undefined
			}

			movies.push(movie)

			// Collect unique values for each category (using English names for consistency)
			if (movie.lq) categories.LQ.add(movie.lq)
			categories.TITLE.add(movie.title)
			categories.DIRECTOR.add(movie.director)
			if (movie.year) categories.YEAR.add(String(movie.year))
			if (movie.language) categories.LANGUAGE.add(movie.language)
			movie.actors.forEach((actor) => categories.ACTORS.add(actor))
			movie.genres.forEach((genre) => categories.GENRES.add(genre))
			if (movie.type) categories.TYPE.add(movie.type)
			if (movie.check) categories.Check.add(movie.check)
			if (movie.duration) categories.DURATION.add(String(movie.duration))
			if (movie.size) categories.SIZE.add(String(movie.size))
			if (movie.notes) categories.NOTES.add(movie.notes)
		}

		// Match movies with folders if moviesFolderPath is provided
		if (moviesFolderPath) {
			try {
				// Track which movies have been matched to avoid duplicates
				const matchedMovies = new Set<string>()

				// Recursively search for movie folders
				await searchMovieFoldersRecursively(
					moviesFolderPath,
					movies,
					matchedMovies,
					moviesFolderPath
				)

				// Check for new unmatched movie folders and add them if TMDb API key is available
				const tmdbApiKey = process.env.TMDB_API_KEY
				if (tmdbApiKey && tmdbApiKey.trim() !== '') {
					const unmatchedFolders = await findUnmatchedMovieFolders(moviesFolderPath, movies)

					// Collect all new movies first (before writing to Excel)
					const newMoviesToAdd: Array<{
						title: string
						director: string
						year?: number
						duration?: number
						language: string
						actors: string[]
						genres: string[]
						type: string
						size: number
						folderPath: string
					}> = []

					for (const { folderPath, folderName } of unmatchedFolders) {
						try {
							// Extract movie title from folder name (remove suffixes)
							const cleanedTitle = removeFolderSuffixes(folderName)

							// Extract year from folder name if present
							const extractedYear = extractYearFromFolderName(folderName)

							// Get movie info from TMDb (pass extracted year for accuracy)
							const movieInfo = await getMovieInfoFromTMDB(
								cleanedTitle,
								tmdbApiKey,
								extractedYear
							)

							if (movieInfo) {
								// Extract language
								const language = extractLanguage(folderName, folderPath)

								// Calculate folder size
								const size = await calculateFolderSize(folderPath)

								// Collect the movie data (don't write to Excel yet)
								newMoviesToAdd.push({
									title: cleanedTitle,
									director: movieInfo.director,
									year: movieInfo.year,
									duration: movieInfo.duration,
									language: language,
									actors: movieInfo.actors,
									genres: movieInfo.genres,
									type: movieInfo.type,
									size: size,
									folderPath: folderPath
								})
							}
						} catch (error) {
							const errorMessage = error instanceof Error ? error.message : String(error)
							console.error(`Error processing new movie folder ${folderName}:`, errorMessage)
							// Continue with other movies even if one fails
						}
					}

					// If we have new movies, create a new Excel file with only the new movies
					if (newMoviesToAdd.length > 0) {
						try {
							// Create a new workbook using ExcelJS for styling support
							const newWorkbook = new ExcelJS.Workbook()
							const newWorksheet = newWorkbook.addWorksheet('New Movies')

							// Define headers in English
							const headers = [
								'Title',
								'Director',
								'Year',
								'Language',
								'Relevant Actors',
								'Genre(s)',
								'Type',
								'Duration',
								'Size'
							]

							// Set header row
							const headerRow = newWorksheet.addRow(headers)
							headerRow.font = { name: 'Arial', size: 10 }
							headerRow.fill = {
								type: 'pattern',
								pattern: 'solid',
								fgColor: { argb: 'FFE0E0E0' }
							}

							// Define font style for all cells: Arial, size 10
							const cellStyle = {
								font: { name: 'Arial', size: 10 },
								numFmt: '@' // Text format
							}

							// Add data rows
							for (const movieData of newMoviesToAdd) {
								// Convert director from "FirstName LastName" to "LastName, FirstName" for Excel
								let directorForExcel = movieData.director
								const nameParts = movieData.director.trim().split(/\s+/)
								if (nameParts.length >= 2) {
									const lastName = nameParts[nameParts.length - 1]
									const firstName = nameParts.slice(0, -1).join(' ')
									directorForExcel = `${lastName}, ${firstName}`
								}

								// Create row with all fields as text
								// Format duration and size
								const durationFormatted = movieData.duration
									? formatDuration(movieData.duration)
									: ''
								const sizeFormatted = movieData.size ? formatFileSize(movieData.size) : ''

								const row = newWorksheet.addRow([
									movieData.title || '',
									directorForExcel || '',
									movieData.year ? String(movieData.year) : '',
									movieData.language || '',
									movieData.actors.join(', ') || '',
									movieData.genres.join(', ') || '',
									movieData.type || '',
									durationFormatted,
									sizeFormatted
								])

								// Apply styling to all cells in the row
								row.eachCell((cell) => {
									cell.font = cellStyle.font
									cell.numFmt = cellStyle.numFmt
								})
							}

							// Set column widths
							newWorksheet.columns = [
								{ width: 30 }, // Title
								{ width: 25 }, // Director
								{ width: 6 }, // Year
								{ width: 8 }, // Language
								{ width: 40 }, // Relevant Actors
								{ width: 25 }, // Genre(s)
								{ width: 8 }, // Type
								{ width: 10 }, // Duration
								{ width: 15 } // Size
							]

							// Create new file path
							const fileDir = path.dirname(filePath)
							const fileExt = path.extname(filePath)
							const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5) // Format: 2024-01-15T10-30-45
							const newFilePath = path.join(fileDir, `NewMovies_${timestamp}${fileExt}`)

							// Write the new workbook to file
							await newWorkbook.xlsx.writeFile(newFilePath)

							// Log success with movie titles
							console.log(
								`\nSuccessfully added ${newMoviesToAdd.length} new movie(s):`
							)
							for (const movieData of newMoviesToAdd) {
								const yearStr = movieData.year ? ` (${movieData.year})` : ''
								console.log(`  ${movieData.title}${yearStr}`)
							}

							// Add to current movies array and update categories
							for (const movieData of newMoviesToAdd) {
								const newMovie: Movie = {
									id: uuidv4(),
									title: movieData.title,
									director: movieData.director, // Already in "FirstName LastName" format
									year: movieData.year,
									duration: movieData.duration,
									language: movieData.language,
									actors: movieData.actors,
									genres: movieData.genres,
									type: movieData.type,
									size: movieData.size,
									folderPath: movieData.folderPath
								}

								movies.push(newMovie)

								// Update categories
								categories.TITLE.add(newMovie.title)
								categories.DIRECTOR.add(newMovie.director)
								if (newMovie.year) categories.YEAR.add(String(newMovie.year))
								if (newMovie.language) categories.LANGUAGE.add(newMovie.language)
								newMovie.actors.forEach((actor) => categories.ACTORS.add(actor))
								newMovie.genres.forEach((genre) => categories.GENRES.add(genre))
								if (newMovie.type) categories.TYPE.add(newMovie.type)
								if (newMovie.size) categories.SIZE.add(String(newMovie.size))
							}
						} catch (excelError) {
							const errorMessage =
								excelError instanceof Error ? excelError.message : String(excelError)
							console.error(`\n❌ Error writing movies to Excel:`, errorMessage)
							// Note: Movies are still added to the in-memory array so they appear in the UI
							// but won't be persisted to Excel until next successful write
						}
					}
				}
			} catch (error) {
				console.error('Error matching movies with folders:', error)
				// Continue without folder matching
			}
		}

		// Convert Sets to arrays and sort
		const categoriesArrays: Record<string, string[]> = {}
		for (const [key, valueSet] of Object.entries(categories)) {
			categoriesArrays[key] = Array.from(valueSet).sort()
		}

		return {
			movies,
			categories: categoriesArrays,
			moviesFolderPath: moviesFolderPath || ''
		}
	} catch (error) {
		console.error('Error parsing Excel file:', error)
		throw error
	}
}

/**
 * Calculates the total size of a folder recursively
 * @param folderPath Path to the folder
 * @returns Total size in bytes
 */
async function calculateFolderSize(folderPath: string): Promise<number> {
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
				} catch {
					// If stat fails, skip this file
					continue
				}
			}
		}
	} catch {
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
async function searchMovieFoldersRecursively(
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

				// Try to match this folder with an unmatched movie
				let matched = false
				for (const movie of movies) {
					if (matchedMovies.has(movie.id)) continue // Skip already matched movies

					if (matchMovieToFolder(movie.title, entry.name)) {
						movie.folderPath = folderPath
						// Calculate folder size if not provided in Excel
						if (!movie.size) {
							try {
								movie.size = await calculateFolderSize(folderPath)
							} catch (error) {
								console.warn(`Could not calculate size for folder ${folderPath}:`, error)
							}
						}
						matchedMovies.add(movie.id)
						matched = true
						break // Found a match, stop searching
					}
				}

				// If this folder matched a movie, don't recurse into it
				// Otherwise, continue searching recursively
				if (!matched) {
					await searchMovieFoldersRecursively(folderPath, movies, matchedMovies, rootPath)
				}
			}
		}
	} catch (error) {
		console.error(`Error searching directory ${currentPath}:`, error)
		// Continue searching other directories
	}
}

/**
 * Extracts language code from folder name or parent folder
 * Looks for patterns like "[ES]", "[EN]" in folder name
 * Or checks parent folder names like "EN", "ENG", "IT", "ITA"
 * @param folderName Name of the movie folder
 * @param folderPath Full path to the movie folder
 * @returns Language code (default: "EN")
 */
function extractLanguage(folderName: string, folderPath: string): string {
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

/**
 * Formats duration in seconds to "1h26m" format
 * @param seconds Duration in seconds
 * @returns Formatted string like "1h26m" or "45m"
 */
function formatDuration(seconds: number): string {
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
function formatFileSize(bytes: number): string {
	const units = ['B', 'KB', 'MB', 'GB', 'TB']
	let size = bytes
	let unitIndex = 0
	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024
		unitIndex++
	}
	return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
}

/**
 * TMDb API response types
 */
interface TMDBMovieSearchResult {
	id: number
	title: string
	release_date?: string
	popularity: number
}

interface TMDBMovieDetails {
	id: number
	title: string
	release_date?: string
	runtime?: number
	genres: Array<{ id: number; name: string }>
}

interface TMDBCredits {
	crew: Array<{ job: string; name: string }>
	cast: Array<{ name: string; order: number }>
}

/**
 * Calls TMDb API to get movie information
 * @param movieTitle Title of the movie
 * @param apiKey TMDb API key (v3)
 * @param year Optional year to help with more accurate results
 * @returns Movie information object or null if API call fails
 */
async function getMovieInfoFromTMDB(
	movieTitle: string,
	apiKey: string,
	year?: number
): Promise<{
	director: string
	year: number | undefined
	duration: number | undefined
	actors: string[]
	genres: string[]
	type: string
} | null> {
	try {
		const baseUrl = 'https://api.themoviedb.org/3'

		// Step 1: Search for the movie
		const searchParams = new URLSearchParams({
			api_key: apiKey,
			query: movieTitle,
			language: 'en-US'
		})
		if (year) {
			searchParams.append('year', String(year))
		}

		console.log(`TMDb Search for "${movieTitle}"${year ? ` (${year})` : ''}`)
		const searchResponse = await fetch(`${baseUrl}/search/movie?${searchParams.toString()}`)

		if (!searchResponse.ok) {
			console.error(`TMDb search failed: ${searchResponse.status} ${searchResponse.statusText}`)
			return null
		}

		const searchData = (await searchResponse.json()) as { results: TMDBMovieSearchResult[] }
		if (!searchData.results || searchData.results.length === 0) {
			return null
		}

		// Get the first result (best match)
		const movieId = searchData.results[0].id
		const matchedMovie = searchData.results[0]
		console.log(`   Found: "${matchedMovie.title}" (ID: ${movieId})`)

		// Step 2: Get movie details (runtime, genres, release date)
		const detailsParams = new URLSearchParams({
			api_key: apiKey,
			language: 'en-US'
		})
		const detailsResponse = await fetch(`${baseUrl}/movie/${movieId}?${detailsParams.toString()}`)

		if (!detailsResponse.ok) {
			console.error(`TMDb details failed: ${detailsResponse.status} ${detailsResponse.statusText}`)
			return null
		}

		const movieDetails = (await detailsResponse.json()) as TMDBMovieDetails

		// Step 3: Get credits (director, cast)
		const creditsParams = new URLSearchParams({
			api_key: apiKey,
			language: 'en-US'
		})
		const creditsResponse = await fetch(`${baseUrl}/movie/${movieId}/credits?${creditsParams.toString()}`)

		if (!creditsResponse.ok) {
			console.error(`TMDb credits failed: ${creditsResponse.status} ${creditsResponse.statusText}`)
			return null
		}

		const credits = (await creditsResponse.json()) as TMDBCredits

		// Extract director (first person with job "Director")
		const director = credits.crew.find((person) => person.job === 'Director')?.name || ''

		// Extract top 3 actors (ordered by cast order)
		const actors = credits.cast
			.sort((a, b) => a.order - b.order)
			.slice(0, 3)
			.map((actor) => actor.name)

		// Extract genres
		const genres = movieDetails.genres.map((genre) => genre.name)

		// Extract year from release_date
		let releaseYear: number | undefined = undefined
		if (movieDetails.release_date) {
			const yearMatch = movieDetails.release_date.match(/^(\d{4})/)
			if (yearMatch) {
				releaseYear = parseInt(yearMatch[1], 10)
			}
		}

		// Convert runtime from minutes to seconds
		const durationInSeconds = movieDetails.runtime ? movieDetails.runtime * 60 : undefined

		// Determine type: Film, Serie, or Docu
		// TMDb doesn't directly provide this, but we can infer from genres
		let type = 'Film'
		const genreNames = genres.map((g) => g.toLowerCase())
		if (genreNames.includes('documentary')) {
			type = 'Docu'
		} else if (genreNames.includes('tv movie') || genreNames.includes('tv series')) {
			type = 'Serie'
		}

		return {
			director,
			year: releaseYear || year || undefined,
			duration: durationInSeconds,
			actors,
			genres,
			type
		}
	} catch (error) {
		console.error('Error calling TMDb API:', error)
		return null
	}
}

/**
 * Checks if a folder contains at least one video file
 * @param folderPath Path to the folder to check
 * @returns true if folder contains at least one video file
 */
async function folderContainsVideo(folderPath: string): Promise<boolean> {
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
				// Recursively check subdirectories
				const subFolderPath = path.join(folderPath, entry.name)
				if (await folderContainsVideo(subFolderPath)) {
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
async function findUnmatchedMovieFolders(
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
						const hasVideo = await folderContainsVideo(folderPath)
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
			console.error(`Error searching folder ${currentPath}:`, error)
		}
	}

	await searchFolders(moviesFolderPath)
	return unmatchedFolders
}

/**
 * Finds Excel files in a directory
 * @param dirPath Path to the directory
 * @returns A promise that resolves to the path of the first Excel file found, or null
 */
export async function findExcelFile(dirPath: string): Promise<string | null> {
	try {
		const files = await fs.readdir(dirPath)
		const excelFile = files.find(
			(file) => file.toLowerCase().endsWith('.xlsx') || file.toLowerCase().endsWith('.xls')
		)
		return excelFile ? path.join(dirPath, excelFile) : null
	} catch (error) {
		console.error('Error finding Excel file:', error)
		return null
	}
}
