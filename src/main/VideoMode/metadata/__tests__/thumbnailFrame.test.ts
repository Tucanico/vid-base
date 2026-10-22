import { execFileSync } from 'child_process'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import ffmpegPath from 'ffmpeg-static'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { VideoFile } from '../../../../shared/types/video'
import { loadLibrary, saveLibrary } from '../library'
import { previewFrame, setThumbnailFrame } from '../thumbnailFrame'

// library.ts only needs deleteFile from utils; mocking it avoids loading ExifTool
vi.mock('../../../metadata/utils', () => ({ deleteFile: vi.fn() }))

let source: string
let dir: string
const at = (...parts: string[]): string => path.join(dir, ...parts)
const isJpeg = async (file: string): Promise<boolean> => {
	const bytes = await fs.readFile(file)
	return bytes[0] === 0xff && bytes[1] === 0xd8
}

beforeAll(async () => {
	// A 2-second test clip, made once with the bundled FFmpeg
	source = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'vidbase-clip-')), 'clip.mp4')
	execFileSync(ffmpegPath as unknown as string, [
		...['-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=160x120:rate=10'],
		...['-pix_fmt', 'yuv420p', source]
	])
})

beforeEach(async () => {
	dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidbase-frame-'))
	await fs.mkdir(at('.thumbnails'))
	await fs.copyFile(source, at('clip.mp4'))
	await fs.writeFile(at('.thumbnails', 'clip.jpg'), 'old thumbnail')
	await fs.writeFile(at('photo.png'), 'photo')
	const entries: VideoFile[] = [
		{
			id: 'v1',
			fileName: 'clip.mp4',
			filePath: at('clip.mp4'),
			thumbnailPath: at('.thumbnails', 'clip.jpg'),
			mediaType: 'video',
			tags: [],
			favourited: false,
			rawTags: '',
			duration: 2
		},
		{
			id: 'p1',
			fileName: 'photo.png',
			filePath: at('photo.png'),
			mediaType: 'image',
			tags: [],
			favourited: false,
			rawTags: ''
		}
	]
	await saveLibrary(dir, entries)
})

afterEach(async () => {
	await fs.rm(dir, { recursive: true, force: true })
})

describe('previewFrame', () => {
	it('gives the frame as a JPEG data URL', async () => {
		expect(await previewFrame(at('clip.mp4'), 1)).toMatch(/^data:image\/jpeg;base64,\/9j\//)
	})
})

describe('setThumbnailFrame', () => {
	it('replaces the thumbnail with the frame and gives the entry a new thumbnailVersion', async () => {
		const result = await setThumbnailFrame(dir, 'v1', 1.5)
		expect(result).toMatchObject({
			ok: true,
			video: { thumbnailPath: at('.thumbnails', 'clip.jpg') }
		})
		expect(result.ok && typeof result.video.thumbnailVersion).toBe('number')
		expect(await isJpeg(at('.thumbnails', 'clip.jpg'))).toBe(true)
		expect(await fs.readdir(at('.thumbnails'))).toEqual(['clip.jpg'])
		const saved = (await loadLibrary(dir))?.files.find((f) => f.id === 'v1')
		expect(saved?.thumbnailVersion).toBe(result.ok && result.video.thumbnailVersion)
	})

	it('refuses photos and unknown entries', async () => {
		expect((await setThumbnailFrame(dir, 'p1', 1)).ok).toBe(false)
		expect((await setThumbnailFrame(dir, 'nope', 1)).ok).toBe(false)
	})
})
