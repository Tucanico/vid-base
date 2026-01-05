import React, { useState } from 'react'

/** --- COMPONENT: FilterSection ---
 *  A collapsible UI component for displaying filter options for a single category (e.g., "Category")
 *  @param title The title of the filter section
 *  @param options An array of strings representing the available filter values
 *  @param active The currently active filter value(s) in this section
 *  @param isMultiSelectMode Whether multi-select mode is enabled globally
 *  @param onSelect A callback function called when a user selects or deselects an option (single mode)
 *  @param onMultiSelect A callback function called when a user toggles an option in multi-select mode
 */
function FilterSection({
	title,
	options,
	active,
	isMultiSelectMode,
	onSelect,
	onMultiSelect
}: {
	title: string
	options: string[]
	active?: string | string[]
	isMultiSelectMode: boolean
	onSelect: (option: string | undefined) => void
	onMultiSelect?: (option: string, isSelected: boolean) => void
}): React.ReactElement {
	const [isOpen, setIsOpen] = useState(false)

	const activeSet = Array.isArray(active) ? new Set(active) : new Set(active ? [active] : [])

	const handleOptionClick = (opt: string): void => {
		if (isMultiSelectMode && onMultiSelect) {
			// In multi-select mode, toggle the option
			const isSelected = activeSet.has(opt)
			onMultiSelect(opt, isSelected)
		} else {
			// Single select mode
			const currentActive = Array.isArray(active) ? active[0] : active
			onSelect(currentActive === opt ? undefined : opt)
		}
	}

	return (
		<div style={{ marginBottom: '10px' }}>
			<button
				onClick={() => setIsOpen(!isOpen)}
				style={{
					width: '100%',
					textAlign: 'left',
					background: 'none',
					border: 'none',
					fontSize: '1rem',
					fontWeight: 600,
					padding: '10px 0',
					cursor: 'pointer',
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center'
				}}
			>
				<span>{title}</span>
				<span>{isOpen ? '−' : '+'}</span>
			</button>
			{isOpen && (
				<div
					style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '5px' }}
				>
					{options.map((opt) => {
						const isSelected = activeSet.has(opt)
						return (
							<button
								key={opt}
								onClick={() => handleOptionClick(opt)}
								style={{
									textAlign: 'left',
									background: isSelected ? 'var(--color-primary-light)' : 'transparent',
									border: 'none',
									padding: '6px 10px',
									borderRadius: '4px',
									cursor: 'pointer',
									color: isSelected ? 'var(--color-primary-dark)' : 'var(--color-text)',
									fontWeight: isSelected ? 600 : 400
								}}
							>
								{opt}
							</button>
						)
					})}
				</div>
			)}
		</div>
	)
}

export default FilterSection
