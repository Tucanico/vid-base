import React, { useState, useMemo, useRef, useEffect } from 'react'
import { ParsedTag } from 'src/shared/types/metadata'
import { VideoFile } from 'src/shared/types/video'
import { Library } from '@shared/types/library'
import InfoRow from '../InfoRow'
import { ClickableValues } from '../ClickableValues'
import { sanitizeFileName } from '../../utils/sanitizeFileName'
import { formatDuration, formatFileSize } from '../../utils/formatters'

/** --- COMPONENT: VideoDetailView ---
 *  Full-screen detail view for viewing and editing a video's tags
 *  @param video The VideoFile object being viewed
 *  @param library The Library object containing categories and tags for autocomplete
 *  @param onBack A function to call when the back button is clicked
 *  @param onSave A function to call when the user saves changes; receives the new array of tags
 *  @param onDelete A function to call when the user deletes the video
 *  @param onFilterClick A function to call when a filterable name is clicked (category, value)
 */
function VideoDetailView({
	video,
	library,
	onBack,
	onSave,
	onDelete,
	onFilterClick
}: {
	video: VideoFile
	library: Library | null
	onBack: () => void
	onSave: (tags: ParsedTag[], favourited: boolean) => Promise<boolean>
	onDelete: (video: VideoFile) => void
	onFilterClick: (category: string, value: string) => void
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

	useEffect(() => {
		setTags(video.tags)
		setIsFavorited(video.favourited)
	}, [video])

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

		/* eslint-disable indent */
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
		/* eslint-enable indent */
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
	const getCategoryValues = (key: string): Array<{ value: string; onClick: () => void }> => {
		const matchingTags = tags.filter((t) => t.type === 'kv' && t.key === key)
		return matchingTags.map((tag) => ({
			value: tag.value,
			onClick: () => onFilterClick(key, tag.value)
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
						{video.mediaType === 'image' ? (
							<img
								src={`media:///${video.filePath.replace(/\\/g, '/')}`}
								alt={video.fileName}
								style={{ width: '100%', height: '100%', objectFit: 'contain' }}
								onError={(e) => {
									console.error('Loading error:', video.filePath)
									e.currentTarget.style.display = 'none'
								}}
							/>
						) : video.thumbnailPath ? (
							<img
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
					{/* Title */}
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
