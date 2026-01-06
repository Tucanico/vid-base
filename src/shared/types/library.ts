import { VideoFile } from './video'

// Library structure with files, categories, and tags
export interface Library {
	files: VideoFile[]
	categories: Record<string, string[]> // Key-value pairs: category name -> array of values
	tags: string[] // Simple tags
}
