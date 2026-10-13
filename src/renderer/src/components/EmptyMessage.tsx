import React, { ReactNode } from 'react'

/** --- COMPONENT: EmptyMessage ---
 *  Centered message shown when a list has nothing to display
 */
function EmptyMessage({ children }: { children: ReactNode }): React.ReactElement {
	return (
		<div
			style={{
				textAlign: 'center',
				color: 'var(--color-text-mute)',
				marginTop: '40px'
			}}
		>
			{children}
		</div>
	)
}

export default EmptyMessage
