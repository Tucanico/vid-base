import * as fs from 'fs'
import * as path from 'path'
import { exiftool } from 'exiftool-vendored'
import { v4 as uuidv4 } from 'uuid'
import { VideoFile, ParsedTag } from '../shared/types'

// La funzione di parsing rimane uguale, funziona perfettamente con i tuoi dati
function parseTags(rawString: string): ParsedTag[] {
  if (!rawString) return []

  return rawString
    .split(/[;,]/)
    .map((segment) => {
      const clean = segment.trim()
      if (!clean) return null

      if (clean.includes(':')) {
        const [key, ...rest] = clean.split(':')
        return {
          type: 'kv',
          key: key.trim().toLowerCase(),
          value: rest.join(':').trim(),
          original: clean
        } as ParsedTag
      } else {
        return {
          type: 'simple',
          value: clean,
          original: clean
        } as ParsedTag
      }
    })
    .filter(Boolean) as ParsedTag[]
}

export async function scanDirectory(dirPath: string): Promise<VideoFile[]> {
  const files = fs.readdirSync(dirPath)
  const videoExtensions = ['.mp4', '.mkv', '.mov', '.avi', '.wmv', '.m4v']

  const results: VideoFile[] = []

  for (const file of files) {
    const fullPath = path.join(dirPath, file)
    const ext = path.extname(file).toLowerCase()

    if (videoExtensions.includes(ext)) {
      try {
        // Exiftool restituisce un tipo "Tags" che contiene chiavi dinamiche
        // Usiamo 'any' qui per accedere a campi non standard come Category senza errori di TS
        const meta: any = await exiftool.read(fullPath)

        // --- MODIFICA QUI ---
        // Aggiungiamo 'meta.Category' in cima alla lista delle priorità
        const potentialTags = [
          meta.Category, // <--- ECCOLO! I tuoi tag sono qui
          meta.XPKeywords,
          meta.Keywords,
          meta.Subject,
          meta.Description
        ]

        // Trova il primo campo che non sia vuoto
        const foundTags = potentialTags.find(
          (val) =>
            (Array.isArray(val) && val.length > 0) || (typeof val === 'string' && val.trim() !== '')
        )

        let rawString = ''

        // Se è un array (come nel tuo caso: ['categoria:Glory Hole', 'facial']), lo uniamo
        if (Array.isArray(foundTags)) {
          rawString = foundTags.map(String).join('; ')
        } else if (typeof foundTags === 'string') {
          rawString = foundTags
        }

        results.push({
          id: uuidv4(),
          fileName: file,
          filePath: fullPath,
          rawTags: rawString,
          tags: parseTags(rawString)
        })
      } catch (err) {
        console.error(`Errore leggendo ${file}:`, err)
      }
    }
  }
  return results
}

export function closeExiftool(): void {
  exiftool.end()
}
