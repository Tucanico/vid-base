import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { ParsedTag } from '../shared/types/metadata'
import { VideoFile } from '../shared/types/video'

// The preload script runs in a privileged environment with access to Node.js APIs
// It acts as a secure bridge between the sandboxed renderer process (the web page)
// and the main process (which has full system access)

// Define the custom API that will be exposed to the renderer process
// These functions provide a type-safe way to send messages to the main process
// without exposing the entire ipcRenderer module
const api = {
	// Invokes the 'dialog:openDirectory' handler in the main process to show a folder selection dialog
	selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:openDirectory'),
	// Invokes the 'videos:scan' handler to scan a directory for videos
	scanVideos: (path: string): Promise<VideoFile[]> => ipcRenderer.invoke('videos:scan', path),
	// Sends a one-way message to the 'video:open' handler to open a file
	openVideo: (path: string): void => ipcRenderer.send('video:open', path),
	// Invokes the 'videos:updateTags' handler to update metadata for a file
	updateTags: (filePath: string, tags: ParsedTag[]): Promise<void> =>
		ipcRenderer.invoke('videos:updateTags', filePath, tags),
	// Invokes the 'db:load' handler to load the library from a file
	loadLibrary: (folderPath: string): Promise<VideoFile[] | null> =>
		ipcRenderer.invoke('db:load', folderPath),
	// Invokes the 'db:save' handler to save the library to a file
	saveLibrary: (folderPath: string, videos: VideoFile[]): Promise<void> =>
		ipcRenderer.invoke('db:save', folderPath, videos),
	// Invokes the 'video:delete' handler to delete a video file, its thumbnail, and library entry
	deleteVideo: (filePath: string, thumbnailPath: string, videoId: string): Promise<boolean> =>
		ipcRenderer.invoke('video:delete', filePath, thumbnailPath, videoId)
}

// Use the contextBridge to securely expose the APIs to the renderer process
// This is the recommended way to do it in modern Electron apps with contextIsolation enabled
if (process.contextIsolated) {
	try {
		// Expose the built-in Electron APIs (e.g., for dark mode)
		contextBridge.exposeInMainWorld('electron', electronAPI)
		// Expose our custom API defined above
		contextBridge.exposeInMainWorld('api', api)
	} catch (error) {
		console.error('Failed to expose APIs in preload script:', error)
	}
} else {
	// If contextIsolation is disabled (not recommended), attach directly to the window object
	// @ts-ignore (these properties are defined in the index.d.ts file)
	window.electron = electronAPI
	// @ts-ignore (not sure)
	window.api = api
}
