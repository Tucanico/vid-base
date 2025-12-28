import * as fs from 'fs/promises'
import * as path from 'path'
import { VideoFile } from '../../shared/types/video'

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
