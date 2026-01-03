import React from 'react'

/** --- COMPONENT: InfoRow ---
 *  A simple presentational component to display a label and a value in the edit modal
 *  It doesn't render anything if the value is not provided
 *  @param label The label to display for the information
 *  @param value The value to display
 */
function InfoRow({ label, value }: { label: string; value?: string }): React.ReactElement | null {
	if (!value) return null
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
			<span style={{ color: 'var(--color-text-soft)' }}>{value}</span>
		</div>
	)
}

export default InfoRow
