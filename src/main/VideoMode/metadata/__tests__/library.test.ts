import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Library } from '../../../../shared/types/library'
import { loadLibrary, saveLibrary, saveSavedViews } from '../library'

// library.ts only needs deleteFile from utils; mocking it avoids loading ExifTool
vi.mock('../../../metadata/utils', () => ({ deleteFile: vi.fn() }))

let dir: string
let libraryPath: string
const listDir = async (): Promise<string[]> => (await fs.readdir(dir)).sort()

beforeEach(async () => {
	dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidbase-library-'))
	libraryPath = path.join(dir, 'library.json')
	vi.spyOn(console, 'log').mockImplementation(() => {})
	vi.spyOn(console, 'warn').mockImplementation(() => {})
	vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(async () => {
	vi.restoreAllMocks()
	await fs.rm(dir, { recursive: true, force: true })
})

describe('loadLibrary', () => {
	it('returns null when there is no library.json, without creating anything', async () => {
		expect(await loadLibrary(dir)).toBeNull()
		expect(await listDir()).toEqual([])
	})

	it('moves a truncated library.json aside instead of leaving it to be overwritten', async () => {
		await fs.writeFile(libraryPath, '{"files": [ {"id": "trunc')
		expect(await loadLibrary(dir)).toBeNull()
		const files = await listDir()
		expect(files).not.toContain('library.json')
		expect(files).toHaveLength(1)
		expect(files[0]).toMatch(/^library\.corrupt-.+\.json$/)
		expect(await fs.readFile(path.join(dir, files[0]), 'utf-8')).toBe('{"files": [ {"id": "trunc')
	})

	it('moves a library.json with the wrong shape aside', async () => {
		await fs.writeFile(libraryPath, '[1, 2, 3]')
		expect(await loadLibrary(dir)).toBeNull()
		const files = await listDir()
		expect(files).not.toContain('library.json')
		expect(files[0]).toMatch(/^library\.corrupt-.+\.json$/)
	})

	it('throws filesystem errors instead of returning null', async () => {
		// A directory where library.json should be makes readFile fail with EISDIR
		await fs.mkdir(libraryPath)
		await expect(loadLibrary(dir)).rejects.toMatchObject({ code: 'EISDIR' })
	})
})

describe('saveLibrary', () => {
	it('writes library.json without leaving the temporary file behind', async () => {
		await saveLibrary(dir, [])
		expect(await listDir()).toEqual(['library.json'])
	})

	it('keeps the existing categories and tags', async () => {
		const existing: Library = { files: [], categories: { genre: ['doc'] }, tags: ['keep-me'] }
		await saveLibrary(dir, [], existing)
		const loaded = await loadLibrary(dir)
		expect(loaded?.categories.genre).toEqual(['doc'])
		expect(loaded?.tags).toEqual(['keep-me'])
	})

	it('replaces an existing library.json', async () => {
		await saveLibrary(dir, [], { files: [], categories: {}, tags: ['old'] })
		await saveLibrary(dir, [], { files: [], categories: {}, tags: ['new'] })
		expect((await loadLibrary(dir))?.tags).toEqual(['new'])
		expect(await listDir()).toEqual(['library.json'])
	})
})

describe('saved searches', () => {
	const view = {
		id: 'v1',
		name: 'Anna on holiday',
		list: 'library' as const,
		filters: { simpleTag: [], model: ['Anna'] },
		searchQuery: 'beach',
		sortField: 'name',
		sortDirection: 'asc' as const
	}

	it('are kept by every save of the library', async () => {
		await saveLibrary(dir, [])
		await saveSavedViews(dir, [view])
		const library = await loadLibrary(dir)
		// An ordinary save (a scan, a tag change) passes the loaded library along
		await saveLibrary(dir, [], library)
		expect((await loadLibrary(dir))?.savedViews).toEqual([view])
	})

	it('can be replaced', async () => {
		await saveLibrary(dir, [])
		await saveSavedViews(dir, [view])
		await saveSavedViews(dir, [])
		expect((await loadLibrary(dir))?.savedViews).toEqual([])
	})

	it('need a library to be saved in', async () => {
		await expect(saveSavedViews(dir, [view])).rejects.toThrow(/no library/)
	})
})
