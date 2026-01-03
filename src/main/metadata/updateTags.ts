import { ParsedTag } from '../../shared/types/metadata'
import { ourExiftool } from './utils'

/** Updates the metadata tags of a video file using exiftool
 *  @param filePath The absolute path to the video file to update
 *  @param tags An array of ParsedTag objects representing the tags to write
 *  @returns A promise that resolves when the tags have been written, or rejects on error
 */
export async function updateVideoTags(filePath: string, tags: ParsedTag[]): Promise<void> {
	// 1. Reconstruct the "raw" string (e.g., "holidays; category:nature") for simple string-based fields
	const tagString = tags
		.map((t) => {
			if (t.type === 'kv' && t.key) {
				return `${t.key}:${t.value}`
			}
			return t.value
		})
		.join('; ')

	// 2. Reconstruct a simple list of strings for metadata fields that support arrays
	const tagList = tags.map((t) => (t.type === 'kv' ? `${t.key}:${t.value}` : t.value))

	try {
		console.log(`Writing tags to ${filePath}:`, tagString)

		// 3. AGGRESSIVE WRITING STRATEGY:
		// Different operating systems and video players read tags from different metadata fields
		// To ensure maximum compatibility, we write the tags to all common fields:
		// - XPKeywords: Used by Windows Explorer (Details Pane -> Tags)
		// - Keywords: Standard IPTC field
		// - Subject: Standard XMP field
		// - Category: Another legacy Microsoft field
		// - Description/Comment: Fallback fields
		await ourExiftool.write(
			filePath,
			{
				XPKeywords: tagString,
				Keywords: tagList,
				Subject: tagList,
				Category: tagString,
				Description: tagString,
				Comment: tagString
			},
			// '-overwrite_original' tells exiftool to modify the file directly instead of creating a new file and leaving the original with a '_original' suffix
			{ writeArgs: ['-overwrite_original'] }
		)

		console.log(`Success! Tags updated.`)
	} catch (err) {
		console.error(`Error saving tags to ${filePath}:`, err)
		// Re-throw the error so the calling process knows the update failed
		throw err
	}
}
