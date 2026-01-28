import React, { useState, useMemo, useRef, useEffect } from 'react'
import { ParsedTag } from 'src/shared/types/metadata'
import { VideoFile } from 'src/shared/types/video'
import { Library } from '@shared/types/library'

/** --- COMPONENT: BatchEditModal ---
 *  Modal for editing tags/categories for multiple videos at once
 *  @param videos Array of VideoFile objects being edited
 *  @param library The Library object containing categories and tags for autocomplete
 *  @param onClose A function to call when the modal should be closed
 *  @param onSave A function to call when the user saves changes; receives tags to add and remove
 */
function BatchEditModal({
	videos,
	library,
	onClose,
	onSave
}: {
	videos: VideoFile[]
	library: Library | null
	onClose: () => void
	onSave: (tagsToAdd: ParsedTag[], tagsToRemove: ParsedTag[]) => void
}): React.ReactElement {
	// State for tags to add
	const [tagsToAdd, setTagsToAdd] = useState<ParsedTag[]>([])
	// State for tags to remove
	const [tagsToRemove, setTagsToRemove] = useState<ParsedTag[]>([])
	// State for the new tag input field
	const [inputValue, setInputValue] = useState('')
	// State to track the saving process
	const [isSaving, setIsSaving] = useState(false)
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
			Object.keys(library.categories)
				.filter((key) => key.toLowerCase().startsWith(query))
				.forEach((key) => {
					const values = library.categories[key].slice(0, 3)
					values.forEach((val) => {
						results.push({
							display: `${key}:${val}`,
							value: `${key}:${val}`,
							type: 'category'
						})
					})
				})

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

		return results.slice(0, 10)
	}, [inputValue, library])

	// Parse tag string into ParsedTag
	const parseTagString = (tagString: string): ParsedTag | null => {
		const trimmed = tagString.trim()
		if (!trimmed) return null

		if (trimmed.includes(':')) {
			const [key, ...valueParts] = trimmed.split(':')
			const value = valueParts.join(':').trim()
			if (key && value) {
				return {
					type: 'kv',
					key: key.trim().toLowerCase(),
					value: value.trim(),
					original: trimmed
				}
			}
		}
		return { type: 'simple', value: trimmed, original: trimmed }
	}

	// Handle adding a tag
	const handleAddTag = (e: React.FormEvent | React.KeyboardEvent): void => {
		e.preventDefault()
		if (!inputValue.trim()) return

		if (inputValue.trim().toLowerCase() === 'fav') {
			setInputValue('')
			setShowSuggestions(false)
			return
		}

		const tag = parseTagString(inputValue)
		if (!tag) return

		// Check if it's already in tagsToAdd
		const exists = tagsToAdd.some((t) => {
			if (tag.type === 'kv') {
				return t.type === 'kv' && t.key === tag.key && t.value === tag.value
			} else {
				return t.type === 'simple' && t.value === tag.value
			}
		})

		if (!exists) {
			setTagsToAdd([...tagsToAdd, tag])
		}
		setInputValue('')
		setShowSuggestions(false)
	}

	// Handle selecting a suggestion
	const selectSuggestion = (suggestion: { display: string; value: string }): void => {
		setInputValue(suggestion.value)
		setShowSuggestions(false)
		setSelectedIndex(0)
		inputRef.current?.focus()
	}

	// Handle input change
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
		setInputValue(e.target.value)
		setShowSuggestions(true)
		setSelectedIndex(0)
	}

	// Handle removing a tag from "to add" list
	const handleRemoveFromAdd = (tagToRemove: ParsedTag): void => {
		setTagsToAdd(
			tagsToAdd.filter((t) => {
				if (tagToRemove.type === 'kv') {
					return !(
						t.type === 'kv' &&
						t.key === tagToRemove.key &&
						t.value === tagToRemove.value
					)
				} else {
					return !(t.type === 'simple' && t.value === tagToRemove.value)
				}
			})
		)
	}

	// Handle adding a tag to "to remove" list
	const handleAddToRemove = (tag: ParsedTag): void => {
		const exists = tagsToRemove.some((t) => {
			if (tag.type === 'kv') {
				return t.type === 'kv' && t.key === tag.key && t.value === tag.value
			} else {
				return t.type === 'simple' && t.value === tag.value
			}
		})

		if (!exists) {
			setTagsToRemove([...tagsToRemove, tag])
		}
	}

	// Handle removing a tag from "to remove" list
	const handleRemoveFromRemove = (tagToRemove: ParsedTag): void => {
		setTagsToRemove(
			tagsToRemove.filter((t) => {
				if (tagToRemove.type === 'kv') {
					return !(
						t.type === 'kv' &&
						t.key === tagToRemove.key &&
						t.value === tagToRemove.value
					)
				} else {
					return !(t.type === 'simple' && t.value === tagToRemove.value)
				}
			})
		)
	}

	// Get all unique tags from selected videos
	const allTagsFromVideos = useMemo(() => {
		const tagSet = new Map<string, ParsedTag>()
		videos.forEach((video) => {
			video.tags.forEach((tag) => {
				const key = tag.type === 'kv' ? `${tag.key}:${tag.value}` : tag.value
				if (!tagSet.has(key)) {
					tagSet.set(key, tag)
				}
			})
		})
		return Array.from(tagSet.values())
	}, [videos])

	// Handle input keydown
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
					// After selecting, add the tag
					setTimeout(() => {
						if (inputRef.current) {
							const event = new Event('submit', { bubbles: true, cancelable: true })
							inputRef.current.form?.dispatchEvent(event)
						}
					}, 0)
				} else {
					handleAddTag(e)
				}
				break
			case 'Escape':
				setShowSuggestions(false)
				break
		}
	}

	// Handle save
	const handleSave = async (): Promise<void> => {
		setIsSaving(true)
		try {
			await onSave(tagsToAdd, tagsToRemove)
		} finally {
			setIsSaving(false)
		}
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

	// Focus input when modal opens
	useEffect(() => {
		if (inputRef.current) {
			inputRef.current.focus()
		}
	}, [])

	return (
		<div
			onClick={(e) => {
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
				paddingTop: '50px',
				overflowY: 'auto'
			}}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				style={{
					backgroundColor: 'var(--color-background)',
					borderRadius: '12px',
					width: '90%',
					maxWidth: '800px',
					maxHeight: '90vh',
					overflowY: 'auto',
					boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
					display: 'flex',
					flexDirection: 'column'
				}}
			>
				{/* Header */}
				<div
					style={{
						padding: '20px 25px',
						borderBottom: '1px solid var(--color-background-mute)',
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center'
					}}
				>
					<h2 style={{ margin: 0, color: 'var(--color-text)', fontSize: '1.2rem' }}>
						Batch Edit ({videos.length} video{videos.length !== 1 ? 's' : ''})
					</h2>
					<button
						onClick={onClose}
						style={{
							background: 'none',
							border: 'none',
							fontSize: '1.5rem',
							cursor: 'pointer',
							color: 'var(--color-text-mute)',
							padding: '0',
							width: '30px',
							height: '30px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center'
						}}
					>
						×
					</button>
				</div>

				{/* Content */}
				<div style={{ padding: '40px', flex: 1 }}>
					{/* Add Tags Section */}
					<div style={{ marginBottom: '40px' }}>
						<h4 style={{ marginTop: 0, marginBottom: '10px', color: 'var(--color-text)' }}>
							Add Tags
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
							{tagsToAdd.map((tag, index) => (
								<span
									key={index}
									style={{
										background:
											tag.type === 'kv'
												? 'var(--color-primary-light)'
												: 'var(--color-background-mute)',
										color:
											tag.type === 'kv'
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
									{tag.type === 'kv' ? (
										<span>
											<strong style={{ opacity: 0.75 }}>{tag.key}:</strong> {tag.value}
										</span>
									) : (
										tag.value
									)}
									<button
										onClick={() => handleRemoveFromAdd(tag)}
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
							{tagsToAdd.length === 0 && (
								<span style={{ color: 'var(--color-text-mute)', fontStyle: 'italic' }}>
									No tags to add
								</span>
							)}
						</div>
						<form
							onSubmit={handleAddTag}
							style={{
								display: 'flex',
								gap: '10px',
								position: 'relative',
								width: '100%',
								boxSizing: 'border-box'
							}}
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
												{suggestion.display}
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

					{/* Remove Tags Section */}
					<div>
						<h4 style={{ marginTop: 0, marginBottom: '10px', color: 'var(--color-text)' }}>
							Remove Tags
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
							{allTagsFromVideos.map((tag, index) => {
								const isInRemoveList = tagsToRemove.some((t) => {
									if (tag.type === 'kv') {
										return t.type === 'kv' && t.key === tag.key && t.value === tag.value
									} else {
										return t.type === 'simple' && t.value === tag.value
									}
								})

								if (isInRemoveList) {
									return (
										<span
											key={index}
											onClick={() => handleRemoveFromRemove(tag)}
											style={{
												background: 'var(--color-primary)',
												color: 'white',
												padding: '5px 12px',
												borderRadius: '16px',
												fontSize: '0.8rem',
												fontWeight: 500,
												display: 'flex',
												alignItems: 'center',
												height: 'fit-content',
												cursor: 'pointer'
											}}
										>
											{tag.type === 'kv' ? (
												<span>
													<strong style={{ opacity: 0.75 }}>{tag.key}:</strong>{' '}
													{tag.value}
												</span>
											) : (
												tag.value
											)}
											<button
												onClick={(e) => {
													e.stopPropagation()
													handleRemoveFromRemove(tag)
												}}
												style={{
													marginLeft: '8px',
													border: 'none',
													background: 'transparent',
													cursor: 'pointer',
													fontWeight: 'bold',
													color: 'white',
													padding: '0 4px'
												}}
											>
												×
											</button>
										</span>
									)
								}

								return (
									<span
										key={index}
										onClick={() => handleAddToRemove(tag)}
										style={{
											background:
												tag.type === 'kv'
													? 'var(--color-primary-light)'
													: 'var(--color-background-mute)',
											color:
												tag.type === 'kv'
													? 'var(--color-primary-dark)'
													: 'var(--color-text)',
											padding: '5px 12px',
											borderRadius: '16px',
											fontSize: '0.8rem',
											fontWeight: 500,
											display: 'flex',
											alignItems: 'center',
											height: 'fit-content',
											cursor: 'pointer'
										}}
									>
										{tag.type === 'kv' ? (
											<span>
												<strong style={{ opacity: 0.75 }}>{tag.key}:</strong>{' '}
												{tag.value}
											</span>
										) : (
											tag.value
										)}
									</span>
								)
							})}
							{allTagsFromVideos.length === 0 && (
								<span style={{ color: 'var(--color-text-mute)', fontStyle: 'italic' }}>
									No tags in selected videos
								</span>
							)}
						</div>
					</div>
				</div>

				{/* Footer */}
				<div
					style={{
						padding: '20px 25px',
						borderTop: '1px solid var(--color-background-mute)',
						display: 'flex',
						justifyContent: 'flex-end',
						gap: '10px'
					}}
				>
					<button
						onClick={onClose}
						disabled={isSaving}
						style={{
							padding: '10px 20px',
							fontSize: '1rem',
							backgroundColor: 'var(--color-background-soft)',
							color: 'var(--color-text)',
							border: '1px solid var(--color-background-mute)',
							borderRadius: '6px',
							cursor: isSaving ? 'not-allowed' : 'pointer'
						}}
					>
						Cancel
					</button>
					<button
						onClick={handleSave}
						disabled={isSaving || (tagsToAdd.length === 0 && tagsToRemove.length === 0)}
						style={{
							padding: '10px 20px',
							fontSize: '1rem',
							backgroundColor:
								isSaving || (tagsToAdd.length === 0 && tagsToRemove.length === 0)
									? 'var(--ev-c-gray-400)'
									: 'var(--color-primary)',
							color: 'white',
							border: 'none',
							borderRadius: '6px',
							cursor:
								isSaving || (tagsToAdd.length === 0 && tagsToRemove.length === 0)
									? 'not-allowed'
									: 'pointer'
						}}
					>
						{isSaving ? 'Saving...' : 'Save Changes'}
					</button>
				</div>
			</div>
		</div>
	)
}

export default BatchEditModal
