import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { VideoUpdateResult } from '../../../shared/types/video'
import { loadLibrary, saveLibrary } from './library'
import { extractFrame } from './thumbnails'

/** A small preview of a video's frame at a given time, for choosing a thumbnail on the video page
 *  @param videoPath The absolute path to the video file
 *  @param seconds Where to take the frame
 *  @returns The frame as a JPEG data URL
 */
export async function previewFrame(videoPath: string, seconds: number): Promise<string> {
	const tmpPath = path.join(
		os.tmpdir(),
		`vidbase-frame-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
	)
	try {
		await extractFrame(videoPath, seconds, tmpPath, 640)
		const data = await fs.readFile(tmpPath)
		return `data:image/jpeg;base64,${data.toString('base64')}`
	} finally {
		await fs.rm(tmpPath, { force: true })
	}
}

/** Makes a video's frame at a given time its thumbnail. The frame is written next to the old
 *  thumbnail and renamed over it, so a failed extraction leaves the old one; the library entry gets
 *  a new thumbnailVersion, which the app adds to the thumbnail's URL so the new image is shown
 *  @param folderPath The library folder (where library.json is)
 *  @param videoId The id of the library entry
 *  @param seconds Where to take the frame
 *  @returns The updated entry, or a message for the user
 */
export async function setThumbnailFrame(
	folderPath: string,
	videoId: string,
	seconds: number
): Promise<VideoUpdateResult> {
	const library = await loadLibrary(folderPath)
	const entry = library?.files.find((file) => file.id === videoId)
	if (!library || !entry) {
		return { ok: false, error: 'This file is no longer in the library. Scan the folder again.' }
	}
	if (entry.mediaType !== 'video') {
		return { ok: false, error: 'Only videos have a thumbnail to choose.' }
	}

	// Where generateThumbnail puts it, if the video has none yet
	const thumbnailPath =
		entry.thumbnailPath ??
		path.join(
			path.dirname(entry.filePath),
			'.thumbnails',
			`${path.parse(entry.fileName).name}.jpg`
		)
	await fs.mkdir(path.dirname(thumbnailPath), { recursive: true })
	const tmpPath = `${thumbnailPath}.new.jpg`
	try {
		await extractFrame(entry.filePath, seconds, tmpPath)
		await fs.rename(tmpPath, thumbnailPath)
	} catch (error) {
		await fs.rm(tmpPath, { force: true })
		throw error
	}

	const updated = { ...entry, thumbnailPath, thumbnailVersion: Date.now() }
	await saveLibrary(
		folderPath,
		library.files.map((file) => (file.id === videoId ? updated : file)),
		library
	)
	return { ok: true, video: updated }
}
