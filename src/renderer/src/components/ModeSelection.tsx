import React, { useEffect, useState } from 'react'
import { RecentFolder, getRecentFolders, removeRecentFolder } from '../utils/recentFolders'

type AppMode = 'videos' | 'movies' | null

const recentKey = (recent: RecentFolder): string => `${recent.mode}\u0000${recent.folder}`
// The folder's own name, shown above its full path
const folderName = (folder: string): string => folder.split(/[\\/]/).filter(Boolean).pop() ?? folder

function ModeSelection({
	onModeSelected
}: {
	onModeSelected: (mode: 'videos' | 'movies', folder: string) => void
}): React.ReactElement {
	const [selectedMode, setSelectedMode] = useState<AppMode>(null)
	const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
	const [recentFolders, setRecentFolders] = useState<RecentFolder[]>(getRecentFolders)
	// Whether each recent folder is available; missing while it is being checked
	const [availability, setAvailability] = useState<Record<string, boolean>>({})
	const [version, setVersion] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		void Promise.all(
			getRecentFolders().map(
				async (recent) =>
					[recentKey(recent), await window.api.folderExists(recent.folder)] as const
			)
		).then((entries) => {
			if (!cancelled) setAvailability(Object.fromEntries(entries))
		})
		void window.api.getAppVersion().then(({ version, isPackaged }) => {
			if (!cancelled) setVersion(isPackaged ? version : `${version} (dev)`)
		})
		return () => {
			cancelled = true
		}
	}, [])

	// Opens a recent folder straight away; if it is not available, marks it (clicking again re-checks)
	const openRecent = async (recent: RecentFolder): Promise<void> => {
		const available = await window.api.useFolder(recent.folder)
		setAvailability((prev) => ({ ...prev, [recentKey(recent)]: available }))
		if (available) onModeSelected(recent.mode, recent.folder)
	}

	const forgetRecent = (recent: RecentFolder): void => {
		removeRecentFolder(recent.mode, recent.folder)
		setRecentFolders(getRecentFolders())
	}

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
				// "safe": when the content is taller than the window, its top stays reachable
				justifyContent: 'safe center',
				alignItems: 'center',
				fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
				backgroundColor: 'var(--color-background)',
				padding: '40px',
				position: 'relative',
				boxSizing: 'border-box',
				overflowY: 'auto'
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

			{/* Recent folders */}
			{recentFolders.length > 0 && (
				<div style={{ marginTop: '40px', width: '100%', maxWidth: '560px' }}>
					<h2
						style={{ fontSize: '1rem', color: 'var(--color-text-mute)', margin: '0 0 10px' }}
					>
						Recent
					</h2>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
						{recentFolders.map((recent) => {
							const unavailable = availability[recentKey(recent)] === false
							return (
								<div
									key={recentKey(recent)}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: '10px',
										padding: '10px 12px',
										backgroundColor: 'var(--color-background-soft)',
										border: '1px solid var(--color-background-mute)',
										borderRadius: '6px',
										opacity: unavailable ? 0.7 : 1
									}}
								>
									<button
										onClick={() => void openRecent(recent)}
										title={recent.folder}
										style={{
											flex: 1,
											minWidth: 0,
											textAlign: 'left',
											background: 'transparent',
											border: 'none',
											padding: 0,
											cursor: 'pointer',
											color: 'var(--color-text)'
										}}
									>
										<div>
											{recent.mode === 'videos' ? '🎬 Videos' : '🎞 Movies'} ·{' '}
											<strong>{folderName(recent.folder)}</strong>
										</div>
										<div
											style={{
												fontSize: '0.8rem',
												color: 'var(--color-text-mute)',
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: 'nowrap'
											}}
										>
											{recent.folder}
										</div>
										{unavailable && (
											<div
												style={{
													fontSize: '0.8rem',
													color: 'var(--color-danger)',
													marginTop: '4px'
												}}
											>
												Not available: connect the drive or mount the VeraCrypt vault,
												then click again.
											</div>
										)}
									</button>
									<button
										onClick={() => forgetRecent(recent)}
										aria-label="Remove from recent"
										title="Remove from recent"
										style={{
											background: 'transparent',
											border: 'none',
											cursor: 'pointer',
											color: 'var(--color-text-mute)',
											fontSize: '1.1rem'
										}}
									>
										×
									</button>
								</div>
							)
						})}
					</div>
				</div>
			)}

			{version && (
				<div
					style={{
						position: 'absolute',
						bottom: '12px',
						right: '16px',
						fontSize: '0.8rem',
						color: 'var(--color-text-mute)'
					}}
				>
					VidBase {version}
				</div>
			)}
		</div>
	)
}

export default ModeSelection
