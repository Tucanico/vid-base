import { ParsedTag } from './metadata'

// Media type enum
export type MediaType = 'video' | 'image'

// This is the core data structure representing a single media file (video or image) in the application
// It holds all the information needed for display, filtering, and metadata updates
export interface VideoFile {
	id: string // A unique identifier for the media file, generated using uuid
	fileName: string // The name of the file (e.g., "my-vacation.mp4" or "photo.jpg")
	filePath: string // The absolute path to the media file on the filesystem
	mediaType: MediaType // Whether this is a video or image
	thumbnailPath?: string // The absolute path to the generated thumbnail image (for videos). Optional, as it might not exist yet
	tags: ParsedTag[] // An array of structured ParsedTag objects for easy use in the UI
	rawTags: string // The original, unprocessed string of tags read from the file's metadata
}
