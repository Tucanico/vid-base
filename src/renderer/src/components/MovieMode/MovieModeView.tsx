import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Movie, MovieArchive } from '@shared/types/movie'
import { ActiveFilters } from '@shared/types/filter'
import MovieDetailView from './MovieDetailView'
import MovieCard from './MovieCard'
import Sidebar from '../Sidebar'
import AppHeader, { HeaderTab } from '../AppHeader'
import ListLayout from '../ListLayout'
import ScanLoader from '../ScanLoader'
import EmptyMessage from '../EmptyMessage'
import { ListSnapshot, useListControls } from '../../hooks/useListControls'
import { useListScrollRestore } from '../../hooks/useListScrollRestore'
import { useValueTabs, valueTabLabel } from '../../hooks/useValueTabs'
import {
	MovieTypeView,
	RangeFilter,
	applyMovieFilters,
	buildMovieFilterCategories,
	filterByMovieType,
	filterByRanges,
	movieMatchesSearch,
	sortMovies
} from '../../utils/movieList'

const SORT_OPTIONS = [
	{ value: 'title', label: 'Title' },
	{ value: 'year', label: 'Year' },
	{ value: 'director', label: 'Director' },
	{ value: 'duration', label: 'Duration' },
	{ value: 'size', label: 'Size' }
]

const TYPE_TABS: Array<{ type: MovieTypeView; label: string }> = [
	{ type: 'all', label: 'All' },
	{ type: 'film', label: 'Film' },
	{ type: 'serie', label: 'Serie TV' },
	{ type: 'docu', label: 'Documentario' }
]

// The filters Movie Mode opens with (and resets to when another folder is loaded): the Film tab
const filmFilters = (): ActiveFilters => ({ simpleTag: [], TYPE: ['film'] })

/** --- COMPONENT: MovieModeView ---
 *  Movie Mode: loads the Excel-backed movie archive of a folder and shows it, with type tabs,
 *  filters (including duration and size ranges), search and sorting. It owns all Movie Mode state
 *  @param initialFolder The folder picked on the mode selection screen, loaded when the view opens
 */
function MovieModeView({ initialFolder }: { initialFolder: string }): React.ReactElement {
	// State for the current view mode (list or detail)
	const [viewMode, setViewMode] = useState<'list' | 'detail'>('list')
	// State for the list of all movies
	const [movies, setMovies] = useState<Movie[]>([])
	// State for movie archive (categories for filtering)
	const [movieArchive, setMovieArchive] = useState<MovieArchive | null>(null)
	// State to indicate when a load is in progress. Starts true: the initial folder is loaded on open
	const [loading, setLoading] = useState(true)
	// State to hold the movie currently being viewed in detail
	const [viewingMovie, setViewingMovie] = useState<Movie | null>(null)
	// State for movie view tabs
	const [movieTypeView, setMovieTypeView] = useState<MovieTypeView>('film')
	// State for movie duration/size range filters
	const [movieDurationRange, setMovieDurationRange] = useState<RangeFilter | null>(null)
	const [movieSizeRange, setMovieSizeRange] = useState<RangeFilter | null>(null)
	const controls = useListControls(filmFilters())
	const {
		activeFilters,
		setActiveFilters,
		setOpenCategories,
		searchQuery,
		sortField,
		sortDirection
	} = controls
	const { listScrollRef, rememberScroll, restoreScroll, currentScrollTop } =
		useListScrollRestore(viewMode)
	// Value tabs: the movies filtered by a value clicked in the detail view (e.g. Genres: Drama),
	// each with its own filters, search, sort, range filters and scroll position
	const valueTabs = useValueTabs<{
		list: ListSnapshot
		durationRange: RangeFilter | null
		sizeRange: RangeFilter | null
		scrollTop: number
	}>(
		() => ({
			list: controls.snapshot(),
			durationRange: movieDurationRange,
			sizeRange: movieSizeRange,
			scrollTop: currentScrollTop()
		}),
		(saved) => {
			controls.restore(saved.list)
			setMovieDurationRange(saved.durationRange)
			setMovieSizeRange(saved.sizeRange)
			restoreScroll(saved.scrollTop)
		},
		() => ({ list: controls.freshSnapshot(), durationRange: null, sizeRange: null, scrollTop: 0 })
	)
	const activeTab = valueTabs.activeTab
	// A value tab shows movies of every type
	const typeView: MovieTypeView = activeTab ? 'all' : movieTypeView

	// Resets the view for loading another folder
	const startLoading = (): void => {
		// The tabs belong to the previous folder's archive
		valueTabs.closeAllTabs()
		setLoading(true)
		setMovieTypeView('film')
		setMovieDurationRange(null)
		setMovieSizeRange(null)
		setActiveFilters(filmFilters())
		setOpenCategories(new Set())
		setMovies([]) // Clear previous movies
	}

	// Loads the movie archive of `folder` (from its Excel file)
	const loadArchive = async (folder: string): Promise<void> => {
		try {
			console.log('Loading movies from Excel...')
			// The folder contains both the Excel file and the movie folders
			const archive = await window.api.loadMovies(folder, folder)
			setMovies(archive.movies)
			setMovieArchive(archive)
		} catch (error) {
			console.error('Loading error:', error)
			alert(
				'There was an error loading movies. If no Excel file exists, set TMDB_API_KEY so VidBase can create one.'
			)
		} finally {
			setLoading(false)
		}
	}

	// Loads the initial folder once. The initial state already matches startLoading, and the ref
	// keeps StrictMode's second effect run (development only) from starting a second load
	const initialLoadStarted = useRef(false)
	useEffect(() => {
		if (initialLoadStarted.current) return
		initialLoadStarted.current = true
		loadArchive(initialFolder)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// Handles the folder selection and loading (for changing folder after the initial selection)
	const handleSelectFolder = async (): Promise<void> => {
		const folder = await window.api.selectFolder()
		if (folder) {
			startLoading()
			await loadArchive(folder)
		}
	}

	// Handles opening a movie in detail view
	const handleMovieClick = (movie: Movie): void => {
		console.log('Opening movie:', movie.title)
		rememberScroll()
		setViewingMovie(movie)
		setViewMode('detail')
	}

	// Handles going back to list view
	const handleBackToList = (): void => {
		restoreScroll()
		setViewMode('list')
		setViewingMovie(null)
	}

	const handleMovieTypeView = (type: MovieTypeView): void => {
		valueTabs.switchTo(null)
		setMovieTypeView(type)
		setMovieDurationRange(null)
		setMovieSizeRange(null)
		if (type === 'all') {
			setActiveFilters({ simpleTag: [] })
			setOpenCategories(new Set())
		} else {
			const newFilters: ActiveFilters = { simpleTag: [] }
			newFilters.TYPE = [type]
			setActiveFilters(newFilters)
			setOpenCategories(new Set(['TYPE']))
		}
		setViewMode('list')
		setViewingMovie(null)
	}

	// Handles clicking on a filterable name (director, actor, genre, etc.): opens its tab and shows
	// it, or with Ctrl/Cmd held opens it in the background and stays on the movie
	const handleFilterClick = (category: string, value: string, inBackground = false): void => {
		valueTabs.openTab(category, value, inBackground)
		if (inBackground) return
		setViewMode('list')
		setViewingMovie(null)
	}

	// Shows a value tab
	const handleTabClick = (id: string): void => {
		valueTabs.switchTo(id)
		setViewMode('list')
		setViewingMovie(null)
	}

	// The movies of the value tab on screen (all movies on the type tabs)
	const tabMovies = useMemo(() => {
		if (!activeTab) return movies
		const tabFilter: ActiveFilters = { simpleTag: [] }
		tabFilter[activeTab.category] = [activeTab.value]
		return applyMovieFilters(movies, tabFilter, new Set())
	}, [movies, activeTab])

	// The movies the duration and size ranges are computed from (type tab, filters and search,
	// ignoring the range filters themselves)
	const movieRangeBase = useMemo(() => {
		let result = filterByMovieType(tabMovies, typeView)
		result = applyMovieFilters(result, activeFilters, new Set(['TYPE', 'DURATION', 'SIZE']))
		if (searchQuery.trim()) {
			result = result.filter((movie) => movieMatchesSearch(movie, searchQuery))
		}
		return result
	}, [tabMovies, typeView, activeFilters, searchQuery])

	const movieRangeStats = useMemo(() => {
		const durationValues = movieRangeBase
			.map((movie) => movie.durationSeconds)
			.filter((value): value is number => typeof value === 'number')
		const sizeValues = movieRangeBase
			.map((movie) => movie.sizeBytes)
			.filter((value): value is number => typeof value === 'number')

		return {
			durationMin: durationValues.length ? Math.min(...durationValues) : undefined,
			durationMax: durationValues.length ? Math.max(...durationValues) : undefined,
			sizeMin: sizeValues.length ? Math.min(...sizeValues) : undefined,
			sizeMax: sizeValues.length ? Math.max(...sizeValues) : undefined
		}
	}, [movieRangeBase])

	// Handles toggling a filter category open/closed. Opening DURATION or SIZE starts its range
	// filter over the full range of the current list; closing it removes the range filter
	const handleToggleCategory = (category: string): void => {
		const isOpening = !controls.openCategories.has(category)
		const upperCategory = category.toUpperCase()
		if (upperCategory === 'DURATION' || upperCategory === 'SIZE') {
			if (isOpening) {
				if (
					upperCategory === 'DURATION' &&
					movieRangeStats.durationMin !== undefined &&
					movieRangeStats.durationMax !== undefined
				) {
					setMovieDurationRange({
						min: movieRangeStats.durationMin,
						max: movieRangeStats.durationMax,
						selectedMin: movieRangeStats.durationMin,
						selectedMax: movieRangeStats.durationMax
					})
				}
				if (
					upperCategory === 'SIZE' &&
					movieRangeStats.sizeMin !== undefined &&
					movieRangeStats.sizeMax !== undefined
				) {
					setMovieSizeRange({
						min: movieRangeStats.sizeMin,
						max: movieRangeStats.sizeMax,
						selectedMin: movieRangeStats.sizeMin,
						selectedMax: movieRangeStats.sizeMax
					})
				}
			} else {
				if (upperCategory === 'DURATION') {
					setMovieDurationRange(null)
				}
				if (upperCategory === 'SIZE') {
					setMovieSizeRange(null)
				}
			}
		}

		controls.toggleOpenCategory(category)
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

	// Clears any active filter (a type tab keeps its TYPE filter, and the ranges reset to full)
	const handleClearFilters = (): void => {
		if (typeView !== 'all') {
			setActiveFilters({ simpleTag: [], TYPE: [typeView] })
			setMovieDurationRange((prev) =>
				prev ? { ...prev, selectedMin: prev.min, selectedMax: prev.max } : prev
			)
			setMovieSizeRange((prev) =>
				prev ? { ...prev, selectedMin: prev.min, selectedMax: prev.max } : prev
			)
			return
		}
		setActiveFilters({ simpleTag: [] })
	}

	const handleMovieDurationRangeChange = (min: number, max: number): void => {
		setMovieDurationRange((prev) => {
			if (!prev) return prev
			return {
				...prev,
				selectedMin: min,
				selectedMax: max
			}
		})
	}

	const handleMovieSizeRangeChange = (min: number, max: number): void => {
		setMovieSizeRange((prev) => {
			if (!prev) return prev
			return {
				...prev,
				selectedMin: min,
				selectedMax: max
			}
		})
	}

	// useMemo to calculate the available filter options from the archive's categories
	const filterOptions = useMemo(() => {
		if (!movieArchive) {
			return {
				categories: {},
				simpleTags: []
			}
		}
		return {
			categories: buildMovieFilterCategories(movieArchive.categories, typeView),
			simpleTags: []
		}
	}, [movieArchive, typeView])

	// Computed: Filtered and sorted movies based on active filters, search, and sorting
	const filteredMovies = useMemo(() => {
		let result = filterByMovieType(tabMovies, typeView)

		// Apply filters
		const hasActiveFilters = Object.entries(activeFilters).some(
			([key, values]) => key !== 'simpleTag' && values.length > 0
		)
		if (hasActiveFilters) {
			result = applyMovieFilters(result, activeFilters, new Set(['TYPE', 'DURATION', 'SIZE']))
		}

		// Apply search
		if (searchQuery.trim()) {
			result = result.filter((movie) => movieMatchesSearch(movie, searchQuery))
		}

		// Apply sorting
		result = sortMovies(result, sortField, sortDirection)

		return filterByRanges(result, movieDurationRange, movieSizeRange)
	}, [
		tabMovies,
		activeFilters,
		searchQuery,
		sortField,
		sortDirection,
		typeView,
		movieDurationRange,
		movieSizeRange
	])

	if (loading) {
		return <ScanLoader />
	}

	// Show detail view if in detail mode
	if (viewMode === 'detail' && viewingMovie) {
		return (
			<MovieDetailView
				movie={viewingMovie}
				onBack={handleBackToList}
				onFilterClick={handleFilterClick}
			/>
		)
	}

	// Show list view
	return (
		<ListLayout
			header={
				<AppHeader
					selectFolderLabel="📂 Select Movies Folder"
					onSelectFolder={handleSelectFolder}
					showSearchBar={true}
					searchQuery={searchQuery}
					onSearchChange={controls.setSearchQuery}
					sortField={sortField}
					onSortFieldChange={controls.setSortField}
					sortOptions={SORT_OPTIONS}
					sortDirection={sortDirection}
					onToggleSortDirection={() =>
						controls.setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
					}
					tabsRow={
						valueTabs.tabs.length > 0 &&
						valueTabs.tabs.map((tab) => (
							<HeaderTab
								key={tab.id}
								active={activeTab?.id === tab.id}
								onClick={() => handleTabClick(tab.id)}
								onClose={() => valueTabs.closeTab(tab.id)}
							>
								{valueTabLabel(tab)}
							</HeaderTab>
						))
					}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						{TYPE_TABS.map(({ type, label }) => (
							<HeaderTab
								key={type}
								active={!activeTab && movieTypeView === type}
								onClick={() => handleMovieTypeView(type)}
							>
								{label}
							</HeaderTab>
						))}
					</div>
				</AppHeader>
			}
			sidebar={
				<Sidebar
					filterOptions={filterOptions}
					activeFilters={activeFilters}
					isMultiSelectMode={controls.isMultiSelectMode}
					onFilterChange={controls.handleFilterChange}
					onMultiSelectChange={controls.handleMultiSelectChange}
					onClearFilters={handleClearFilters}
					onToggleMultiSelect={() =>
						controls.setIsMultiSelectMode(!controls.isMultiSelectMode)
					}
					openCategories={controls.openCategories}
					onToggleCategory={handleToggleCategory}
					isMovieMode={true}
					onMovieFilterTextChange={handleMovieFilterTextChange}
					movieRangeFilters={{
						duration: movieDurationRange
							? {
									...movieDurationRange,
									onChange: handleMovieDurationRangeChange
								}
							: undefined,
						size: movieSizeRange
							? {
									...movieSizeRange,
									onChange: handleMovieSizeRangeChange
								}
							: undefined
					}}
				/>
			}
			mainRef={listScrollRef}
		>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: '12px',
					width: '100%',
					maxWidth: '100%',
					boxSizing: 'border-box'
				}}
			>
				{/* Render the list of movie cards */}
				{filteredMovies.map((movie) => (
					<MovieCard key={movie.id} movie={movie} onEdit={() => handleMovieClick(movie)} />
				))}

				{/* Conditional messages for empty states */}
				{movies.length === 0 && (
					<EmptyMessage>
						No movies loaded. Click the top-right button to select a folder with an Excel
						file.
					</EmptyMessage>
				)}
				{movies.length > 0 && filteredMovies.length === 0 && (
					<EmptyMessage>No movies match the selected filters.</EmptyMessage>
				)}
			</div>
		</ListLayout>
	)
}

export default MovieModeView
