import React, { useState, useMemo } from 'react'
import { ParsedTag } from 'src/shared/types/metadata'
import { VideoFile } from 'src/shared/types/video'
import { Library } from '@shared/types/library'
import { Movie, MovieArchive } from '@shared/types/movie'
import DetailView from './components/DetailView'
import MovieDetailView from './components/MovieDetailView'
import VideoCard from './components/VideoCard'
import MovieCard from './components/MovieCard'
import Sidebar from './components/Sidebar'
import ModeSelection from './components/ModeSelection'
import { ActiveFilters } from '@shared/types/filter'

type AppMode = 'videos' | 'movies' | null
type ViewMode = 'list' | 'detail'

/** --- MAIN APP COMPONENT ---
 *  The root component of the application. It manages the global state,
 *  including the list of videos, loading status, and active filters
 *  It also orchestrates all interactions with the main process via the `window.api` object
 */
function App(): React.ReactElement {
	// State for the current app mode (videos or movies)
	const [appMode, setAppMode] = useState<AppMode>(null)
	// State for the current view mode (list or detail)
	const [viewMode, setViewMode] = useState<ViewMode>('list')
	// State for the list of all video files in the current folder
	const [videos, setVideos] = useState<VideoFile[]>([])
	// State for the list of all movies
	const [movies, setMovies] = useState<Movie[]>([])
	// State for movie archive (categories for filtering)
	const [movieArchive, setMovieArchive] = useState<MovieArchive | null>(null)
	// State to indicate when a scan or load operation is in progress
	const [loading, setLoading] = useState(false)
	// State to hold the video file currently being viewed in detail
	const [viewingVideo, setViewingVideo] = useState<VideoFile | null>(null)
	// State to hold the movie currently being viewed in detail
	const [viewingMovie, setViewingMovie] = useState<Movie | null>(null)
	// State for the path of the currently selected video folder
	const [currentFolder, setCurrentFolder] = useState<string | null>(null)
	// State for the currently active filters. Supports multiple filters per category
	const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
		simpleTag: []
	})
	// State for global multi-select mode
	const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
	// State for library metadata (categories and tags)
	const [library, setLibrary] = useState<Library | null>(null)
	// State for tracking which filter categories are open
	const [openCategories, setOpenCategories] = useState<Set<string>>(new Set())

	// Handles mode selection from the initial screen
	const handleModeSelected = async (mode: 'videos' | 'movies', folder: string): Promise<void> => {
		setAppMode(mode)
		setCurrentFolder(folder)

		if (mode === 'videos') {
			// Load videos mode
			setLoading(true)
			setVideos([]) // Clear previous videos
			try {
				console.log('Scanning directory...')
				const results = await window.api.scanVideos(folder)
				setVideos(results)
				// Load the updated library to get categories and tags
				const updatedLibrary = await window.api.loadLibrary(folder)
				if (updatedLibrary) {
					setLibrary(updatedLibrary)
				}
			} catch (error) {
				console.error('Loading error:', error)
				alert('There was an error during loading.')
			} finally {
				setLoading(false)
			}
		} else if (mode === 'movies') {
			// Load movies mode (from Excel file)
			setLoading(true)
			setMovies([]) // Clear previous movies
			try {
				console.log('Loading movies from Excel...')
				// The folder contains both the Excel file and the movie folders
				const archive = await window.api.loadMovies(folder, folder)
				setMovies(archive.movies)
				setMovieArchive(archive)
			} catch (error) {
				console.error('Loading error:', error)
				alert('There was an error loading movies. Make sure there is an Excel file in the selected folder.')
			} finally {
				setLoading(false)
			}
		}
	}

	// Handles the folder selection and video loading process (for changing folder after initial selection)
	const handleScan = async (): Promise<void> => {
		const folder = await window.api.selectFolder()
		if (folder) {
			setCurrentFolder(folder)
			setLoading(true)
			
			if (appMode === 'videos') {
				setVideos([]) // Clear previous videos
				try {
					// Always scan the directory - it will use library.json metadata when available
					// and scan new files normally
					console.log('Scanning directory...')
					const results = await window.api.scanVideos(folder)
					setVideos(results)
					// Load the updated library to get categories and tags
					const updatedLibrary = await window.api.loadLibrary(folder)
					if (updatedLibrary) {
						setLibrary(updatedLibrary)
					}
				} catch (error) {
					console.error('Loading error:', error)
					alert('There was an error during loading.')
				} finally {
					setLoading(false)
				}
			} else if (appMode === 'movies') {
				setMovies([]) // Clear previous movies
				try {
					console.log('Loading movies from Excel...')
					// The folder contains both the Excel file and the movie folders
					const archive = await window.api.loadMovies(folder, folder)
					setMovies(archive.movies)
					setMovieArchive(archive)
				} catch (error) {
					console.error('Loading error:', error)
					alert('There was an error loading movies. Make sure there is an Excel file in the selected folder.')
				} finally {
					setLoading(false)
				}
			}
		}
	}

	// Handles saving updated tags for a video
	const saveTags = async (newTags: ParsedTag[]): Promise<void> => {
		if (!viewingVideo || !currentFolder) return

		try {
			// 1. Tell the main process to write the new tags to the file's metadata
			await window.api.updateTags(viewingVideo.filePath, newTags)
			// 2. Update the local state to reflect the change immediately
			const updatedList = videos.map((v) =>
				v.id === viewingVideo.id ? { ...v, tags: newTags } : v
			)
			setVideos(updatedList)
			// 3. Save the updated list to the 'library.json' cache (will update categories/tags)
			await window.api.saveLibrary(currentFolder, updatedList)
			// 4. Reload library to get updated categories and tags
			const updatedLibrary = await window.api.loadLibrary(currentFolder)
			if (updatedLibrary) {
				setLibrary(updatedLibrary)
			}
		} catch (error) {
			console.error('Error saving tags:', error)
			alert('Error: unable to save tags.')
		}
	}

	// Handles deleting a video
	const handleDeleteVideo = async (videoToDelete: VideoFile): Promise<void> => {
		if (!currentFolder) return

		try {
			// 1. Tell the main process to trash the video file and its thumbnail
			const success = await window.api.deleteVideo(
				videoToDelete.filePath,
				videoToDelete.thumbnailPath || '',
				videoToDelete.id
			)
			if (!success) {
				alert('Failed to delete video files. Please try again.')
				return
			}
			// 2. Update the local state to remove the deleted video
			const updatedList = videos.filter((v) => v.id !== videoToDelete.id)
			setVideos(updatedList)
			// 3. Save the updated list to the 'library.json' cache
			await window.api.saveLibrary(currentFolder, updatedList)
			// 4. Return to list view after deletion
			setViewMode('list')
			setViewingVideo(null)
		} catch (error) {
			console.error('Error deleting video:', error)
			alert('Error: unable to delete video.')
		}
	}

	// Handles opening a video in detail view
	const handleVideoClick = (video: VideoFile): void => {
		setViewingVideo(video)
		setViewingMovie(null)
		setViewMode('detail')
	}

	// Handles opening a movie in detail view
	const handleMovieClick = (movie: Movie): void => {
		console.log('Opening movie:', movie.title)
		setViewingMovie(movie)
		setViewingVideo(null)
		setViewMode('detail')
	}

	// Handles going back to list view
	const handleBackToList = (): void => {
		setViewMode('list')
		setViewingVideo(null)
		setViewingMovie(null)
	}

	// Handles clicking on a filterable name (model, production, etc.)
	const handleFilterClick = (category: string, value: string): void => {
		// Set the filter and return to list view
		const newFilters: ActiveFilters = { simpleTag: [] }
		newFilters[category] = [value]
		setActiveFilters(newFilters)
		// Open the corresponding category in the sidebar
		setOpenCategories(new Set([category]))
		setViewMode('list')
		setViewingVideo(null)
	}

	// Handles toggling a filter category open/closed
	const handleToggleCategory = (category: string): void => {
		setOpenCategories((prev) => {
			const newSet = new Set(prev)
			if (newSet.has(category)) {
				newSet.delete(category)
			} else {
				newSet.add(category)
			}
			return newSet
		})
	}

	// useMemo to calculate all available filter options from the library
	// This uses the categories and tags from library.json (for videos) or movieArchive (for movies)
	const filterOptions = useMemo(() => {
		if (appMode === 'movies' && movieArchive) {
			return {
				categories: movieArchive.categories,
				simpleTags: []
			}
		}
		if (!library) {
			return {
				categories: {},
				simpleTags: []
			}
		}
		return {
			categories: library.categories,
			simpleTags: library.tags
		}
	}, [library, movieArchive, appMode])

	// Handles changes to the active filter (single select mode - only one filter total)
	const handleFilterChange = (category: string, value: string | undefined): void => {
		if (!value) {
			// If value is undefined, clear all filters
			setActiveFilters({ simpleTag: [] })
		} else {
			// Single select: clear all categories and set only this one
			const newFilters: ActiveFilters = { simpleTag: [] }
			newFilters[category] = [value]
			setActiveFilters(newFilters)
		}
	}

	// Handles text input changes for movie filters
	const handleMovieFilterTextChange = (category: string, value: string): void => {
		setActiveFilters((prev) => {
			const newFilters = { ...prev }
			if (value.trim() === '') {
				// Clear this category if input is empty
				delete newFilters[category]
			} else {
				// Set the text value (single value array for text inputs)
				newFilters[category] = [value]
			}
			return newFilters
		})
	}

	// Handles multi-select filter changes
	const handleMultiSelectChange = (
		category: string,
		option: string,
		isSelected: boolean
	): void => {
		setActiveFilters((prev) => {
			const newFilters = { ...prev }
			if (!newFilters[category]) {
				newFilters[category] = []
			}
			if (isSelected) {
				// Remove the option
				newFilters[category] = newFilters[category].filter((v) => v !== option)
			} else {
				// Add the option
				newFilters[category] = [...newFilters[category], option]
			}
			return newFilters
		})
	}

	// Clears any active filter
	const handleClearFilters = (): void => {
		setActiveFilters({ simpleTag: [] })
	}

	// useMemo to compute the list of videos to display based on the active filters
	// This is recalculated only when the 'videos' or 'activeFilters' change
	// Uses OR logic within each category, AND logic across categories
	const filteredVideos = useMemo(() => {
		// Check if any filters are active
		const hasActiveFilters = Object.values(activeFilters).some((arr) => arr.length > 0)
		if (!hasActiveFilters) {
			return videos // No filters active, return all videos
		}

		return videos.filter((video) => {
			// For each category, check if the video matches any of the selected values (OR logic)
			// All categories must match (AND logic across categories)
			for (const [category, values] of Object.entries(activeFilters)) {
				if (values.length === 0) continue // Skip empty categories

				let categoryMatches = false
				if (category === 'simpleTag') {
					categoryMatches = video.tags.some(
						(t) => t.type === 'simple' && values.includes(t.value)
					)
				} else {
					categoryMatches = video.tags.some(
						(t) => t.type === 'kv' && t.key === category && values.includes(t.value)
					)
				}

				if (!categoryMatches) {
					return false // This category doesn't match, exclude the video
				}
			}
			return true // All categories matched
		})
	}, [videos, activeFilters])

	// Computed: Filtered movies based on active filters (text-based filtering)
	const filteredMovies = useMemo(() => {
		if (appMode !== 'movies') return []

		// Check if any filters are active
		const hasActiveFilters = Object.entries(activeFilters).some(
			([key, values]) => key !== 'simpleTag' && values.length > 0
		)
		if (!hasActiveFilters) {
			return movies
		}

		return movies.filter((movie) => {
			// All categories must match (AND logic across categories)
			for (const [category, filterValues] of Object.entries(activeFilters)) {
				if (category === 'simpleTag') continue // Skip simpleTag for movies
				if (filterValues.length === 0) continue // Skip empty categories

				const filterValue = filterValues[0].toLowerCase() // Text input, single value

				let categoryMatches = false

				// Handle different movie fields (using English names)
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

				if (!categoryMatches) {
					return false // This category doesn't match, exclude the movie
				}
			}
			return true // All categories matched
		})
	}, [movies, activeFilters, appMode])

	// Show mode selection screen if no mode is selected
	if (!appMode) {
		return <ModeSelection onModeSelected={handleModeSelected} />
	}

	// Show detail view if in detail mode
	if (viewMode === 'detail') {
		if (appMode === 'videos' && viewingVideo) {
			return (
				<DetailView
					video={viewingVideo}
					library={library}
					onBack={handleBackToList}
					onSave={saveTags}
					onDelete={handleDeleteVideo}
					onFilterClick={handleFilterClick}
				/>
			)
		}
		if (appMode === 'movies' && viewingMovie) {
			return (
				<MovieDetailView
					movie={viewingMovie}
					onBack={handleBackToList}
					onFilterClick={handleFilterClick}
				/>
			)
		}
	}

	// Show list view
	return (
		<div
			style={{
				height: '100vh',
				display: 'flex',
				flexDirection: 'column',
				fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
				overflow: 'hidden',
				backgroundColor: 'var(--color-background)'
			}}
		>
			{/* --- HEADER --- */}
			<header
				style={{
					padding: '15px 25px',
					backgroundColor: 'var(--color-background-soft)',
					borderBottom: '1px solid var(--ev-c-gray-300)',
					zIndex: 10,
					boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
					flexShrink: 0,
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center'
				}}
			>
				<h1 style={{ color: 'var(--color-text)', margin: 0, fontSize: '1.2rem' }}>VidBase</h1>

				<button
					onClick={handleScan}
					disabled={loading}
					style={{
						padding: '10px 20px',
						fontSize: '1rem',
						backgroundColor: loading ? 'var(--ev-c-gray-400)' : 'var(--color-primary)',
						color: 'white',
						border: 'none',
						borderRadius: '6px',
						cursor: loading ? 'not-allowed' : 'pointer',
						transition: 'background 0.2s'
					}}
				>
					{loading
						? 'Scanning...'
						: appMode === 'videos'
							? '📂 Select Video Folder'
							: '📂 Select Movies Folder'}
				</button>
			</header>

			{/* --- MAIN CONTENT --- */}
			<div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
				<Sidebar
					filterOptions={filterOptions}
					activeFilters={activeFilters}
					isMultiSelectMode={isMultiSelectMode}
					onFilterChange={handleFilterChange}
					onMultiSelectChange={handleMultiSelectChange}
					onClearFilters={handleClearFilters}
					onToggleMultiSelect={() => setIsMultiSelectMode(!isMultiSelectMode)}
					openCategories={openCategories}
					onToggleCategory={handleToggleCategory}
				/>

				<main
					style={{
						flex: 1,
						overflowY: 'auto',
						padding: '20px'
					}}
				>
					{appMode === 'videos' ? (
						<div
							style={{
								display: 'flex',
								flexDirection: 'row',
								flexWrap: 'wrap',
								justifyContent: 'center',
								gap: '20px'
							}}
						>
							{/* Render the grid of video cards */}
							{filteredVideos.map((vid) => (
								<VideoCard key={vid.id} video={vid} onEdit={() => handleVideoClick(vid)} />
							))}

							{/* Conditional messages for empty states */}
							{!loading && videos.length === 0 && (
								<div
									style={{
										textAlign: 'center',
										color: 'var(--color-text-mute)',
										marginTop: '40px'
									}}
								>
									No videos loaded. Click the top-right button to start.
								</div>
							)}
							{!loading && videos.length > 0 && filteredVideos.length === 0 && (
								<div
									style={{
										textAlign: 'center',
										color: 'var(--color-text-mute)',
										marginTop: '40px'
									}}
								>
									No videos match the selected filters.
								</div>
							)}
						</div>
					) : (
						<div
							style={{
								display: 'flex',
								flexDirection: 'column',
								gap: '12px',
								maxWidth: '1200px',
								width: '100%',
								margin: '0 auto'
							}}
						>
							{/* Render the list of movie cards */}
							{filteredMovies.map((movie) => (
								<MovieCard key={movie.id} movie={movie} onEdit={() => handleMovieClick(movie)} />
							))}

							{/* Conditional messages for empty states */}
							{!loading && movies.length === 0 && (
								<div
									style={{
										textAlign: 'center',
										color: 'var(--color-text-mute)',
										marginTop: '40px'
									}}
								>
									No movies loaded. Click the top-right button to select a folder with an Excel file.
								</div>
							)}
							{!loading && movies.length > 0 && filteredMovies.length === 0 && (
								<div
									style={{
										textAlign: 'center',
										color: 'var(--color-text-mute)',
										marginTop: '40px'
									}}
								>
									No movies match the selected filters.
								</div>
							)}
						</div>
					)}
				</main>
			</div>
		</div>
	)
}

export default App
