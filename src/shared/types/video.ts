import { ParsedTag } from './metadata'

// This is the core data structure representing a single video file in the application
// It holds all the information needed for display, filtering, and metadata updates
export interface VideoFile {
	id: string // A unique identifier for the video file, generated using uuid
	fileName: string // The name of the file (e.g., "my-vacation.mp4")
	filePath: string // The absolute path to the video file on the filesystem
	thumbnailPath?: string // The absolute path to the generated thumbnail image. Optional, as it might not exist yet
	tags: ParsedTag[] // An array of structured ParsedTag objects for easy use in the UI
	rawTags: string // The original, unprocessed string of tags read from the file's metadata
}
