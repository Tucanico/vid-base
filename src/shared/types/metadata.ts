export type Keys = 'category' | 'channel' | 'model' | 'production'

export interface ParsedTag {
	type: 'simple' | 'kv'
	key?: string // e.g.: "category"
	value: string // e.g.: "vintage"
	original: string // e.g.: "category:vintage"
}

export interface ExiftoolTags {
	Category?: string | string[]
	XPKeywords?: string | string[]
	Keywords?: string | string[]
	Subject?: string | string[]
	Description?: string | string[]
	// Add other properties if they are accessed
}
