import * as fs from 'fs/promises'
import * as path from 'path'
import { VideoFile } from '../../shared/types/video'
import { deleteFile } from './utils'

// The name of the file used to store the video library metadata
const LIBRARY_FILE = 'library.json'

/** Loads the video library from a JSON file in the specified folder
 *  @param folderPath The path to the folder containing the library.json file
 *  @returns A promise that resolves to an array of VideoFile objects, or null if the library is not found or an error occurs
 */
export async function loadLibrary(folderPath: string): Promise<VideoFile[] | null> {
	const dbPath = path.join(folderPath, LIBRARY_FILE)
	try {
		const data = await fs.readFile(dbPath, 'utf-8')
		return JSON.parse(data) as VideoFile[]
	} catch (error) {
		console.log('Library not found or empty: ', error)
		return null
	}
}

/** Saves the video library to a JSON file in the specified folder
 *  @param folderPath The path to the folder where the library.json file will be saved
 *  @param videos An array of VideoFile objects to save to the library
 *  @returns A promise that resolves when the library has been saved
 */
export async function saveLibrary(folderPath: string, videos: VideoFile[]): Promise<void> {
	const dbPath = path.join(folderPath, LIBRARY_FILE)
	try {
		// Stringify the videos array with pretty printing (2-space indentation) for readability
		const data = JSON.stringify(videos, null, 2)
		await fs.writeFile(dbPath, data, 'utf-8')
		console.log('Library saved to:', dbPath)
	} catch (error) {
		console.error('Error saving library:', error)
	}
}

/** Deletes a video entry from the library, including the video file and its thumbnail
 *  @param folderPath The path to the folder containing the library
 *  @param videoId The ID of the video to delete
 *  @returns A promise that resolves when the video entry has been deleted
 */
export async function deleteVideoEntry(folderPath: string, videoId: string): Promise<void> {
	try {
		const videos = await loadLibrary(folderPath)
		if (!videos) {
			console.warn(
				`Library not found or empty at ${folderPath}. Cannot delete video ${videoId}.`
			)
			return
		}

		const videoToDelete = videos.find((video) => video.id === videoId)
		if (!videoToDelete) {
			console.warn(`Video with ID ${videoId} not found in library at ${folderPath}.`)
			return
		}

		// Delete the actual video file from the filesystem
		await deleteFile(videoToDelete.filePath)
		// If a thumbnail exists, delete it as well
		if (videoToDelete.thumbnailPath) {
			await deleteFile(videoToDelete.thumbnailPath)
		}

		// Filter out the deleted video from the library
		const updatedVideos = videos.filter((video) => video.id !== videoId)
		// Save the updated library back to the JSON file
		await saveLibrary(folderPath, updatedVideos)
		console.log(`Video ${videoId} and its files deleted successfully from ${folderPath}.`)
	} catch (error) {
		console.error(`Error deleting video entry ${videoId} from ${folderPath}:`, error)
	}
}
