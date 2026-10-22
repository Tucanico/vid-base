import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addRecentFolder, getRecentFolders, removeRecentFolder } from '../recentFolders'

// The tests run in Node, which has no localStorage: a small in-memory one stands in for it
let store: Map<string, string>
beforeEach(() => {
	store = new Map()
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => void store.set(key, value)
	})
})
afterEach(() => {
	vi.unstubAllGlobals()
})

describe('recent folders', () => {
	it('lists the folders newest first, once per mode and folder', () => {
		addRecentFolder('videos', '/a')
		addRecentFolder('movies', '/b')
		addRecentFolder('videos', '/a')
		expect(getRecentFolders().map((f) => `${f.mode} ${f.folder}`)).toEqual([
			'videos /a',
			'movies /b'
		])
	})

	it('keeps the same folder separately for each mode', () => {
		addRecentFolder('videos', '/a')
		addRecentFolder('movies', '/a')
		expect(getRecentFolders()).toHaveLength(2)
	})

	it('keeps at most 8', () => {
		for (let i = 0; i < 10; i++) addRecentFolder('videos', `/f${i}`)
		const folders = getRecentFolders()
		expect(folders).toHaveLength(8)
		expect(folders[0].folder).toBe('/f9')
	})

	it('removes a folder', () => {
		addRecentFolder('videos', '/a')
		addRecentFolder('videos', '/b')
		removeRecentFolder('videos', '/a')
		expect(getRecentFolders().map((f) => f.folder)).toEqual(['/b'])
	})

	it('treats stored junk as an empty list, and works without storage', () => {
		store.set('vidbase.recentFolders', '{not json')
		expect(getRecentFolders()).toEqual([])
		store.set('vidbase.recentFolders', JSON.stringify([{ mode: 'x', folder: 1 }, 'y']))
		expect(getRecentFolders()).toEqual([])
		vi.stubGlobal('localStorage', undefined)
		expect(getRecentFolders()).toEqual([])
		expect(() => addRecentFolder('videos', '/a')).not.toThrow()
	})
})
