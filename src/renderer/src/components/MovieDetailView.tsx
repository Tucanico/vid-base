import React from 'react'
import { Movie } from '@shared/types/movie'

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
	// Component to render clickable values
	const ClickableValue = ({ value, onClick }: { value: string; onClick: () => void }): React.ReactElement => (
		<span
			onClick={onClick}
			style={{
				color: 'var(--color-primary)',
				cursor: 'pointer',
				textDecoration: 'underline',
				marginRight: '8px'
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

	// Component to render multiple clickable values
	const ClickableValues = ({ values, label }: { values: string[]; label: string }): React.ReactElement | null => {
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
				<span style={{ color: 'var(--color-text-soft)', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
					{values.map((value, index) => (
						<React.Fragment key={index}>
							<ClickableValue value={value} onClick={() => onFilterClick(label, value)} />
							{index < values.length - 1 && <span>,</span>}
						</React.Fragment>
					))}
				</span>
			</div>
		)
	}

	// Component to render a single clickable value
	const ClickableSingleValue = ({ value, label }: { value: string; label: string }): React.ReactElement | null => {
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
						<ClickableSingleValue value={movie.director} label="DIRECTOR" />
						{movie.year && (
							<ClickableSingleValue value={String(movie.year)} label="YEAR" />
						)}
						<ClickableSingleValue value={movie.language || ''} label="LANGUAGE" />
						<ClickableValues values={movie.actors} label="ACTORS" />
						<ClickableValues values={movie.genres} label="GENRES" />
						<ClickableSingleValue value={movie.type || ''} label="TYPE" />
						
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

