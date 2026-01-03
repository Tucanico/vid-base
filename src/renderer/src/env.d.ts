import { ParsedTag } from 'src/shared/types/metadata'
import { VideoFile } from 'src/shared/types/video'

// Type declaration to inform TypeScript about the 'api' object exposed by the preload script
// This provides type safety and autocompletion when using window.api
declare global {
	interface Window {
		api: {
			selectFolder: () => Promise<string | null>
			scanVideos: (path: string) => Promise<VideoFile[]>
			openVideo: (path: string) => void
			updateTags: (filePath: string, tags: ParsedTag[]) => Promise<void>
			loadLibrary: (folderPath: string) => Promise<VideoFile[] | null>
			saveLibrary: (folderPath: string, videos: VideoFile[]) => Promise<void>
			deleteVideoEntry: (folderPath: string, videoId: string) => Promise<void>
		}
	}
}
