import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VideoFile } from '../../../../shared/types/video'
import { loadLibrary, saveLibrary } from '../library'
import { toRelative } from '../libraryPaths'

// library.ts only needs deleteFile from utils; mocking it avoids loading ExifTool
vi.mock('../../../metadata/utils', () => ({ deleteFile: vi.fn() }))

let root: string
const at = (...parts: string[]): string => path.join(root, ...parts)
const entry = (id: string, filePath: string, thumbnailPath?: string): VideoFile => ({
	id,
	fileName: path.basename(filePath.replace(/\\/g, '/')),
	filePath,
	thumbnailPath,
	mediaType: 'video',
	tags: [],
	favourited: false,
	rawTags: ''
})
const writeRawLibrary = (files: object[]): Promise<void> =>
	fs.writeFile(at('library.json'), JSON.stringify({ files, categories: {}, tags: [] }))

beforeEach(async () => {
	root = await fs.mkdtemp(path.join(os.tmpdir(), 'vidbase-paths-'))
	await fs.mkdir(at('Holidays', '.thumbnails'), { recursive: true })
	await fs.writeFile(at('Holidays', 'Beach.mp4'), 'video')
	await fs.writeFile(at('Holidays', '.thumbnails', 'Beach.jpg'), 'thumbnail')
	await fs.writeFile(at('Top.mp4'), 'video')
	vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(async () => {
	vi.restoreAllMocks()
	await fs.rm(root, { recursive: true, force: true })
})

describe('toRelative', () => {
	it('gives the path inside the folder with "/" separators, or null outside it', () => {
		expect(toRelative(root, at('Holidays', 'Beach.mp4'))).toBe('Holidays/Beach.mp4')
		expect(toRelative(root, path.join(root, '..', 'elsewhere.mp4'))).toBeNull()
		expect(toRelative(root, root)).toBeNull()
	})
})

describe('library.json paths', () => {
	it('saves each entry with its paths relative to the library folder, keeping the absolute ones', async () => {
		await saveLibrary(root, [
			entry('a', at('Holidays', 'Beach.mp4'), at('Holidays', '.thumbnails', 'Beach.jpg'))
		])
		const [stored] = JSON.parse(await fs.readFile(at('library.json'), 'utf-8')).files
		expect(stored).toMatchObject({
			filePath: at('Holidays', 'Beach.mp4'),
			relativePath: 'Holidays/Beach.mp4',
			relativeThumbnailPath: 'Holidays/.thumbnails/Beach.jpg'
		})
	})

	it('uses the relative paths when the folder is mounted somewhere else', async () => {
		// As saved on another computer, where the drive was E:\Videos
		await writeRawLibrary([
			{
				...entry(
					'a',
					'E:\\Videos\\Holidays\\Beach.mp4',
					'E:\\Videos\\Holidays\\.thumbnails\\Beach.jpg'
				),
				relativePath: 'Holidays/Beach.mp4',
				relativeThumbnailPath: 'Holidays/.thumbnails/Beach.jpg'
			}
		])
		const [file] = (await loadLibrary(root))!.files
		expect(file.filePath).toBe(at('Holidays', 'Beach.mp4'))
		expect(file.thumbnailPath).toBe(at('Holidays', '.thumbnails', 'Beach.jpg'))
		expect(file).not.toHaveProperty('relativePath')
	})

	it('keeps the absolute paths of an older library saved on this computer', async () => {
		await writeRawLibrary([entry('a', at('Holidays', 'Beach.mp4'))])
		expect((await loadLibrary(root))!.files[0].filePath).toBe(at('Holidays', 'Beach.mp4'))
	})

	it('moves the paths of an older library saved on Windows under the folder', async () => {
		await writeRawLibrary([
			entry(
				'a',
				'E:\\Videos\\Holidays\\Beach.mp4',
				'E:\\Videos\\Holidays\\.thumbnails\\Beach.jpg'
			),
			entry('b', 'E:\\Videos\\Top.mp4'),
			// Deleted since: still moved under the folder, so the scan sees it as missing, not foreign
			entry('c', 'E:\\Videos\\Gone.mp4')
		])
		const files = (await loadLibrary(root))!.files
		expect(files.map((f) => f.filePath)).toEqual([
			at('Holidays', 'Beach.mp4'),
			at('Top.mp4'),
			at('Gone.mp4')
		])
		expect(files[0].thumbnailPath).toBe(at('Holidays', '.thumbnails', 'Beach.jpg'))
	})

	it('moves the paths of an older library saved on Linux at another mount point', async () => {
		await writeRawLibrary([entry('a', '/run/media/someone/Juber/Videos/Holidays/Beach.mp4')])
		expect((await loadLibrary(root))!.files[0].filePath).toBe(at('Holidays', 'Beach.mp4'))
	})

	it('leaves alone paths whose files cannot be found under the folder', async () => {
		await writeRawLibrary([entry('a', 'Z:\\Other\\unknown.mp4')])
		expect((await loadLibrary(root))!.files[0].filePath).toBe('Z:\\Other\\unknown.mp4')
	})

	it('writes the relative paths at the next save of an older library', async () => {
		await writeRawLibrary([entry('a', 'E:\\Videos\\Top.mp4')])
		const library = await loadLibrary(root)
		await saveLibrary(root, library!.files, library)
		const [stored] = JSON.parse(await fs.readFile(at('library.json'), 'utf-8')).files
		expect(stored).toMatchObject({ filePath: at('Top.mp4'), relativePath: 'Top.mp4' })
	})
})
