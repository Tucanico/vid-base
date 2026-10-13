import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMovieArchivioFromFolders } from '../movieParser'

let dir: string
let archive: string
const savedKey = process.env.TMDB_API_KEY

beforeEach(async () => {
	dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidbase-movies-'))
	archive = path.join(dir, 'Archivio.xlsx')
})

afterEach(async () => {
	if (savedKey === undefined) delete process.env.TMDB_API_KEY
	else process.env.TMDB_API_KEY = savedKey
	await fs.rm(dir, { recursive: true, force: true })
})

describe('createMovieArchivioFromFolders with an existing Archivio.xlsx', () => {
	it('keeps it and returns its path when the user does not confirm', async () => {
		process.env.TMDB_API_KEY = 'test-key'
		await fs.writeFile(archive, 'existing')
		const confirmOverwrite = vi.fn().mockResolvedValue(false)
		await expect(createMovieArchivioFromFolders(dir, dir, confirmOverwrite)).resolves.toBe(
			archive
		)
		expect(confirmOverwrite).toHaveBeenCalledWith(archive)
		expect(await fs.readFile(archive, 'utf-8')).toBe('existing')
	})

	it('replaces it when the user confirms', async () => {
		process.env.TMDB_API_KEY = 'test-key'
		await fs.writeFile(archive, 'existing')
		const confirmOverwrite = vi.fn().mockResolvedValue(true)
		await expect(createMovieArchivioFromFolders(dir, dir, confirmOverwrite)).resolves.toBe(
			archive
		)
		// An .xlsx file is a zip archive
		expect((await fs.readFile(archive)).subarray(0, 2).toString()).toBe('PK')
	})

	it('keeps it without asking when there is no TMDb key to build a new one', async () => {
		delete process.env.TMDB_API_KEY
		await fs.writeFile(archive, 'existing')
		const confirmOverwrite = vi.fn()
		await expect(createMovieArchivioFromFolders(dir, dir, confirmOverwrite)).resolves.toBe(
			archive
		)
		expect(confirmOverwrite).not.toHaveBeenCalled()
		expect(await fs.readFile(archive, 'utf-8')).toBe('existing')
	})
})

describe('createMovieArchivioFromFolders without an archive', () => {
	it('still requires a TMDb key', async () => {
		delete process.env.TMDB_API_KEY
		await expect(createMovieArchivioFromFolders(dir, dir, vi.fn())).rejects.toThrow(
			'TMDB_API_KEY is required'
		)
	})
})
