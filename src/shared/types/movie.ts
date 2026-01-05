/**
 * Movie data structure parsed from Excel file
 * All field names are in English for consistency
 */
export interface Movie {
	id: string
	lq?: string // LQ column
	title: string // Title (from TITOLO)
	director: string // Director (from REGISTA, formatted as "Name Surname")
	year?: number // Year (from ANNO)
	language?: string // Language (from LINGUA)
	actors: string[] // Actors (from ATTORI RILEVANTI, split from comma-separated string)
	genres: string[] // Genres (from GENERE, split from comma-separated string)
	type?: string // Type (from TIPO, e.g., Film)
	check?: string // Check column
	notes?: string // Notes (from NOTE)
	folderPath?: string // Path to the folder containing the movie
}

/**
 * Movie archive structure (temporary, in-memory)
 */
export interface MovieArchive {
	movies: Movie[]
	categories: Record<string, string[]> // All unique values per category for filtering
	moviesFolderPath: string // Path to the folder containing movie folders
}

