// Define the types for filter categories
export type FilterCategory = 'category' | 'model' | 'channel' | 'production' | 'simpleTag'
export type ActiveFilters = {
	category: string[]
	model: string[]
	channel: string[]
	production: string[]
	simpleTag: string[]
}
