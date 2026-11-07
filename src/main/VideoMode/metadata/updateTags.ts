import { WriteTags } from 'exiftool-vendored'
import { ParsedTag } from '../../../shared/types/metadata'
import { ourExiftool } from '../../metadata/utils'

// What a photo needs to look the same once every other field is deleted: its colour profile, the JFIF
// header, the Adobe segment (how a JPEG's colours are encoded), a PNG's gamma and sRGB chunks, and the
// EXIF orientation of photos taken sideways. ExifTool leaves a PNG's cHRM and cICP chunks alone.
// The first three are kept out of the deletion; the others can't be, so they are copied back from the
// file as it was. The exclusions must come before -tagsFromFile: after it, ExifTool reads them as
// "don't copy" instead of "don't delete", and the colour profile is lost
const KEEP_ARGS = [
	'--ICC_Profile:all',
	'--JFIF:all',
	'--Adobe:all',
	'-tagsFromFile',
	'@',
	'-PNG:Gamma',
	'-PNG:SRGBRendering',
	'-IFD0:Orientation'
]

/** Writes the tags of a video or photo into the file, one tag per item of its XMP dc:subject list
 *  (e.g. "holidays", "category:nature", and "fav" when it is a favourite), and deletes every other
 *  metadata field: the copies older versions wrote in XPKeywords, Keywords, Category, Description and
 *  Comment, and titles, dates, GPS, encoder names and the like. What the picture needs stays
 *  (see KEEP_ARGS), as does the structure ExifTool never touches (tracks, codecs, duration, rotation)
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
			// ExifTool applies these in order: delete everything, then write the tags (an empty list writes
			// none). The typings have no group-prefixed tag names
			{ all: null, 'XMP-dc:Subject': items } as WriteTags,
			// '-overwrite_original' tells exiftool to modify the file directly instead of creating a new file and leaving the original with a '_original' suffix
			{ writeArgs: ['-overwrite_original', ...KEEP_ARGS] }
		)

		console.log(`Success! Tags updated.`)
	} catch (err) {
		console.error(`Error saving tags to ${filePath}:`, err)
		// Re-throw the error so the calling process knows the update failed
		throw err
	}
}
