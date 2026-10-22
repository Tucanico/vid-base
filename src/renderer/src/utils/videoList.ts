import { ParsedTag } from '@shared/types/metadata'
import { VideoFile } from '@shared/types/video'
import { ActiveFilters } from '@shared/types/filter'

/** Picks `count` random video ids (Fisher-Yates shuffle), for the home view
 *  @param items The videos to pick from
 *  @param count How many ids to return (fewer if there are fewer videos)
 *  @returns The picked ids
 */
export const pickRandomIds = (items: VideoFile[], count: number): string[] => {
	const ids = items.map((item) => item.id)
	for (let i = ids.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[ids[i], ids[j]] = [ids[j], ids[i]]
	}
	return ids.slice(0, Math.min(count, ids.length))
}

/** Picks `count` random video ids for the home view's shuffle, preferring videos that are not on it
 *  now; the current ones only fill in when there are not enough others
 *  @param items The videos to pick from
 *  @param currentIds The ids on the home view now
 *  @param count How many ids to return (fewer if there are fewer videos)
 *  @returns The picked ids
 */
export const pickNewRandomIds = (
	items: VideoFile[],
	currentIds: string[],
	count: number
): string[] => {
	const current = new Set(currentIds)
	const fresh = pickRandomIds(
		items.filter((item) => !current.has(item.id)),
		count
	)
	if (fresh.length >= count) return fresh
	return [
		...fresh,
		...pickRandomIds(
			items.filter((item) => current.has(item.id)),
			count - fresh.length
		)
	]
}

/** Removes the "fav" tag from a tag list, reporting whether it was there
 *  @param tags The tags to clean
 *  @returns The tags without "fav", and whether "fav" was present
 */
export const stripFavoriteTag = (
	tags: ParsedTag[]
): { cleanedTags: ParsedTag[]; hasFav: boolean } => {
	let hasFav = false
	const cleanedTags = tags.filter((tag) => {
		if (tag.type === 'simple' && tag.value.toLowerCase() === 'fav') {
			hasFav = true
			return false
		}
		return true
	})
	return { cleanedTags, hasFav }
}

/** Builds the raw tag string stored on a video (e.g. "holidays; category:nature; fav")
 *  @param tags The video's tags
 *  @param favourited Whether to append the "fav" tag
 *  @returns The raw tag string
 */
export const buildRawTagString = (tags: ParsedTag[], favourited: boolean): string => {
	const parts = tags.map((t) => (t.type === 'kv' ? `${t.key}:${t.value}` : t.value))
	if (favourited) {
		parts.push('fav')
	}
	return parts.join('; ')
}

/** Removes `tagsToRemove` from a video's tags and adds `tagsToAdd` (without duplicates)
 *  @param video The video to update
 *  @param tagsToAdd Tags to add
 *  @param tagsToRemove Tags to remove
 *  @returns The updated video (a new object)
 */
export const applyBatchTagChanges = (
	video: VideoFile,
	tagsToAdd: ParsedTag[],
	tagsToRemove: ParsedTag[]
): VideoFile => {
	// Start with current tags
	let newTags = [...video.tags]

	// Remove tags that should be removed
	for (const tagToRemove of tagsToRemove) {
		if (tagToRemove.type === 'kv') {
			newTags = newTags.filter(
				(t) => !(t.type === 'kv' && t.key === tagToRemove.key && t.value === tagToRemove.value)
			)
		} else {
			newTags = newTags.filter((t) => !(t.type === 'simple' && t.value === tagToRemove.value))
		}
	}

	// Add new tags (avoid duplicates)
	for (const tagToAdd of tagsToAdd) {
		const exists = newTags.some((t) => {
			if (tagToAdd.type === 'kv') {
				return t.type === 'kv' && t.key === tagToAdd.key && t.value === tagToAdd.value
			} else {
				return t.type === 'simple' && t.value === tagToAdd.value
			}
		})
		if (!exists) {
			newTags.push(tagToAdd)
		}
	}

	return {
		...video,
		tags: newTags,
		rawTags: buildRawTagString(newTags, video.favourited),
		favourited: video.favourited
	}
}

/** Builds the sidebar's filter options (categories and simple tags) from a list of videos
 *  @param list The videos to read tags from
 *  @returns The categories (key -> sorted values) and the sorted simple tags, "fav" excluded
 */
export const buildFilterOptionsFromVideos = (
	list: VideoFile[]
): {
	categories: Record<string, string[]>
	simpleTags: string[]
} => {
	const categorySets: Record<string, Set<string>> = {}
	const simpleTagSet = new Set<string>()

	for (const video of list) {
		for (const tag of video.tags) {
			if (tag.type === 'kv') {
				const key = tag.key?.toLowerCase()
				if (!key) {
					continue
				}
				if (!categorySets[key]) {
					categorySets[key] = new Set()
				}
				categorySets[key].add(tag.value)
			} else if (tag.type === 'simple') {
				if (tag.value.toLowerCase() === 'fav') continue
				simpleTagSet.add(tag.value)
			}
		}
	}

	const categories: Record<string, string[]> = {}
	Object.entries(categorySets).forEach(([key, values]) => {
		categories[key] = Array.from(values).sort()
	})

	return {
		categories,
		simpleTags: Array.from(simpleTagSet).sort()
	}
}

/** Keeps the videos that match every active filter category
 *  @param videos The videos to filter
 *  @param activeFilters The active filters (simple tags and key:value categories)
 *  @returns The matching videos (the same array when no filter is active)
 */
export const filterVideosByTags = (
	videos: VideoFile[],
	activeFilters: ActiveFilters
): VideoFile[] => {
	const hasActiveFilters = Object.values(activeFilters).some((arr) => arr.length > 0)
	if (!hasActiveFilters) return videos

	return videos.filter((video) => {
		for (const [category, values] of Object.entries(activeFilters)) {
			if (values.length === 0) continue

			let categoryMatches = false
			if (category === 'simpleTag') {
				categoryMatches = video.tags.some(
					(t) => t.type === 'simple' && values.includes(t.value)
				)
			} else {
				categoryMatches = video.tags.some(
					(t) => t.type === 'kv' && t.key === category && values.includes(t.value)
				)
			}

			if (!categoryMatches) return false
		}
		return true
	})
}

/** Checks if a video matches the search query (file name, tag values and tag keys)
 *  @param video The video to check
 *  @param query The search query
 *  @returns true if the video matches, or the query is empty
 */
export const videoMatchesSearch = (video: VideoFile, query: string): boolean => {
	if (!query.trim()) return true
	const lowerQuery = query.toLowerCase()

	// Search in file name
	if (video.fileName.toLowerCase().includes(lowerQuery)) return true

	// Search in all tags (both kv and simple)
	for (const tag of video.tags) {
		if (tag.value.toLowerCase().includes(lowerQuery)) return true
		if (tag.key && tag.key.toLowerCase().includes(lowerQuery)) return true
	}

	return false
}

/** Sorts videos by name, size or duration
 *  @param videos The videos to sort (not modified)
 *  @param field 'name', 'size' or 'duration' (anything else sorts by name)
 *  @param direction The sort direction
 *  @returns A new sorted array
 */
export const sortVideos = (
	videos: VideoFile[],
	field: string,
	direction: 'asc' | 'desc'
): VideoFile[] => {
	const sorted = [...videos].sort((a, b) => {
		let aValue: string | number | undefined
		let bValue: string | number | undefined

		switch (field) {
			case 'name':
				aValue = a.fileName.toLowerCase()
				bValue = b.fileName.toLowerCase()
				break
			case 'size':
				aValue = a.fileSize ?? 0
				bValue = b.fileSize ?? 0
				break
			case 'duration':
				aValue = a.duration ?? 0
				bValue = b.duration ?? 0
				break
			default:
				aValue = a.fileName.toLowerCase()
				bValue = b.fileName.toLowerCase()
		}

		if (aValue < bValue) return direction === 'asc' ? -1 : 1
		if (aValue > bValue) return direction === 'asc' ? 1 : -1
		return 0
	})

	return sorted
}

/** The filters with a value tab's value added (as one more value of its category)
 *  @param filters The filters
 *  @param category The value tab's category
 *  @param value The value tab's value
 *  @returns New filters; `filters` is not changed
 */
export const addTabValue = (
	filters: ActiveFilters,
	category: string,
	value: string
): ActiveFilters => {
	const values = filters[category] ?? []
	return { ...filters, [category]: values.includes(value) ? values : [...values, value] }
}

/** Whether two sets of filters select the same videos: the same values per category, ignoring the
 *  order of categories and values and empty categories
 *  @param a Filters
 *  @param b Filters
 *  @returns true if they are the same
 */
export const sameFilters = (a: ActiveFilters, b: ActiveFilters): boolean => {
	const normalize = (filters: ActiveFilters): string =>
		JSON.stringify(
			Object.entries(filters)
				.filter(([, values]) => values.length > 0)
				.map(([key, values]) => [key, [...values].sort()])
				.sort(([x], [y]) => String(x).localeCompare(String(y)))
		)
	return normalize(a) === normalize(b)
}

/** Groups of videos and photos that are probably copies of the same file: the same kind, the same
 *  size in bytes and, for videos, the same duration to the second. Files without a size are left out
 *  @param videos The videos and photos to look through
 *  @returns The groups of two or more, biggest files first
 */
export const findDuplicateGroups = (videos: VideoFile[]): VideoFile[][] => {
	const groups = new Map<string, VideoFile[]>()
	for (const video of videos) {
		if (!video.fileSize) continue
		const duration =
			video.mediaType === 'video' && video.duration ? Math.round(video.duration) : ''
		const key = `${video.mediaType}|${video.fileSize}|${duration}`
		groups.set(key, [...(groups.get(key) ?? []), video])
	}
	return [...groups.values()]
		.filter((group) => group.length > 1)
		.sort((a, b) => (b[0].fileSize ?? 0) - (a[0].fileSize ?? 0))
}
