import React, { useState, useMemo } from 'react'
import { ParsedTag } from 'src/shared/types/metadata'
import { VideoFile } from 'src/shared/types/video'
import EditModal from './components/EditModal'
import VideoCard from './components/VideoCard'
import Sidebar from './components/Sidebar'
import { ActiveFilter, FilterCategory } from '@shared/types/filter'

/** --- MAIN APP COMPONENT ---
 *  The root component of the application. It manages the global state,
 *  including the list of videos, loading status, and active filters
 *  It also orchestrates all interactions with the main process via the `window.api` object
 */
function App(): React.ReactElement {
	// State for the list of all video files in the current folder
	const [videos, setVideos] = useState<VideoFile[]>([])
	// State to indicate when a scan or load operation is in progress
	const [loading, setLoading] = useState(false)
	// State to hold the video file currently being edited in the modal
	const [editingVideo, setEditingVideo] = useState<VideoFile | null>(null)
	// State for the path of the currently selected video folder
	const [currentFolder, setCurrentFolder] = useState<string | null>(null)
	// State for the currently active filter. Only one filter can be active at a time
	const [activeFilters, setActiveFilters] = useState<ActiveFilter | null>(null)

	// Handles the folder selection and video loading process
	const handleScan = async (): Promise<void> => {
		const folder = await window.api.selectFolder()
		if (folder) {
			setCurrentFolder(folder)
			setLoading(true)
			setVideos([]) // Clear previous videos
			try {
				// First, try to load from the 'library.json' cache file
				const cachedVideos = await window.api.loadLibrary(folder)
				if (cachedVideos) {
					console.log('library.json found! Loading from cache.')
					setVideos(cachedVideos)
				} else {
					// If no cache exists, perform a full scan of the directory
					console.log('No library.json found. Starting full scan...')
					const results = await window.api.scanVideos(folder)
					setVideos(results)
					// Save the results to the cache for next time
					await window.api.saveLibrary(folder, results)
				}
			} catch (error) {
				console.error('Loading error:', error)
				alert('There was an error during loading.')
			} finally {
				setLoading(false)
			}
		}
	}

	// Handles saving updated tags for a video
	const saveTags = async (newTags: ParsedTag[]): Promise<void> => {
		if (!editingVideo || !currentFolder) return

		try {
			// 1. Tell the main process to write the new tags to the file's metadata
			await window.api.updateTags(editingVideo.filePath, newTags)
			// 2. Update the local state to reflect the change immediately
			const updatedList = videos.map((v) =>
				v.id === editingVideo.id ? { ...v, tags: newTags } : v
			)
			setVideos(updatedList)
			// 3. Save the updated list to the 'library.json' cache
			await window.api.saveLibrary(currentFolder, updatedList)
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
			setEditingVideo(null) // Close the modal after deletion
		} catch (error) {
			console.error('Error deleting video:', error)
			alert('Error: unable to delete video.')
		}
	}

	// useMemo to calculate all available filter options from the current video list
	// This is recalculated only when the 'videos' array changes
	const filterOptions = useMemo(() => {
		const categories = new Set<string>()
		const models = new Set<string>()
		const channels = new Set<string>()
		const productions = new Set<string>()
		const simpleTags = new Set<string>()

		videos.forEach((video) => {
			video.tags.forEach((tag) => {
				if (tag.type === 'kv') {
					if (tag.key === 'category') categories.add(tag.value)
					if (tag.key === 'model') models.add(tag.value)
					if (tag.key === 'channel') channels.add(tag.value)
					if (tag.key === 'production') productions.add(tag.value)
				} else {
					simpleTags.add(tag.value)
				}
			})
		})

		return {
			categories: [...categories].sort(),
			models: [...models].sort(),
			channels: [...channels].sort(),
			productions: [...productions].sort(),
			simpleTags: [...simpleTags].sort()
		}
	}, [videos])

	// Handles changes to the active filter
	const handleFilterChange = (category: FilterCategory, value: string | undefined): void => {
		setActiveFilters(() => {
			if (!value) {
				// If value is undefined, it means the filter is being cleared
				return null
			}
			// Set the new active filter
			return { category, value }
		})
	}

	// Clears any active filter
	const handleClearFilters = (): void => {
		setActiveFilters(null)
	}

	// useMemo to compute the list of videos to display based on the active filter
	// This is recalculated only when the 'videos' or 'activeFilters' change
	const filteredVideos = useMemo(() => {
		if (!activeFilters) {
			return videos // No filter active, return all videos
		}

		return videos.filter((video) => {
			const { category, value } = activeFilters

			if (category === 'simpleTag') {
				return video.tags.some((t) => t.type === 'simple' && t.value === value)
			} else {
				return video.tags.some(
					(t) => t.type === 'kv' && t.key === category && t.value === value
				)
			}
		})
	}, [videos, activeFilters])

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
				<h1 style={{ color: 'var(--color-text)', margin: 0, fontSize: '1.2rem' }}>
					Video Catalog
				</h1>

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
					{loading ? 'Scanning...' : '📂 Select Video Folder'}
				</button>
			</header>

			{/* --- MAIN CONTENT --- */}
			<div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
				<Sidebar
					filterOptions={filterOptions}
					activeFilters={activeFilters}
					onFilterChange={handleFilterChange}
					onClearFilters={handleClearFilters}
				/>

				<main
					style={{
						flex: 1,
						overflowY: 'auto',
						padding: '20px'
					}}
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
							<VideoCard key={vid.id} video={vid} onEdit={() => setEditingVideo(vid)} />
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
				</main>
			</div>

			{/* --- MODAL --- */}
			{/* Render the edit modal only when a video is selected for editing */}
			{editingVideo && (
				<EditModal
					video={editingVideo}
					onClose={() => setEditingVideo(null)}
					onSave={saveTags}
					onDelete={handleDeleteVideo}
				/>
			)}
		</div>
	)
}

export default App
