import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { videoApi } from './VideoMode'
import { movieApi } from './MovieMode'
import { sharedApi } from './shared'

// The preload script runs in a privileged environment with access to Node.js APIs
// It acts as a secure bridge between the sandboxed renderer process (the web page)
// and the main process (which has full system access)

// Define the custom API that will be exposed to the renderer process
// These functions provide a type-safe way to send messages to the main process
// without exposing the entire ipcRenderer module
const api = {
	...sharedApi,
	...videoApi,
	...movieApi
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
