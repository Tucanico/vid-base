import React from 'react'
import { VideoFile } from 'src/shared/types/video'
import { sanitizeFileName } from '../utils/sanitizeFileName'

/** --- COMPONENT: VideoCard ---
 *  A component to display a single video in the main grid
 *  Shows a thumbnail, title, and key tags
 *  @param video The VideoFile object to display
 *  @param onEdit A function to call when the card is clicked, to open the edit modal
 */
function VideoCard({
	video,
	onEdit,
	isSelected = false,
	onSelect,
	onSelectToggle,
	onToggleFavorite
}: {
	video: VideoFile
	onEdit: (event?: React.MouseEvent) => void
	isSelected?: boolean
	onSelect?: (isSelected: boolean) => void
	onSelectToggle?: () => void
	onToggleFavorite?: () => void
}): React.ReactElement {
	// Find specific tags to highlight on the card
	const categoryTag = video.tags.find((t) => t.type === 'kv' && t.key === 'category')
	const channelTag = video.tags.find((t) => t.type === 'kv' && t.key === 'channel')
	const modelTag = video.tags.find((t) => t.type === 'kv' && t.key === 'model')
	const secondaryTag = channelTag || modelTag
	const isFavorited = video.tags.some(
		(t) => t.type === 'simple' && t.value.toLowerCase() === 'fav'
	)

	// Use ref to track click timeout
	const clickTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

	const handleClick = (e: React.MouseEvent): void => {
		// If checkbox is clicked, toggle selection
		if ((e.target as HTMLElement).closest('.selection-checkbox')) {
			e.stopPropagation()
			if (onSelectToggle) {
				onSelectToggle()
			} else if (onSelect) {
				onSelect(!isSelected)
			}
			return
		}

		// Clear any existing timeout
		if (clickTimeoutRef.current) {
			clearTimeout(clickTimeoutRef.current)
		}

		// Set a delay before handling single click (to allow double-click to register)
		clickTimeoutRef.current = setTimeout(() => {
			onEdit(e)
		}, 250) // 250ms delay
	}

	const handleDoubleClick = (e: React.MouseEvent): void => {
		// Clear the single-click timeout
		if (clickTimeoutRef.current) {
			clearTimeout(clickTimeoutRef.current)
			clickTimeoutRef.current = null
		}

		// Don't trigger if checkbox was clicked
		if ((e.target as HTMLElement).closest('.selection-checkbox')) {
			return
		}

		// Open video in default player
		window.api.openVideo(video.filePath)
	}

	// Cleanup timeout on unmount
	React.useEffect(() => {
		return () => {
			if (clickTimeoutRef.current) {
				clearTimeout(clickTimeoutRef.current)
			}
		}
	}, [])

	return (
		<div
			onClick={handleClick}
			onDoubleClick={handleDoubleClick}
			style={{
				width: '200px',
				height: '180px',
				border: isSelected
					? '2px solid var(--color-primary)'
					: '1px solid var(--color-background-mute)',
				backgroundColor: isSelected
					? 'var(--color-primary-light)'
					: 'var(--color-background-soft)',
				borderRadius: '8px',
				boxShadow: isSelected
					? '0 4px 12px rgba(0, 0, 0, 0.15)'
					: '0 4px 6px rgba(0, 0, 0, 0.04)',
				cursor: 'pointer',
				transition: 'all 0.2s ease-in-out',
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden',
				position: 'relative'
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.boxShadow =
					'0 7px 14px rgba(0, 0, 0, 0.07), 0 3px 6px rgba(0, 0, 0, 0.07)'
				e.currentTarget.style.transform = 'translateY(-2px)'
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.boxShadow = isSelected
					? '0 4px 12px rgba(0, 0, 0, 0.15)'
					: '0 4px 6px rgba(0, 0, 0, 0.04)'
				e.currentTarget.style.transform = 'translateY(0)'
			}}
		>
			{/* Selection Checkbox */}
			{(onSelect || onSelectToggle) && (
				<div
					className="selection-checkbox"
					onClick={(e) => {
						e.stopPropagation()
						if (onSelectToggle) {
							onSelectToggle()
						} else if (onSelect) {
							onSelect(!isSelected)
						}
					}}
					style={{
						position: 'absolute',
						top: '8px',
						left: '8px',
						zIndex: 10,
						width: '15px',
						height: '15px',
						backgroundColor: isSelected ? 'var(--color-primary)' : 'white',
						border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-background-mute)'}`,
						borderRadius: '3px',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						cursor: 'pointer',
						boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
					}}
				>
					{isSelected && (
						<span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>✓</span>
					)}
				</div>
			)}

			{/* Favorite Star */}
			{onToggleFavorite && (
				<button
					onClick={(e) => {
						e.stopPropagation()
						onToggleFavorite()
					}}
					style={{
						position: 'absolute',
						top: '12px',
						right: '12px',
						zIndex: 10,
						width: '15px',
						height: '15px',
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
						fontSize: '28px',
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
			)}

			{/* Thumbnail or Image */}
			<div
				style={{
					width: '100%',
					height: '100px',
					backgroundColor: 'var(--color-background-mute)',
					overflow: 'hidden'
				}}
			>
				{video.mediaType === 'image' ? (
					// For images, show the image itself
					<img
						src={`media:///${video.filePath.replace(/\\/g, '/')}`}
						alt={video.fileName}
						style={{
							width: '100%',
							height: '100%',
							objectFit: 'cover'
						}}
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
						style={{
							width: '100%',
							height: '100%',
							objectFit: 'cover'
						}}
						onError={(e) => {
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
					{sanitizeFileName(video.fileName)}
				</h3>
			</div>
		</div>
	)
}

export default VideoCard
