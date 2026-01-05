import * as fs from 'fs/promises'
import * as path from 'path'
import * as XLSX from 'xlsx'
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
export async function parseMovieExcel(filePath: string, moviesFolderPath?: string): Promise<MovieArchive> {
	try {
		// Read the Excel file
		const workbook = XLSX.readFile(filePath)
		
		// Get the first sheet
		const sheetName = workbook.SheetNames[0]
		const worksheet = workbook.Sheets[sheetName]
		
		// Convert to JSON with header row
		const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]
		
		if (data.length < 2) {
			throw new Error('Excel file must have at least a header row and one data row')
		}
		
		// First row is headers
		const headers = data[0].map((h: any) => String(h).trim())
		
		// Find column indices
		const lqIndex = headers.findIndex((h: string) => h.toUpperCase() === 'LQ')
		const titoloIndex = headers.findIndex((h: string) => h.toUpperCase() === 'TITOLO')
		const registaIndex = headers.findIndex((h: string) => h.toUpperCase() === 'REGISTA')
		const annoIndex = headers.findIndex((h: string) => h.toUpperCase() === 'ANNO')
		const linguaIndex = headers.findIndex((h: string) => h.toUpperCase() === 'LINGUA')
		const attoriIndex = headers.findIndex((h: string) => h.toUpperCase() === 'ATTORI RILEVANTI' || h.toUpperCase() === 'ATTORI')
		const genereIndex = headers.findIndex((h: string) => h.toUpperCase() === 'GENERE')
		const tipoIndex = headers.findIndex((h: string) => h.toUpperCase() === 'TIPO')
		const checkIndex = headers.findIndex((h: string) => h.toUpperCase() === 'CHECK')
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
			if (movie.notes) categories.NOTES.add(movie.notes)
		}
		
		// Match movies with folders if moviesFolderPath is provided
		if (moviesFolderPath) {
			try {
				// Track which movies have been matched to avoid duplicates
				const matchedMovies = new Set<string>()
				
				// Recursively search for movie folders
				await searchMovieFoldersRecursively(moviesFolderPath, movies, matchedMovies, moviesFolderPath)
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
 * Recursively searches for movie folders and matches them with movies from Excel
 * If a folder matches a movie, it doesn't recurse into it (it IS the movie folder)
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
 * Finds Excel files in a directory
 * @param dirPath Path to the directory
 * @returns A promise that resolves to the path of the first Excel file found, or null
 */
export async function findExcelFile(dirPath: string): Promise<string | null> {
	try {
		const files = await fs.readdir(dirPath)
		const excelFile = files.find(
			(file) =>
				file.toLowerCase().endsWith('.xlsx') ||
				file.toLowerCase().endsWith('.xls')
		)
		return excelFile ? path.join(dirPath, excelFile) : null
	} catch (error) {
		console.error('Error finding Excel file:', error)
		return null
	}
}

