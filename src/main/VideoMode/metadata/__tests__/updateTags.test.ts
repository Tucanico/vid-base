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
// What the picture needs, per format: a save must leave it as it was
const NEEDED: Record<string, string[]> = {
	'clip.mp4': ['QuickTime:Duration'],
	'clip.mov': ['QuickTime:Duration'],
	'photo.jpg': ['ICC_Profile:ProfileCopyright', 'IFD0:Orientation'],
	'photo.png': ['ICC_Profile:ProfileCopyright', 'PNG:Gamma', 'PNG:SRGBRendering']
}
// Fields that are not tags, as the test writes them: a save deletes them
const isOtherField = (key: string): boolean =>
	/:(Title|Copyright|LastKeywordXMP|Make|GPS\w*|Track\d+Name)$/.test(key) &&
	!/^(ExifTool|System|File):/.test(key)
let sources: string
let iccFile: string

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
	// Each clip's video track has a name, like the release names some downloads carry
	for (const clip of ['clip.mp4', 'clip.mov']) {
		ffmpeg([
			'-i',
			'testsrc=duration=1:size=160x120:rate=10',
			'-pix_fmt',
			'yuv420p',
			'-metadata:s:v',
			'title=Some.Release.Name',
			path.join(sources, clip)
		])
	}
	for (const photo of ['photo.jpg', 'photo.png']) {
		ffmpeg(['-i', 'testsrc=size=160x120', '-frames:v', '1', path.join(sources, photo)])
	}
	// A minimal colour profile: the header and one tag, a copyright text (ExifTool rejects an empty tag table)
	const icc = Buffer.alloc(160)
	icc.writeUInt32BE(160, 0)
	icc.writeUInt32BE(0x02100000, 8)
	icc.write('mntrRGB XYZ ', 12, 'latin1')
	icc.write('acsp', 36, 'latin1')
	icc.writeUInt32BE(1, 128)
	icc.write('cprt', 132, 'latin1')
	icc.writeUInt32BE(144, 136)
	icc.writeUInt32BE(13, 140)
	icc.write('text', 144, 'latin1')
	icc.write('Test', 152, 'latin1')
	iccFile = path.join(sources, 'profile.icc')
	await fs.writeFile(iccFile, icc)
})

afterAll(async () => {
	await ourExiftool.end()
	await fs.rm(sources, { recursive: true, force: true })
})

describe('updateVideoTags', () => {
	it.each(FORMATS)(
		'%s: keeps only the tags, in XMP dc:subject, and what the picture needs; the scan reads them back',
		async (name) => {
			const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'vidbase-save-')), name)
			await fs.copyFile(path.join(sources, name), file)
			// A file saved by an older version: the same tags in six fields. In MP4s Windows keeps its own
			// copy in the Microsoft box, in photos another in XMP. Plus fields that are not tags, and what
			// the picture needs: a colour profile, a sideways photo's orientation, a PNG's gamma and sRGB
			const list = ['model:Old', 'old', 'fav']
			const text = list.join('; ')
			const photo = name.startsWith('photo.')
			await ourExiftool.write(
				file,
				{
					XPKeywords: text,
					Keywords: list,
					Subject: list,
					Category: text,
					Description: text,
					Comment: text,
					...(name.endsWith('.mp4') ? { 'Microsoft:Category': 'model:Old, windows' } : {}),
					Title: 'Seen on some site',
					Copyright: 'Some site',
					'XMP-microsoft:LastKeywordXMP': list,
					...(name.endsWith('.jpg')
						? {
								Make: 'Camera',
								GPSLatitude: 50.7,
								GPSLongitude: 19.8,
								'IFD0:Orientation#': 6
							}
						: {}),
					...(name.endsWith('.png')
						? { 'PNG:Gamma': 2.2, 'PNG:SRGBRendering': 'Perceptual' }
						: {})
				} as WriteTags,
				{ writeArgs: ['-overwrite_original', ...(photo ? [`-ICC_Profile<=${iccFile}`] : [])] }
			)
			const before: Record<string, unknown> = await ourExiftool.readRaw(file, ['-G1', '-a'])
			expect(Object.keys(await tagFields(file)).length).toBeGreaterThan(3)
			expect(Object.keys(before).filter(isOtherField).length).toBeGreaterThan(2)
			if (!photo) expect(before['VideoUserData:Track1Name']).toBe('Some.Release.Name')
			for (const key of NEEDED[name]) expect(before[key]).toBeDefined()

			await updateVideoTags(file, parseTags('model:Anna Rossi; holiday'), true)
			expect(await tagFields(file)).toEqual({
				'XMP-dc:Subject': ['model:Anna Rossi', 'holiday', 'fav']
			})
			const after: Record<string, unknown> = await ourExiftool.readRaw(file, ['-G1', '-a'])
			expect(Object.keys(after).filter(isOtherField)).toEqual([])
			for (const key of NEEDED[name]) expect(after[key]).toEqual(before[key])
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
