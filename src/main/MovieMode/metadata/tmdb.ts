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
export async function getMovieInfoFromTMDB(
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
