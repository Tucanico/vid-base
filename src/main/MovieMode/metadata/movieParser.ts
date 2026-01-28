import * as fs from 'fs/promises'
import * as path from 'path'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import { v4 as uuidv4 } from 'uuid'
import { Movie, MovieArchive } from '../../../shared/types/movie'

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
 * Parses duration values from Excel into seconds.
 * Supports raw seconds or formatted strings like "1h26m", "45m", "30s".
 */
function parseDurationValue(value: unknown): number | undefined {
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
function parseSizeValue(value: unknown): number | undefined {
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
					const rowsToBackfill: Array<{
						row: number
						movie: Movie
						durationFormatted: string
						durationSeconds?: number
						sizeFormatted: string
						sizeBytes?: number
					}> = []
					if (tmdbApiKey && tmdbApiKey.trim() !== '') {
						for (const movie of movies) {
							const presence = movieExcelFieldPresence.get(movie.id)
							if (!presence || presence.hasDuration || presence.hasSize) continue
							if (!movie.folderPath) continue
							const excelRow = movieExcelRowMap.get(movie.id)
							if (!excelRow) continue

							try {
								const movieInfo = await getMovieInfoFromTMDB(
									movie.title,
									tmdbApiKey,
									movie.year
								)
								const durationSeconds = movieInfo?.duration
								const durationFormatted =
									typeof durationSeconds === 'number'
										? formatDuration(durationSeconds)
										: ''
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

					// Apply Excel updates (additions and deletions) in one pass
					if (
						newMoviesToAdd.length > 0 ||
						rowsToDelete.length > 0 ||
						rowsToBackfill.length > 0
					) {
						try {
							const workbook = new ExcelJS.Workbook()
							await workbook.xlsx.readFile(filePath)
							const worksheet = workbook.worksheets[0] || workbook.addWorksheet('Archivio')

							// Find header row (supports optional title row)
							let headerRowNumber = -1
							const maxHeaderSearch = Math.min(10, worksheet.rowCount)
							for (let i = 1; i <= maxHeaderSearch; i++) {
								const rowValues = (worksheet.getRow(i).values || []) as unknown[]
								const rowStrings = rowValues.map((v) =>
									String(v ?? '')
										.trim()
										.toUpperCase()
								)
								if (rowStrings.includes('TITOLO') && rowStrings.includes('REGISTA')) {
									headerRowNumber = i
									break
								}
							}

							if (headerRowNumber === -1) {
								throw new Error('Could not find header row in Excel file')
							}

							// Map column indices from header row
							const headerRow = worksheet.getRow(headerRowNumber)
							const headerValues = (headerRow.values || []) as unknown[]
							const headerMap = new Map<string, number>()
							headerValues.forEach((value, index) => {
								if (index === 0) return
								const key = String(value ?? '')
									.trim()
									.toUpperCase()
								if (key) headerMap.set(key, index)
							})

							const getCol = (names: string[]): number | undefined => {
								for (const name of names) {
									const col = headerMap.get(name)
									if (col !== undefined) return col
								}
								return undefined
							}

							const colLQ = getCol(['LQ'])
							const colTitolo = getCol(['TITOLO'])
							const colRegista = getCol(['REGISTA'])
							const colAnno = getCol(['ANNO'])
							const colLingua = getCol(['LINGUA'])
							const colAttori = getCol(['ATTORI RILEVANTI', 'ATTORI'])
							const colGenere = getCol(['GENERE'])
							const colTipo = getCol(['TIPO'])
							const colDurata = getCol(['DURATA'])
							const colDimensione = getCol(['DIMENSIONE', 'DIMENSIONI'])
							const colCheck = getCol(['CHECK'])
							const colNote = getCol(['NOTE'])

							if (!colTitolo || !colRegista) {
								throw new Error('Excel file must have TITOLO and REGISTA columns')
							}
							if (rowsToBackfill.length > 0 && (!colDurata || !colDimensione)) {
								throw new Error('Excel file must have DURATA and DIMENSIONE columns')
							}

							// Delete missing movies first (from bottom to top)
							if (rowsToDelete.length > 0) {
								rowsToDelete.sort((a, b) => b - a)
								for (const rowNumber of rowsToDelete) {
									worksheet.spliceRows(rowNumber, 1)
								}
							}

							// Backfill duration and size for existing rows
							if (rowsToBackfill.length > 0 && colDurata && colDimensione) {
								for (const entry of rowsToBackfill) {
									const row = worksheet.getRow(entry.row)
									row.getCell(colDurata).value = entry.durationFormatted
									row.getCell(colDimensione).value = entry.sizeFormatted
								}
							}

							// Find the last row with actual data (ExcelJS rowCount can include empty styled rows)
							const dataStartRow = headerRowNumber + 1
							let lastDataRow = headerRowNumber
							for (let i = worksheet.rowCount; i >= dataStartRow; i--) {
								const rowValues = (worksheet.getRow(i).values || []) as unknown[]
								const hasValue = rowValues.some((v, idx) => {
									if (idx === 0) return false
									if (v === null || v === undefined) return false
									return String(v).trim() !== ''
								})
								if (hasValue) {
									lastDataRow = i
									break
								}
							}

							// Add new movie rows
							for (const movieData of newMoviesToAdd) {
								// Convert director from "FirstName LastName" to "LastName, FirstName" for Excel
								let directorForExcel = movieData.director
								const nameParts = movieData.director.trim().split(/\s+/)
								if (nameParts.length >= 2) {
									const lastName = nameParts[nameParts.length - 1]
									const firstName = nameParts.slice(0, -1).join(' ')
									directorForExcel = `${lastName}, ${firstName}`
								}

								// Format duration and size
								const durationFormatted = movieData.duration
									? formatDuration(movieData.duration)
									: ''
								const sizeFormatted = movieData.size ? formatFileSize(movieData.size) : ''

								const rowValues: unknown[] = []
								if (colLQ) rowValues[colLQ] = ''
								if (colTitolo) rowValues[colTitolo] = movieData.title || ''
								if (colRegista) rowValues[colRegista] = directorForExcel || ''
								if (colAnno)
									rowValues[colAnno] = movieData.year ? String(movieData.year) : ''
								if (colLingua) rowValues[colLingua] = movieData.language || ''
								if (colAttori) rowValues[colAttori] = movieData.actors.join(', ') || ''
								if (colGenere) rowValues[colGenere] = movieData.genres.join(', ') || ''
								if (colTipo) rowValues[colTipo] = movieData.type || ''
								if (colDurata) rowValues[colDurata] = durationFormatted
								if (colDimensione) rowValues[colDimensione] = sizeFormatted
								if (colCheck) rowValues[colCheck] = ''
								if (colNote) rowValues[colNote] = ''

								const row = worksheet.insertRow(lastDataRow + 1, rowValues)
								lastDataRow += 1
								row.eachCell((cell) => {
									cell.numFmt = '@'
								})
							}

							const writeWithRetry = async (): Promise<void> => {
								const delays = [0, 300, 600]
								for (let attempt = 0; attempt < delays.length; attempt++) {
									if (delays[attempt] > 0) {
										await new Promise((resolve) => setTimeout(resolve, delays[attempt]))
									}
									try {
										await workbook.xlsx.writeFile(filePath)
										return
									} catch (error) {
										if (attempt === delays.length - 1) throw error
									}
								}
							}

							// Write updates back to the original file (with retry for transient locks)
							await writeWithRetry()

							// Log success with movie titles
							if (newMoviesToAdd.length > 0) {
								console.log(`\nSuccessfully added ${newMoviesToAdd.length} new movie(s):`)
								for (const movieData of newMoviesToAdd) {
									const yearStr = movieData.year ? ` (${movieData.year})` : ''
									console.log(`  ${movieData.title}${yearStr}`)
								}
							}
							if (rowsToDelete.length > 0) {
								console.log(
									`\nSuccessfully removed ${rowsToDelete.length} missing movie(s):`
								)
								for (const movieData of removedMovieEntries) {
									const yearStr = movieData.year ? ` (${movieData.year})` : ''
									console.log(`  ${movieData.title}${yearStr}`)
								}
							}
							if (rowsToBackfill.length > 0) {
								console.log(
									`\nSuccessfully backfilled ${rowsToBackfill.length} movie(s) missing duration/size:`
								)
								for (const entry of rowsToBackfill) {
									const yearStr = entry.movie.year ? ` (${entry.movie.year})` : ''
									console.log(`  ${entry.movie.title}${yearStr}`)
								}
							}
						} catch (excelError) {
							const errorMessage =
								excelError instanceof Error ? excelError.message : String(excelError)
							console.error(`\n❌ Error updating Excel:`, errorMessage)
							// Note: Movies are still added to the in-memory array so they appear in the UI
							// but won't be persisted to Excel until next successful write
						}
					}

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
						const sizeFormatted =
							sizeBytes !== undefined ? formatFileSize(sizeBytes) : undefined

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
			console.error(
				`TMDb details failed: ${detailsResponse.status} ${detailsResponse.statusText}`
			)
			return null
		}

		const movieDetails = (await detailsResponse.json()) as TMDBMovieDetails

		// Step 3: Get credits (director, cast)
		const creditsParams = new URLSearchParams({
			api_key: apiKey,
			language: 'en-US'
		})
		const creditsResponse = await fetch(
			`${baseUrl}/movie/${movieId}/credits?${creditsParams.toString()}`
		)

		if (!creditsResponse.ok) {
			console.error(
				`TMDb credits failed: ${creditsResponse.status} ${creditsResponse.statusText}`
			)
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
		console.error('Error finding Excel file:', error)
		return null
	}
}

/**
 * Creates a new Archivio Excel file by scanning movie folders and enriching with TMDb.
 * @param moviesFolderPath Path to the folder containing movie folders
 * @param outputDir Optional output directory for the Excel file (defaults to moviesFolderPath)
 * @returns A promise that resolves to the new Excel file path
 */
export async function createMovieArchivioFromFolders(
	moviesFolderPath: string,
	outputDir?: string
): Promise<string> {
	const tmdbApiKey = process.env.TMDB_API_KEY
	if (!tmdbApiKey || tmdbApiKey.trim() === '') {
		throw new Error('TMDB_API_KEY is required to create a new movie archive')
	}

	const targetDir = outputDir || moviesFolderPath
	const filePath = path.join(targetDir, 'Archivio.xlsx')

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
