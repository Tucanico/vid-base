import { ElectronAPI } from '@electron-toolkit/preload'

// This file extends the global Window interface with the APIs
// exposed from the preload script. This provides type safety and
// autocompletion for the renderer process when accessing these APIs
declare global {
	interface Window {
		// The standard Electron API provided by @electron-toolkit/preload
		electron: ElectronAPI
		// Our custom API exposed from the preload script
		api: unknown
	}
}
