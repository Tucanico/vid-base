import { ParsedTag } from '../../shared/types/metadata'
import { ourExiftool } from './utils'

export async function updateVideoTags(filePath: string, tags: ParsedTag[]): Promise<void> {
  // 1. Ricostruiamo la stringa "raw" (es: "vacanze; categoria:natura")
  const tagString = tags
    .map((t) => {
      if (t.type === 'kv' && t.key) {
        return `${t.key}:${t.value}`
      }
      return t.value
    })
    .join('; ')

  // Tag come array (per i formati che supportano liste vere invece di stringhe)
  const tagList = tags.map((t) => (t.type === 'kv' ? `${t.key}:${t.value}` : t.value))

  try {
    console.log(`Scrivendo tags su ${filePath}:`, tagString)

    // 2. Scrittura Aggressiva
    // Windows MP4 usa spesso 'ItemList:Keyword' o 'Microsoft:XPKeywords'.
    // XMP usa 'Subject'.
    // IPTC usa 'Keywords'.
    // Scriviamo OVUNQUE.
    await ourExiftool.write(
      filePath,
      {
        XPKeywords: tagString, // Windows (Proprietà -> Dettagli -> Contrassegni)
        Keywords: tagList, // Standard IPTC (spesso array)
        Subject: tagList, // Standard XMP (spesso array)
        //'ItemList:Keyword': tagString, // Specifico MP4
        Category: tagString, // Legacy Microsoft
        Description: tagString, // Fallback descrizione
        Comment: tagString // Fallback commenti
      },
      // 3. writing options (removes _original files)
      { writeArgs: ['-overwrite_original'] }
    )

    console.log(`Successo! Tags aggiornati.`)
  } catch (err) {
    console.error(`Errore salvataggio tags su ${filePath}:`, err)
    throw err
  }
}
