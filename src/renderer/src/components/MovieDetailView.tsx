import React from 'react'
import { Movie } from '@shared/types/movie'

// Format duration to "1h26m" format
function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600)
	const minutes = Math.floor((seconds % 3600) / 60)
	if (hours > 0) {
		return `${hours}h${minutes}m`
	}
	return `${minutes}m`
}

// Format file size to human-readable format
function formatFileSize(bytes: number): string {
	const units = ['B', 'KB', 'MB', 'GB', 'TB']
	let size = bytes
	let unitIndex = 0
	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024
		unitIndex++
	}
	return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
}

// Component to render clickable values
function ClickableValue({
	value,
	onClick
}: {
	value: string
	onClick: () => void
}): React.ReactElement {
	return (
		<span
			onClick={onClick}
			style={{
				color: 'var(--color-primary)',
				cursor: 'pointer'
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.color = 'var(--color-primary-dark)'
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.color = 'var(--color-primary)'
			}}
		>
			{value}
		</span>
	)
}

// Component to render multiple clickable values
function ClickableValues({
	values,
	label,
	onFilterClick
}: {
	values: string[]
	label: string
	onFilterClick: (category: string, value: string) => void
}): React.ReactElement | null {
	if (values.length === 0) return null
	// Format label for display (capitalize first letter, rest lowercase)
	const displayLabel = label.charAt(0) + label.slice(1).toLowerCase()
	return (
		<div
			style={{
				display: 'flex',
				justifyContent: 'space-between',
				padding: '8px 0',
				borderBottom: '1px solid var(--color-background-mute)'
			}}
		>
			<span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{displayLabel}</span>
			<span
				style={{
					color: 'var(--color-text-soft)',
					display: 'flex',
					flexWrap: 'wrap',
					gap: '0',
					alignItems: 'center'
				}}
			>
				{values.map((value, index) => (
					<span key={index} style={{ display: 'inline-flex', alignItems: 'center' }}>
						<ClickableValue value={value} onClick={() => onFilterClick(label, value)} />
						{index < values.length - 1 && <span style={{ marginRight: '4px' }}>,</span>}
					</span>
				))}
			</span>
		</div>
	)
}

// Component to render a single clickable value
function ClickableSingleValue({
	value,
	label,
	onFilterClick
}: {
	value: string
	label: string
	onFilterClick: (category: string, value: string) => void
}): React.ReactElement | null {
	if (!value) return null
	// Format label for display (capitalize first letter, rest lowercase)
	const displayLabel = label.charAt(0) + label.slice(1).toLowerCase()
	return (
		<div
			style={{
				display: 'flex',
				justifyContent: 'space-between',
				padding: '8px 0',
				borderBottom: '1px solid var(--color-background-mute)'
			}}
		>
			<span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{displayLabel}</span>
			<span style={{ color: 'var(--color-text-soft)' }}>
				<ClickableValue value={value} onClick={() => onFilterClick(label, value)} />
			</span>
		</div>
	)
}

/** --- COMPONENT: MovieDetailView ---
 *  Full-screen detail view for viewing movie information
 *  @param movie The Movie object being viewed
 *  @param onBack A function to call when the back button is clicked
 *  @param onFilterClick A function to call when a filterable field is clicked (category, value)
 */
function MovieDetailView({
	movie,
	onBack,
	onFilterClick
}: {
	movie: Movie
	onBack: () => void
	onFilterClick: (category: string, value: string) => void
}): React.ReactElement {
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
				{/* Left side - Empty for now, could add poster/thumbnail later */}
				<div
					style={{
						flex: '0 0 400px',
						display: 'flex',
						flexDirection: 'column',
						gap: '20px'
					}}
				>
					{/* Placeholder for future poster/thumbnail */}
					<div
						style={{
							width: '100%',
							aspectRatio: '16/9',
							backgroundColor: 'var(--color-background-mute)',
							borderRadius: '8px',
							overflow: 'hidden',
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center',
							color: 'var(--color-text-mute)'
						}}
					>
						🎬
					</div>

					{/* Action button */}
					{movie.folderPath && (
						<button
							onClick={() => window.api.openFolder(movie.folderPath!)}
							style={{
								width: '100%',
								padding: '12px 20px',
								background: 'transparent',
								color: 'var(--color-text)',
								border: '1px solid var(--color-background-mute)',
								borderRadius: '6px',
								cursor: 'pointer',
								fontWeight: 600
							}}
						>
							📂 Open
						</button>
					)}
				</div>

				{/* Right side - Info */}
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
						{movie.title}
					</h2>

					{/* Info Section */}
					<div>
						<ClickableSingleValue
							value={movie.director}
							label="DIRECTOR"
							onFilterClick={onFilterClick}
						/>
						{movie.year && (
							<ClickableSingleValue
								value={String(movie.year)}
								label="YEAR"
								onFilterClick={onFilterClick}
							/>
						)}
						<ClickableSingleValue
							value={movie.language || ''}
							label="LANGUAGE"
							onFilterClick={onFilterClick}
						/>
						<ClickableValues
							values={movie.actors}
							label="ACTORS"
							onFilterClick={onFilterClick}
						/>
						<ClickableValues
							values={movie.genres}
							label="GENRES"
							onFilterClick={onFilterClick}
						/>
						<ClickableSingleValue
							value={movie.type || ''}
							label="TYPE"
							onFilterClick={onFilterClick}
						/>
						{movie.duration && (
							<div
								style={{
									display: 'flex',
									justifyContent: 'space-between',
									padding: '8px 0',
									borderBottom: '1px solid var(--color-background-mute)'
								}}
							>
								<span style={{ fontWeight: 500, color: 'var(--color-text)' }}>
									Duration
								</span>
								<span style={{ color: 'var(--color-text-soft)' }}>
									{formatDuration(movie.duration)}
								</span>
							</div>
						)}
						{movie.size && (
							<div
								style={{
									display: 'flex',
									justifyContent: 'space-between',
									padding: '8px 0',
									borderBottom: '1px solid var(--color-background-mute)'
								}}
							>
								<span style={{ fontWeight: 500, color: 'var(--color-text)' }}>Size</span>
								<span style={{ color: 'var(--color-text-soft)' }}>
									{formatFileSize(movie.size)}
								</span>
							</div>
						)}

						{/* Non-clickable fields */}
						{movie.lq && (
							<div
								style={{
									display: 'flex',
									justifyContent: 'space-between',
									padding: '8px 0',
									borderBottom: '1px solid var(--color-background-mute)'
								}}
							>
								<span style={{ fontWeight: 500, color: 'var(--color-text)' }}>LQ</span>
								<span style={{ color: 'var(--color-text-soft)' }}>{movie.lq}</span>
							</div>
						)}
						{movie.check && (
							<div
								style={{
									display: 'flex',
									justifyContent: 'space-between',
									padding: '8px 0',
									borderBottom: '1px solid var(--color-background-mute)'
								}}
							>
								<span style={{ fontWeight: 500, color: 'var(--color-text)' }}>Check</span>
								<span style={{ color: 'var(--color-text-soft)' }}>{movie.check}</span>
							</div>
						)}
						{movie.notes && (
							<div
								style={{
									display: 'flex',
									flexDirection: 'column',
									padding: '8px 0',
									borderBottom: '1px solid var(--color-background-mute)',
									gap: '4px'
								}}
							>
								<span style={{ fontWeight: 500, color: 'var(--color-text)' }}>Notes</span>
								<span style={{ color: 'var(--color-text-soft)', whiteSpace: 'pre-wrap' }}>
									{movie.notes}
								</span>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

export default MovieDetailView
