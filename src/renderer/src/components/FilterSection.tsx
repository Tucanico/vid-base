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
	onMultiSelect,
	isOpen: controlledIsOpen,
	onToggleOpen,
	isTextInput = false,
	onTextInputChange
}: {
	title: string
	options: string[]
	active?: string | string[]
	isMultiSelectMode: boolean
	onSelect: (option: string | undefined) => void
	onMultiSelect?: (option: string, isSelected: boolean) => void
	isOpen?: boolean
	onToggleOpen?: () => void
	isTextInput?: boolean
	onTextInputChange?: (value: string) => void
}): React.ReactElement {
	const [internalIsOpen, setInternalIsOpen] = useState(false)
	const [showValuesModal, setShowValuesModal] = useState(false)
	const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen
	const setIsOpen = onToggleOpen || setInternalIsOpen

	// Get current text input value from active prop
	const activeSet = Array.isArray(active) ? new Set(active) : new Set(active ? [active] : [])
	const textInputValue = isTextInput
		? Array.isArray(active)
			? active[0] || ''
			: active || ''
		: ''

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
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: '8px'
				}}
			>
				<button
					onClick={() => setIsOpen(!isOpen)}
					style={{
						flex: 1,
						textAlign: 'left',
						background: 'none',
						border: 'none',
						fontSize: '1rem',
						fontWeight: 600,
						padding: '10px 0',
						cursor: 'pointer',
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						gap: '8px'
					}}
				>
					<span>{title}</span>
					<span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
						{isTextInput && (
							<button
								onClick={(e) => {
									e.stopPropagation()
									setShowValuesModal(!showValuesModal)
								}}
								title={
									showValuesModal
										? `Hide ${title.toLowerCase()} values`
										: `Show all ${title.toLowerCase()} values`
								}
								style={{
									background: showValuesModal
										? 'var(--color-primary-light)'
										: 'transparent',
									border: '1px solid var(--color-background-mute)',
									borderRadius: '4px',
									padding: '4px 8px',
									cursor: 'pointer',
									fontSize: '0.75rem',
									color: showValuesModal
										? 'var(--color-primary-dark)'
										: 'var(--color-text-mute)',
									minWidth: '24px',
									height: '24px',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									flexShrink: 0
								}}
							>
								ℹ
							</button>
						)}
						<span>{isOpen ? '−' : '+'}</span>
					</span>
				</button>
			</div>
			{isOpen && (
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						gap: '4px',
						paddingTop: '5px',
						width: '100%',
						boxSizing: 'border-box'
					}}
				>
					{isTextInput ? (
						<>
							<input
								type="text"
								value={textInputValue}
								onChange={(e) => {
									const value = e.target.value
									if (onTextInputChange) {
										onTextInputChange(value)
									}
								}}
								placeholder={`Filter by ${title.toLowerCase()}...`}
								style={{
									padding: '6px 8px',
									border: '1px solid var(--color-background-mute)',
									borderRadius: '4px',
									backgroundColor: 'var(--color-background)',
									color: 'var(--color-text)',
									fontSize: '0.85rem',
									width: '100%',
									boxSizing: 'border-box'
								}}
							/>
							{showValuesModal && (
								<div
									style={{
										display: 'flex',
										flexDirection: 'column',
										gap: '4px',
										marginTop: '8px'
									}}
								>
									{options.map((opt) => {
										const isSelected = activeSet.has(opt)
										return (
											<button
												key={opt}
												onClick={() => handleOptionClick(opt)}
												style={{
													textAlign: 'left',
													background: isSelected
														? 'var(--color-primary-light)'
														: 'transparent',
													border: 'none',
													padding: '6px 10px',
													borderRadius: '4px',
													cursor: 'pointer',
													color: isSelected
														? 'var(--color-primary-dark)'
														: 'var(--color-text)',
													fontWeight: isSelected ? 600 : 400
												}}
											>
												{opt}
											</button>
										)
									})}
								</div>
							)}
						</>
					) : (
						options.map((opt) => {
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
						})
					)}
				</div>
			)}
		</div>
	)
}

export default FilterSection
