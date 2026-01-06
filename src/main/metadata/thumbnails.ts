import * as path from 'path'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import { exec } from 'child_process'
import ffmpeg, { FfprobeData } from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import { path as ffprobePath } from 'ffprobe-static'

// When the app is packaged, the binaries are placed in a special 'app.asar.unpacked' directory
// This logic adjusts the path to point to the correct location
if (ffmpegPath) {
	const fixedFfmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked')
	console.log('FFmpeg Path:', fixedFfmpegPath)
	ffmpeg.setFfmpegPath(fixedFfmpegPath)
} else {
	console.error('ERROR: ffmpeg-static not found!')
}

// Same path adjustment for ffprobe
if (ffprobePath) {
	const fixedFfprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked')
	console.log('FFprobe Path:', fixedFfprobePath)
	console.log('') // Extra newline after FFprobe Path
	ffmpeg.setFfprobePath(fixedFfprobePath)
} else {
	console.error('ERROR: ffprobe-static not found! Run "npm install ffprobe-static"')
}

/** Generates a thumbnail for a given video file and saves it in a hidden '.thumbnails' folder
 *  @param videoPath The absolute path to the video file
 *  @returns A promise that resolves with the path to the generated thumbnail, or undefined if an error occurs
 */
export async function generateThumbnail(videoPath: string): Promise<string | undefined> {
	const videoDir = path.dirname(videoPath)
	const outputFolder = path.join(videoDir, '.thumbnails')
	const fileName = path.basename(videoPath)
	const thumbName = `${path.parse(fileName).name}.jpg`
	const thumbPath = path.join(outputFolder, thumbName)

	try {
		// Create the '.thumbnails' directory if it doesn't already exist
		await fs.mkdir(outputFolder, { recursive: true })

		// On Windows, set the 'hidden' attribute on the folder
		if (process.platform === 'win32') {
			exec(`attrib +h "${outputFolder}"`, (err) => {
				if (err) {
					console.warn(`Could not hide folder ${outputFolder}:`, err)
				}
			})
		}
	} catch (error) {
		console.error(`Failed to create .thumbnails directory at ${outputFolder}:`, error)
		return undefined
	}

	// If the thumbnail already exists, return its path immediately
	if (fsSync.existsSync(thumbPath)) return thumbPath

	return new Promise((resolve) => {
		// 1. Get video duration using ffprobe
		ffmpeg.ffprobe(videoPath, (err: Error, metadata: FfprobeData) => {
			if (err || !metadata.format?.duration) {
				console.error('❌ ffprobe failed:', err)
				resolve(undefined)
				return
			}

			// 2. Calculate a seek time (20% into the video) for a more representative frame
			const duration = metadata.format.duration
			const seekTime = duration * 0.2

			// 3. Use ffmpeg to extract a single frame from the video
			ffmpeg(videoPath)
				.seekInput(seekTime) // Seek to the calculated time
				.frames(1) // Extract only one frame
				.outputOptions([
					'-q:v 4' // Set JPEG quality (2-5 is a good range)
				])
				.output(thumbPath) // Save the frame to the thumbnail path
				.on('end', () => resolve(thumbPath)) // Resolve the promise on success
				.on('error', (err: Error) => {
					console.error(`❌ FFmpeg error on ${fileName}:`, err.message)
					resolve(undefined) // Resolve with undefined on error
				})
				.run()
		})
	})
}
