import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import ExcelJS from 'exceljs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Movie } from '../../../../shared/types/movie'
import { searchMovieFoldersRecursively } from '../movieFolders'
import { findExcelFile, parseMovieExcel } from '../movieParser'

// Movie Mode deletes the Excel rows of movies whose folder it did not find, so a folder that could
// not be read must never look like a folder without movies. readdir is replaced to fail on demand
const readdir = vi.fn()
vi.mock('fs/promises', async (importOriginal) => {
	const actual = await importOriginal<typeof import('fs/promises')>()
	return { ...actual, readdir: (...args: unknown[]) => readdir(...args) }
})

const folder = (
	name: string
): { name: string; isDirectory: () => boolean; isFile: () => boolean } => ({
	name,
	isDirectory: () => true,
	isFile: () => false
})
const fsError = (code: string): NodeJS.ErrnoException =>
	Object.assign(new Error(`${code}: failed`), { code })
const alphaMovie = (): Movie => ({
	id: '1',
	title: 'Alpha Movie',
	director: 'Mario Rossi',
	actors: [],
	genres: []
})

beforeEach(() => {
	readdir.mockReset()
	vi.spyOn(console, 'error').mockImplementation(() => {})
	vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('searchMovieFoldersRecursively', () => {
	it('rethrows a drive error from a movie folder', async () => {
		readdir.mockImplementation(async (p: string) =>
			p === '/root' ? [folder('Alpha Movie (2001)')] : Promise.reject(fsError('EIO'))
		)
		await expect(
			searchMovieFoldersRecursively('/root', [alphaMovie()], new Set(), '/root')
		).rejects.toMatchObject({ code: 'EIO' })
	})

	it('skips a subfolder it is not allowed to read', async () => {
		readdir.mockImplementation(async (p: string) =>
			p === '/root' ? [folder('System Volume Information')] : Promise.reject(fsError('EACCES'))
		)
		const movie = alphaMovie()
		await expect(
			searchMovieFoldersRecursively('/root', [movie], new Set(), '/root')
		).resolves.toBeUndefined()
		expect(movie.folderPath).toBeUndefined()
	})

	it('rethrows any error reading the movies root', async () => {
		readdir.mockRejectedValue(fsError('EACCES'))
		await expect(
			searchMovieFoldersRecursively('/root', [alphaMovie()], new Set(), '/root')
		).rejects.toMatchObject({ code: 'EACCES' })
	})
})

describe('findExcelFile', () => {
	it('rethrows a drive error instead of reporting that there is no archive', async () => {
		readdir.mockRejectedValue(fsError('EIO'))
		await expect(findExcelFile('/root')).rejects.toMatchObject({ code: 'EIO' })
	})

	it('returns null for other errors, as before', async () => {
		readdir.mockRejectedValue(fsError('EACCES'))
		await expect(findExcelFile('/root')).resolves.toBeNull()
	})
})

describe('parseMovieExcel with an unreadable movies folder', () => {
	let dir: string

	beforeEach(async () => {
		dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidbase-archive-'))
	})

	afterEach(async () => {
		await fs.rm(dir, { recursive: true, force: true })
	})

	it('loads the movies and leaves every row in the Excel file', async () => {
		const archive = path.join(dir, 'Archivio.xlsx')
		const workbook = new ExcelJS.Workbook()
		const sheet = workbook.addWorksheet('Archivio')
		sheet.addRow(['TITOLO', 'REGISTA'])
		sheet.addRow(['Alpha Movie', 'Rossi, Mario'])
		sheet.addRow(['Beta Doc', 'Bianchi, Anna'])
		await workbook.xlsx.writeFile(archive)

		readdir.mockRejectedValue(fsError('EACCES'))
		const result = await parseMovieExcel(archive, dir)

		expect(result.movies.map((m) => m.title)).toEqual(['Alpha Movie', 'Beta Doc'])
		const after = new ExcelJS.Workbook()
		await after.xlsx.readFile(archive)
		expect(after.worksheets[0].rowCount).toBe(3)
	})
})
