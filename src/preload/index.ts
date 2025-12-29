import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { ParsedTag } from '../shared/types/metadata'
import { VideoFile } from '../shared/types/video'

const api = {
  selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
  scanVideos: (path: string) => ipcRenderer.invoke('videos:scan', path),
  openVideo: (path: string) => ipcRenderer.send('video:open', path),
  updateTags: (filePath: string, tags: ParsedTag[]) =>
    ipcRenderer.invoke('videos:updateTags', filePath, tags),
  loadLibrary: (folderPath: string) => ipcRenderer.invoke('db:load', folderPath),
  saveLibrary: (folderPath: string, videos: VideoFile[]) =>
    ipcRenderer.invoke('db:save', folderPath, videos),
  deleteVideoEntry: (folderPath: string, videoId: string) =>
    ipcRenderer.invoke('videos:delete', folderPath, videoId)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    // Expose the api object defined above
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
