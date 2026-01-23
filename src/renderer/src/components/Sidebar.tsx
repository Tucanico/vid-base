import React from 'react'
import FilterSection from './FilterSection'
import { ActiveFilters } from '@shared/types/filter'

/** --- COMPONENT: Sidebar ---
 *  The main sidebar component that holds all the filter sections
 *  @param filterOptions An object containing arrays of all available options for each category
 *  @param activeFilters The currently active filters (supports multiple per category)
 *  @param isMultiSelectMode Whether multi-select mode is enabled globally
 *  @param onFilterChange A callback to update the active filter (single select mode)
 *  @param onMultiSelectChange A callback to toggle filters in multi-select mode
 *  @param onClearFilters A callback to clear all active filters
 */
function Sidebar({
	filterOptions,
	activeFilters,
	isMultiSelectMode,
	onFilterChange,
	onMultiSelectChange,
	onClearFilters,
	onToggleMultiSelect,
	openCategories,
	onToggleCategory,
	isMovieMode = false,
	onMovieFilterTextChange
}: {
	filterOptions: {
		categories: Record<string, string[]>
		simpleTags: string[]
	}
	activeFilters: ActiveFilters
	isMultiSelectMode: boolean
	onFilterChange: (category: string, value: string | undefined) => void
	onMultiSelectChange: (category: string, option: string, isSelected: boolean) => void
	onClearFilters: () => void
	onToggleMultiSelect: () => void
	openCategories?: Set<string>
	onToggleCategory?: (category: string) => void
	isMovieMode?: boolean
	onMovieFilterTextChange?: (category: string, value: string) => void
}): React.ReactElement {
	return (
		<div
			style={{
				width: '240px',
				flexShrink: 0,
				borderRight: '1px solid var(--color-background-mute)',
				padding: '20px',
				paddingRight: '12px', // Reserve space for scrollbar
				overflowY: 'auto',
				overflowX: 'hidden',
				background: 'var(--color-background-soft)',
				boxSizing: 'border-box',
				scrollbarGutter: 'stable' // Reserve space for scrollbar (modern browsers)
			}}
		>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					marginBottom: '15px',
					gap: '8px'
				}}
			>
				<h2 style={{ margin: 0, fontSize: '1.2rem' }}>Filters</h2>
				<button
					onClick={onToggleMultiSelect}
					title={isMultiSelectMode ? 'Disable multi-select' : 'Enable multi-select'}
					style={{
						background: isMultiSelectMode ? 'var(--color-primary-light)' : 'transparent',
						border: '1px solid var(--color-background-mute)',
						borderRadius: '4px',
						padding: '4px 8px',
						cursor: 'pointer',
						fontSize: '0.75rem',
						color: isMultiSelectMode ? 'var(--color-primary-dark)' : 'var(--color-text-mute)',
						fontWeight: isMultiSelectMode ? 600 : 400,
						minWidth: '24px',
						height: '24px',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center'
					}}
				>
					{isMultiSelectMode ? '☑' : '☐'}
				</button>
				<button
					onClick={onClearFilters}
					style={{
						background: 'none',
						border: 'none',
						color: 'var(--color-text-mute)',
						cursor: 'pointer',
						fontSize: '0.8rem'
					}}
				>
					Clear
				</button>
			</div>

			{/* Dynamically render filter sections for each category found in the library */}
			{Object.entries(filterOptions.categories).map(([categoryName, values]) => {
				const activeValues = activeFilters[categoryName] || []
				const isOpen = openCategories?.has(categoryName) ?? false
				return (
					<FilterSection
						key={categoryName}
						title={categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}
						options={values}
						active={activeValues.length > 1 ? activeValues : activeValues[0]}
						isMultiSelectMode={isMultiSelectMode}
						onSelect={(val) => onFilterChange(categoryName, val)}
						onMultiSelect={(opt, isSelected) =>
							onMultiSelectChange(categoryName, opt, isSelected)
						}
						isOpen={isOpen}
						onToggleOpen={onToggleCategory ? () => onToggleCategory(categoryName) : undefined}
						isTextInput={isMovieMode}
						onTextInputChange={
							isMovieMode && onMovieFilterTextChange
								? (value) => onMovieFilterTextChange(categoryName, value)
								: undefined
						}
					/>
				)
			})}
			{/* Simple tags section */}
			{filterOptions.simpleTags.length > 0 && (
				<FilterSection
					title="Tags"
					options={filterOptions.simpleTags}
					active={
						activeFilters.simpleTag.length > 1
							? activeFilters.simpleTag
							: activeFilters.simpleTag[0]
					}
					isMultiSelectMode={isMultiSelectMode}
					onSelect={(val) => onFilterChange('simpleTag', val)}
					onMultiSelect={(opt, isSelected) =>
						onMultiSelectChange('simpleTag', opt, isSelected)
					}
					isOpen={openCategories?.has('simpleTag') ?? false}
					onToggleOpen={onToggleCategory ? () => onToggleCategory('simpleTag') : undefined}
				/>
			)}
		</div>
	)
}

export default Sidebar
