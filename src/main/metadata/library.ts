import * as fs from 'fs/promises'
import * as path from 'path'
import { VideoFile } from '../../shared/types/video'
import { deleteFile } from './utils'

export async function loadLibrary(folderPath: string): Promise<VideoFile[] | null> {
  const dbPath = path.join(folderPath, 'library.json')
  try {
    // Prova a leggere il file
    const data = await fs.readFile(dbPath, 'utf-8')
    return JSON.parse(data) as VideoFile[]
  } catch (error) {
    // Se il file non esiste o è corrotto, ritorna null
    return null
  }
}

export async function saveLibrary(folderPath: string, videos: VideoFile[]): Promise<void> {
  const dbPath = path.join(folderPath, 'library.json')
  try {
    const data = JSON.stringify(videos, null, 2) // null, 2 per formattazione leggibile
    await fs.writeFile(dbPath, data, 'utf-8')
    console.log('Libreria salvata in:', dbPath)
  } catch (error) {
    console.error('Errore salvataggio libreria:', error)
  }
}

export async function deleteVideoEntry(folderPath: string, videoId: string): Promise<void> {
  try {
    let videos = await loadLibrary(folderPath)
    if (!videos) {
      console.warn(`Library not found or empty at ${folderPath}. Cannot delete video ${videoId}.`)
      return
    }

    const videoToDelete = videos.find(video => video.id === videoId)
    if (!videoToDelete) {
      console.warn(`Video with ID ${videoId} not found in library at ${folderPath}.`)
      return
    }

    // Delete the actual video file and thumbnail
    await deleteFile(videoToDelete.filePath)
    if (videoToDelete.thumbnailPath) {
      await deleteFile(videoToDelete.thumbnailPath)
    }

    // Remove from library and save
    const updatedVideos = videos.filter(video => video.id !== videoId)
    await saveLibrary(folderPath, updatedVideos)
    console.log(`Video ${videoId} and its files deleted successfully from ${folderPath}.`)
  } catch (error) {
    console.error(`Error deleting video entry ${videoId} from ${folderPath}:`, error)
  }
}

