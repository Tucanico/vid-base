import { useRef, useState } from 'react'

// A list filtered by one value clicked in a detail view, e.g. Model: X or Genres: Drama
export interface ValueTab {
	id: string
	category: string
	value: string
}

export interface ValueTabs {
	tabs: ValueTab[]
	activeTab: ValueTab | null
	openTab: (category: string, value: string, inBackground: boolean) => void
	closeTab: (id: string) => void
	closeAllTabs: () => void
	switchTo: (id: string | null) => void
}

// Snapshot key of the mode's main views (Home / Library / Favourited, or All / Film / ...)
const MAIN = '\u0000main'

/** Label of a value tab, e.g. "Model: X"
 *  @param tab The tab
 *  @returns The category, capitalised, and the value
 */
export const valueTabLabel = (tab: ValueTab): string =>
	`${tab.category.charAt(0).toUpperCase()}${tab.category.slice(1).toLowerCase()}: ${tab.value}`

/** Value tabs, opened next to the mode's main views. The live list state always belongs to the
 *  view on screen: switching saves it as that view's snapshot and loads the target's, so every tab
 *  keeps its own filters, search, sort and scroll position
 *  @param takeSnapshot Returns the live state of the view on screen
 *  @param applySnapshot Replaces the live state with a saved one
 *  @param newTabSnapshot The state a tab opens with
 *  @returns The open tabs, the active one (null on the main views) and the functions to change them
 */
export function useValueTabs<S>(
	takeSnapshot: () => S,
	applySnapshot: (snapshot: S) => void,
	newTabSnapshot: () => S
): ValueTabs {
	const [tabs, setTabs] = useState<ValueTab[]>([])
	const [activeTabId, setActiveTabId] = useState<string | null>(null)
	// Saved state of the views that are not on screen. A ref: it is only used when switching
	const snapshots = useRef(new Map<string, S>())

	// Shows a tab, or the main views with null
	const switchTo = (id: string | null): void => {
		if (id === activeTabId) return
		snapshots.current.set(activeTabId ?? MAIN, takeSnapshot())
		applySnapshot(snapshots.current.get(id ?? MAIN) ?? newTabSnapshot())
		setActiveTabId(id)
	}

	// Opens the tab of a value (or finds the one already open); in the background it is not shown
	const openTab = (category: string, value: string, inBackground: boolean): void => {
		const id = JSON.stringify([category, value])
		setTabs((prev) =>
			prev.some((tab) => tab.id === id) ? prev : [...prev, { id, category, value }]
		)
		if (!inBackground) {
			switchTo(id)
		}
	}

	// Closes a tab; closing the one on screen goes back to the main views as they were
	const closeTab = (id: string): void => {
		if (id === activeTabId) {
			const main = snapshots.current.get(MAIN)
			if (main) applySnapshot(main)
			setActiveTabId(null)
		}
		snapshots.current.delete(id)
		setTabs((prev) => prev.filter((tab) => tab.id !== id))
	}

	// Closes every tab, e.g. when another folder is loaded
	const closeAllTabs = (): void => {
		if (activeTabId !== null) {
			const main = snapshots.current.get(MAIN)
			if (main) applySnapshot(main)
			setActiveTabId(null)
		}
		snapshots.current.clear()
		setTabs([])
	}

	const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null

	return { tabs, activeTab, openTab, closeTab, closeAllTabs, switchTo }
}
