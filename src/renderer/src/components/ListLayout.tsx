import React, { ReactNode, RefObject } from 'react'

/** --- COMPONENT: ListLayout ---
 *  Full-height layout of the list views: the header on top, then the sidebar and the scrolling list
 *  @param header The header (AppHeader)
 *  @param sidebar The filter sidebar, if shown
 *  @param mainRef Ref for the scrolling list element (used to restore its scroll position)
 *  @param overlay Rendered after the layout, e.g. a modal
 */
function ListLayout({
	header,
	sidebar,
	mainRef,
	overlay,
	children
}: {
	header: ReactNode
	sidebar?: ReactNode
	mainRef: RefObject<HTMLDivElement | null>
	overlay?: ReactNode
	children: ReactNode
}): React.ReactElement {
	return (
		<div
			style={{
				height: '100vh',
				display: 'flex',
				flexDirection: 'column',
				fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
				overflow: 'hidden',
				backgroundColor: 'var(--color-background)'
			}}
		>
			{header}

			{/* --- MAIN CONTENT --- */}
			<div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
				{sidebar}

				<main
					ref={mainRef}
					style={{
						flex: 1,
						overflowY: 'auto',
						overflowX: 'hidden',
						padding: '20px',
						boxSizing: 'border-box'
					}}
				>
					{children}
				</main>
			</div>

			{overlay}
		</div>
	)
}

export default ListLayout
