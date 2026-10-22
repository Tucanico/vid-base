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
	favourited: boolean // Whether the file is marked as a favorite
	rawTags: string // The original, unprocessed string of tags read from the file's metadata
	fileSize?: number // File size in bytes
	duration?: number // Duration in seconds (for videos)
}

// Result of renaming a media file: the updated library entry, or a message to show the user
export type RenameResult = { ok: true; video: VideoFile } | { ok: false; error: string }
