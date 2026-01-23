import { ipcRenderer } from 'electron'

export const sharedApi = {
	// Invokes the 'dialog:openDirectory' handler in the main process to show a folder selection dialog
	selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:openDirectory'),
	// Sends a one-way message to the 'folder:open' handler to open a folder in the file explorer
	openFolder: (folderPath: string): void => ipcRenderer.send('folder:open', folderPath)
}
