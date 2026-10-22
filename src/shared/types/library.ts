import { VideoFile } from './video'
import { ActiveFilters } from './filter'

// A search saved in a library, shown as a tab: the list it starts from, its filters (a value tab's
// value included), its search text and its sort
export interface SavedView {
	id: string
	name: string
	list: 'library' | 'favorites'
	filters: ActiveFilters
	searchQuery: string
	sortField: string
	sortDirection: 'asc' | 'desc'
}

// Library structure with files, categories, and tags
export interface Library {
	files: VideoFile[]
	categories: Record<string, string[]> // Key-value pairs: category name -> array of values
	tags: string[] // Simple tags
	savedViews?: SavedView[] // Saved searches (missing in libraries saved before they existed)
}
