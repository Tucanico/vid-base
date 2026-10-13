import { Movie } from '@shared/types/movie'
import { ActiveFilters } from '@shared/types/filter'

export type MovieTypeView = 'all' | 'film' | 'serie' | 'docu'

// A duration or size range filter: the full range of the list and the selected part of it
export type RangeFilter = {
	min: number
	max: number
	selectedMin: number
	selectedMax: number
}

/** Builds the sidebar's filter categories from the archive's categories, for the current type tab
 *  @param archiveCategories The categories collected from the Excel archive
 *  @param movieTypeView The selected type tab
 *  @returns The categories to show (TITLE, NOTES and CHECK are never shown; a type tab also hides
 *  LQ and TYPE, and the Serie TV tab hides DURATION)
 */
export const buildMovieFilterCategories = (
	archiveCategories: Record<string, string[]>,
	movieTypeView: MovieTypeView
): Record<string, string[]> => {
	const isTypeView = movieTypeView !== 'all'
	const baseCategories = { ...archiveCategories }
	delete baseCategories.TITLE
	delete baseCategories.NOTES
	delete baseCategories.Check
	delete baseCategories.CHECK
	return isTypeView
		? (() => {
				const filtered = { ...baseCategories }
				const duration = filtered.DURATION
				delete filtered.LQ
				delete filtered.TYPE
				delete filtered.DURATION
				return movieTypeView === 'serie' ? filtered : { ...filtered, DURATION: duration }
			})()
		: baseCategories
}

/** Keeps the movies of the selected type tab
 *  @param movies The movies to filter
 *  @param movieTypeView The selected type tab ('all' keeps everything)
 *  @returns The matching movies
 */
export const filterByMovieType = (movies: Movie[], movieTypeView: MovieTypeView): Movie[] => {
	if (movieTypeView === 'all') return movies
	return movies.filter((movie) => movie.type?.toLowerCase().includes(movieTypeView) ?? false)
}

/** Keeps the movies that match every active filter category (first value of each, substring match)
 *  @param list The movies to filter
 *  @param filters The active filters
 *  @param ignoredCategories Upper-case categories to skip (filtered elsewhere)
 *  @returns The matching movies
 */
export const applyMovieFilters = (
	list: Movie[],
	filters: ActiveFilters,
	ignoredCategories: Set<string>
): Movie[] => {
	if (
		Object.entries(filters).every(([key, values]) => key === 'simpleTag' || values.length === 0)
	) {
		return list
	}

	return list.filter((movie) => {
		for (const [category, filterValues] of Object.entries(filters)) {
			if (category === 'simpleTag') continue
			if (ignoredCategories.has(category.toUpperCase())) continue
			if (filterValues.length === 0) continue

			const filterValue = filterValues[0].toLowerCase()
			let categoryMatches = false

			switch (category.toUpperCase()) {
				case 'TITLE':
					categoryMatches = movie.title.toLowerCase().includes(filterValue)
					break
				case 'DIRECTOR':
					categoryMatches = movie.director.toLowerCase().includes(filterValue)
					break
				case 'YEAR':
					categoryMatches = movie.year?.toString().includes(filterValue) ?? false
					break
				case 'LANGUAGE':
					categoryMatches = movie.language?.toLowerCase().includes(filterValue) ?? false
					break
				case 'ACTORS':
					categoryMatches = movie.actors.some((actor) =>
						actor.toLowerCase().includes(filterValue)
					)
					break
				case 'GENRES':
					categoryMatches = movie.genres.some((genre) =>
						genre.toLowerCase().includes(filterValue)
					)
					break
				case 'TYPE':
					categoryMatches = movie.type?.toLowerCase().includes(filterValue) ?? false
					break
				case 'LQ':
					categoryMatches = movie.lq?.toLowerCase().includes(filterValue) ?? false
					break
				case 'NOTES':
					categoryMatches = movie.notes?.toLowerCase().includes(filterValue) ?? false
					break
				case 'CHECK':
					categoryMatches = movie.check?.toLowerCase().includes(filterValue) ?? false
					break
				default:
					categoryMatches = false
			}

			if (!categoryMatches) return false
		}
		return true
	})
}

/** Keeps the movies whose duration and size are inside the selected ranges
 *  (movies without a duration or size are kept)
 *  @param movies The movies to filter
 *  @param durationRange The duration range filter, if open
 *  @param sizeRange The size range filter, if open
 *  @returns The matching movies
 */
export const filterByRanges = (
	movies: Movie[],
	durationRange: RangeFilter | null,
	sizeRange: RangeFilter | null
): Movie[] => {
	let result = movies
	if (durationRange) {
		result = result.filter(
			(movie) =>
				typeof movie.durationSeconds !== 'number' ||
				(movie.durationSeconds >= durationRange.selectedMin &&
					movie.durationSeconds <= durationRange.selectedMax)
		)
	}
	if (sizeRange) {
		result = result.filter(
			(movie) =>
				typeof movie.sizeBytes !== 'number' ||
				(movie.sizeBytes >= sizeRange.selectedMin && movie.sizeBytes <= sizeRange.selectedMax)
		)
	}
	return result
}

/** Checks if a movie matches the search query (any text field, actors and genres)
 *  @param movie The movie to check
 *  @param query The search query
 *  @returns true if the movie matches, or the query is empty
 */
export const movieMatchesSearch = (movie: Movie, query: string): boolean => {
	if (!query.trim()) return true
	const lowerQuery = query.toLowerCase()

	// Search across all movie fields
	if (movie.title.toLowerCase().includes(lowerQuery)) return true
	if (movie.director.toLowerCase().includes(lowerQuery)) return true
	if (movie.year?.toString().includes(lowerQuery)) return true
	if (movie.language?.toLowerCase().includes(lowerQuery)) return true
	if (movie.type?.toLowerCase().includes(lowerQuery)) return true
	if (movie.notes?.toLowerCase().includes(lowerQuery)) return true
	if (movie.lq?.toLowerCase().includes(lowerQuery)) return true
	if (movie.check?.toLowerCase().includes(lowerQuery)) return true

	// Search in arrays
	if (movie.actors.some((actor) => actor.toLowerCase().includes(lowerQuery))) return true
	if (movie.genres.some((genre) => genre.toLowerCase().includes(lowerQuery))) return true

	return false
}

/** Sorts movies by title, year, director, duration or size
 *  @param movies The movies to sort (not modified)
 *  @param field The field to sort by (anything else sorts by title)
 *  @param direction The sort direction
 *  @returns A new sorted array
 */
export const sortMovies = (movies: Movie[], field: string, direction: 'asc' | 'desc'): Movie[] => {
	const sorted = [...movies].sort((a, b) => {
		let aValue: string | number | undefined
		let bValue: string | number | undefined

		switch (field) {
			case 'title':
				aValue = a.title.toLowerCase()
				bValue = b.title.toLowerCase()
				break
			case 'year':
				aValue = a.year ?? 0
				bValue = b.year ?? 0
				break
			case 'director':
				aValue = a.director.toLowerCase()
				bValue = b.director.toLowerCase()
				break
			case 'duration':
				aValue = a.durationSeconds ?? 0
				bValue = b.durationSeconds ?? 0
				break
			case 'size':
				aValue = a.sizeBytes ?? 0
				bValue = b.sizeBytes ?? 0
				break
			default:
				aValue = a.title.toLowerCase()
				bValue = b.title.toLowerCase()
		}

		if (aValue < bValue) return direction === 'asc' ? -1 : 1
		if (aValue > bValue) return direction === 'asc' ? 1 : -1
		return 0
	})

	return sorted
}
