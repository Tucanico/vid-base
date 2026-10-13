import React, { ReactNode } from 'react'

/** --- COMPONENT: HeaderTab ---
 *  Tab-style button for a mode's navigation in the header (Home / Library / ..., All / Film / ...)
 *  @param active Whether this tab is the selected one
 *  @param onClick Called when the tab is clicked
 *  @param onClose If given, the tab shows a × that calls it (a middle-click calls it too)
 */
export function HeaderTab({
	active,
	onClick,
	onClose,
	children
}: {
	active: boolean
	onClick: () => void
	onClose?: () => void
	children: ReactNode
}): React.ReactElement {
	return (
		<button
			onClick={onClick}
			onAuxClick={(e) => {
				if (e.button === 1 && onClose) {
					e.preventDefault()
					onClose()
				}
			}}
			style={{
				padding: '8px 14px',
				fontSize: '0.9rem',
				backgroundColor: active ? 'var(--color-primary)' : 'var(--color-background)',
				color: active ? 'white' : 'var(--color-text)',
				border: '1px solid var(--color-background-mute)',
				borderRadius: '6px',
				cursor: 'pointer'
			}}
		>
			{children}
			{onClose && (
				<span
					role="button"
					aria-label="Close tab"
					title="Close tab"
					onClick={(e) => {
						// Don't also select the tab being closed
						e.stopPropagation()
						onClose()
					}}
					style={{ marginLeft: '8px', opacity: 0.7 }}
				>
					×
				</span>
			)}
		</button>
	)
}

/** --- COMPONENT: AppHeader ---
 *  Header of the list views: the title, the mode's navigation and actions (children), the folder
 *  button, and optionally the search and sort controls
 *  @param selectFolderLabel Label of the folder button
 *  @param onSelectFolder Called when the folder button is clicked
 *  @param showSearchBar Whether to show the search and sort row
 *  @param sortOptions The fields the list can be sorted by
 */
function AppHeader({
	children,
	selectFolderLabel,
	onSelectFolder,
	showSearchBar,
	searchQuery,
	onSearchChange,
	sortField,
	onSortFieldChange,
	sortOptions,
	sortDirection,
	onToggleSortDirection
}: {
	children?: ReactNode
	selectFolderLabel: string
	onSelectFolder: () => void
	showSearchBar: boolean
	searchQuery: string
	onSearchChange: (query: string) => void
	sortField: string
	onSortFieldChange: (field: string) => void
	sortOptions: Array<{ value: string; label: string }>
	sortDirection: 'asc' | 'desc'
	onToggleSortDirection: () => void
}): React.ReactElement {
	return (
		<header
			style={{
				padding: '15px 25px',
				backgroundColor: 'var(--color-background-soft)',
				borderBottom: '1px solid var(--ev-c-gray-300)',
				zIndex: 10,
				boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
				flexShrink: 0,
				display: 'flex',
				flexDirection: 'column',
				gap: '15px'
			}}
		>
			{/* Top row: Title, mode navigation and folder button */}
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center'
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
					<h1 style={{ color: 'var(--color-text)', margin: 0, fontSize: '1.2rem' }}>
						VidBase
					</h1>
				</div>

				{/* Takes the free width, so that many value tabs wrap instead of overflowing */}
				<div
					style={{
						display: 'flex',
						gap: '10px',
						alignItems: 'center',
						flex: 1,
						minWidth: 0,
						justifyContent: 'flex-end'
					}}
				>
					{children}
					<button
						onClick={onSelectFolder}
						style={{
							padding: '10px 20px',
							fontSize: '1rem',
							backgroundColor: 'var(--color-primary)',
							color: 'white',
							border: 'none',
							borderRadius: '6px',
							cursor: 'pointer',
							transition: 'background 0.2s'
						}}
					>
						{selectFolderLabel}
					</button>
				</div>
			</div>

			{/* Bottom row: Search and Sort controls */}
			{showSearchBar && (
				<div
					style={{
						display: 'flex',
						gap: '15px',
						alignItems: 'center',
						flexWrap: 'wrap'
					}}
				>
					{/* Search input */}
					<input
						type="text"
						placeholder="Search across all fields..."
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
						style={{
							flex: 1,
							minWidth: '200px',
							padding: '8px 12px',
							fontSize: '0.9rem',
							border: '1px solid var(--color-background-mute)',
							borderRadius: '6px',
							backgroundColor: 'var(--color-background)',
							color: 'var(--color-text)',
							outline: 'none'
						}}
					/>

					{/* Sort field selector */}
					<select
						value={sortField}
						onChange={(e) => onSortFieldChange(e.target.value)}
						style={{
							padding: '8px 12px',
							fontSize: '0.9rem',
							border: '1px solid var(--color-background-mute)',
							borderRadius: '6px',
							backgroundColor: 'var(--color-background)',
							color: 'var(--color-text)',
							outline: 'none',
							cursor: 'pointer'
						}}
					>
						{sortOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>

					{/* Sort direction toggle */}
					<button
						onClick={onToggleSortDirection}
						title={`Sort ${sortDirection === 'asc' ? 'Ascending' : 'Descending'}`}
						style={{
							padding: '8px 12px',
							fontSize: '0.9rem',
							border: '1px solid var(--color-background-mute)',
							borderRadius: '6px',
							backgroundColor: 'var(--color-background)',
							color: 'var(--color-text)',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							gap: '5px'
						}}
					>
						{sortDirection === 'asc' ? '↑' : '↓'} {sortDirection === 'asc' ? 'Asc' : 'Desc'}
					</button>
				</div>
			)}
		</header>
	)
}

export default AppHeader
