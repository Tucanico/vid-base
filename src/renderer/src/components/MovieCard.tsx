import React from 'react'
import { Movie } from '@shared/types/movie'

/** --- COMPONENT: MovieCard ---
 *  A list-style component to display a single movie
 *  @param movie The Movie object to display
 *  @param onEdit A function to call when the card is clicked, to open the detail view
 */
function MovieCard({ movie, onEdit }: { movie: Movie; onEdit: () => void }): React.ReactElement {
	const handleClick = (): void => {
		console.log('MovieCard clicked:', movie.title)
		onEdit()
	}

	return (
		<div
			onClick={handleClick}
			style={{
				width: '100%',
				maxWidth: '100%',
				padding: '15px 20px',
				border: '1px solid var(--color-background-mute)',
				backgroundColor: 'var(--color-background-soft)',
				borderRadius: '8px',
				display: 'flex',
				alignItems: 'center',
				gap: '20px',
				transition: 'all 0.2s ease-in-out',
				cursor: 'pointer',
				boxSizing: 'border-box'
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
				e.currentTarget.style.transform = 'translateY(-1px)'
				e.currentTarget.style.backgroundColor = 'var(--color-background)'
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.boxShadow = 'none'
				e.currentTarget.style.transform = 'translateY(0)'
				e.currentTarget.style.backgroundColor = 'var(--color-background-soft)'
			}}
		>
			{/* Title */}
			<div style={{ flex: '1 1 30%', minWidth: 0 }}>
				<h3
					style={{
						margin: 0,
						fontSize: '1rem',
						color: 'var(--color-text)',
						fontWeight: 600,
						whiteSpace: 'nowrap',
						overflow: 'hidden',
						textOverflow: 'ellipsis'
					}}
					title={movie.title}
				>
					{movie.title}
				</h3>
			</div>

			{/* Year */}
			<div style={{ flex: '0 0 80px', textAlign: 'center' }}>
				<span style={{ color: 'var(--color-text-mute)', fontSize: '0.9rem' }}>
					{movie.year || '—'}
				</span>
			</div>

			{/* Director */}
			<div style={{ flex: '1 1 25%', minWidth: 0 }}>
				<span
					style={{
						color: 'var(--color-text-soft)',
						fontSize: '0.9rem',
						whiteSpace: 'nowrap',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						display: 'block'
					}}
					title={movie.director}
				>
					{movie.director}
				</span>
			</div>

			{/* Language */}
			<div style={{ flex: '0 0 60px', textAlign: 'center' }}>
				<span style={{ color: 'var(--color-text-mute)', fontSize: '0.9rem' }}>
					{movie.language || '—'}
				</span>
			</div>
		</div>
	)
}

export default MovieCard
