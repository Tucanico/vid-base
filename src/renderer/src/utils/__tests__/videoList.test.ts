import { describe, expect, it } from 'vitest'
import { VideoFile } from '@shared/types/video'
import { addTabValue, findDuplicateGroups, pickNewRandomIds, sameFilters } from '../videoList'

const videos = (count: number): VideoFile[] =>
	Array.from({ length: count }, (_, i) => ({ id: `v${i}` }) as VideoFile)

describe('pickNewRandomIds', () => {
	it('picks only videos that are not on the home view when there are enough', () => {
		const all = videos(60)
		const current = all.slice(0, 24).map((v) => v.id)
		const picked = pickNewRandomIds(all, current, 24)
		expect(picked).toHaveLength(24)
		expect(new Set(picked).size).toBe(24)
		expect(picked.some((id) => current.includes(id))).toBe(false)
	})

	it('fills in with current videos when there are not enough others', () => {
		const all = videos(30)
		const current = all.slice(0, 24).map((v) => v.id)
		const picked = pickNewRandomIds(all, current, 24)
		expect(picked).toHaveLength(24)
		expect(new Set(picked).size).toBe(24)
		// All 6 videos that were not shown are in, before any current one
		expect(picked.slice(0, 6).sort()).toEqual(['v24', 'v25', 'v26', 'v27', 'v28', 'v29'])
	})

	it('returns every video when there are fewer than asked', () => {
		const all = videos(5)
		expect(pickNewRandomIds(all, ['v0', 'v1'], 24).sort()).toEqual(['v0', 'v1', 'v2', 'v3', 'v4'])
	})
})

describe('addTabValue', () => {
	it('adds the value to its category, once', () => {
		expect(addTabValue({ simpleTag: [] }, 'model', 'Anna')).toEqual({
			simpleTag: [],
			model: ['Anna']
		})
		expect(addTabValue({ simpleTag: [], model: ['Anna'] }, 'model', 'Anna').model).toEqual([
			'Anna'
		])
		expect(addTabValue({ simpleTag: [], model: ['Bea'] }, 'model', 'Anna').model).toEqual([
			'Bea',
			'Anna'
		])
	})
})

describe('sameFilters', () => {
	it('ignores the order of categories and values, and empty categories', () => {
		expect(
			sameFilters(
				{ simpleTag: ['b', 'a'], model: ['Anna'] },
				{ model: ['Anna'], simpleTag: ['a', 'b'], channel: [] }
			)
		).toBe(true)
		expect(
			sameFilters({ simpleTag: [], model: ['Anna'] }, { simpleTag: [], model: ['Bea'] })
		).toBe(false)
		expect(sameFilters({ simpleTag: [] }, { simpleTag: [], model: ['Anna'] })).toBe(false)
	})
})

describe('findDuplicateGroups', () => {
	const file = (
		id: string,
		mediaType: 'video' | 'image',
		fileSize?: number,
		duration?: number
	): VideoFile => ({ id, mediaType, fileSize, duration }) as VideoFile

	it('groups files of the same kind, size and duration, biggest first', () => {
		const groups = findDuplicateGroups([
			file('a', 'video', 100, 60.2),
			file('b', 'video', 100, 59.9),
			file('c', 'video', 100, 90),
			file('d', 'image', 500),
			file('e', 'image', 500),
			file('f', 'video', 500)
		])
		expect(groups.map((g) => g.map((v) => v.id))).toEqual([
			['d', 'e'],
			['a', 'b']
		])
	})

	it('leaves out files without a size, and single files', () => {
		expect(
			findDuplicateGroups([file('a', 'video'), file('b', 'video'), file('c', 'video', 1, 1)])
		).toEqual([])
	})
})
