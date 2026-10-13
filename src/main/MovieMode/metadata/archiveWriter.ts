import ExcelJS from 'exceljs'
import { Movie } from '../../../shared/types/movie'
import { formatDuration, formatFileSize } from './excelValues'

// A movie found in the folders but not in the archive, to add as a new row
export interface NewMovieRow {
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
}

// An archive row whose empty duration and size cells are filled in
export interface BackfillRow {
	row: number
	movie: Movie
	durationFormatted: string
	durationSeconds?: number
	sizeFormatted: string
	sizeBytes?: number
}

export interface ArchiveChanges {
	newMoviesToAdd: NewMovieRow[]
	// Excel row numbers of the movies whose folder no longer exists (sorted in place)
	rowsToDelete: number[]
	rowsToBackfill: BackfillRow[]
	// Title and year of the deleted movies, for the log
	removedMovieEntries: Array<{ title: string; year?: number }>
}

/**
 * Applies the additions, deletions and backfills to the archive's Excel file in one pass
 * A failure is logged and not thrown: the movies are still shown, and the file is updated on the
 * next successful load
 * @param filePath Path to the Excel file
 * @param changes The rows to add, delete and backfill
 */
export async function updateArchiveFile(filePath: string, changes: ArchiveChanges): Promise<void> {
	const { newMoviesToAdd, rowsToDelete, rowsToBackfill, removedMovieEntries } = changes
	if (newMoviesToAdd.length === 0 && rowsToDelete.length === 0 && rowsToBackfill.length === 0) {
		return
	}

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
			const durationFormatted = movieData.duration ? formatDuration(movieData.duration) : ''
			const sizeFormatted = movieData.size ? formatFileSize(movieData.size) : ''

			const rowValues: unknown[] = []
			if (colLQ) rowValues[colLQ] = ''
			if (colTitolo) rowValues[colTitolo] = movieData.title || ''
			if (colRegista) rowValues[colRegista] = directorForExcel || ''
			if (colAnno) rowValues[colAnno] = movieData.year ? String(movieData.year) : ''
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
			console.log(`\nSuccessfully removed ${rowsToDelete.length} missing movie(s):`)
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
		const errorMessage = excelError instanceof Error ? excelError.message : String(excelError)
		console.error(`\n❌ Error updating Excel:`, errorMessage)
		// Note: Movies are still added to the in-memory array so they appear in the UI
		// but won't be persisted to Excel until next successful write
	}
}
