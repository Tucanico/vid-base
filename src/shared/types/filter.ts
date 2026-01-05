// ActiveFilters is now dynamic - it can have any category name as a key
export type ActiveFilters = Record<string, string[]> & {
	simpleTag: string[] // Simple tags are always available
}
