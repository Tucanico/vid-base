import { WriteTags } from 'exiftool-vendored'
import { ParsedTag } from '../../../shared/types/metadata'
import { ourExiftool } from '../../metadata/utils'

// Where older versions also wrote the tags (as XPKeywords, Keywords, Category, Description and Comment,
// which land in these groups depending on the format). Each save deletes them, so XMP dc:subject is the
// only copy. They are named group by group because ExifTool runs with MWG on: there a bare Keywords or
// Description is a composite that includes XMP-dc:Subject, and deleting it deletes the new tags as well
const OLD_TAG_COPIES = [
	'IFD0:XPKeywords',
	'XMP-pdf:Keywords',
	'IPTC:Keywords',
	'ItemList:Category',
	'XMP-photoshop:Category',
	'IPTC:Category',
	'Microsoft:Category',
	'ItemList:Description',
	'XMP-dc:Description',
	'IPTC:Caption-Abstract',
	'IFD0:ImageDescription',
	'PNG:Description',
	'ItemList:Comment',
	'File:Comment',
	'PNG:Comment'
]

/** Writes the tags of a video or photo into the file, one tag per item of its XMP dc:subject list
 *  (e.g. "holidays", "category:nature", and "fav" when it is a favourite), and deletes the copies
 *  older versions wrote elsewhere
 *  @param filePath The absolute path to the video file to update
 *  @param tags An array of ParsedTag objects representing the tags to write
 *  @param favourited Whether to add the "fav" item
 *  @returns A promise that resolves when the tags have been written, or rejects on error
 */
export async function updateVideoTags(
	filePath: string,
	tags: ParsedTag[],
	favourited: boolean
): Promise<void> {
	const items = [
		...tags.map((t) => (t.type === 'kv' && t.key ? `${t.key}:${t.value}` : t.value)),
		...(favourited ? ['fav'] : [])
	]

	try {
		console.log(`Writing tags to ${filePath}:`, items.join('; '))

		await ourExiftool.write(
			filePath,
			// The typings have no group-prefixed tag names; an empty list deletes dc:subject
			{
				'XMP-dc:Subject': items,
				...Object.fromEntries(OLD_TAG_COPIES.map((tag) => [tag, null]))
			} as WriteTags,
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
