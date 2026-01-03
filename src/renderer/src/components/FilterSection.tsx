import React, { useState } from 'react'

/** --- COMPONENT: FilterSection ---
 *  A collapsible UI component for displaying filter options for a single category (e.g., "Category")
 *  @param title The title of the filter section
 *  @param options An array of strings representing the available filter values
 *  @param active The currently active filter value in this section, if any
 *  @param onSelect A callback function called when a user selects or deselects an option
 */
function FilterSection({
	title,
	options,
	active,
	onSelect
}: {
	title: string
	options: string[]
	active?: string
	onSelect: (option: string | undefined) => void
}): React.ReactElement {
	const [isOpen, setIsOpen] = useState(false)

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
					{options.map((opt) => (
						<button
							key={opt}
							onClick={() => onSelect(active === opt ? undefined : opt)}
							style={{
								textAlign: 'left',
								background: active === opt ? 'var(--color-primary-light)' : 'transparent',
								border: 'none',
								padding: '6px 10px',
								borderRadius: '4px',
								cursor: 'pointer',
								color: active === opt ? 'var(--color-primary-dark)' : 'var(--color-text)',
								fontWeight: active === opt ? 600 : 400
							}}
						>
							{opt}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

export default FilterSection
