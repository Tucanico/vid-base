import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VideoFile } from '../../../../shared/types/video'
import { loadLibrary, saveLibrary } from '../library'
import { renameVideoFile, validateBaseName } from '../rename'

// library.ts only needs deleteFile from utils; mocking it avoids loading ExifTool
vi.mock('../../../metadata/utils', () => ({ deleteFile: vi.fn() }))
// saveLibrary can be made to fail, to check that a failed rename is undone
const saveFailure = vi.hoisted(() => ({ fail: false }))
vi.mock('../library', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../library')>()
	return {
		...actual,
		saveLibrary: async (...args: Parameters<typeof actual.saveLibrary>): Promise<void> => {
			if (saveFailure.fail) throw Object.assign(new Error('EIO: i/o error'), { code: 'EIO' })
			return actual.saveLibrary(...args)
		}
	}
})

let dir: string
const exists = (file: string): Promise<boolean> =>
	fs.access(file).then(
		() => true,
		() => false
	)
const at = (...parts: string[]): string => path.join(dir, ...parts)

beforeEach(async () => {
	dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidbase-rename-'))
	await fs.mkdir(at('.thumbnails'))
	await fs.writeFile(at('Beach day.mp4'), 'video')
	await fs.writeFile(at('.thumbnails', 'Beach day.jpg'), 'thumbnail')
	const entry: VideoFile = {
		id: 'v1',
		fileName: 'Beach day.mp4',
		filePath: at('Beach day.mp4'),
		thumbnailPath: at('.thumbnails', 'Beach day.jpg'),
		mediaType: 'video',
		tags: [{ type: 'simple', value: 'summer', original: 'summer' }],
		favourited: true,
		rawTags: 'summer; fav'
	}
	await saveLibrary(dir, [entry], { files: [], categories: {}, tags: ['summer'] })
	saveFailure.fail = false
	vi.spyOn(console, 'log').mockImplementation(() => {})
	vi.spyOn(console, 'warn').mockImplementation(() => {})
	vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(async () => {
	vi.restoreAllMocks()
	await fs.rm(dir, { recursive: true, force: true })
})

describe('validateBaseName', () => {
	it('accepts ordinary names, including dots and non-ASCII letters', () => {
		expect(validateBaseName('Beach day 2', '.mp4')).toBeNull()
		expect(validateBaseName('Sommer.am.Strand – Teil 1', '.mp4')).toBeNull()
	})

	it('refuses names that would not work on Windows', () => {
		expect(validateBaseName('', '.mp4')).toMatch(/empty/)
		expect(validateBaseName('a:b', '.mp4')).toMatch(/cannot contain/)
		expect(validateBaseName('a?b', '.mp4')).toMatch(/cannot contain/)
		expect(validateBaseName('a/b', '.mp4')).toMatch(/cannot contain/)
		expect(validateBaseName('tab\there', '.mp4')).toMatch(/cannot contain/)
		expect(validateBaseName('ends with dot.', '.mp4')).toMatch(/end with/)
		expect(validateBaseName('CON', '.mp4')).toMatch(/reserves/)
		expect(validateBaseName('lpt1.backup', '.mp4')).toMatch(/reserves/)
		expect(validateBaseName('x'.repeat(260), '.mp4')).toMatch(/too long/)
	})
})

describe('renameVideoFile', () => {
	it('renames the file and its thumbnail, and updates the library entry keeping its id', async () => {
		const result = await renameVideoFile(dir, 'v1', '  Beach at sunset  ')
		expect(result).toMatchObject({
			ok: true,
			video: {
				id: 'v1',
				fileName: 'Beach at sunset.mp4',
				filePath: at('Beach at sunset.mp4'),
				thumbnailPath: at('.thumbnails', 'Beach at sunset.jpg'),
				favourited: true
			}
		})
		expect(await exists(at('Beach day.mp4'))).toBe(false)
		expect(await fs.readFile(at('Beach at sunset.mp4'), 'utf-8')).toBe('video')
		expect(await fs.readFile(at('.thumbnails', 'Beach at sunset.jpg'), 'utf-8')).toBe('thumbnail')
		const library = await loadLibrary(dir)
		expect(library?.files.map((f) => [f.id, f.filePath])).toEqual([
			['v1', at('Beach at sunset.mp4')]
		])
		expect(library?.tags).toEqual(['summer'])
	})

	it('keeps the extension, even if the new name contains a dot', async () => {
		const result = await renameVideoFile(dir, 'v1', 'Clip.final')
		expect(result.ok && result.video.fileName).toBe('Clip.final.mp4')
	})

	it('never overwrites another file', async () => {
		await fs.writeFile(at('Other.mp4'), 'other')
		const result = await renameVideoFile(dir, 'v1', 'Other')
		expect(result).toEqual({ ok: false, error: '"Other.mp4" already exists in this folder.' })
		expect(await fs.readFile(at('Other.mp4'), 'utf-8')).toBe('other')
		expect(await exists(at('Beach day.mp4'))).toBe(true)
	})

	it('does not overwrite a different file whose name only differs in case', async () => {
		// The test folder is case-sensitive, so this is another file, not the same one
		await fs.writeFile(at('beach day.mp4'), 'another video')
		const result = await renameVideoFile(dir, 'v1', 'beach day')
		expect(result.ok).toBe(false)
		expect(await fs.readFile(at('beach day.mp4'), 'utf-8')).toBe('another video')
	})

	it('refuses an invalid name without touching anything', async () => {
		const result = await renameVideoFile(dir, 'v1', 'bad:name')
		expect(result.ok).toBe(false)
		expect(await exists(at('Beach day.mp4'))).toBe(true)
	})

	it('does nothing when the name does not change', async () => {
		const result = await renameVideoFile(dir, 'v1', 'Beach day')
		expect(result).toMatchObject({ ok: true, video: { filePath: at('Beach day.mp4') } })
	})

	it("keeps the old thumbnail name when another file's thumbnail already has the new one", async () => {
		await fs.writeFile(at('.thumbnails', 'Clip.jpg'), 'clip thumbnail')
		const result = await renameVideoFile(dir, 'v1', 'Clip')
		expect(result).toMatchObject({
			ok: true,
			video: { filePath: at('Clip.mp4'), thumbnailPath: at('.thumbnails', 'Beach day.jpg') }
		})
		expect(await fs.readFile(at('.thumbnails', 'Clip.jpg'), 'utf-8')).toBe('clip thumbnail')
	})

	it('reports an entry or file that is gone', async () => {
		expect((await renameVideoFile(dir, 'nope', 'X')).ok).toBe(false)
		await fs.rm(at('Beach day.mp4'))
		expect(await renameVideoFile(dir, 'v1', 'X')).toMatchObject({
			ok: false,
			error: expect.stringMatching(/no longer on the drive/)
		})
	})

	it('puts the file and thumbnail back if library.json cannot be saved', async () => {
		saveFailure.fail = true
		await expect(renameVideoFile(dir, 'v1', 'Beach at sunset')).rejects.toMatchObject({
			code: 'EIO'
		})
		expect(await exists(at('Beach day.mp4'))).toBe(true)
		expect(await exists(at('.thumbnails', 'Beach day.jpg'))).toBe(true)
		expect(await exists(at('Beach at sunset.mp4'))).toBe(false)
		expect((await loadLibrary(dir))?.files[0].filePath).toBe(at('Beach day.mp4'))
	})
})
