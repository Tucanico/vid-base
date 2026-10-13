import React from 'react'

export function ClickableValue({
	value,
	onClick
}: {
	value: string
	onClick: (event: React.MouseEvent) => void
}): React.ReactElement {
	return (
		<span
			onClick={onClick}
			style={{
				color: 'var(--color-primary)',
				cursor: 'pointer'
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.color = 'var(--color-primary-dark)'
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.color = 'var(--color-primary)'
			}}
		>
			{value}
		</span>
	)
}

export function ClickableValues({
	values,
	label
}: {
	values: Array<{ value: string; onClick: (event: React.MouseEvent) => void }>
	label: string
}): React.ReactElement | null {
	if (values.length === 0) return null
	return (
		<div
			style={{
				display: 'flex',
				justifyContent: 'space-between',
				padding: '8px 0',
				borderBottom: '1px solid var(--color-background-mute)'
			}}
		>
			<span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{label}</span>
			<span
				style={{
					color: 'var(--color-text-soft)',
					display: 'flex',
					flexWrap: 'wrap',
					gap: '0',
					alignItems: 'center'
				}}
			>
				{values.map((item, index) => (
					<span key={index} style={{ display: 'inline-flex', alignItems: 'center' }}>
						<ClickableValue value={item.value} onClick={item.onClick} />
						{index < values.length - 1 && <span style={{ marginRight: '4px' }}>,</span>}
					</span>
				))}
			</span>
		</div>
	)
}

export function ClickableFilterValues({
	values,
	label,
	onFilterClick
}: {
	values: string[]
	label: string
	onFilterClick: (category: string, value: string, inBackground?: boolean) => void
}): React.ReactElement | null {
	if (values.length === 0) return null
	const displayLabel = label.charAt(0) + label.slice(1).toLowerCase()
	return (
		<div
			style={{
				display: 'flex',
				justifyContent: 'space-between',
				padding: '8px 0',
				borderBottom: '1px solid var(--color-background-mute)'
			}}
		>
			<span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{displayLabel}</span>
			<span
				style={{
					color: 'var(--color-text-soft)',
					display: 'flex',
					flexWrap: 'wrap',
					gap: '0',
					alignItems: 'center'
				}}
			>
				{values.map((value, index) => (
					<span key={index} style={{ display: 'inline-flex', alignItems: 'center' }}>
						<ClickableValue
							value={value}
							onClick={(event) =>
								onFilterClick(label, value, event.ctrlKey || event.metaKey)
							}
						/>
						{index < values.length - 1 && <span style={{ marginRight: '4px' }}>,</span>}
					</span>
				))}
			</span>
		</div>
	)
}

export function ClickableSingleValue({
	value,
	label,
	onFilterClick
}: {
	value: string
	label: string
	onFilterClick: (category: string, value: string, inBackground?: boolean) => void
}): React.ReactElement | null {
	if (!value) return null
	const displayLabel = label.charAt(0) + label.slice(1).toLowerCase()
	return (
		<div
			style={{
				display: 'flex',
				justifyContent: 'space-between',
				padding: '8px 0',
				borderBottom: '1px solid var(--color-background-mute)'
			}}
		>
			<span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{displayLabel}</span>
			<span style={{ color: 'var(--color-text-soft)' }}>
				<ClickableValue
					value={value}
					onClick={(event) => onFilterClick(label, value, event.ctrlKey || event.metaKey)}
				/>
			</span>
		</div>
	)
}
