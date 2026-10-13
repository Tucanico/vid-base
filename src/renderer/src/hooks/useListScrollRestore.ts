import { RefObject, useEffect, useRef, useState } from 'react'

export interface ListScrollRestore {
	listScrollRef: RefObject<HTMLDivElement | null>
	rememberScroll: () => void
	restoreScroll: () => void
}

/** Remembers the list's scroll position when a detail view opens, and restores it on the way back
 *  @param viewMode The current view mode; the position is restored once it is 'list' again
 *  @returns The ref for the scrolling list element, and the functions to call when leaving the list
 *  (rememberScroll) and when going back to it (restoreScroll)
 */
export function useListScrollRestore(viewMode: 'list' | 'detail'): ListScrollRestore {
	const listScrollRef = useRef<HTMLDivElement>(null)
	const lastListScrollTopRef = useRef(0)
	const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false)

	useEffect(() => {
		if (viewMode !== 'list' || !shouldRestoreScroll) return
		const target = listScrollRef.current
		if (!target) return
		requestAnimationFrame(() => {
			target.scrollTop = lastListScrollTopRef.current
			setShouldRestoreScroll(false)
		})
	}, [viewMode, shouldRestoreScroll])

	const rememberScroll = (): void => {
		lastListScrollTopRef.current = listScrollRef.current?.scrollTop ?? 0
	}

	const restoreScroll = (): void => {
		setShouldRestoreScroll(true)
	}

	return { listScrollRef, rememberScroll, restoreScroll }
}
