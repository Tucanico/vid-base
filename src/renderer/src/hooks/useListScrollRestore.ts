import { RefObject, useEffect, useRef, useState } from 'react'

export interface ListScrollRestore {
	listScrollRef: RefObject<HTMLDivElement | null>
	rememberScroll: () => void
	restoreScroll: (scrollTop?: number) => void
	currentScrollTop: () => number
}

/** Remembers the list's scroll position when a detail view opens, and restores it on the way back
 *  @param viewMode The current view mode; the position is restored once it is 'list' again
 *  @returns The ref for the scrolling list element; the functions to call when leaving the list
 *  (rememberScroll) and when going back to it (restoreScroll, optionally to another position); and
 *  currentScrollTop, the list's position (the remembered one while a detail view hides the list)
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

	const restoreScroll = (scrollTop?: number): void => {
		if (scrollTop !== undefined) {
			lastListScrollTopRef.current = scrollTop
		}
		setShouldRestoreScroll(true)
	}

	const currentScrollTop = (): number =>
		listScrollRef.current?.scrollTop ?? lastListScrollTopRef.current

	return { listScrollRef, rememberScroll, restoreScroll, currentScrollTop }
}
