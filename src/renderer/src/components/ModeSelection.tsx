import React, { useState } from 'react'

type AppMode = 'videos' | 'movies' | null

function ModeSelection({
	onModeSelected
}: {
	onModeSelected: (mode: 'videos' | 'movies', folder: string) => void
}): React.ReactElement {
	const [selectedMode, setSelectedMode] = useState<AppMode>(null)
	const [selectedFolder, setSelectedFolder] = useState<string | null>(null)

	const handleModeClick = (mode: 'videos' | 'movies'): void => {
		setSelectedMode(mode)
	}

	const handleSelectFolder = async (): Promise<void> => {
		const folder = await window.api.selectFolder()
		if (folder) {
			setSelectedFolder(folder)
		}
	}

	const handleContinue = (): void => {
		if (selectedMode && selectedFolder) {
			onModeSelected(selectedMode, selectedFolder)
		}
	}

	return (
		<div
			style={{
				height: '100vh',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'center',
				alignItems: 'center',
				fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
				backgroundColor: 'var(--color-background)',
				padding: '40px'
			}}
		>
			<h1 style={{ color: 'var(--color-text)', marginBottom: '40px', fontSize: '2rem' }}>
				VidBase
			</h1>

			{/* Mode Selection */}
			<div
				style={{
					display: 'flex',
					gap: '20px',
					marginBottom: '40px'
				}}
			>
				<button
					onClick={() => handleModeClick('videos')}
					style={{
						padding: '20px 40px',
						fontSize: '1.2rem',
						backgroundColor:
							selectedMode === 'videos'
								? 'var(--color-primary)'
								: 'var(--color-background-soft)',
						color: selectedMode === 'videos' ? 'white' : 'var(--color-text)',
						border: `2px solid ${
							selectedMode === 'videos'
								? 'var(--color-primary)'
								: 'var(--color-background-mute)'
						}`,
						borderRadius: '8px',
						cursor: 'pointer',
						transition: 'all 0.2s',
						fontWeight: selectedMode === 'videos' ? 600 : 400
					}}
				>
					Videos
				</button>
				<button
					onClick={() => handleModeClick('movies')}
					style={{
						padding: '20px 40px',
						fontSize: '1.2rem',
						backgroundColor:
							selectedMode === 'movies'
								? 'var(--color-primary)'
								: 'var(--color-background-soft)',
						color: selectedMode === 'movies' ? 'white' : 'var(--color-text)',
						border: `2px solid ${
							selectedMode === 'movies'
								? 'var(--color-primary)'
								: 'var(--color-background-mute)'
						}`,
						borderRadius: '8px',
						cursor: 'pointer',
						transition: 'all 0.2s',
						fontWeight: selectedMode === 'movies' ? 600 : 400
					}}
				>
					Movies
				</button>
			</div>

			{/* Folder Selection */}
			{selectedMode && (
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: '20px',
						minWidth: '400px'
					}}
				>
					<button
						onClick={handleSelectFolder}
						style={{
							padding: '12px 24px',
							fontSize: '1rem',
							backgroundColor: 'var(--color-background-soft)',
							color: 'var(--color-text)',
							border: '1px solid var(--color-background-mute)',
							borderRadius: '6px',
							cursor: 'pointer',
							width: '100%'
						}}
					>
						📂 Select Folder
					</button>
					{selectedFolder && (
						<div
							style={{
								padding: '12px',
								backgroundColor: 'var(--color-background-soft)',
								borderRadius: '6px',
								width: '100%',
								textAlign: 'center',
								color: 'var(--color-text)',
								fontSize: '0.9rem',
								wordBreak: 'break-all'
							}}
						>
							{selectedFolder}
						</div>
					)}
					{selectedFolder && (selectedMode === 'videos' || selectedMode === 'movies') && (
						<button
							onClick={handleContinue}
							style={{
								padding: '12px 24px',
								fontSize: '1rem',
								backgroundColor: 'var(--color-primary)',
								color: 'white',
								border: 'none',
								borderRadius: '6px',
								cursor: 'pointer',
								fontWeight: 600,
								width: '100%'
							}}
						>
							Continue
						</button>
					)}
				</div>
			)}
		</div>
	)
}

export default ModeSelection
