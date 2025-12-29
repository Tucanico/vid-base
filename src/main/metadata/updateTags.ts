import { ParsedTag } from '../../shared/types/metadata'
import { ourExiftool } from './utils'

export async function updateVideoTags(filePath: string, tags: ParsedTag[]): Promise<void> {
  // 1. Reconstruct the "raw" string (e.g., "holidays; category:nature")
  const tagString = tags
    .map((t) => {
      if (t.type === 'kv' && t.key) {
        return `${t.key}:${t.value}`
      }
      return t.value
    })
    .join('; ')

  // Tags as an array (for formats that support true lists instead of strings)
  const tagList = tags.map((t) => (t.type === 'kv' ? `${t.key}:${t.value}` : t.value))

  try {
    console.log(`Writing tags to ${filePath}:`, tagString)

    // 2. Aggressive Writing
    // Windows MP4 often uses 'ItemList:Keyword' or 'Microsoft:XPKeywords'.
    // XMP uses 'Subject'.
    // IPTC uses 'Keywords'.
    // Write EVERYWHERE.
    await ourExiftool.write(
      filePath,
      {
        XPKeywords: tagString, // Windows (Properties -> Details -> Tags)
        Keywords: tagList, // Standard IPTC (often array)
        Subject: tagList, // Standard XMP (often array)
        //'ItemList:Keyword': tagString, // Specifico MP4
        Category: tagString, // Legacy Microsoft
        Description: tagString, // Fallback description
        Comment: tagString // Fallback comments
      },
      // 3. writing options (removes _original files)
      { writeArgs: ['-overwrite_original'] }
    )

    console.log(`Success! Tags updated.`)
  } catch (err) {
    console.error(`Error saving tags to ${filePath}:`, err)
    throw err
  }
}
