import React, { useState, useMemo } from 'react'
import { ParsedTag } from 'src/shared/types/metadata'
import { VideoFile } from 'src/shared/types/video'
import EditModal from './components/EditModal'
import VideoCard from './components/VideoCard'
import Sidebar from './components/Sidebar'
import { ActiveFilters, FilterCategory } from '@shared/types/filter'

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
	// State for the currently active filters. Supports multiple filters per category
	const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
		category: [],
		model: [],
		channel: [],
		production: [],
		simpleTag: []
	})
	// State for global multi-select mode
	const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)

	// Handles the folder selection and video loading process
	const handleScan = async (): Promise<void> => {
		const folder = await window.api.selectFolder()
		if (folder) {
			setCurrentFolder(folder)
			setLoading(true)
			setVideos([]) // Clear previous videos
			try {
				// Always scan the directory - it will use library.json metadata when available
				// and scan new files normally
				console.log('Scanning directory...')
				const results = await window.api.scanVideos(folder)
				setVideos(results)
				// Save the results to the cache
				await window.api.saveLibrary(folder, results)
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
			categories: Array.from(categories).sort(),
			models: Array.from(models).sort(),
			channels: Array.from(channels).sort(),
			productions: Array.from(productions).sort(),
			simpleTags: Array.from(simpleTags).sort()
		}
	}, [videos])

	// Handles changes to the active filter (single select mode - only one filter total)
	const handleFilterChange = (category: FilterCategory, value: string | undefined): void => {
		if (!value) {
			// If value is undefined, clear all filters
			setActiveFilters({
				category: [],
				model: [],
				channel: [],
				production: [],
				simpleTag: []
			})
		} else {
			// Single select: clear all categories and set only this one
			setActiveFilters({
				category: [],
				model: [],
				channel: [],
				production: [],
				simpleTag: [],
				[category]: [value]
			})
		}
	}

	// Handles multi-select filter changes
	const handleMultiSelectChange = (
		category: FilterCategory,
		option: string,
		isSelected: boolean
	): void => {
		setActiveFilters((prev) => {
			const newFilters = { ...prev }
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
		setActiveFilters({
			category: [],
			model: [],
			channel: [],
			production: [],
			simpleTag: []
		})
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
			for (const [category, values] of Object.entries(activeFilters) as [
				FilterCategory,
				string[]
			][]) {
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
					isMultiSelectMode={isMultiSelectMode}
					onFilterChange={handleFilterChange}
					onMultiSelectChange={handleMultiSelectChange}
					onClearFilters={handleClearFilters}
					onToggleMultiSelect={() => setIsMultiSelectMode(!isMultiSelectMode)}
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
