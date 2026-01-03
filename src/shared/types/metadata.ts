// A type alias for the specific keys used in key-value tags
export type Keys = 'category' | 'channel' | 'model' | 'production'

// Represents a tag after it has been parsed from its raw string format
export interface ParsedTag {
	type: 'simple' | 'kv' // 'simple' for a standalone tag (e.g., "holiday"), 'kv' for a key-value pair (e.g., "category:nature")
	key?: string // The key of a key-value tag (e.g., "category"). Only present if type is 'kv'
	value: string // The value of the tag (e.g., "holiday" or "nature")
	original: string // The original, unparsed string for the tag
}

// Represents the raw object returned by exiftool-vendored when reading a file's metadata
// The properties are optional because a file may not have any of these specific tags
// The type is a union of string and string[] because exiftool can return a single tag as a string,
// or multiple tags with the same name as an array of strings
export interface ExiftoolTags {
	Category?: string | string[]
	XPKeywords?: string | string[]
	Keywords?: string | string[]
	Subject?: string | string[]
	Description?: string | string[]
	// Add other potential tag fields here if they need to be read
}
