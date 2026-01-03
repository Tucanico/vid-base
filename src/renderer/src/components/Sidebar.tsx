import React from 'react'
import FilterSection from './FilterSection'
import { ActiveFilter, FilterCategory } from '@shared/types/filter'

/** --- COMPONENT: Sidebar ---
 *  The main sidebar component that holds all the filter sections
 *  @param filterOptions An object containing arrays of all available options for each category
 *  @param activeFilters The currently active filter
 *  @param onFilterChange A callback to update the active filter
 *  @param onClearFilters A callback to clear all active filters
 */
function Sidebar({
	filterOptions,
	activeFilters,
	onFilterChange,
	onClearFilters
}: {
	filterOptions: {
		categories: string[]
		models: string[]
		channels: string[]
		productions: string[]
		simpleTags: string[]
	}
	activeFilters: ActiveFilter | null
	onFilterChange: (category: FilterCategory, value: string | undefined) => void
	onClearFilters: () => void
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
					marginBottom: '15px'
				}}
			>
				<h2 style={{ margin: 0, fontSize: '1.2rem' }}>Filters</h2>
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
				active={activeFilters?.category === 'category' ? activeFilters.value : undefined}
				onSelect={(val) => onFilterChange('category', val)}
			/>
			<FilterSection
				title="Model"
				options={filterOptions.models}
				active={activeFilters?.category === 'model' ? activeFilters.value : undefined}
				onSelect={(val) => onFilterChange('model', val)}
			/>
			<FilterSection
				title="Channel"
				options={filterOptions.channels}
				active={activeFilters?.category === 'channel' ? activeFilters.value : undefined}
				onSelect={(val) => onFilterChange('channel', val)}
			/>
			<FilterSection
				title="Production"
				options={filterOptions.productions}
				active={activeFilters?.category === 'production' ? activeFilters.value : undefined}
				onSelect={(val) => onFilterChange('production', val)}
			/>
			<FilterSection
				title="Tags"
				options={filterOptions.simpleTags}
				active={activeFilters?.category === 'simpleTag' ? activeFilters.value : undefined}
				onSelect={(val) => onFilterChange('simpleTag', val)}
			/>
		</div>
	)
}

export default Sidebar
