import React from 'react'

export type ScanProgress = { processed: number; total: number; percent: number }

/** --- COMPONENT: ScanLoader ---
 *  Full-screen loader shown while a folder is scanned or loaded
 *  @param progress Scan progress; without it (or with total 0) the bar is indeterminate
 */
function ScanLoader({ progress }: { progress?: ScanProgress }): React.ReactElement {
	const isDeterminate = !!progress && progress.total > 0
	return (
		<div
			style={{
				height: '100vh',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				backgroundColor: 'var(--color-background)',
				fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
			}}
		>
			<div className="scan-loader">
				<div className="scan-loader__spinner" aria-label="Scanning" />
				<div className="scan-loader__label">Scanning folder...</div>
				<div
					className="scan-loader__bar"
					role="progressbar"
					aria-valuemin={isDeterminate ? 0 : undefined}
					aria-valuemax={isDeterminate ? 100 : undefined}
					aria-valuenow={isDeterminate ? progress.percent : undefined}
					aria-valuetext="Scanning"
				>
					<div
						className={`scan-loader__bar-fill${isDeterminate ? ' scan-loader__bar-fill--determinate' : ''}`}
						style={isDeterminate ? { width: `${progress.percent}%` } : undefined}
					/>
				</div>
			</div>
		</div>
	)
}

export default ScanLoader
