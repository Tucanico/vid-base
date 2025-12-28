import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Definiamo le API personalizzate che App.tsx si aspetta
const api = {
  selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
  scanVideos: (path: string) => ipcRenderer.invoke('videos:scan', path),
  openVideo: (path: string) => ipcRenderer.send('video:open', path)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    // Esponiamo l'oggetto api definito sopra
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
