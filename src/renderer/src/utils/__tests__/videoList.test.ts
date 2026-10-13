import { describe, expect, it } from 'vitest'
import { VideoFile } from '@shared/types/video'
import { pickNewRandomIds } from '../videoList'

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
