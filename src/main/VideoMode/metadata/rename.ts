import * as fs from 'fs/promises'
import { Stats } from 'fs'
import * as path from 'path'
import { RenameResult, VideoFile } from '../../../shared/types/video'
import { loadLibrary, saveLibrary } from './library'

// Characters Windows does not allow in file names (control characters are checked separately).
// They are refused on every system, so a drive renamed on Linux still works on Windows
const FORBIDDEN_CHARACTERS = /[<>:"/\\|?*]/
// Names Windows reserves for devices, also with an extension (CON.mp4)
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

/** Checks a new base name (the name without its extension) for a media file
 *  @param baseName The new base name, already trimmed
 *  @param extension The file's extension, kept as it is (e.g. ".mp4")
 *  @returns A message for the user, or null if the name can be used
 */
export function validateBaseName(baseName: string, extension: string): string | null {
	if (!baseName) return 'The name cannot be empty.'
	if (baseName === '.' || baseName === '..') return 'This name is not allowed.'
	if (
		FORBIDDEN_CHARACTERS.test(baseName) ||
		[...baseName].some((char) => char.charCodeAt(0) < 32)
	) {
		return 'A name cannot contain < > : " / \\ | ? * or control characters.'
	}
	if (/[. ]$/.test(baseName)) return 'A name cannot end with a dot or a space.'
	if (RESERVED_NAMES.test(baseName.split('.')[0].trim())) {
		return `"${baseName}" is a name Windows reserves.`
	}
	if (Buffer.byteLength(baseName + extension, 'utf8') > 255) return 'The name is too long.'
	return null
}

// stat, with null for a file that does not exist
async function statOrNull(filePath: string): Promise<Stats | null> {
	try {
		return await fs.stat(filePath)
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
			return null
		throw error
	}
}

/** Renames a video or photo: the file on disk (its extension is kept), its thumbnail, and its
 *  library.json entry, which keeps its id so the session collection, Home and the selection still
 *  find it. If library.json cannot be saved, the file and thumbnail are renamed back.
 *  Not retried by withRetry: a second attempt after a partial rename would no longer find the file
 *  @param folderPath The library folder (where library.json is)
 *  @param videoId The id of the library entry
 *  @param newBaseName The new name, without extension
 *  @returns The updated entry, or a message for the user when the rename is refused
 */
export async function renameVideoFile(
	folderPath: string,
	videoId: string,
	newBaseName: string
): Promise<RenameResult> {
	const library = await loadLibrary(folderPath)
	const entry = library?.files.find((file) => file.id === videoId)
	if (!library || !entry) {
		return { ok: false, error: 'This file is no longer in the library. Scan the folder again.' }
	}

	const extension = path.extname(entry.fileName)
	const baseName = newBaseName.trim()
	const invalid = validateBaseName(baseName, extension)
	if (invalid) return { ok: false, error: invalid }

	const newFileName = baseName + extension
	const oldPath = entry.filePath
	const newPath = path.join(path.dirname(oldPath), newFileName)
	if (newPath === oldPath) return { ok: true, video: entry }

	const source = await statOrNull(oldPath)
	if (!source) {
		return { ok: false, error: 'The file is no longer on the drive. Scan the folder again.' }
	}
	// Never overwrite: on Linux and macOS fs.rename silently replaces an existing file. The only
	// existing target allowed is the file itself, in a case-only rename on a case-insensitive drive
	const target = await statOrNull(newPath)
	const sameFile =
		target !== null &&
		newPath.toLowerCase() === oldPath.toLowerCase() &&
		target.ino === source.ino &&
		target.dev === source.dev
	if (target && !sameFile) {
		return { ok: false, error: `"${newFileName}" already exists in this folder.` }
	}

	// Errors here (e.g. the file is open in a player on Windows) reach the renderer, which says so
	await fs.rename(oldPath, newPath)

	// The thumbnail follows the file's name (as generateThumbnail names it), unless another file's
	// thumbnail already has that name: then the entry keeps pointing to the old one, which still works
	let thumbnailPath = entry.thumbnailPath
	let thumbnailRenamed = false
	if (entry.thumbnailPath) {
		const newThumbnailPath = path.join(path.dirname(entry.thumbnailPath), `${baseName}.jpg`)
		if (newThumbnailPath !== entry.thumbnailPath && !(await statOrNull(newThumbnailPath))) {
			try {
				await fs.rename(entry.thumbnailPath, newThumbnailPath)
				thumbnailPath = newThumbnailPath
				thumbnailRenamed = true
			} catch (error) {
				console.warn('Could not rename the thumbnail, keeping its old name:', error)
			}
		}
	}

	const updated: VideoFile = { ...entry, fileName: newFileName, filePath: newPath, thumbnailPath }
	try {
		await saveLibrary(
			folderPath,
			library.files.map((file) => (file.id === videoId ? updated : file)),
			library
		)
	} catch (error) {
		// Put everything back, so library.json and the drive still agree
		await fs.rename(newPath, oldPath).catch(() => {})
		if (thumbnailRenamed && thumbnailPath && entry.thumbnailPath) {
			await fs.rename(thumbnailPath, entry.thumbnailPath).catch(() => {})
		}
		throw error
	}

	console.log(`Renamed ${oldPath} to ${newPath}`)
	return { ok: true, video: updated }
}
