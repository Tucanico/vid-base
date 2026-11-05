import { execFileSync } from 'child_process'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import ffmpegPath from 'ffmpeg-static'
import { WriteTags } from 'exiftool-vendored'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ourExiftool } from '../../../metadata/utils'
import { parseTags, tagsFromMetadata } from '../scanner'
import { updateVideoTags } from '../updateTags'

// With the real ExifTool: which fields a save leaves in each format is ExifTool's doing, not VidBase's
const FORMATS = ['clip.mp4', 'clip.mov', 'photo.jpg', 'photo.png']
let sources: string

// The fields that hold tags, as stored. MWG ones are composites ExifTool computes from the others
const tagFields = async (file: string): Promise<Record<string, unknown>> => {
	const raw = await ourExiftool.readRaw(file, ['-G1', '-a'])
	return Object.fromEntries(
		Object.entries(raw).filter(
			([key]) =>
				/Keywords|Subject|Category|Description|Comment|Caption/.test(key) &&
				!/^(MWG|ExifTool):|HandlerDescription$/.test(key)
		)
	)
}

beforeAll(async () => {
	sources = await fs.mkdtemp(path.join(os.tmpdir(), 'vidbase-tags-'))
	const ffmpeg = (args: string[]): void => {
		execFileSync(ffmpegPath as unknown as string, ['-loglevel', 'error', '-f', 'lavfi', ...args])
	}
	for (const clip of ['clip.mp4', 'clip.mov']) {
		ffmpeg([
			'-i',
			'testsrc=duration=1:size=160x120:rate=10',
			'-pix_fmt',
			'yuv420p',
			path.join(sources, clip)
		])
	}
	for (const photo of ['photo.jpg', 'photo.png']) {
		ffmpeg(['-i', 'testsrc=size=160x120', '-frames:v', '1', path.join(sources, photo)])
	}
})

afterAll(async () => {
	await ourExiftool.end()
	await fs.rm(sources, { recursive: true, force: true })
})

describe('updateVideoTags', () => {
	it.each(FORMATS)(
		'%s: keeps the tags only in XMP dc:subject, and the scan reads them back',
		async (name) => {
			const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'vidbase-save-')), name)
			await fs.copyFile(path.join(sources, name), file)
			// A file saved by an older version: the same tags in six fields. In MP4s Windows keeps its own
			// copy in the Microsoft box
			const list = ['model:Old', 'old', 'fav']
			const text = list.join('; ')
			await ourExiftool.write(
				file,
				{
					XPKeywords: text,
					Keywords: list,
					Subject: list,
					Category: text,
					Description: text,
					Comment: text,
					...(name.endsWith('.mp4') ? { 'Microsoft:Category': 'model:Old, windows' } : {})
				} as WriteTags,
				{ writeArgs: ['-overwrite_original'] }
			)
			expect(Object.keys(await tagFields(file)).length).toBeGreaterThan(3)

			await updateVideoTags(file, parseTags('model:Anna Rossi; holiday'), true)
			expect(await tagFields(file)).toEqual({
				'XMP-dc:Subject': ['model:Anna Rossi', 'holiday', 'fav']
			})
			expect(tagsFromMetadata(await ourExiftool.read(file))).toMatchObject({
				rawTags: 'model:Anna Rossi; holiday; fav',
				favourited: true
			})

			// Removing every tag leaves none behind
			await updateVideoTags(file, [], false)
			expect(await tagFields(file)).toEqual({})
			expect(tagsFromMetadata(await ourExiftool.read(file)).tags).toEqual([])
		},
		30000
	)
})
