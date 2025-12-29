import * as path from 'path'
import * as fsSync from 'fs'
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
export async function generateThumbnail(
	videoPath: string,
	outputFolder: string,
	fileName: string
): Promise<string | undefined> {
	const thumbName = `${path.parse(fileName).name}.jpg`
	const thumbPath = path.join(outputFolder, thumbName)

	// If it exists already, return it
	if (fsSync.existsSync(thumbPath)) return thumbPath

	return new Promise((resolve) => {
		// 1. Get duration
		ffmpeg.ffprobe(videoPath, (err: any, metadata: any) => {
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
