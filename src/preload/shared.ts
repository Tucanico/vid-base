import { ipcRenderer } from 'electron'

export const sharedApi = {
	// Invokes the 'dialog:openDirectory' handler in the main process to show a folder selection dialog
	selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:openDirectory'),
	// Sends a one-way message to the 'folder:open' handler to open a folder in the file explorer
	openFolder: (folderPath: string): void => ipcRenderer.send('folder:open', folderPath),
	// Invokes the 'folder:exists' handler: whether a folder is available (drive connected, vault mounted)
	folderExists: (folderPath: string): Promise<boolean> =>
		ipcRenderer.invoke('folder:exists', folderPath),
	// Invokes the 'folder:use' handler to open a library folder without the dialog; false if unavailable
	useFolder: (folderPath: string): Promise<boolean> =>
		ipcRenderer.invoke('folder:use', folderPath),
	// Invokes the 'app:version' handler for the app's version
	getAppVersion: (): Promise<{ version: string; isPackaged: boolean }> =>
		ipcRenderer.invoke('app:version')
}
