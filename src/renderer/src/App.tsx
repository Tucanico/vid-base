import React, { useState, useMemo, useEffect, useRef } from 'react'
import { ParsedTag } from 'src/shared/types/metadata'
import { VideoFile } from 'src/shared/types/video'
import { Library } from '@shared/types/library'
import { Movie, MovieArchive } from '@shared/types/movie'
import VideoDetailView from './components/VideoDetailView'
import MovieDetailView from './components/MovieDetailView'
import VideoCard from './components/VideoCard'
import MovieCard from './components/MovieCard'
import Sidebar from './components/Sidebar'
import ModeSelection from './components/ModeSelection'
import BatchEditModal from './components/BatchEditModal'
import { ActiveFilters } from '@shared/types/filter'

type AppMode = 'videos' | 'movies' | null
type ViewMode = 'list' | 'detail'
type VideoListViewMode = 'library' | 'home' | 'favorites'
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
	const [videoListViewMode, setVideoListViewMode] = useState<VideoListViewMode>('home')
	// Scroll state for returning to list view
	const listScrollRef = useRef<HTMLDivElement>(null)
	const lastListScrollTopRef = useRef(0)
	const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false)
	// State for the list of all video files in the current folder
	const [videos, setVideos] = useState<VideoFile[]>([])
	const [homeVideoIds, setHomeVideoIds] = useState<string[]>([])
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
	// State for global search query
	const [searchQuery, setSearchQuery] = useState<string>('')
	// State for sorting
	const [sortField, setSortField] = useState<string>('name')
	const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
	// State for selected videos (for batch editing)
	const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set())
	// State for batch edit modal
	const [showBatchEditModal, setShowBatchEditModal] = useState(false)

	// Handles mode selection from the initial screen
	const handleModeSelected = async (mode: 'videos' | 'movies', folder: string): Promise<void> => {
		setAppMode(mode)
		setCurrentFolder(folder)
		setVideoListViewMode(mode === 'videos' ? 'home' : 'library')

		if (mode === 'videos') {
			// Load videos mode
			setLoading(true)
			setVideos([]) // Clear previous videos
			try {
				console.log('Scanning directory...')
				const results = await window.api.scanVideos(folder)
				setVideos(results)
				setHomeVideoIds(pickRandomIds(results, 24))
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
				alert(
					'There was an error loading movies. Make sure there is an Excel file in the selected folder.'
				)
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
			setVideoListViewMode('library')

			if (appMode === 'videos') {
				setVideos([]) // Clear previous videos
				try {
					// Always scan the directory - it will use library.json metadata when available
					// and scan new files normally
					console.log('Scanning directory...')
					const results = await window.api.scanVideos(folder)
					setVideos(results)
					setHomeVideoIds(pickRandomIds(results, 24))
					setVideoListViewMode('home')
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
					alert(
						'There was an error loading movies. Make sure there is an Excel file in the selected folder.'
					)
				} finally {
					setLoading(false)
				}
			}
		}
	}

	// Handles saving updated tags for a video
	const saveTags = async (newTags: ParsedTag[]): Promise<boolean> => {
		if (!viewingVideo || !currentFolder) return false

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
			return true
		} catch (error) {
			console.error('Error saving tags:', error)
			alert('Error: unable to save tags.')
			return false
		}
	}

	const toggleFavorite = async (video: VideoFile): Promise<void> => {
		if (!currentFolder) return
		const hasFav = video.tags.some(
			(t) => t.type === 'simple' && t.value.toLowerCase() === 'fav'
		)
		const updatedTags = hasFav
			? video.tags.filter((t) => !(t.type === 'simple' && t.value.toLowerCase() === 'fav'))
			: [...video.tags, { type: 'simple', value: 'fav', original: 'fav' }]

		const updatedVideo = { ...video, tags: updatedTags }
		const updatedList = videos.map((v) => (v.id === video.id ? updatedVideo : v))
		setVideos(updatedList)

		try {
			await window.api.updateTags(video.filePath, updatedTags)
			await window.api.saveLibrary(currentFolder, updatedList)
			const updatedLibrary = await window.api.loadLibrary(currentFolder)
			if (updatedLibrary) {
				setLibrary(updatedLibrary)
			}
			if (viewingVideo && viewingVideo.id === video.id) {
				setViewingVideo(updatedVideo)
			}
		} catch (error) {
			console.error('Error updating favorite tag:', error)
			alert('Error: unable to update favorite tag.')
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

	// Handles opening a video in detail view or toggling selection
	const handleVideoClick = (video: VideoFile, event?: React.MouseEvent): void => {
		// If Ctrl/Cmd is held, toggle selection instead of opening detail view
		if (event && (event.ctrlKey || event.metaKey)) {
			setSelectedVideoIds((prev) => {
				const newSet = new Set(prev)
				if (newSet.has(video.id)) {
					newSet.delete(video.id)
				} else {
					newSet.add(video.id)
				}
				return newSet
			})
			return
		}
		
		// Normal click - open detail view
		lastListScrollTopRef.current = listScrollRef.current?.scrollTop ?? 0
		setViewingVideo(video)
		setViewingMovie(null)
		setViewMode('detail')
	}

	// Handles toggling video selection
	const handleVideoSelect = (videoId: string, isSelected: boolean): void => {
		setSelectedVideoIds((prev) => {
			const newSet = new Set(prev)
			if (isSelected) {
				newSet.add(videoId)
			} else {
				newSet.delete(videoId)
			}
			return newSet
		})
	}

	// Handles batch editing
	const handleBatchEdit = (): void => {
		if (selectedVideoIds.size === 0) return
		setShowBatchEditModal(true)
	}

	// Handles batch save (applies tags to all selected videos)
	const handleBatchSave = async (tagsToAdd: ParsedTag[], tagsToRemove: ParsedTag[]): Promise<void> => {
		if (selectedVideoIds.size === 0 || !currentFolder) return

		const selectedVideos = videos.filter((v) => selectedVideoIds.has(v.id))
		
		try {
			// Update local state with new tags for all selected videos
			const updatedList = videos.map((video) => {
				if (!selectedVideoIds.has(video.id)) {
					return video // Not selected, keep as is
				}

				// Start with current tags
				let newTags = [...video.tags]

				// Remove tags that should be removed
				for (const tagToRemove of tagsToRemove) {
					if (tagToRemove.type === 'kv') {
						newTags = newTags.filter(
							(t) => !(t.type === 'kv' && t.key === tagToRemove.key && t.value === tagToRemove.value)
						)
					} else {
						newTags = newTags.filter((t) => !(t.type === 'simple' && t.value === tagToRemove.value))
					}
				}

				// Add new tags (avoid duplicates)
				for (const tagToAdd of tagsToAdd) {
					const exists = newTags.some((t) => {
						if (tagToAdd.type === 'kv') {
							return t.type === 'kv' && t.key === tagToAdd.key && t.value === tagToAdd.value
						} else {
							return t.type === 'simple' && t.value === tagToAdd.value
						}
					})
					if (!exists) {
						newTags.push(tagToAdd)
					}
				}

				return { ...video, tags: newTags }
			})

			// Update file metadata for all selected videos
			for (const video of selectedVideos) {
				const updatedVideo = updatedList.find((v) => v.id === video.id)
				if (updatedVideo) {
					await window.api.updateTags(video.filePath, updatedVideo.tags)
				}
			}

			// Update local state
			setVideos(updatedList)

			// Save the updated list to the 'library.json' cache (will update categories/tags)
			await window.api.saveLibrary(currentFolder, updatedList)

			// Reload library to get updated categories and tags
			const updatedLibrary = await window.api.loadLibrary(currentFolder)
			if (updatedLibrary) {
				setLibrary(updatedLibrary)
			}

			// Clear selection and close modal
			setSelectedVideoIds(new Set())
			setShowBatchEditModal(false)
		} catch (error) {
			console.error('Error in batch save:', error)
			alert('Error updating videos. Please try again.')
		}
	}

	// Handles opening a movie in detail view
	const handleMovieClick = (movie: Movie): void => {
		console.log('Opening movie:', movie.title)
		lastListScrollTopRef.current = listScrollRef.current?.scrollTop ?? 0
		setViewingMovie(movie)
		setViewingVideo(null)
		setViewMode('detail')
	}

	// Handles going back to list view
	const handleBackToList = (): void => {
		setShouldRestoreScroll(true)
		setViewMode('list')
		setViewingVideo(null)
		setViewingMovie(null)
	}

	useEffect(() => {
		if (viewMode !== 'list' || !shouldRestoreScroll) return
		const target = listScrollRef.current
		if (!target) return
		requestAnimationFrame(() => {
			target.scrollTop = lastListScrollTopRef.current
			setShouldRestoreScroll(false)
		})
	}, [viewMode, shouldRestoreScroll])

	const pickRandomIds = (items: VideoFile[], count: number): string[] => {
		const ids = items.map((item) => item.id)
		for (let i = ids.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1))
			;[ids[i], ids[j]] = [ids[j], ids[i]]
		}
		return ids.slice(0, Math.min(count, ids.length))
	}

	const handleHomeView = (): void => {
		setActiveFilters({ simpleTag: [] })
		setOpenCategories(new Set())
		setSearchQuery('')
		setVideoListViewMode('home')
		setViewMode('list')
		setViewingVideo(null)
		setViewingMovie(null)
	}

	const handleFavoritesView = (): void => {
		setActiveFilters({ simpleTag: [] })
		setOpenCategories(new Set())
		setSearchQuery('')
		setVideoListViewMode('favorites')
		setViewMode('list')
		setViewingVideo(null)
		setViewingMovie(null)
	}

	const handleLibraryView = (): void => {
		setVideoListViewMode('library')
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

	// Helper function to check if a video matches the search query
	const videoMatchesSearch = (video: VideoFile, query: string): boolean => {
		if (!query.trim()) return true
		const lowerQuery = query.toLowerCase()
		
		// Search in file name
		if (video.fileName.toLowerCase().includes(lowerQuery)) return true
		
		// Search in all tags (both kv and simple)
		for (const tag of video.tags) {
			if (tag.value.toLowerCase().includes(lowerQuery)) return true
			if (tag.key && tag.key.toLowerCase().includes(lowerQuery)) return true
		}
		
		return false
	}

	// Helper function to sort videos
	const sortVideos = (videos: VideoFile[], field: string, direction: 'asc' | 'desc'): VideoFile[] => {
		const sorted = [...videos].sort((a, b) => {
			let aValue: string | number | undefined
			let bValue: string | number | undefined
			
			switch (field) {
				case 'name':
					aValue = a.fileName.toLowerCase()
					bValue = b.fileName.toLowerCase()
					break
				case 'size':
					aValue = a.fileSize ?? 0
					bValue = b.fileSize ?? 0
					break
				case 'duration':
					aValue = a.duration ?? 0
					bValue = b.duration ?? 0
					break
				default:
					aValue = a.fileName.toLowerCase()
					bValue = b.fileName.toLowerCase()
			}
			
			if (aValue < bValue) return direction === 'asc' ? -1 : 1
			if (aValue > bValue) return direction === 'asc' ? 1 : -1
			return 0
		})
		
		return sorted
	}

	// useMemo to compute the list of videos to display based on filters, search, and sorting
	const homeVideos = useMemo(() => {
		if (homeVideoIds.length === 0) return []
		const byId = new Map(videos.map((video) => [video.id, video]))
		return homeVideoIds.map((id) => byId.get(id)).filter(Boolean) as VideoFile[]
	}, [homeVideoIds, videos])

	const filteredVideos = useMemo(() => {
		let result = videos

		if (videoListViewMode === 'home') {
			return homeVideos
		}

		if (videoListViewMode === 'favorites') {
			result = result.filter((video) =>
				video.tags.some((t) => t.type === 'simple' && t.value.toLowerCase() === 'fav')
			)
		}
		
		// Apply filters
		const hasActiveFilters = Object.values(activeFilters).some((arr) => arr.length > 0)
		if (hasActiveFilters) {
			result = result.filter((video) => {
				for (const [category, values] of Object.entries(activeFilters)) {
					if (values.length === 0) continue
					
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
					
					if (!categoryMatches) return false
				}
				return true
			})
		}
		
		// Apply search
		if (searchQuery.trim()) {
			result = result.filter((video) => videoMatchesSearch(video, searchQuery))
		}
		
		// Apply sorting
		result = sortVideos(result, sortField, sortDirection)
		
		return result
	}, [
		videos,
		activeFilters,
		searchQuery,
		sortField,
		sortDirection,
		videoListViewMode,
		homeVideos
	])

	// Helper function to check if a movie matches the search query
	const movieMatchesSearch = (movie: Movie, query: string): boolean => {
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

	// Helper function to sort movies
	const sortMovies = (movies: Movie[], field: string, direction: 'asc' | 'desc'): Movie[] => {
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
					aValue = a.duration ?? 0
					bValue = b.duration ?? 0
					break
				case 'size':
					aValue = a.size ?? 0
					bValue = b.size ?? 0
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

	// Computed: Filtered and sorted movies based on active filters, search, and sorting
	const filteredMovies = useMemo(() => {
		if (appMode !== 'movies') return []

		let result = movies

		// Apply filters
		const hasActiveFilters = Object.entries(activeFilters).some(
			([key, values]) => key !== 'simpleTag' && values.length > 0
		)
		if (hasActiveFilters) {
			result = result.filter((movie) => {
				for (const [category, filterValues] of Object.entries(activeFilters)) {
					if (category === 'simpleTag') continue
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
		
		// Apply search
		if (searchQuery.trim()) {
			result = result.filter((movie) => movieMatchesSearch(movie, searchQuery))
		}
		
		// Apply sorting
		result = sortMovies(result, sortField, sortDirection)
		
		return result
	}, [movies, activeFilters, appMode, searchQuery, sortField, sortDirection])

	// Show mode selection screen if no mode is selected
	if (!appMode) {
		return <ModeSelection onModeSelected={handleModeSelected} />
	}

	// Show detail view if in detail mode
	if (viewMode === 'detail') {
		if (appMode === 'videos' && viewingVideo) {
			return (
				<VideoDetailView
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
	const showSidebar = appMode === 'movies' || videoListViewMode !== 'home'
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
					flexDirection: 'column',
					gap: '15px'
				}}
			>
				{/* Top row: Title and Scan button */}
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center'
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
						<h1 style={{ color: 'var(--color-text)', margin: 0, fontSize: '1.2rem' }}>
							VidBase
						</h1>
					</div>

					<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
						{appMode === 'videos' && (
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
								<button
									onClick={handleHomeView}
									style={{
										padding: '8px 14px',
										fontSize: '0.9rem',
										backgroundColor: videoListViewMode === 'home'
											? 'var(--color-primary)'
											: 'var(--color-background)',
										color: videoListViewMode === 'home' ? 'white' : 'var(--color-text)',
										border: '1px solid var(--color-background-mute)',
										borderRadius: '6px',
										cursor: 'pointer'
									}}
								>
									Home
								</button>
								<button
									onClick={handleLibraryView}
									style={{
										padding: '8px 14px',
										fontSize: '0.9rem',
										backgroundColor: videoListViewMode === 'library'
											? 'var(--color-primary)'
											: 'var(--color-background)',
										color: videoListViewMode === 'library' ? 'white' : 'var(--color-text)',
										border: '1px solid var(--color-background-mute)',
										borderRadius: '6px',
										cursor: 'pointer'
									}}
								>
									Library
								</button>
								<button
									onClick={handleFavoritesView}
									style={{
										padding: '8px 14px',
										fontSize: '0.9rem',
										backgroundColor: videoListViewMode === 'favorites'
											? 'var(--color-primary)'
											: 'var(--color-background)',
										color: videoListViewMode === 'favorites' ? 'white' : 'var(--color-text)',
										border: '1px solid var(--color-background-mute)',
										borderRadius: '6px',
										cursor: 'pointer'
									}}
								>
									★ Favourited
								</button>
							</div>
						)}
						{appMode === 'videos' && selectedVideoIds.size > 0 && (
							<button
								onClick={handleBatchEdit}
								style={{
									padding: '10px 20px',
									fontSize: '1rem',
									backgroundColor: 'var(--color-primary)',
									color: 'white',
									border: 'none',
									borderRadius: '6px',
									cursor: 'pointer',
									transition: 'background 0.2s'
								}}
							>
								Edit {selectedVideoIds.size} Selected
							</button>
						)}
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
					</div>
				</div>

				{/* Bottom row: Search and Sort controls */}
				{!(appMode === 'videos' && videoListViewMode === 'home') && (
					<div
						style={{
							display: 'flex',
							gap: '15px',
							alignItems: 'center',
							flexWrap: 'wrap'
						}}
					>
						{/* Search input */}
						<input
							type="text"
							placeholder="Search across all fields..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							style={{
								flex: 1,
								minWidth: '200px',
								padding: '8px 12px',
								fontSize: '0.9rem',
								border: '1px solid var(--color-background-mute)',
								borderRadius: '6px',
								backgroundColor: 'var(--color-background)',
								color: 'var(--color-text)',
								outline: 'none'
							}}
						/>

						{/* Sort field selector */}
						<select
							value={sortField}
							onChange={(e) => setSortField(e.target.value)}
							style={{
								padding: '8px 12px',
								fontSize: '0.9rem',
								border: '1px solid var(--color-background-mute)',
								borderRadius: '6px',
								backgroundColor: 'var(--color-background)',
								color: 'var(--color-text)',
								outline: 'none',
								cursor: 'pointer'
							}}
						>
							{appMode === 'videos' ? (
								<>
									<option value="name">Name</option>
									<option value="size">Size</option>
									<option value="duration">Duration</option>
								</>
							) : (
								<>
									<option value="title">Title</option>
									<option value="year">Year</option>
									<option value="director">Director</option>
									<option value="duration">Duration</option>
									<option value="size">Size</option>
								</>
							)}
						</select>

						{/* Sort direction toggle */}
						<button
							onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
							title={`Sort ${sortDirection === 'asc' ? 'Ascending' : 'Descending'}`}
							style={{
								padding: '8px 12px',
								fontSize: '0.9rem',
								border: '1px solid var(--color-background-mute)',
								borderRadius: '6px',
								backgroundColor: 'var(--color-background)',
								color: 'var(--color-text)',
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								gap: '5px'
							}}
						>
							{sortDirection === 'asc' ? '↑' : '↓'} {sortDirection === 'asc' ? 'Asc' : 'Desc'}
						</button>
					</div>
				)}
			</header>

			{/* --- MAIN CONTENT --- */}
			<div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
				{showSidebar && (
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
						isMovieMode={appMode === 'movies'}
						onMovieFilterTextChange={
							appMode === 'movies' ? handleMovieFilterTextChange : undefined
						}
					/>
				)}

				<main
					ref={listScrollRef}
					style={{
						flex: 1,
						overflowY: 'auto',
						overflowX: 'hidden',
						padding: '20px',
						boxSizing: 'border-box'
					}}
				>
					{appMode === 'videos' ? (
						<>
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
								<VideoCard
									key={vid.id}
									video={vid}
									onEdit={(e) => handleVideoClick(vid, e)}
									isSelected={selectedVideoIds.has(vid.id)}
									onSelect={(isSelected) => handleVideoSelect(vid.id, isSelected)}
									onSelectToggle={() => handleVideoSelect(vid.id, !selectedVideoIds.has(vid.id))}
									onToggleFavorite={() => toggleFavorite(vid)}
								/>
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
							{videoListViewMode === 'home' && (
								<div style={{ textAlign: 'center', marginTop: '22px' }}>
									<button
										onClick={handleLibraryView}
										style={{
											background: 'transparent',
											border: 'none',
											color: 'var(--color-primary)',
											cursor: 'pointer',
											fontSize: '1.1rem',
											fontWeight: 700,
											letterSpacing: '0.2px'
										}}
									>
										Go to the library →
									</button>
								</div>
							)}
						</>
					) : (
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
								<MovieCard
									key={movie.id}
									movie={movie}
									onEdit={() => handleMovieClick(movie)}
								/>
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
									No movies loaded. Click the top-right button to select a folder with an
									Excel file.
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

			{/* Batch Edit Modal */}
			{showBatchEditModal && appMode === 'videos' && (
				<BatchEditModal
					videos={videos.filter((v) => selectedVideoIds.has(v.id))}
					library={library}
					onClose={() => {
						setShowBatchEditModal(false)
						setSelectedVideoIds(new Set())
					}}
					onSave={handleBatchSave}
				/>
			)}
		</div>
	)
}

export default App
