import React, { useState } from 'react'
import { ParsedTag } from 'src/shared/types/metadata'
import { VideoFile } from 'src/shared/types/video'
import InfoRow from './InfoRow'

/** --- COMPONENT: EditModal ---
 *  The modal component for viewing details and editing a video's tags
 *  @param video The VideoFile object being edited
 *  @param onClose A function to call when the modal should be closed
 *  @param onSave A function to call when the user saves changes; receives the new array of tags
 */
function EditModal({
	video,
	onClose,
	onSave,
	onDelete
}: {
	video: VideoFile
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

	// Handles the "Delete Video" button click
	const handleDeleteClick = async (): Promise<void> => {
		const confirmed = window.confirm(`Are you sure you want to delete "${video.fileName}"? This action cannot be undone.`)
		if (confirmed) {
			setIsDeleting(true)
			await onDelete(video)
			setIsDeleting(false)
			onClose()
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
					{/* Left-aligned actions */}
					<div style={{ display: 'flex', gap: '10px' }}>
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
