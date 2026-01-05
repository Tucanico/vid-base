import { ParsedTag } from 'src/shared/types/metadata'
import { VideoFile } from 'src/shared/types/video'
import { Library } from '@shared/types/library'
import { MovieArchive } from '@shared/types/movie'

// Type declaration to inform TypeScript about the 'api' object exposed by the preload script
// This provides type safety and autocompletion when using window.api
declare global {
	interface Window {
		api: {
			selectFolder: () => Promise<string | null>
			scanVideos: (path: string) => Promise<VideoFile[]>
			openVideo: (path: string) => void
			updateTags: (filePath: string, tags: ParsedTag[]) => Promise<void>
			loadLibrary: (folderPath: string) => Promise<Library | null>
			saveLibrary: (folderPath: string, videos: VideoFile[]) => Promise<void>
			deleteVideo: (filePath: string, thumbnailPath: string, videoId: string) => Promise<boolean>
			loadMovies: (folderPath: string, moviesFolderPath?: string) => Promise<MovieArchive>
			openFolder: (folderPath: string) => void
		}
	}
}
