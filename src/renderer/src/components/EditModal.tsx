import React, { useState, useMemo, useRef, useEffect } from 'react'
import { ParsedTag } from 'src/shared/types/metadata'
import { VideoFile } from 'src/shared/types/video'
import { Library } from '@shared/types/library'
import InfoRow from './InfoRow'
import { sanitizeFileName } from '../utils/sanitizeFileName'

/** --- COMPONENT: EditModal ---
 *  The modal component for viewing details and editing a video's tags
 *  @param video The VideoFile object being edited
 *  @param library The Library object containing categories and tags for autocomplete
 *  @param onClose A function to call when the modal should be closed
 *  @param onSave A function to call when the user saves changes; receives the new array of tags
 */
function EditModal({
	video,
	library,
	onClose,
	onSave,
	onDelete
}: {
	video: VideoFile
	library: Library | null
	onClose: () => void
	onSave: (tags: ParsedTag[]) => void
	onDelete: (video: VideoFile) => void
}): React.ReactElement {
	// State to manage the tags being edited
	const [tags, setTags] = useState<ParsedTag[]>(video.tags)
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
					selectSuggestion(suggestions[selectedIndex])
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
		setShowSuggestions(false)
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
	}, [showSuggestions])

	// Disable background scrolling when modal is open
	useEffect(() => {
		// Save original overflow style
		const originalOverflow = document.body.style.overflow
		// Disable scrolling on body
		document.body.style.overflow = 'hidden'

		// Cleanup: restore original overflow when modal closes
		return () => {
			document.body.style.overflow = originalOverflow
		}
	}, [])

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

	// Handles the "Delete Video" button click
	const handleDeleteClick = async (): Promise<void> => {
		const confirmed = window.confirm(
			`Are you sure you want to delete "${sanitizeFileName(video.fileName)}"? This action cannot be undone.`
		)
		if (confirmed) {
			setIsDeleting(true)
			await onDelete(video)
			setIsDeleting(false)
			onClose()
		}
	}

	// Find all key-value tags for each category and combine their values
	const getCategoryValues = (key: string): string | undefined => {
		const matchingTags = tags.filter((t) => t.type === 'kv' && t.key === key)
		if (matchingTags.length === 0) return undefined
		return matchingTags.map((t) => t.value).join(', ')
	}

	const categoryValue = getCategoryValues('category')
	const modelValue = getCategoryValues('model')
	const channelValue = getCategoryValues('channel')
	const productionValue = getCategoryValues('production')

	// Format file size to human-readable format
	const formatFileSize = (bytes?: number): string | undefined => {
		if (!bytes) return undefined
		const units = ['B', 'KB', 'MB', 'GB', 'TB']
		let size = bytes
		let unitIndex = 0
		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024
			unitIndex++
		}
		return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
	}

	// Format duration to "1h26m30s" format
	const formatDuration = (seconds?: number): string | undefined => {
		if (!seconds) return undefined
		const hours = Math.floor(seconds / 3600)
		const minutes = Math.floor((seconds % 3600) / 60)
		const secs = Math.floor(seconds % 60)
		
		const parts: string[] = []
		if (hours > 0) parts.push(`${hours}h`)
		if (minutes > 0) parts.push(`${minutes}m`)
		if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)
		
		return parts.join('')
	}

	return (
		<div
			onClick={(e) => {
				// Close modal if clicking on the overlay (not the content)
				if (e.target === e.currentTarget) {
					onClose()
				}
			}}
			style={{
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				backgroundColor: 'rgba(0,0,0,0.5)',
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'flex-start',
				zIndex: 1000,
				overflow: 'hidden',
				paddingBottom: '40px'
			}}
		>
			<div
				onClick={(e) => {
					// Prevent clicks inside the modal from closing it
					e.stopPropagation()
				}}
				style={{
					backgroundColor: 'var(--color-background-soft)',
					padding: '25px',
					borderRadius: '12px',
					width: '600px',
					maxWidth: '95%',
					maxHeight: 'calc(100vh - 40px)',
					boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
					overflowY: 'auto',
					margin: '0 auto'
				}}
			>
				{/* Thumbnail or Image */}
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
					{video.mediaType === 'image' ? (
						// For images, show the image itself
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
						// For videos, show thumbnail
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
					{sanitizeFileName(video.fileName)}
				</h2>

				{/* Info Section */}
				<div style={{ marginBottom: '25px' }}>
					<InfoRow label="Category" value={categoryValue} />
					<InfoRow label="Model" value={modelValue} />
					<InfoRow label="Channel" value={channelValue} />
					<InfoRow label="Production" value={productionValue} />
					{video.mediaType === 'video' && (
						<>
							<InfoRow label="Duration" value={formatDuration(video.duration)} />
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
					{/* Left-aligned actions */}
					<div style={{ display: 'flex', gap: '10px' }}>
						{/* Play/Open Button */}
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
							{video.mediaType === 'image' ? '📂 Open' : '▶ Play'}
						</button>
						{/* Delete Button */}
						<button
							onClick={handleDeleteClick}
							disabled={isSaving || isDeleting}
							style={{
								padding: '10px 20px',
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

					{/* Right-aligned actions */}
					<div style={{ display: 'flex', gap: '10px' }}>
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

export default EditModal
