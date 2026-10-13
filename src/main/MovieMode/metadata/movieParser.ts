import * as fs from 'fs/promises'
import * as path from 'path'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import { v4 as uuidv4 } from 'uuid'
import { Movie, MovieArchive } from '../../../shared/types/movie'
import { isTransientDriveError } from '../../driveRetry'
import {
	formatDirectorName,
	formatDuration,
	formatFileSize,
	parseArrayField,
	parseDurationValue,
	parseSizeValue
} from './excelValues'
import { extractLanguage, extractYearFromFolderName, removeFolderSuffixes } from './folderNames'
import {
	calculateFolderSize,
	findUnmatchedMovieFolders,
	searchMovieFoldersRecursively
} from './movieFolders'
import { getMovieInfoFromTMDB } from './tmdb'
import { BackfillRow, NewMovieRow, updateArchiveFile } from './archiveWriter'

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

		if (data.length < 1) {
			throw new Error('Excel file must have at least a title or header row')
		}

		// Determine header row (support optional title row like "ARCHIVIO")
		const row0 = data[0] || []
		const row1 = data[1] || []
		const row0Strings = row0.map((h: unknown) => String(h).trim().toUpperCase())
		const row1Strings = row1.map((h: unknown) => String(h).trim().toUpperCase())

		const headerCandidates = ['LQ', 'TITOLO', 'REGISTA', 'ANNO', 'LINGUA']
		const row0HasHeaders = headerCandidates.some((h) => row0Strings.includes(h))
		const row1HasHeaders = headerCandidates.some((h) => row1Strings.includes(h))

		const headerRowIndex = row0HasHeaders ? 0 : row1HasHeaders ? 1 : 0
		const headers = data[headerRowIndex].map((h: unknown) => String(h).trim())

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
		const dimensioniIndex = headers.findIndex((h: string) =>
			['DIMENSIONI', 'DIMENSIONE'].includes(h.toUpperCase())
		)
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
		const movieExcelRowMap = new Map<string, number>()
		const movieExcelFieldPresence = new Map<string, { hasDuration: boolean; hasSize: boolean }>()

		// Process data rows (skip header row)
		for (let i = headerRowIndex + 1; i < data.length; i++) {
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

			const hasDurationCell =
				durataIndex !== -1 &&
				row[durataIndex] !== undefined &&
				String(row[durataIndex]).trim() !== ''
			const hasSizeCell =
				dimensioniIndex !== -1 &&
				row[dimensioniIndex] !== undefined &&
				String(row[dimensioniIndex]).trim() !== ''

			// Parse duration (in seconds) and format for display/storage
			const durationSeconds =
				durataIndex !== -1 ? parseDurationValue(row[durataIndex]) : undefined
			const durationFormatted =
				durationSeconds !== undefined ? formatDuration(durationSeconds) : undefined

			// Parse size (in bytes) and format for display/storage
			const sizeBytes = dimensioniIndex !== -1 ? parseSizeValue(row[dimensioniIndex]) : undefined
			const sizeFormatted = sizeBytes !== undefined ? formatFileSize(sizeBytes) : undefined

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
				duration: durationFormatted,
				durationSeconds: durationSeconds,
				size: sizeFormatted,
				sizeBytes: sizeBytes,
				notes: noteIndex !== -1 ? String(row[noteIndex] || '').trim() : undefined
			}

			movies.push(movie)
			movieExcelRowMap.set(movie.id, i + 1)
			movieExcelFieldPresence.set(movie.id, {
				hasDuration: hasDurationCell,
				hasSize: hasSizeCell
			})

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
			if (movie.duration) categories.DURATION.add(movie.duration)
			if (movie.size) categories.SIZE.add(movie.size)
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

				// Check for new unmatched movie folders and add them (TMDb optional)
				const tmdbApiKey = process.env.TMDB_API_KEY
				const hasTmdbKey = Boolean(tmdbApiKey && tmdbApiKey.trim() !== '')
				if (!hasTmdbKey) {
					console.warn('TMDB_API_KEY is not set. New movies will use folder data only.')
				}
				const unmatchedFolders = await findUnmatchedMovieFolders(moviesFolderPath, movies)

				// Collect all new movies first (before writing to Excel)
				const newMoviesToAdd: NewMovieRow[] = []

				for (const { folderPath, folderName } of unmatchedFolders) {
					try {
						// Extract movie title from folder name (remove suffixes)
						const cleanedTitle = removeFolderSuffixes(folderName)

						// Extract year from folder name if present
						const extractedYear = extractYearFromFolderName(folderName)

						// Get movie info from TMDb (pass extracted year for accuracy)
						const movieInfo = hasTmdbKey
							? await getMovieInfoFromTMDB(cleanedTitle, tmdbApiKey!, extractedYear)
							: null

						// Extract language
						const language = extractLanguage(folderName, folderPath)

						// Calculate folder size
						const size = await calculateFolderSize(folderPath)

						// Collect the movie data (don't write to Excel yet)
						newMoviesToAdd.push({
							title: cleanedTitle,
							director: movieInfo?.director || 'Unknown',
							year: movieInfo?.year ?? extractedYear ?? undefined,
							duration: movieInfo?.duration,
							language: language,
							actors: movieInfo?.actors || [],
							genres: movieInfo?.genres || [],
							type: movieInfo?.type || 'Film',
							size: size,
							folderPath: folderPath
						})
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error)
						console.error(`Error processing new movie folder ${folderName}:`, errorMessage)
						// Continue with other movies even if one fails
					}
				}

				// Identify movies that no longer exist in folders
				const rowsToDelete: number[] = []
				const removedMovieIds = new Set<string>()
				const removedMovieEntries: Array<{ title: string; year?: number }> = []
				for (const movie of movies) {
					const excelRow = movieExcelRowMap.get(movie.id)
					if (!excelRow) continue
					if (movie.folderPath) continue
					rowsToDelete.push(excelRow)
					removedMovieIds.add(movie.id)
					removedMovieEntries.push({ title: movie.title, year: movie.year })
				}

				// Identify movies missing BOTH duration and size to backfill
				const rowsToBackfill: BackfillRow[] = []
				if (hasTmdbKey) {
					for (const movie of movies) {
						const presence = movieExcelFieldPresence.get(movie.id)
						if (!presence || presence.hasDuration || presence.hasSize) continue
						if (!movie.folderPath) continue
						const excelRow = movieExcelRowMap.get(movie.id)
						if (!excelRow) continue

						try {
							const movieInfo = await getMovieInfoFromTMDB(
								movie.title,
								tmdbApiKey!,
								movie.year
							)
							const durationSeconds = movieInfo?.duration
							const durationFormatted =
								typeof durationSeconds === 'number' ? formatDuration(durationSeconds) : ''
							const sizeBytes = await calculateFolderSize(movie.folderPath)
							const sizeFormatted =
								typeof sizeBytes === 'number' ? formatFileSize(sizeBytes) : ''

							if (durationFormatted && sizeFormatted) {
								rowsToBackfill.push({
									row: excelRow,
									movie,
									durationFormatted,
									durationSeconds,
									sizeFormatted,
									sizeBytes
								})
							}
						} catch (error) {
							const errorMessage = error instanceof Error ? error.message : String(error)
							console.error(
								`Error backfilling duration/size for ${movie.title}:`,
								errorMessage
							)
						}
					}
				}
				if (rowsToBackfill.length > 0) {
					console.log(
						`\nDetected ${rowsToBackfill.length} movie(s) missing duration and size:`
					)
					for (const entry of rowsToBackfill) {
						const yearStr = entry.movie.year ? ` (${entry.movie.year})` : ''
						console.log(`  ${entry.movie.title}${yearStr}`)
					}
				}

				// Apply Excel updates (additions, deletions and backfills) in one pass
				await updateArchiveFile(filePath, {
					newMoviesToAdd,
					rowsToDelete,
					rowsToBackfill,
					removedMovieEntries
				})

				// Remove from in-memory list and rebuild categories
				if (removedMovieIds.size > 0) {
					for (let i = movies.length - 1; i >= 0; i--) {
						if (removedMovieIds.has(movies[i].id)) {
							movies.splice(i, 1)
						}
					}

					categories.LQ.clear()
					categories.TITLE.clear()
					categories.DIRECTOR.clear()
					categories.YEAR.clear()
					categories.LANGUAGE.clear()
					categories.ACTORS.clear()
					categories.GENRES.clear()
					categories.TYPE.clear()
					categories.Check.clear()
					categories.DURATION.clear()
					categories.SIZE.clear()
					categories.NOTES.clear()

					for (const movie of movies) {
						if (movie.lq) categories.LQ.add(movie.lq)
						categories.TITLE.add(movie.title)
						categories.DIRECTOR.add(movie.director)
						if (movie.year) categories.YEAR.add(String(movie.year))
						if (movie.language) categories.LANGUAGE.add(movie.language)
						movie.actors.forEach((actor) => categories.ACTORS.add(actor))
						movie.genres.forEach((genre) => categories.GENRES.add(genre))
						if (movie.type) categories.TYPE.add(movie.type)
						if (movie.check) categories.Check.add(movie.check)
						if (movie.duration) categories.DURATION.add(movie.duration)
						if (movie.size) categories.SIZE.add(movie.size)
						if (movie.notes) categories.NOTES.add(movie.notes)
					}
				}

				// Add to current movies array and update categories
				for (const movieData of newMoviesToAdd) {
					const durationSeconds = movieData.duration
					const sizeBytes = movieData.size
					const durationFormatted =
						durationSeconds !== undefined ? formatDuration(durationSeconds) : undefined
					const sizeFormatted = sizeBytes !== undefined ? formatFileSize(sizeBytes) : undefined

					const newMovie: Movie = {
						id: uuidv4(),
						title: movieData.title,
						director: movieData.director, // Already in "FirstName LastName" format
						year: movieData.year,
						duration: durationFormatted,
						durationSeconds: durationSeconds,
						language: movieData.language,
						actors: movieData.actors,
						genres: movieData.genres,
						type: movieData.type,
						size: sizeFormatted,
						sizeBytes: sizeBytes,
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
					if (newMovie.duration) categories.DURATION.add(newMovie.duration)
					if (newMovie.size) categories.SIZE.add(newMovie.size)
				}

				// Update in-memory data for backfilled movies
				for (const entry of rowsToBackfill) {
					entry.movie.duration = entry.durationFormatted
					entry.movie.durationSeconds = entry.durationSeconds
					entry.movie.size = entry.sizeFormatted
					entry.movie.sizeBytes = entry.sizeBytes
					if (entry.movie.duration) categories.DURATION.add(entry.movie.duration)
					if (entry.movie.size) categories.SIZE.add(entry.movie.size)
				}
			} catch (error) {
				// A drive error is rethrown so withRetry can retry the load, instead of returning the
				// movies without their folders
				if (isTransientDriveError(error)) throw error
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
 * Finds Excel files in a directory
 * @param dirPath Path to the directory
 * @returns A promise that resolves to the path of the first Excel file found, or null
 */
export async function findExcelFile(dirPath: string): Promise<string | null> {
	try {
		const files = await fs.readdir(dirPath)
		const isExcel = (file: string): boolean =>
			file.toLowerCase().endsWith('.xlsx') || file.toLowerCase().endsWith('.xls')
		const preferredNames = ['archivio', 'da vedere']
		const excelFiles = files.filter((file) => isExcel(file))

		const preferredFile = excelFiles.find((file) => {
			const base = path.parse(file).name.toLowerCase()
			return preferredNames.includes(base)
		})

		if (preferredFile) return path.join(dirPath, preferredFile)
		const fallback = excelFiles[0]
		return fallback ? path.join(dirPath, fallback) : null
	} catch (error) {
		// A drive error is rethrown: null means "no archive here", and the caller would then create a
		// new Archivio.xlsx from the folders, overwriting the existing one
		if (isTransientDriveError(error)) throw error
		console.error('Error finding Excel file:', error)
		return null
	}
}

/**
 * Whether a file exists. Errors other than "not found" are thrown: a file that could not be
 * checked must not be assumed missing (and then overwritten)
 * @param filePath Path to the file
 * @returns true if the file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.stat(filePath)
		return true
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
			return false
		}
		throw error
	}
}

/**
 * Creates a new Archivio Excel file by scanning movie folders and enriching with TMDb.
 * An existing Archivio.xlsx (which findExcelFile can miss, e.g. when the folder cannot be listed)
 * is only replaced if `confirmOverwrite` says so; otherwise its path is returned, to load it instead
 * @param moviesFolderPath Path to the folder containing movie folders
 * @param outputDir Optional output directory for the Excel file (defaults to moviesFolderPath)
 * @param confirmOverwrite Asked before an existing Archivio.xlsx is replaced; true replaces it
 * @returns A promise that resolves to the new Excel file path (or the existing one, if kept)
 */
export async function createMovieArchivioFromFolders(
	moviesFolderPath: string,
	outputDir: string | undefined,
	confirmOverwrite: (filePath: string) => Promise<boolean>
): Promise<string> {
	const tmdbApiKey = process.env.TMDB_API_KEY
	const hasTmdbKey = Boolean(tmdbApiKey && tmdbApiKey.trim() !== '')

	const targetDir = outputDir || moviesFolderPath
	const filePath = path.join(targetDir, 'Archivio.xlsx')

	// The archive holds what neither the folders nor TMDb can rebuild (LQ, CHECK, NOTE), so it is
	// never replaced without asking. Without a TMDb key no new archive can be built, so it is kept
	// without asking. Checked first, so keeping it skips the folder scan and the TMDb calls
	if (await fileExists(filePath)) {
		if (!hasTmdbKey || !(await confirmOverwrite(filePath))) return filePath
	}

	if (!tmdbApiKey || tmdbApiKey.trim() === '') {
		throw new Error('TMDB_API_KEY is required to create a new movie archive')
	}

	const workbook = new ExcelJS.Workbook()
	const worksheet = workbook.addWorksheet('Archivio')

	const headers = [
		'LQ',
		'TITOLO',
		'REGISTA',
		'ANNO',
		'LINGUA',
		'ATTORI RILEVANTI',
		'GENERE',
		'TIPO',
		'DURATA',
		'DIMENSIONE',
		'CHECK',
		'NOTE'
	]

	// Title row (kept simple, first cell only)
	worksheet.addRow(['ARCHIVIO'])
	worksheet.addRow(headers)

	const movieFolders = await findUnmatchedMovieFolders(moviesFolderPath, [])

	for (const { folderPath, folderName } of movieFolders) {
		const cleanedTitle = removeFolderSuffixes(folderName)
		const extractedYear = extractYearFromFolderName(folderName)
		const movieInfo = await getMovieInfoFromTMDB(cleanedTitle, tmdbApiKey, extractedYear)

		const director = movieInfo?.director?.trim() || 'Unknown'
		const directorForExcel = director.includes(',')
			? director
			: (() => {
					const nameParts = director.trim().split(/\s+/)
					if (nameParts.length >= 2) {
						const lastName = nameParts[nameParts.length - 1]
						const firstName = nameParts.slice(0, -1).join(' ')
						return `${lastName}, ${firstName}`
					}
					return director
				})()

		const language = extractLanguage(folderName, folderPath)
		const size = await calculateFolderSize(folderPath)

		const durationFormatted =
			typeof movieInfo?.duration === 'number' ? formatDuration(movieInfo.duration) : ''
		const sizeFormatted = typeof size === 'number' ? formatFileSize(size) : ''

		worksheet.addRow([
			'',
			cleanedTitle,
			directorForExcel,
			movieInfo?.year ?? extractedYear ?? '',
			language,
			movieInfo?.actors?.join(', ') || '',
			movieInfo?.genres?.join(', ') || '',
			movieInfo?.type || 'Film',
			durationFormatted,
			sizeFormatted,
			'',
			''
		])
	}

	await workbook.xlsx.writeFile(filePath)
	return filePath
}
