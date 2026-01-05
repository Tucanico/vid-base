import React from 'react'
import FilterSection from './FilterSection'
import { ActiveFilters, FilterCategory } from '@shared/types/filter'

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
	onToggleMultiSelect
}: {
	filterOptions: {
		categories: string[]
		models: string[]
		channels: string[]
		productions: string[]
		simpleTags: string[]
	}
	activeFilters: ActiveFilters
	isMultiSelectMode: boolean
	onFilterChange: (category: FilterCategory, value: string | undefined) => void
	onMultiSelectChange: (category: FilterCategory, option: string, isSelected: boolean) => void
	onClearFilters: () => void
	onToggleMultiSelect: () => void
}): React.ReactElement {
	return (
		<div
			style={{
				width: '240px',
				flexShrink: 0,
				borderRight: '1px solid var(--color-background-mute)',
				padding: '20px',
				overflowY: 'auto',
				background: 'var(--color-background-soft)'
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

			<FilterSection
				title="Category"
				options={filterOptions.categories}
				active={
					activeFilters.category.length > 1
						? activeFilters.category
						: activeFilters.category[0]
				}
				isMultiSelectMode={isMultiSelectMode}
				onSelect={(val) => onFilterChange('category', val)}
				onMultiSelect={(opt, isSelected) => onMultiSelectChange('category', opt, isSelected)}
			/>
			<FilterSection
				title="Model"
				options={filterOptions.models}
				active={activeFilters.model.length > 1 ? activeFilters.model : activeFilters.model[0]}
				isMultiSelectMode={isMultiSelectMode}
				onSelect={(val) => onFilterChange('model', val)}
				onMultiSelect={(opt, isSelected) => onMultiSelectChange('model', opt, isSelected)}
			/>
			<FilterSection
				title="Channel"
				options={filterOptions.channels}
				active={
					activeFilters.channel.length > 1 ? activeFilters.channel : activeFilters.channel[0]
				}
				isMultiSelectMode={isMultiSelectMode}
				onSelect={(val) => onFilterChange('channel', val)}
				onMultiSelect={(opt, isSelected) => onMultiSelectChange('channel', opt, isSelected)}
			/>
			<FilterSection
				title="Production"
				options={filterOptions.productions}
				active={
					activeFilters.production.length > 1
						? activeFilters.production
						: activeFilters.production[0]
				}
				isMultiSelectMode={isMultiSelectMode}
				onSelect={(val) => onFilterChange('production', val)}
				onMultiSelect={(opt, isSelected) => onMultiSelectChange('production', opt, isSelected)}
			/>
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
				onMultiSelect={(opt, isSelected) => onMultiSelectChange('simpleTag', opt, isSelected)}
			/>
		</div>
	)
}

export default Sidebar
