import React, { useState, useMemo, useRef, useEffect } from 'react'
import { ParsedTag } from '@shared/types/metadata'
import { VideoFile } from '@shared/types/video'
import { Library } from '@shared/types/library'
import InfoRow from '../InfoRow'
import { ClickableValues } from '../ClickableValues'
import { sanitizeFileName } from '../../utils/sanitizeFileName'
import { formatDuration, formatFileSize } from '../../utils/formatters'
import { mediaUrl } from '../../utils/mediaUrl'

/** --- COMPONENT: VideoDetailView ---
 *  Full-screen detail view for viewing and editing a video's tags
 *  @param video The VideoFile object being viewed
 *  @param library The Library object containing categories and tags for autocomplete
 *  @param onBack A function to call when the back button is clicked
 *  @param onSave A function to call when the user saves changes; receives the new array of tags
 *  @param onDelete A function to call when the user deletes the video
 *  @param onFilterClick A function to call when a filterable name is clicked (category, value, and whether Ctrl/Cmd was held to open it in the background)
 *  @param isInSession Whether the video is in the session collection
 *  @param onToggleSession A function to call to add the video to the session collection or remove it
 *  @param onRename A function to call to rename the file (new name without extension); resolves to
 *  an error message to show, or null once renamed
 *  @param onPrevious Shows the previous video of the list; missing on the first one
 *  @param onNext Shows the next video of the list; missing on the last one
 *  @param position The video's place in the list (1-based) and the list's length
 *  @param onSetThumbnail Makes the frame at the given time the video's thumbnail; resolves to an error
 *  message to show, or null once done
 */
function VideoDetailView({
	video,
	library,
	onBack,
	onSave,
	onDelete,
	onFilterClick,
	isInSession,
	onToggleSession,
	onRename,
	onSetThumbnail,
	onPrevious,
	onNext,
	position
}: {
	video: VideoFile
	library: Library | null
	onBack: () => void
	onSave: (tags: ParsedTag[], favourited: boolean) => Promise<boolean>
	onDelete: (video: VideoFile) => void
	onFilterClick: (category: string, value: string, inBackground?: boolean) => void
	isInSession: boolean
	onToggleSession: () => void
	onRename: (newBaseName: string) => Promise<string | null>
	onSetThumbnail: (seconds: number) => Promise<string | null>
	onPrevious?: () => void
	onNext?: () => void
	position?: { index: number; total: number }
}): React.ReactElement {
	// State to manage the tags being edited
	const [tags, setTags] = useState<ParsedTag[]>(video.tags)
	const [isFavorited, setIsFavorited] = useState<boolean>(video.favourited)
	// State for the new tag input field
	const [inputValue, setInputValue] = useState('')
	// State to track the saving process
	const [isSaving, setIsSaving] = useState(false)
	// State to track the deleting process
	const [isDeleting, setIsDeleting] = useState(false)
	// State for autocomplete suggestions
	const [showSuggestions, setShowSuggestions] = useState(false)
	const [selectedIndex, setSelectedIndex] = useState(0)
	const inputRef = useRef<HTMLInputElement>(null)
	const suggestionsRef = useRef<HTMLDivElement>(null)
	// State for renaming the file
	const [isRenaming, setIsRenaming] = useState(false)
	const [nameDraft, setNameDraft] = useState('')
	const [renameError, setRenameError] = useState<string | null>(null)
	const [isRenameSaving, setIsRenameSaving] = useState(false)
	// State for choosing the thumbnail's frame (videos only)
	const [isChoosingFrame, setIsChoosingFrame] = useState(false)
	const [frameTime, setFrameTime] = useState(0)
	const [framePreview, setFramePreview] = useState<string | null>(null)
	const [frameError, setFrameError] = useState<string | null>(null)
	const [isFrameSaving, setIsFrameSaving] = useState(false)
	const duration = video.duration ?? 0
	const canChooseFrame = video.mediaType === 'video' && duration > 0

	// While choosing a thumbnail, a preview of the frame at the slider's time, asked for once the slider
	// rests for a moment (each preview runs FFmpeg)
	useEffect(() => {
		if (!isChoosingFrame) return undefined
		let cancelled = false
		const timer = setTimeout(() => {
			window.api.previewFrame(video.filePath, frameTime).then(
				(url) => {
					if (cancelled) return
					setFramePreview(url)
					setFrameError(null)
				},
				() => {
					if (!cancelled) setFrameError('This frame could not be read.')
				}
			)
		}, 250)
		return () => {
			cancelled = true
			clearTimeout(timer)
		}
	}, [isChoosingFrame, frameTime, video.filePath])

	const startChoosingFrame = (): void => {
		// Where thumbnails are taken by default
		setFrameTime(duration * 0.2)
		setFramePreview(null)
		setFrameError(null)
		setIsChoosingFrame(true)
	}

	const saveFrame = async (): Promise<void> => {
		if (isFrameSaving) return
		setIsFrameSaving(true)
		const error = await onSetThumbnail(frameTime)
		setIsFrameSaving(false)
		if (error) {
			setFrameError(error)
			return
		}
		setIsChoosingFrame(false)
	}

	// The tag editor starts over from the saved tags whenever they change (after a save, or when
	// another video is shown). Compared during render, React's pattern for state that follows a prop,
	// and on the tags and favourite only: a rename replaces `video` but keeps them, so tag edits that
	// are not saved yet stay
	const [editorSource, setEditorSource] = useState({
		tags: video.tags,
		favourited: video.favourited
	})
	if (editorSource.tags !== video.tags || editorSource.favourited !== video.favourited) {
		setEditorSource({ tags: video.tags, favourited: video.favourited })
		setTags(video.tags)
		setIsFavorited(video.favourited)
	}

	// The file's extension stays as it is; only the name before it can be renamed
	const extensionIndex = video.fileName.lastIndexOf('.')
	const extension = extensionIndex > 0 ? video.fileName.slice(extensionIndex) : ''
	const baseName = video.fileName.slice(0, video.fileName.length - extension.length)

	const startRenaming = (): void => {
		setNameDraft(baseName)
		setRenameError(null)
		setIsRenaming(true)
	}

	const cancelRenaming = (): void => {
		setIsRenaming(false)
		setRenameError(null)
	}

	const saveRename = async (): Promise<void> => {
		if (isRenameSaving) return
		setIsRenameSaving(true)
		const error = await onRename(nameDraft)
		setIsRenameSaving(false)
		if (error) {
			setRenameError(error)
			return
		}
		setIsRenaming(false)
	}

	// Generate autocomplete suggestions based on input value
	const suggestions = useMemo(() => {
		if (!inputValue.trim() || !library) return []

		const query = inputValue.trim().toLowerCase()
		const results: Array<{ display: string; value: string; type: 'category' | 'tag' }> = []

		// Check if input contains a colon (key:value format)
		if (query.includes(':')) {
			const [keyPart, ...valueParts] = query.split(':')
			const key = keyPart.trim()
			const valueQuery = valueParts.join(':').trim().toLowerCase()

			// If we have a category key, suggest values for that category
			if (library.categories[key] && valueQuery) {
				library.categories[key]
					.filter((val) => val.toLowerCase().startsWith(valueQuery))
					.forEach((val) => {
						results.push({
							display: `${key}:${val}`,
							value: `${key}:${val}`,
							type: 'category'
						})
					})
			} else if (key && !valueQuery) {
				// If we have a key but no value query, suggest the key with available values
				if (library.categories[key]) {
					library.categories[key].forEach((val) => {
						results.push({
							display: `${key}:${val}`,
							value: `${key}:${val}`,
							type: 'category'
						})
					})
				}
			}
		} else {
			// No colon - suggest both category keys and simple tags
			// Suggest category keys that start with the query
			Object.keys(library.categories)
				.filter((key) => key.toLowerCase().startsWith(query))
				.forEach((key) => {
					// Show first few values for this category
					const values = library.categories[key].slice(0, 3)
					values.forEach((val) => {
						results.push({
							display: `${key}:${val}`,
							value: `${key}:${val}`,
							type: 'category'
						})
					})
				})

			// Suggest simple tags that start with the query
			library.tags
				.filter((tag) => tag.toLowerCase().startsWith(query))
				.forEach((tag) => {
					results.push({
						display: tag,
						value: tag,
						type: 'tag'
					})
				})
		}

		return results.slice(0, 10) // Limit to 10 suggestions
	}, [inputValue, library])

	// Handle input change
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
		setInputValue(e.target.value)
		setShowSuggestions(true)
		setSelectedIndex(0)
	}

	// Handle selecting a suggestion
	const selectSuggestion = (suggestion: { display: string; value: string }): void => {
		setInputValue(suggestion.value)
		setShowSuggestions(false)
		setSelectedIndex(0)
		inputRef.current?.focus()
	}

	const buildTagFromValue = (rawValue: string): ParsedTag => {
		const trimmed = rawValue.trim()
		if (trimmed.includes(':')) {
			const [key, ...val] = trimmed.split(':')
			return {
				type: 'kv',
				key: key.trim().toLowerCase(),
				value: val.join(':').trim(),
				original: trimmed
			}
		}
		return { type: 'simple', value: trimmed, original: trimmed }
	}

	const addTagFromValue = (rawValue: string): void => {
		if (!rawValue.trim()) return
		if (rawValue.trim().toLowerCase() === 'fav') {
			setIsFavorited(true)
			void onSave(tags, true)
			setInputValue('')
			setShowSuggestions(false)
			setSelectedIndex(0)
			return
		}
		const newTag = buildTagFromValue(rawValue)
		setTags([...tags, newTag])
		setInputValue('')
		setShowSuggestions(false)
		setSelectedIndex(0)
	}

	// Handle keyboard navigation in suggestions
	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
		if (!showSuggestions || suggestions.length === 0) {
			if (e.key === 'Enter') {
				handleAddTag(e)
			}
			return
		}

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault()
				setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
				break
			case 'ArrowUp':
				e.preventDefault()
				setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0))
				break
			case 'Enter':
				e.preventDefault()
				if (suggestions[selectedIndex]) {
					addTagFromValue(suggestions[selectedIndex].value)
				} else {
					handleAddTag(e)
				}
				break
			case 'Escape':
				setShowSuggestions(false)
				break
		}
	}

	// Handles the submission of the "Add Tag" form
	const handleAddTag = (e: React.FormEvent | React.KeyboardEvent): void => {
		e.preventDefault()
		addTagFromValue(inputValue)
	}

	// Close suggestions when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent): void => {
			if (
				suggestionsRef.current &&
				!suggestionsRef.current.contains(event.target as Node) &&
				inputRef.current &&
				!inputRef.current.contains(event.target as Node)
			) {
				setShowSuggestions(false)
			}
		}

		if (showSuggestions) {
			document.addEventListener('mousedown', handleClickOutside)
			return () => {
				document.removeEventListener('mousedown', handleClickOutside)
			}
		}
		return undefined
	}, [showSuggestions])

	// Removes a tag from the state
	const removeTag = (index: number): void => {
		setTags(tags.filter((_, i) => i !== index))
	}

	// Handles the "Save Changes" button click
	const handleSaveClick = async (): Promise<void> => {
		setIsSaving(true)
		const success = await onSave(tags, isFavorited)
		setIsSaving(false)
		if (success) {
			onBack()
		}
	}

	// Handles the "Delete Video" button click
	const handleDeleteClick = async (): Promise<void> => {
		const confirmed = window.confirm(
			`Are you sure you want to delete "${video.fileName}"? This action cannot be undone.`
		)
		if (confirmed) {
			setIsDeleting(true)
			await onDelete(video)
			setIsDeleting(false)
			onBack()
		}
	}

	// Find all key-value tags for each category and combine their values
	const getCategoryValues = (
		key: string
	): Array<{ value: string; onClick: (event: React.MouseEvent) => void }> => {
		const matchingTags = tags.filter((t) => t.type === 'kv' && t.key === key)
		return matchingTags.map((tag) => ({
			value: tag.value,
			onClick: (event: React.MouseEvent) =>
				onFilterClick(key, tag.value, event.ctrlKey || event.metaKey)
		}))
	}

	const categoryValues = getCategoryValues('category')
	const modelValues = getCategoryValues('model')
	const channelValues = getCategoryValues('channel')
	const productionValues = getCategoryValues('production')
	const visibleTags = tags

	const toggleFavoriteTag = async (): Promise<void> => {
		const nextFavorited = !isFavorited
		setIsFavorited(nextFavorited)
		await onSave(tags, nextFavorited)
	}

	// Keyboard shortcuts: ← → previous/next, F favourite, P session, R rename, Esc back. Ignored while
	// typing in a field (the rename and tag fields handle their own Enter and Escape) or with a
	// modifier held. Subscribed on every render, so they always use the current handlers
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.ctrlKey || event.metaKey || event.altKey) return
			const target = event.target as HTMLElement | null
			if (
				target &&
				(['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
			) {
				return
			}
			switch (event.key) {
				case 'ArrowLeft':
					onPrevious?.()
					break
				case 'ArrowRight':
					onNext?.()
					break
				case 'f':
				case 'F':
					void toggleFavoriteTag()
					break
				case 'p':
				case 'P':
					onToggleSession()
					break
				case 'r':
				case 'R':
					if (!isRenaming) startRenaming()
					break
				case 'Escape':
					if (!isRenaming) onBack()
					break
				default:
					return
			}
			event.preventDefault()
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	})

	return (
		<div
			style={{
				height: '100vh',
				display: 'flex',
				flexDirection: 'column',
				fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
				backgroundColor: 'var(--color-background)',
				overflow: 'hidden'
			}}
		>
			{/* Header with back button */}
			<header
				style={{
					padding: '15px 25px',
					backgroundColor: 'var(--color-background-soft)',
					borderBottom: '1px solid var(--ev-c-gray-300)',
					zIndex: 10,
					boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
					flexShrink: 0,
					display: 'flex',
					alignItems: 'center',
					gap: '15px'
				}}
			>
				<button
					onClick={onBack}
					style={{
						padding: '8px 12px',
						backgroundColor: 'transparent',
						border: '1px solid var(--color-background-mute)',
						borderRadius: '6px',
						cursor: 'pointer',
						color: 'var(--color-text)',
						fontSize: '1rem',
						display: 'flex',
						alignItems: 'center',
						gap: '8px'
					}}
				>
					← Back
				</button>
				<h1 style={{ color: 'var(--color-text)', margin: 0, fontSize: '1.2rem' }}>VidBase</h1>
				{position && (
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<button
							onClick={onPrevious}
							disabled={!onPrevious}
							title="Previous (←)"
							aria-label="Previous"
							style={{
								padding: '6px 12px',
								backgroundColor: 'transparent',
								border: '1px solid var(--color-background-mute)',
								borderRadius: '6px',
								cursor: onPrevious ? 'pointer' : 'default',
								color: 'var(--color-text)',
								opacity: onPrevious ? 1 : 0.4
							}}
						>
							‹
						</button>
						<span style={{ color: 'var(--color-text-mute)', fontSize: '0.9rem' }}>
							{position.index} / {position.total}
						</span>
						<button
							onClick={onNext}
							disabled={!onNext}
							title="Next (→)"
							aria-label="Next"
							style={{
								padding: '6px 12px',
								backgroundColor: 'transparent',
								border: '1px solid var(--color-background-mute)',
								borderRadius: '6px',
								cursor: onNext ? 'pointer' : 'default',
								color: 'var(--color-text)',
								opacity: onNext ? 1 : 0.4
							}}
						>
							›
						</button>
					</div>
				)}
				<span
					style={{ marginLeft: 'auto', color: 'var(--color-text-mute)', fontSize: '0.8rem' }}
				>
					← → browse · F favourite · P session · R rename · Esc back
				</span>
			</header>

			{/* Main content */}
			<div
				style={{
					flex: 1,
					overflowY: 'auto',
					display: 'flex',
					padding: '40px',
					gap: '40px',
					justifyContent: 'center'
				}}
			>
				{/* Left side - Media */}
				<div
					style={{
						flex: '0 0 400px',
						display: 'flex',
						flexDirection: 'column',
						gap: '20px'
					}}
				>
					{/* Thumbnail or Image */}
					<div
						style={{
							width: '100%',
							aspectRatio: '16/9',
							backgroundColor: 'var(--color-background-mute)',
							borderRadius: '8px',
							overflow: 'hidden',
							position: 'relative'
						}}
					>
						<button
							onClick={toggleFavoriteTag}
							style={{
								position: 'absolute',
								top: '15px',
								right: '15px',
								zIndex: 2,
								width: '25px',
								height: '25px',
								padding: 0,
								border: 'none',
								borderRadius: '0',
								backgroundColor: 'transparent',
								color: isFavorited ? '#f5c542' : 'white',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								cursor: 'pointer',
								boxShadow: 'none',
								fontSize: '40px',
								transform: 'translate(4px, -4px)',
								lineHeight: 1,
								textShadow: isFavorited
									? '0 1px 2px rgba(0,0,0,0.8)'
									: '0 1px 2px rgba(0,0,0,0.9)'
							}}
							aria-label={isFavorited ? 'Unfavorite' : 'Favorite'}
							title={isFavorited ? 'Unfavorite' : 'Favorite'}
						>
							★
						</button>
						<button
							onClick={onToggleSession}
							style={{
								position: 'absolute',
								top: '15px',
								right: '55px',
								zIndex: 2,
								width: '25px',
								height: '25px',
								padding: 0,
								border: 'none',
								backgroundColor: 'transparent',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								cursor: 'pointer',
								fontSize: '26px',
								lineHeight: 1,
								// Greyed out while the video is not in the session collection
								filter: isInSession
									? 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))'
									: 'grayscale(1)',
								opacity: isInSession ? 1 : 0.6
							}}
							aria-label={isInSession ? 'Remove from session' : 'Add to session'}
							title={isInSession ? 'Remove from session' : 'Add to session'}
						>
							📌
						</button>
						{isChoosingFrame && framePreview ? (
							<img
								src={framePreview}
								alt="Frame preview"
								style={{ width: '100%', height: '100%', objectFit: 'cover' }}
							/>
						) : video.mediaType === 'image' ? (
							<img
								src={mediaUrl(video.filePath)}
								alt={video.fileName}
								style={{ width: '100%', height: '100%', objectFit: 'contain' }}
								onError={(e) => {
									console.error('Loading error:', video.filePath)
									e.currentTarget.style.display = 'none'
								}}
							/>
						) : video.thumbnailPath ? (
							<img
								src={mediaUrl(video.thumbnailPath, video.thumbnailVersion)}
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

					{/* Choosing the thumbnail's frame */}
					{canChooseFrame &&
						(isChoosingFrame ? (
							<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
								<input
									type="range"
									min={0}
									max={duration}
									step={Math.max(duration / 1000, 0.1)}
									value={frameTime}
									onChange={(e) => setFrameTime(Number(e.target.value))}
									disabled={isFrameSaving}
									aria-label="Thumbnail frame"
									style={{ width: '100%' }}
								/>
								<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
									<span
										style={{
											color: 'var(--color-text-mute)',
											fontSize: '0.9rem',
											flex: 1
										}}
									>
										{formatDuration(frameTime, true)} / {formatDuration(duration, true)}
									</span>
									<button
										onClick={() => void saveFrame()}
										disabled={isFrameSaving || !framePreview}
										style={{
											padding: '8px 16px',
											backgroundColor: 'var(--color-primary)',
											color: 'white',
											border: 'none',
											borderRadius: '6px',
											cursor: isFrameSaving || !framePreview ? 'not-allowed' : 'pointer',
											fontWeight: 600
										}}
									>
										{isFrameSaving ? 'Saving...' : 'Use this frame'}
									</button>
									<button
										onClick={() => setIsChoosingFrame(false)}
										disabled={isFrameSaving}
										style={{
											padding: '8px 16px',
											background: 'transparent',
											color: 'var(--color-text)',
											border: '1px solid var(--color-background-mute)',
											borderRadius: '6px',
											cursor: 'pointer'
										}}
									>
										Cancel
									</button>
								</div>
								{frameError && (
									<div role="alert" style={{ color: 'var(--color-danger)' }}>
										{frameError}
									</div>
								)}
							</div>
						) : (
							<button
								onClick={startChoosingFrame}
								style={{
									alignSelf: 'flex-start',
									padding: '6px 12px',
									background: 'transparent',
									color: 'var(--color-text)',
									border: '1px solid var(--color-background-mute)',
									borderRadius: '6px',
									cursor: 'pointer'
								}}
							>
								🖼 Choose thumbnail
							</button>
						))}

					{/* Action buttons */}
					<div style={{ display: 'flex', gap: '10px' }}>
						<button
							onClick={() => window.api.openVideo(video.filePath)}
							style={{
								flex: 1,
								padding: '12px 20px',
								background: 'transparent',
								color: 'var(--color-text)',
								border: '1px solid var(--color-background-mute)',
								borderRadius: '6px',
								cursor: 'pointer',
								fontWeight: 600
							}}
						>
							{video.mediaType === 'image' ? '📂 Open' : '▶ Play'}
						</button>
						<button
							onClick={() => window.api.showInFolder(video.filePath)}
							title="Open the folder with this file selected"
							style={{
								padding: '12px 20px',
								background: 'transparent',
								color: 'var(--color-text)',
								border: '1px solid var(--color-background-mute)',
								borderRadius: '6px',
								cursor: 'pointer',
								fontWeight: 600
							}}
						>
							📁 Show in folder
						</button>
						<button
							onClick={handleDeleteClick}
							disabled={isDeleting}
							style={{
								padding: '12px 20px',
								background: isDeleting ? 'var(--color-text-mute)' : 'var(--color-danger)',
								color: 'white',
								border: 'none',
								borderRadius: '6px',
								cursor: isDeleting ? 'not-allowed' : 'pointer',
								fontWeight: 600
							}}
						>
							{isDeleting ? 'Deleting...' : 'Delete'}
						</button>
					</div>
				</div>

				{/* Right side - Info and Tags */}
				<div
					style={{
						flex: '0 0 500px',
						display: 'flex',
						flexDirection: 'column',
						gap: '25px'
					}}
				>
					{/* Title, or the rename field */}
					{isRenaming ? (
						<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
								<input
									autoFocus
									value={nameDraft}
									onChange={(e) => setNameDraft(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') void saveRename()
										if (e.key === 'Escape') cancelRenaming()
									}}
									disabled={isRenameSaving}
									aria-label="New file name"
									style={{
										flex: 1,
										minWidth: 0,
										fontSize: '1.2rem',
										padding: '8px 10px',
										border: '1px solid var(--color-background-mute)',
										borderRadius: '6px',
										backgroundColor: 'var(--color-background)',
										color: 'var(--color-text)'
									}}
								/>
								<span style={{ color: 'var(--color-text-mute)', fontSize: '1.1rem' }}>
									{extension}
								</span>
							</div>
							<div style={{ display: 'flex', gap: '8px' }}>
								<button
									onClick={() => void saveRename()}
									disabled={isRenameSaving}
									style={{
										padding: '8px 16px',
										backgroundColor: 'var(--color-primary)',
										color: 'white',
										border: 'none',
										borderRadius: '6px',
										cursor: isRenameSaving ? 'not-allowed' : 'pointer',
										fontWeight: 600
									}}
								>
									{isRenameSaving ? 'Renaming...' : 'Rename'}
								</button>
								<button
									onClick={cancelRenaming}
									disabled={isRenameSaving}
									style={{
										padding: '8px 16px',
										background: 'transparent',
										color: 'var(--color-text)',
										border: '1px solid var(--color-background-mute)',
										borderRadius: '6px',
										cursor: 'pointer'
									}}
								>
									Cancel
								</button>
							</div>
							{renameError && (
								<div role="alert" style={{ color: 'var(--color-danger)' }}>
									{renameError}
								</div>
							)}
						</div>
					) : (
						<div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
							<h2
								style={{
									margin: 0,
									color: 'var(--color-text)',
									fontSize: '1.8rem',
									wordBreak: 'break-word'
								}}
							>
								{sanitizeFileName(video.fileName)}
							</h2>
							<button
								onClick={startRenaming}
								title="Rename file"
								aria-label="Rename file"
								style={{
									marginTop: '6px',
									padding: '2px 6px',
									background: 'transparent',
									border: 'none',
									cursor: 'pointer',
									fontSize: '1.2rem',
									lineHeight: 1
								}}
							>
								✏️
							</button>
						</div>
					)}

					{/* Info Section */}
					<div>
						<ClickableValues values={categoryValues} label="Category" />
						<ClickableValues values={modelValues} label="Model" />
						<ClickableValues values={channelValues} label="Channel" />
						<ClickableValues values={productionValues} label="Production" />
						{video.mediaType === 'video' && (
							<>
								<InfoRow label="Duration" value={formatDuration(video.duration, true)} />
								<InfoRow label="Size" value={formatFileSize(video.fileSize)} />
							</>
						)}
						{video.mediaType === 'image' && (
							<InfoRow label="Size" value={formatFileSize(video.fileSize)} />
						)}
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
							{visibleTags.map((t, i) => {
								const tagIndex = tags.indexOf(t)
								return (
									<span
										key={i}
										style={{
											background:
												t.type === 'kv'
													? 'var(--color-primary-light)'
													: 'var(--color-background-mute)',
											color:
												t.type === 'kv'
													? 'var(--color-primary-dark)'
													: 'var(--color-text)',
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
											onClick={() => {
												if (tagIndex >= 0) removeTag(tagIndex)
											}}
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
								)
							})}
							{visibleTags.length === 0 && (
								<span style={{ color: 'var(--color-text-mute)', fontStyle: 'italic' }}>
									No tags
								</span>
							)}
						</div>
						<form
							onSubmit={handleAddTag}
							style={{ display: 'flex', gap: '10px', position: 'relative' }}
						>
							<div style={{ flex: 1, position: 'relative' }}>
								<input
									ref={inputRef}
									type="text"
									value={inputValue}
									onChange={handleInputChange}
									onKeyDown={handleKeyDown}
									onFocus={() =>
										setShowSuggestions(
											inputValue.trim().length > 0 && suggestions.length > 0
										)
									}
									placeholder="Ex: holidays or category:nature"
									style={{
										width: '100%',
										padding: '10px',
										borderRadius: '6px',
										border: '1px solid var(--color-background-mute)',
										fontSize: '0.95rem'
									}}
								/>
								{/* Autocomplete suggestions dropdown */}
								{showSuggestions && suggestions.length > 0 && (
									<div
										ref={suggestionsRef}
										style={{
											position: 'absolute',
											top: '100%',
											left: 0,
											right: 0,
											marginTop: '4px',
											backgroundColor: 'var(--color-background-soft)',
											border: '1px solid var(--color-background-mute)',
											borderRadius: '6px',
											boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
											maxHeight: '200px',
											overflowY: 'auto',
											zIndex: 1000
										}}
									>
										{suggestions.map((suggestion, index) => (
											<button
												key={index}
												type="button"
												onClick={() => selectSuggestion(suggestion)}
												onMouseEnter={() => setSelectedIndex(index)}
												style={{
													width: '100%',
													padding: '10px 12px',
													textAlign: 'left',
													background:
														index === selectedIndex
															? 'var(--color-primary-light)'
															: 'transparent',
													border: 'none',
													cursor: 'pointer',
													color: 'var(--color-text)',
													fontSize: '0.9rem',
													display: 'flex',
													alignItems: 'center',
													gap: '8px'
												}}
											>
												<span
													style={{
														color: 'var(--color-text-mute)',
														fontSize: '0.75rem',
														minWidth: '50px'
													}}
												>
													{suggestion.type === 'category' ? '📁' : '🏷️'}
												</span>
												<span>{suggestion.display}</span>
											</button>
										))}
									</div>
								)}
							</div>
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

					{/* Save/Cancel buttons */}
					<div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '20px' }}>
						<button
							onClick={onBack}
							disabled={isSaving || isDeleting}
							style={{
								padding: '12px 24px',
								background: 'transparent',
								border: '1px solid var(--color-background-mute)',
								borderRadius: '6px',
								cursor: 'pointer',
								color: 'var(--color-text-soft)'
							}}
						>
							Cancel
						</button>
						<button
							onClick={handleSaveClick}
							disabled={isSaving || isDeleting}
							style={{
								flex: 1,
								padding: '12px 24px',
								background: isSaving
									? 'var(--color-text-mute)'
									: 'var(--color-primary-dark)',
								color: 'white',
								border: 'none',
								borderRadius: '6px',
								cursor: isSaving ? 'not-allowed' : 'pointer',
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

export default VideoDetailView
