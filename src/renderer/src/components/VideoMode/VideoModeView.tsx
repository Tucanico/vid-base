import React, { useState, useMemo, useEffect, useRef } from 'react'
import { ParsedTag } from '@shared/types/metadata'
import { VideoFile } from '@shared/types/video'
import { Library } from '@shared/types/library'
import { ActiveFilters } from '@shared/types/filter'
import VideoDetailView from './VideoDetailView'
import VideoCard from './VideoCard'
import BatchEditModal from './BatchEditModal'
import Sidebar from '../Sidebar'
import AppHeader, { HeaderTab } from '../AppHeader'
import ListLayout from '../ListLayout'
import ScanLoader, { ScanProgress } from '../ScanLoader'
import EmptyMessage from '../EmptyMessage'
import { ListSnapshot, useListControls } from '../../hooks/useListControls'
import { useListScrollRestore } from '../../hooks/useListScrollRestore'
import { useValueTabs, valueTabLabel } from '../../hooks/useValueTabs'
import { addRecentFolder, folderUnavailableMessage } from '../../utils/recentFolders'
import {
	applyBatchTagChanges,
	buildFilterOptionsFromVideos,
	buildRawTagString,
	filterVideosByTags,
	pickNewRandomIds,
	pickRandomIds,
	sortVideos,
	stripFavoriteTag,
	videoMatchesSearch
} from '../../utils/videoList'

type VideoListViewMode = 'library' | 'home' | 'favorites' | 'session'

const SORT_OPTIONS = [
	{ value: 'name', label: 'Name' },
	{ value: 'size', label: 'Size' },
	{ value: 'duration', label: 'Duration' }
]

/** --- COMPONENT: VideoModeView ---
 *  Video Mode: scans a folder and shows its videos (home, library, favourites and session views), and
 *  lets the user edit tags, favourite, delete and batch-edit them. It owns all Video Mode state and its
 *  interactions with the main process via the `window.api` object
 *  @param initialFolder The folder picked on the mode selection screen, scanned when the view opens
 */
function VideoModeView({ initialFolder }: { initialFolder: string }): React.ReactElement {
	// State for the current view mode (list or detail)
	const [viewMode, setViewMode] = useState<'list' | 'detail'>('list')
	const [videoListViewMode, setVideoListViewMode] = useState<VideoListViewMode>('home')
	// State for the list of all video files in the current folder
	const [videos, setVideos] = useState<VideoFile[]>([])
	const [homeVideoIds, setHomeVideoIds] = useState<string[]>([])
	// State to indicate when a scan is in progress. Starts true: the initial folder is scanned on open
	const [loading, setLoading] = useState(true)
	// State for scan progress
	const [scanProgress, setScanProgress] = useState<ScanProgress>({
		processed: 0,
		total: 0,
		percent: 0
	})
	// State to hold the video file currently being viewed in detail
	const [viewingVideo, setViewingVideo] = useState<VideoFile | null>(null)
	// State for the path of the currently selected video folder
	const [currentFolder, setCurrentFolder] = useState<string | null>(initialFolder)
	// State for library metadata (categories and tags)
	const [library, setLibrary] = useState<Library | null>(null)
	// State for selected videos (for batch editing)
	const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set())
	// State for batch edit modal
	const [showBatchEditModal, setShowBatchEditModal] = useState(false)
	// The session collection: videos saved for this run of the app. Deliberately in memory only, so
	// it is empty every time VidBase starts
	const [sessionIds, setSessionIds] = useState<Set<string>>(new Set())
	const controls = useListControls({ simpleTag: [] })
	const {
		activeFilters,
		setActiveFilters,
		setOpenCategories,
		searchQuery,
		setSearchQuery,
		sortField,
		sortDirection
	} = controls
	const { listScrollRef, rememberScroll, restoreScroll, currentScrollTop } =
		useListScrollRestore(viewMode)
	// Value tabs: the library filtered by a value clicked in the detail view (e.g. Model: X), each
	// with its own filters, search, sort and scroll position
	const valueTabs = useValueTabs<{ list: ListSnapshot; scrollTop: number }>(
		() => ({ list: controls.snapshot(), scrollTop: currentScrollTop() }),
		(saved) => {
			controls.restore(saved.list)
			restoreScroll(saved.scrollTop)
		},
		() => ({ list: controls.freshSnapshot(), scrollTop: 0 })
	)
	const activeTab = valueTabs.activeTab
	// The list shown: a value tab shows the library, filtered by its value
	const listMode: VideoListViewMode = activeTab ? 'library' : videoListViewMode

	// Resets the view for a scan of `folder`. `listView` is the list view kept if the scan fails
	const startLoading = (folder: string, listView: VideoListViewMode): void => {
		// The tabs belong to the previous folder's videos
		valueTabs.closeAllTabs()
		setCurrentFolder(folder)
		setLoading(true)
		setScanProgress({ processed: 0, total: 0, percent: 0 })
		setVideoListViewMode(listView)
		setVideos([]) // Clear previous videos
	}

	// Scans `folder` and loads its library (categories and tags)
	const scanFolder = async (folder: string): Promise<void> => {
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
			addRecentFolder('videos', folder)
		} catch (error) {
			console.error('Loading error:', error)
			const available = await window.api.folderExists(folder).catch(() => false)
			alert(available ? 'There was an error during loading.' : folderUnavailableMessage(folder))
		} finally {
			setLoading(false)
			setScanProgress({ processed: 0, total: 0, percent: 0 })
		}
	}

	// Scans the initial folder once. The initial state already matches startLoading, and the ref
	// keeps StrictMode's second effect run (development only) from starting a second scan
	const initialScanStarted = useRef(false)
	useEffect(() => {
		if (initialScanStarted.current) return
		initialScanStarted.current = true
		scanFolder(initialFolder)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		if (!window.api.onScanProgress) return undefined
		return window.api.onScanProgress((progress) => {
			setScanProgress({
				processed: progress.processed,
				total: progress.total,
				percent: progress.total > 0 ? progress.percent : 0
			})
		})
	}, [])

	// Handles the folder selection and scan (for changing folder after the initial selection)
	const handleSelectFolder = async (): Promise<void> => {
		const folder = await window.api.selectFolder()
		if (folder) {
			startLoading(folder, 'library')
			await scanFolder(folder)
		}
	}

	// Handles saving updated tags for a video
	const saveTags = async (
		newTags: ParsedTag[],
		favouritedOverride?: boolean
	): Promise<boolean> => {
		if (!viewingVideo || !currentFolder) return false

		try {
			const { cleanedTags, hasFav } = stripFavoriteTag(newTags)
			const favourited =
				typeof favouritedOverride === 'boolean'
					? favouritedOverride
					: hasFav || viewingVideo.favourited

			// 1. Tell the main process to write the new tags to the file's metadata
			await window.api.updateTags(viewingVideo.filePath, cleanedTags, favourited)
			// 2. Update the local state to reflect the change immediately
			const updatedList = videos.map((v) =>
				v.id === viewingVideo.id
					? {
							...v,
							tags: cleanedTags,
							favourited,
							rawTags: buildRawTagString(cleanedTags, favourited)
						}
					: v
			)
			setVideos(updatedList)
			const updatedViewing = updatedList.find((v) => v.id === viewingVideo.id)
			if (updatedViewing) {
				setViewingVideo(updatedViewing)
			}
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
		const favourited = !video.favourited
		const updatedVideo = {
			...video,
			favourited,
			rawTags: buildRawTagString(video.tags, favourited)
		}
		const updatedList = videos.map((v) => (v.id === video.id ? updatedVideo : v))
		setVideos(updatedList)

		try {
			await window.api.updateTags(video.filePath, video.tags, favourited)
			await window.api.saveLibrary(currentFolder, updatedList)
			const updatedLibrary = await window.api.loadLibrary(currentFolder)
			if (updatedLibrary) {
				setLibrary(updatedLibrary)
			}
			if (viewingVideo && viewingVideo.id === video.id) {
				setViewingVideo(updatedVideo)
			}
		} catch (error) {
			console.error('Error updating favorite status:', error)
			alert('Error: unable to update favorite.')
		}
	}

	// Renames a video's file (and its thumbnail and library entry). Its id does not change, so the
	// session collection, Home and the selection keep it
	// @returns A message to show in the detail view, or null once renamed
	const handleRename = async (video: VideoFile, newBaseName: string): Promise<string | null> => {
		if (!currentFolder) return 'No folder is open.'
		try {
			const result = await window.api.renameVideo(currentFolder, video.id, newBaseName)
			if (!result.ok) return result.error
			const { fileName, filePath, thumbnailPath } = result.video
			const renamed = { ...video, fileName, filePath, thumbnailPath }
			setVideos((prev) => prev.map((v) => (v.id === video.id ? renamed : v)))
			setViewingVideo(renamed)
			return null
		} catch (error) {
			console.error('Error renaming file:', error)
			return 'The file could not be renamed. It may be open in another program, or the drive may not be available.'
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
		rememberScroll()
		setViewingVideo(video)
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
	const handleBatchSave = async (
		tagsToAdd: ParsedTag[],
		tagsToRemove: ParsedTag[]
	): Promise<void> => {
		if (selectedVideoIds.size === 0 || !currentFolder) return

		const selectedVideos = videos.filter((v) => selectedVideoIds.has(v.id))

		try {
			// Update local state with new tags for all selected videos
			const updatedList = videos.map((video) =>
				selectedVideoIds.has(video.id)
					? applyBatchTagChanges(video, tagsToAdd, tagsToRemove)
					: video
			)

			// Update file metadata for all selected videos
			for (const video of selectedVideos) {
				const updatedVideo = updatedList.find((v) => v.id === video.id)
				if (updatedVideo) {
					await window.api.updateTags(
						video.filePath,
						updatedVideo.tags,
						updatedVideo.favourited
					)
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

	// Handles going back to list view
	const handleBackToList = (): void => {
		restoreScroll()
		setViewMode('list')
		setViewingVideo(null)
	}

	const handleHomeView = (): void => {
		valueTabs.switchTo(null)
		setActiveFilters({ simpleTag: [] })
		setOpenCategories(new Set())
		setSearchQuery('')
		setVideoListViewMode('home')
		setViewMode('list')
		setViewingVideo(null)
	}

	// Replaces the home view's videos with others, not shown there now when possible
	const handleShuffle = (): void => {
		setHomeVideoIds(pickNewRandomIds(videos, homeVideoIds, 24))
		listScrollRef.current?.scrollTo(0, 0)
	}

	const handleFavoritesView = (): void => {
		valueTabs.switchTo(null)
		setActiveFilters({ simpleTag: [] })
		setOpenCategories(new Set())
		setSearchQuery('')
		setVideoListViewMode('favorites')
		setViewMode('list')
		setViewingVideo(null)
	}

	const handleLibraryView = (): void => {
		valueTabs.switchTo(null)
		setVideoListViewMode('library')
		setViewMode('list')
		setViewingVideo(null)
	}

	const handleSessionView = (): void => {
		valueTabs.switchTo(null)
		setActiveFilters({ simpleTag: [] })
		setOpenCategories(new Set())
		setSearchQuery('')
		setVideoListViewMode('session')
		setViewMode('list')
		setViewingVideo(null)
	}

	// Adds a video to the session collection, or removes it
	const toggleSession = (videoId: string): void => {
		setSessionIds((prev) => {
			const next = new Set(prev)
			if (next.has(videoId)) {
				next.delete(videoId)
			} else {
				next.add(videoId)
			}
			return next
		})
	}

	// Handles clicking on a filterable name (category, model, channel, production): opens its tab and
	// shows it, or with Ctrl/Cmd held opens it in the background and stays on the video
	const handleFilterClick = (category: string, value: string, inBackground = false): void => {
		valueTabs.openTab(category, value, inBackground)
		if (inBackground) return
		setViewMode('list')
		setViewingVideo(null)
	}

	// Shows a value tab
	const handleTabClick = (id: string): void => {
		valueTabs.switchTo(id)
		setViewMode('list')
		setViewingVideo(null)
	}

	// Clears any active filter
	const handleClearFilters = (): void => {
		setActiveFilters({ simpleTag: [] })
	}

	// The videos of the value tab on screen (all videos on the main views)
	const tabVideos = useMemo(() => {
		if (!activeTab) return videos
		const tabFilter: ActiveFilters = { simpleTag: [] }
		tabFilter[activeTab.category] = [activeTab.value]
		return filterVideosByTags(videos, tabFilter)
	}, [videos, activeTab])

	// The videos in the session collection that are in the current folder
	const sessionVideos = useMemo(
		() => videos.filter((video) => sessionIds.has(video.id)),
		[videos, sessionIds]
	)

	// useMemo to calculate all available filter options, from library.json (or from the
	// videos shown, in the favourites and session views and in a value tab)
	const filterOptions = useMemo(() => {
		if (activeTab) {
			return buildFilterOptionsFromVideos(tabVideos)
		}
		if (videoListViewMode === 'favorites') {
			const favoriteVideos = videos.filter((video) => video.favourited)
			return buildFilterOptionsFromVideos(favoriteVideos)
		}
		if (videoListViewMode === 'session') {
			return buildFilterOptionsFromVideos(sessionVideos)
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
	}, [library, videoListViewMode, videos, activeTab, tabVideos, sessionVideos])

	// useMemo to compute the list of videos to display based on filters, search, and sorting
	const homeVideos = useMemo(() => {
		if (homeVideoIds.length === 0) return []
		const byId = new Map(videos.map((video) => [video.id, video]))
		return homeVideoIds.map((id) => byId.get(id)).filter(Boolean) as VideoFile[]
	}, [homeVideoIds, videos])

	const filteredVideos = useMemo(() => {
		if (listMode === 'home') {
			return homeVideos
		}

		let result = tabVideos

		if (listMode === 'favorites') {
			result = result.filter((video) => video.favourited)
		}

		if (listMode === 'session') {
			result = result.filter((video) => sessionIds.has(video.id))
		}

		// Apply filters
		result = filterVideosByTags(result, activeFilters)

		// Apply search
		if (searchQuery.trim()) {
			result = result.filter((video) => videoMatchesSearch(video, searchQuery))
		}

		// Apply sorting
		return sortVideos(result, sortField, sortDirection)
	}, [
		tabVideos,
		activeFilters,
		searchQuery,
		sortField,
		sortDirection,
		listMode,
		homeVideos,
		sessionIds
	])

	// Previous and next video in the list the detail view was opened from (with its filters and search)
	const viewingIndex = viewingVideo
		? filteredVideos.findIndex((video) => video.id === viewingVideo.id)
		: -1
	const showAdjacent = (offset: number): void => {
		const adjacent = viewingIndex >= 0 ? filteredVideos[viewingIndex + offset] : undefined
		if (adjacent) setViewingVideo(adjacent)
	}

	if (loading) {
		return <ScanLoader progress={scanProgress} />
	}

	// Show detail view if in detail mode
	if (viewMode === 'detail' && viewingVideo) {
		return (
			<VideoDetailView
				// A new page for each video, so a rename in progress or a half-typed tag does not carry
				// over to the next one (a rename keeps the id, so it keeps the page)
				key={viewingVideo.id}
				video={viewingVideo}
				library={library}
				onBack={handleBackToList}
				onSave={saveTags}
				onDelete={handleDeleteVideo}
				onFilterClick={handleFilterClick}
				isInSession={sessionIds.has(viewingVideo.id)}
				onToggleSession={() => toggleSession(viewingVideo.id)}
				onRename={(newBaseName) => handleRename(viewingVideo, newBaseName)}
				onPrevious={viewingIndex > 0 ? () => showAdjacent(-1) : undefined}
				onNext={
					viewingIndex >= 0 && viewingIndex < filteredVideos.length - 1
						? () => showAdjacent(1)
						: undefined
				}
				position={
					viewingIndex >= 0
						? { index: viewingIndex + 1, total: filteredVideos.length }
						: undefined
				}
			/>
		)
	}

	// Show list view
	const isHome = listMode === 'home'
	return (
		<ListLayout
			header={
				<AppHeader
					selectFolderLabel="📂 Select Video Folder"
					onSelectFolder={handleSelectFolder}
					showSearchBar={!isHome}
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
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
						<HeaderTab active={listMode === 'home'} onClick={handleHomeView}>
							Home
						</HeaderTab>
						{isHome && (
							<HeaderTab active={false} onClick={handleShuffle}>
								🔀 Shuffle
							</HeaderTab>
						)}
						<HeaderTab
							active={!activeTab && listMode === 'library'}
							onClick={handleLibraryView}
						>
							Library
						</HeaderTab>
						<HeaderTab active={listMode === 'favorites'} onClick={handleFavoritesView}>
							★ Favourited
						</HeaderTab>
						<HeaderTab active={listMode === 'session'} onClick={handleSessionView}>
							📌 Session{sessionVideos.length > 0 ? ` (${sessionVideos.length})` : ''}
						</HeaderTab>
					</div>
					{selectedVideoIds.size > 0 && (
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
				</AppHeader>
			}
			sidebar={
				!isHome && (
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
						onToggleCategory={controls.toggleOpenCategory}
						isMovieMode={false}
					/>
				)
			}
			mainRef={listScrollRef}
			overlay={
				showBatchEditModal && (
					<BatchEditModal
						videos={videos.filter((v) => selectedVideoIds.has(v.id))}
						library={library}
						onClose={() => {
							setShowBatchEditModal(false)
							setSelectedVideoIds(new Set())
						}}
						onSave={handleBatchSave}
					/>
				)
			}
		>
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
						isInSession={sessionIds.has(vid.id)}
						onToggleSession={() => toggleSession(vid.id)}
					/>
				))}

				{/* Conditional messages for empty states */}
				{videos.length === 0 && (
					<EmptyMessage>No videos loaded. Click the top-right button to start.</EmptyMessage>
				)}
				{videos.length > 0 && listMode === 'session' && sessionVideos.length === 0 && (
					<EmptyMessage>
						Nothing saved in this session yet. Use 📌 on a video or photo to add it here; the
						list empties when VidBase closes.
					</EmptyMessage>
				)}
				{videos.length > 0 &&
					filteredVideos.length === 0 &&
					!(listMode === 'session' && sessionVideos.length === 0) && (
						<EmptyMessage>No videos match the selected filters.</EmptyMessage>
					)}
			</div>
			{isHome && (
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
		</ListLayout>
	)
}

export default VideoModeView
