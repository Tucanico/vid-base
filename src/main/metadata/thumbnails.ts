import * as path from 'path'
import * as fsSync from 'fs'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import { path as ffprobePath } from 'ffprobe-static' // <--- NUOVO IMPORT

// --- CONFIGURAZIONE DEBUG ---
console.log('--- FFmpeg & FFprobe Init ---')

// 1. Configura FFmpeg
if (ffmpegPath) {
  const fixedFfmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked')
  console.log('FFmpeg Path:', fixedFfmpegPath)
  ffmpeg.setFfmpegPath(fixedFfmpegPath)
} else {
  console.error('ERRORE: ffmpeg-static non trovato!')
}

// 2. Configura FFprobe (FONDAMENTALE PER GLI SCREENSHOT)
if (ffprobePath) {
  const fixedFfprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked')
  console.log('FFprobe Path:', fixedFfprobePath)
  ffmpeg.setFfprobePath(fixedFfprobePath)
} else {
  console.error('ERRORE: ffprobe-static non trovato! Esegui "npm install ffprobe-static"')
}

/**
 * Genera una miniatura per un video dato.
 */
export async function generateThumbnail(
  videoPath: string,
  outputFolder: string,
  fileName: string
): Promise<string | undefined> {
  const thumbName = `${fileName}.jpg`
  const thumbPath = path.join(outputFolder, thumbName)

  // Cache check
  if (fsSync.existsSync(thumbPath)) {
    return thumbPath
  }

  return new Promise((resolve) => {
    ffmpeg(videoPath)
      .on('end', () => {
        // console.log(`Thumb creata: ${thumbName}`);
        resolve(thumbPath)
      })
      .on('error', (err) => {
        console.error(`❌ ERRORE FFmpeg su ${fileName}:`, err.message)
        resolve(undefined)
      })
      .screenshots({
        count: 1,
        folder: outputFolder,
        filename: thumbName,
        size: '320x?',
        timestamps: ['20%']
      })
  })
}
