import { Dispatch, SetStateAction, useState } from 'react'
import { ActiveFilters } from '@shared/types/filter'

export interface ListControls {
	activeFilters: ActiveFilters
	setActiveFilters: Dispatch<SetStateAction<ActiveFilters>>
	openCategories: Set<string>
	setOpenCategories: Dispatch<SetStateAction<Set<string>>>
	searchQuery: string
	setSearchQuery: Dispatch<SetStateAction<string>>
	sortField: string
	setSortField: Dispatch<SetStateAction<string>>
	sortDirection: 'asc' | 'desc'
	setSortDirection: Dispatch<SetStateAction<'asc' | 'desc'>>
	isMultiSelectMode: boolean
	setIsMultiSelectMode: Dispatch<SetStateAction<boolean>>
	handleFilterChange: (category: string, value: string | undefined) => void
	handleMultiSelectChange: (category: string, option: string, isSelected: boolean) => void
	toggleOpenCategory: (category: string) => void
}

/** Filter, search and sort state shared by the Video Mode and Movie Mode list views, with the
 *  filter handlers both pass to the Sidebar
 *  @param initialFilters The filters active when the view opens
 *  @returns The state, its setters and the shared handlers
 */
export function useListControls(initialFilters: ActiveFilters): ListControls {
	// State for the currently active filters. Supports multiple filters per category
	const [activeFilters, setActiveFilters] = useState<ActiveFilters>(initialFilters)
	// State for tracking which filter categories are open
	const [openCategories, setOpenCategories] = useState<Set<string>>(new Set())
	// State for global search query
	const [searchQuery, setSearchQuery] = useState<string>('')
	// State for sorting
	const [sortField, setSortField] = useState<string>('name')
	const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
	// State for global multi-select mode
	const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)

	// Handles changes to the active filter (single select mode - only one filter total)
	const handleFilterChange = (category: string, value: string | undefined): void => {
		if (!value) {
			// If value is undefined, clear all filters
			setActiveFilters({ simpleTag: [] })
		} else {
			// Single select: clear all categories and set only this one
			const newFilters: ActiveFilters = { simpleTag: [] }
			newFilters[category] = [value]
			setActiveFilters(newFilters)
		}
	}

	// Handles multi-select filter changes
	const handleMultiSelectChange = (
		category: string,
		option: string,
		isSelected: boolean
	): void => {
		setActiveFilters((prev) => {
			const newFilters = { ...prev }
			if (!newFilters[category]) {
				newFilters[category] = []
			}
			if (isSelected) {
				// Remove the option
				newFilters[category] = newFilters[category].filter((v) => v !== option)
			} else {
				// Add the option
				newFilters[category] = [...newFilters[category], option]
			}
			return newFilters
		})
	}

	// Toggles a filter category open/closed in the sidebar
	const toggleOpenCategory = (category: string): void => {
		setOpenCategories((prev) => {
			const newSet = new Set(prev)
			if (newSet.has(category)) {
				newSet.delete(category)
			} else {
				newSet.add(category)
			}
			return newSet
		})
	}

	return {
		activeFilters,
		setActiveFilters,
		openCategories,
		setOpenCategories,
		searchQuery,
		setSearchQuery,
		sortField,
		setSortField,
		sortDirection,
		setSortDirection,
		isMultiSelectMode,
		setIsMultiSelectMode,
		handleFilterChange,
		handleMultiSelectChange,
		toggleOpenCategory
	}
}
