import { ElectronAPI } from '@electron-toolkit/preload'
import { ParsedTag } from '../shared/types/metadata'
import { VideoFile } from '../shared/types/video'

declare global {
	interface Window {
		electron: ElectronAPI
		api: {
			selectFolder: () => Promise<string | null>
			scanVideos: (path: string) => Promise<VideoFile[]>
			openVideo: (path: string) => void
			updateTags: (filePath: string, tags: ParsedTag[]) => Promise<void>
			loadLibrary: (folderPath: string) => Promise<VideoFile[] | null>
			saveLibrary: (folderPath: string, videos: VideoFile[]) => Promise<void>
			deleteVideo: (filePath: string, thumbnailPath: string, videoId: string) => Promise<void>
		}
	}
}
