import React, { useState, useMemo } from 'react'
import { ParsedTag } from 'src/shared/types/metadata'
import { VideoFile } from 'src/shared/types/video'

// Type declaration to inform TypeScript about the 'api' object exposed by the preload script
// This provides type safety and autocompletion when using window.api
declare global {
	interface Window {
		api: {
			selectFolder: () => Promise<string | null>
			scanVideos: (path: string) => Promise<VideoFile[]>
			openVideo: (path: string) => void
			updateTags: (filePath: string, tags: ParsedTag[]) => Promise<void>
			loadLibrary: (folderPath: string) => Promise<VideoFile[] | null>
			saveLibrary: (folderPath: string, videos: VideoFile[]) => Promise<void>
			deleteVideoEntry: (folderPath: string, videoId: string) => Promise<void>
		}
	}
}

/** --- COMPONENT: InfoRow ---
 *  A simple presentational component to display a label and a value in the edit modal
 *  It doesn't render anything if the value is not provided
 *  @param label The label to display for the information
 *  @param value The value to display
 */
function InfoRow({ label, value }: { label: string; value?: string }): React.ReactElement | null {
	if (!value) return null
	return (
		<div
			style={{
				display: 'flex',
				justifyContent: 'space-between',
				padding: '8px 0',
				borderBottom: '1px solid var(--color-background-mute)'
			}}
		>
			<span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{label}</span>
			<span style={{ color: 'var(--color-text-soft)' }}>{value}</span>
		</div>
	)
}

/** --- COMPONENT: EditModal ---
 *  The modal component for viewing details and editing a video's tags
 *  @param video The VideoFile object being edited
 *  @param onClose A function to call when the modal should be closed
 *  @param onSave A function to call when the user saves changes; receives the new array of tags
 *  @param currentFolder The path of the currently open folder, needed for deletion
 *  @param onDelete A function to call after a video has been successfully deleted
 */
function EditModal({
	video,
	onClose,
	onSave,
	currentFolder,
	onDelete
}: {
	video: VideoFile
	onClose: () => void
	onSave: (tags: ParsedTag[]) => void
	currentFolder: string | null
	onDelete: (videoId: string) => void
}): React.ReactElement {
	// State to manage the tags being edited
	const [tags, setTags] = useState<ParsedTag[]>(video.tags)
	// State for the new tag input field
	const [inputValue, setInputValue] = useState('')
	// State to track the saving process
	const [isSaving, setIsSaving] = useState(false)
	// State to track the deletion process
	const [isDeleting, setIsDeleting] = useState(false)

	// Handles the submission of the "Add Tag" form
	const handleAddTag = (e: React.FormEvent): void => {
		e.preventDefault()
		if (!inputValue.trim()) return

		// Automatically parses "key:value" strings into key-value tags
		let newTag: ParsedTag
		if (inputValue.includes(':')) {
			const [key, ...val] = inputValue.split(':')
			newTag = {
				type: 'kv',
				key: key.trim().toLowerCase(),
				value: val.join(':').trim(),
				original: inputValue
			}
		} else {
			newTag = { type: 'simple', value: inputValue.trim(), original: inputValue }
		}

		setTags([...tags, newTag])
		setInputValue('') // Clear the input field
	}

	// Removes a tag from the state
	const removeTag = (index: number): void => {
		setTags(tags.filter((_, i) => i !== index))
	}

	// Handles the "Save Changes" button click
	const handleSaveClick = async (): Promise<void> => {
		setIsSaving(true)
		await onSave(tags)
		setIsSaving(false)
		onClose()
	}

	// Handles the "Delete" button click
	const handleDeleteClick = async (): Promise<void> => {
		if (!window.confirm('Are you sure you want to delete this video and all its files?')) {
			return
		}
		setIsDeleting(true)
		try {
			if (currentFolder) {
				// Call the main process API to delete the entry
				await window.api.deleteVideoEntry(currentFolder, video.id)
				onDelete(video.id) // Inform the parent component to update its state
				onClose()
			} else {
				console.error('Current folder is not set, cannot delete video.')
			}
		} catch (error) {
			console.error('Error deleting video:', error)
			alert('Error deleting video.')
		} finally {
			setIsDeleting(false)
		}
	}

	// Find specific key-value tags for display in the info section
	const categoryTag = tags.find((t) => t.type === 'kv' && t.key === 'category')
	const modelTag = tags.find((t) => t.type === 'kv' && t.key === 'model')
	const channelTag = tags.find((t) => t.type === 'kv' && t.key === 'channel')
	const productionTag = tags.find((t) => t.type === 'kv' && t.key === 'production')

	return (
		<div
			style={{
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				backgroundColor: 'rgba(0,0,0,0.5)',
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				zIndex: 1000
			}}
		>
			<div
				style={{
					backgroundColor: 'var(--color-background-soft)',
					padding: '25px',
					borderRadius: '12px',
					width: '600px',
					maxWidth: '95%',
					boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
				}}
			>
				{/* Thumbnail */}
				<div
					style={{
						width: '100%',
						height: '250px',
						backgroundColor: 'var(--color-background-mute)',
						borderRadius: '8px',
						overflow: 'hidden',
						marginBottom: '15px'
					}}
				>
					{video.thumbnailPath ? (
						<img
							// Use the custom 'media://' protocol to load the local thumbnail file
							src={`media:///${video.thumbnailPath.replace(/\\/g, '/')}`}
							alt="thumbnail"
							style={{ width: '100%', height: '100%', objectFit: 'cover' }}
						/>
					) : (
						<div
							style={{
								width: '100%',
								height: '100%',
								display: 'flex',
								justifyContent: 'center',
								alignItems: 'center'
							}}
						>
							<span style={{ fontSize: '3rem' }}>🎬</span>
						</div>
					)}
				</div>

				{/* Title */}
				<h2
					style={{
						marginTop: 0,
						color: 'var(--color-text)',
						fontSize: '1.4rem',
						whiteSpace: 'nowrap',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						marginBottom: '20px',
						textAlign: 'center'
					}}
					title={video.fileName}
				>
					{video.fileName}
				</h2>

				{/* Info Section */}
				<div style={{ marginBottom: '25px' }}>
					<InfoRow label="Category" value={categoryTag?.value} />
					<InfoRow label="Model" value={modelTag?.value} />
					<InfoRow label="Channel" value={channelTag?.value} />
					<InfoRow label="Production" value={productionTag?.value} />
				</div>

				{/* Tag Editor */}
				<div>
					<h4 style={{ marginTop: 0, marginBottom: '10px', color: 'var(--color-text)' }}>
						Tags
					</h4>
					<div
						style={{
							display: 'flex',
							flexWrap: 'wrap',
							gap: '8px',
							marginBottom: '20px',
							minHeight: '40px',
							padding: '10px',
							background: 'var(--color-background-soft)',
							borderRadius: '6px',
							border: '1px solid var(--color-background-mute)'
						}}
					>
						{tags.map((t, i) => (
							<span
								key={i}
								style={{
									background:
										t.type === 'kv'
											? 'var(--color-primary-light)'
											: 'var(--color-background-mute)',
									color:
										t.type === 'kv' ? 'var(--color-primary-dark)' : 'var(--color-text)',
									padding: '5px 12px',
									borderRadius: '16px',
									fontSize: '0.8rem',
									fontWeight: 500,
									display: 'flex',
									alignItems: 'center',
									height: 'fit-content'
								}}
							>
								{t.type === 'kv' ? (
									<span>
										<strong style={{ opacity: 0.75 }}>{t.key}:</strong> {t.value}
									</span>
								) : (
									t.value
								)}
								<button
									onClick={() => removeTag(i)}
									style={{
										marginLeft: '8px',
										border: 'none',
										background: 'transparent',
										cursor: 'pointer',
										fontWeight: 'bold',
										color: 'var(--color-text-mute)',
										padding: '0 4px'
									}}
								>
									×
								</button>
							</span>
						))}
						{tags.length === 0 && (
							<span style={{ color: 'var(--color-text-mute)', fontStyle: 'italic' }}>
								No tags
							</span>
						)}
					</div>
					<form onSubmit={handleAddTag} style={{ display: 'flex', gap: '10px' }}>
						<input
							type="text"
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							placeholder="Ex: holidays or category:nature"
							style={{
								flex: 1,
								padding: '10px',
								borderRadius: '6px',
								border: '1px solid var(--color-background-mute)',
								fontSize: '0.95rem'
							}}
						/>
						<button
							type="submit"
							style={{
								padding: '10px 20px',
								background: 'var(--color-primary)',
								color: 'white',
								border: 'none',
								borderRadius: '6px',
								cursor: 'pointer',
								fontWeight: 600
							}}
						>
							Add
						</button>
					</form>
				</div>

				{/* Action Buttons */}
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						gap: '10px',
						borderTop: '1px solid var(--color-background-mute)',
						paddingTop: '15px',
						marginTop: '25px'
					}}
				>
					{/* Play Button */}
					<button
						onClick={() => window.api.openVideo(video.filePath)}
						style={{
							padding: '10px 20px',
							background: 'transparent',
							color: 'var(--color-text)',
							border: '1px solid var(--color-background-mute)',
							borderRadius: '6px',
							cursor: 'pointer',
							fontWeight: 600
						}}
					>
						▶ Play
					</button>
					<div style={{ display: 'flex', gap: '10px' }}>
						{/* Delete Button */}
						<button
							onClick={handleDeleteClick}
							disabled={isDeleting || isSaving}
							style={{
								padding: '10px 20px',
								background: isDeleting ? '#e57373' : '#f44336',
								color: 'white',
								border: 'none',
								borderRadius: '6px',
								cursor: isDeleting || isSaving ? 'not-allowed' : 'pointer',
								fontWeight: 600,
								marginRight: '10px'
							}}
						>
							{isDeleting ? 'Deleting...' : 'Delete'}
						</button>
						{/* Cancel Button */}
						<button
							onClick={onClose}
							disabled={isSaving || isDeleting}
							style={{
								padding: '10px 20px',
								background: 'transparent',
								border: '1px solid var(--color-background-mute)',
								borderRadius: '6px',
								cursor: 'pointer',
								color: 'var(--color-text-soft)'
							}}
						>
							Cancel
						</button>
						{/* Save Button */}
						<button
							onClick={handleSaveClick}
							disabled={isSaving || isDeleting}
							style={{
								padding: '10px 20px',
								background: isSaving
									? 'var(--color-text-mute)'
									: 'var(--color-primary-dark)',
								color: 'white',
								border: 'none',
								borderRadius: '6px',
								cursor: isSaving || isDeleting ? 'not-allowed' : 'pointer',
								fontWeight: 600
							}}
						>
							{isSaving ? 'Saving...' : 'Save Changes'}
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}

/** --- COMPONENT: VideoCard ---
 *  A component to display a single video in the main grid
 *  Shows a thumbnail, title, and key tags
 *  @param video The VideoFile object to display
 *  @param onEdit A function to call when the card is clicked, to open the edit modal
 */
function VideoCard({
	video,
	onEdit
}: {
	video: VideoFile
	onEdit: () => void
}): React.ReactElement {
	// Find specific tags to highlight on the card
	const categoryTag = video.tags.find((t) => t.type === 'kv' && t.key === 'category')
	const channelTag = video.tags.find((t) => t.type === 'kv' && t.key === 'channel')
	const modelTag = video.tags.find((t) => t.type === 'kv' && t.key === 'model')
	const secondaryTag = channelTag || modelTag

	return (
		<div
			onClick={onEdit}
			style={{
				width: '200px',
				height: '180px',
				border: '1px solid var(--color-background-mute)',
				backgroundColor: 'var(--color-background-soft)',
				borderRadius: '8px',
				boxShadow: '0 4px 6px rgba(0, 0, 0, 0.04)',
				cursor: 'pointer',
				transition: 'all 0.2s ease-in-out',
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden'
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.boxShadow =
					'0 7px 14px rgba(0, 0, 0, 0.07), 0 3px 6px rgba(0, 0, 0, 0.07)'
				e.currentTarget.style.transform = 'translateY(-2px)'
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.04)'
				e.currentTarget.style.transform = 'translateY(0)'
			}}
		>
			{/* Thumbnail */}
			<div
				style={{
					width: '100%',
					height: '100px',
					backgroundColor: 'var(--color-background-mute)',
					overflow: 'hidden'
				}}
			>
				{video.thumbnailPath ? (
					<img
						src={`media:///${video.thumbnailPath.replace(/\\/g, '/')}`}
						alt="thumbnail"
						style={{
							width: '100%',
							height: '100%',
							objectFit: 'cover'
						}}
						onError={(e) => {
							// Fallback if the thumbnail image fails to load
							console.error('Loading error:', video.thumbnailPath)
							e.currentTarget.style.display = 'none'
						}}
					/>
				) : (
					<div
						style={{
							width: '100%',
							height: '100%',
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center'
						}}
					>
						<span style={{ fontSize: '2.5rem' }}>🎬</span>
					</div>
				)}
			</div>

			{/* Content */}
			<div
				style={{
					flex: 1,
					padding: '12px',
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between',
					minHeight: 0
				}}
			>
				{/* Key Tags */}
				<div>
					{categoryTag && (
						<span
							style={{
								color: 'var(--color-text-mute)',
								fontSize: '0.75rem',
								display: 'block',
								fontWeight: 500
							}}
						>
							{categoryTag.key}: {categoryTag.value}
						</span>
					)}
					{secondaryTag && (
						<span
							style={{
								color: 'var(--color-text-mute)',
								fontSize: '0.75rem',
								display: 'block',
								fontWeight: 500
							}}
						>
							{secondaryTag.key}: {secondaryTag.value}
						</span>
					)}
				</div>

				{/* Title */}
				<h3
					style={{
						margin: 0,
						fontSize: '0.9rem',
						color: 'var(--color-text)',
						whiteSpace: 'nowrap',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						lineHeight: 1.3
					}}
					title={video.fileName}
				>
					{video.fileName}
				</h3>
			</div>
		</div>
	)
}

// Define the types for filter categories
type FilterCategory = 'category' | 'model' | 'channel' | 'production' | 'simpleTag'
type ActiveFilter = {
	category: FilterCategory
	value: string
}

/** --- COMPONENT: FilterSection ---
 *  A collapsible UI component for displaying filter options for a single category (e.g., "Category")
 *  @param title The title of the filter section
 *  @param options An array of strings representing the available filter values
 *  @param active The currently active filter value in this section, if any
 *  @param onSelect A callback function called when a user selects or deselects an option
 */
function FilterSection({
	title,
	options,
	active,
	onSelect
}: {
	title: string
	options: string[]
	active?: string
	onSelect: (option: string | undefined) => void
}): React.ReactElement {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<div style={{ marginBottom: '10px' }}>
			<button
				onClick={() => setIsOpen(!isOpen)}
				style={{
					width: '100%',
					textAlign: 'left',
					background: 'none',
					border: 'none',
					fontSize: '1rem',
					fontWeight: 600,
					padding: '10px 0',
					cursor: 'pointer',
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center'
				}}
			>
				<span>{title}</span>
				<span>{isOpen ? '−' : '+'}</span>
			</button>
			{isOpen && (
				<div
					style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '5px' }}
				>
					{options.map((opt) => (
						<button
							key={opt}
							onClick={() => onSelect(active === opt ? undefined : opt)}
							style={{
								textAlign: 'left',
								background: active === opt ? 'var(--color-primary-light)' : 'transparent',
								border: 'none',
								padding: '6px 10px',
								borderRadius: '4px',
								cursor: 'pointer',
								color: active === opt ? 'var(--color-primary-dark)' : 'var(--color-text)',
								fontWeight: active === opt ? 600 : 400
							}}
						>
							{opt}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

/** --- COMPONENT: Sidebar ---
 *  The main sidebar component that holds all the filter sections
 *  @param filterOptions An object containing arrays of all available options for each category
 *  @param activeFilters The currently active filter
 *  @param onFilterChange A callback to update the active filter
 *  @param onClearFilters A callback to clear all active filters
 */
function Sidebar({
	filterOptions,
	activeFilters,
	onFilterChange,
	onClearFilters
}: {
	filterOptions: {
		categories: string[]
		models: string[]
		channels: string[]
		productions: string[]
		simpleTags: string[]
	}
	activeFilters: ActiveFilter | null
	onFilterChange: (category: FilterCategory, value: string | undefined) => void
	onClearFilters: () => void
}): React.ReactElement {
	return (
		<div
			style={{
				width: '240px',
				flexShrink: 0,
				borderRight: '1px solid var(--color-background-mute)',
				padding: '20px',
				overflowY: 'auto',
				background: 'var(--color-background-soft)'
			}}
		>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					marginBottom: '15px'
				}}
			>
				<h2 style={{ margin: 0, fontSize: '1.2rem' }}>Filters</h2>
				<button
					onClick={onClearFilters}
					style={{
						background: 'none',
						border: 'none',
						color: 'var(--color-text-mute)',
						cursor: 'pointer',
						fontSize: '0.8rem'
					}}
				>
					Clear
				</button>
			</div>

			<FilterSection
				title="Category"
				options={filterOptions.categories}
				active={activeFilters?.category === 'category' ? activeFilters.value : undefined}
				onSelect={(val) => onFilterChange('category', val)}
			/>
			<FilterSection
				title="Model"
				options={filterOptions.models}
				active={activeFilters?.category === 'model' ? activeFilters.value : undefined}
				onSelect={(val) => onFilterChange('model', val)}
			/>
			<FilterSection
				title="Channel"
				options={filterOptions.channels}
				active={activeFilters?.category === 'channel' ? activeFilters.value : undefined}
				onSelect={(val) => onFilterChange('channel', val)}
			/>
			<FilterSection
				title="Production"
				options={filterOptions.productions}
				active={activeFilters?.category === 'production' ? activeFilters.value : undefined}
				onSelect={(val) => onFilterChange('production', val)}
			/>
			<FilterSection
				title="Tags"
				options={filterOptions.simpleTags}
				active={activeFilters?.category === 'simpleTag' ? activeFilters.value : undefined}
				onSelect={(val) => onFilterChange('simpleTag', val)}
			/>
		</div>
	)
}

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

	// Removes a video from the local state after it has been deleted
	const handleDeleteVideo = (videoId: string): void => {
		setVideos((prevVideos) => prevVideos.filter((video) => video.id !== videoId))
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
					currentFolder={currentFolder}
					onDelete={handleDeleteVideo}
				/>
			)}
		</div>
	)
}

export default App
