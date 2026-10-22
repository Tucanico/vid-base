import { ipcRenderer } from 'electron'
import { ParsedTag } from '../../shared/types/metadata'
import { RenameResult, VideoFile } from '../../shared/types/video'
import { Library } from '../../shared/types/library'

export const videoApi = {
	// Invokes the 'videos:scan' handler to scan a directory for videos
	scanVideos: (path: string): Promise<VideoFile[]> => ipcRenderer.invoke('videos:scan', path),
	// Subscribes to scan progress updates
	onScanProgress: (
		callback: (progress: { processed: number; total: number; percent: number }) => void
	): (() => void) => {
		const listener = (
			_event: Electron.IpcRendererEvent,
			progress: { processed: number; total: number; percent: number }
		): void => {
			callback(progress)
		}
		ipcRenderer.on('videos:scanProgress', listener)
		return () => ipcRenderer.removeListener('videos:scanProgress', listener)
	},
	// Sends a one-way message to the 'video:open' handler to open a file
	openVideo: (path: string): void => ipcRenderer.send('video:open', path),
	// Sends a one-way message to the 'video:showInFolder' handler to show a file in its folder
	showInFolder: (path: string): void => ipcRenderer.send('video:showInFolder', path),
	// Invokes the 'video:rename' handler to rename a file (the extension is kept)
	renameVideo: (folderPath: string, videoId: string, newBaseName: string): Promise<RenameResult> =>
		ipcRenderer.invoke('video:rename', folderPath, videoId, newBaseName),
	// Invokes the 'videos:updateTags' handler to update metadata for a file
	updateTags: (filePath: string, tags: ParsedTag[], favourited: boolean): Promise<void> =>
		ipcRenderer.invoke('videos:updateTags', filePath, tags, favourited),
	// Invokes the 'db:load' handler to load the library from a file
	loadLibrary: (folderPath: string): Promise<Library | null> =>
		ipcRenderer.invoke('db:load', folderPath),
	// Invokes the 'db:save' handler to save the library to a file
	saveLibrary: (folderPath: string, videos: VideoFile[]): Promise<void> =>
		ipcRenderer.invoke('db:save', folderPath, videos),
	// Invokes the 'video:delete' handler to delete a video file, its thumbnail, and library entry
	deleteVideo: (filePath: string, thumbnailPath: string, videoId: string): Promise<boolean> =>
		ipcRenderer.invoke('video:delete', filePath, thumbnailPath, videoId)
}
