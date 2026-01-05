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
