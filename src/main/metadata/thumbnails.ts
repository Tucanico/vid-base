import * as path from 'path'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import { exec } from 'child_process'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import { path as ffprobePath } from 'ffprobe-static'

// 1. Configure FFmpeg
if (ffmpegPath) {
	const fixedFfmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked')
	console.log('FFmpeg Path:', fixedFfmpegPath)
	ffmpeg.setFfmpegPath(fixedFfmpegPath)
} else {
	console.error('ERROR: ffmpeg-static not found!')
}

// 2. Configure FFprobe
if (ffprobePath) {
	const fixedFfprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked')
	console.log('FFprobe Path:', fixedFfprobePath)
	ffmpeg.setFfprobePath(fixedFfprobePath)
} else {
	console.error('ERROR: ffprobe-static not found! Run "npm install ffprobe-static"')
}

// Generate a thumbnail for a given video
export async function generateThumbnail(videoPath: string): Promise<string | undefined> {
	const videoDir = path.dirname(videoPath)
	const outputFolder = path.join(videoDir, '.thumbnails')
	const fileName = path.basename(videoPath)
	const thumbName = `${path.parse(fileName).name}.jpg`
	const thumbPath = path.join(outputFolder, thumbName)

	try {
		// Create .thumbnails directory if it doesn't exist
		await fs.mkdir(outputFolder, { recursive: true })

		// Hide the folder on Windows
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

	// If it exists already, return it
	if (fsSync.existsSync(thumbPath)) return thumbPath

	return new Promise((resolve) => {
		// 1. Get duration
		ffmpeg.ffprobe(videoPath, (err: Error, metadata: ffmpeg.FfprobeData) => {
			if (err || !metadata.format?.duration) {
				console.error('❌ ffprobe failed:', err)
				resolve(undefined)
				return
			}

			const duration = metadata.format.duration
			const seekTime = duration * 0.2 // 20%

			// 2. Extract frame
			ffmpeg(videoPath)
				.seekInput(seekTime)
				.frames(1)
				.outputOptions([
					'-q:v 4' // real JPEG quality
				])
				.output(thumbPath)
				.on('end', () => resolve(thumbPath))
				.on('error', (err) => {
					console.error(`❌ FFmpeg error on ${fileName}:`, err.message)
					resolve(undefined)
				})
				.run()
		})
	})
}
