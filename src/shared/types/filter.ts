// Define the types for filter categories
export type FilterCategory = 'category' | 'model' | 'channel' | 'production' | 'simpleTag'
export type ActiveFilter = {
	category: FilterCategory
	value: string
}
