import { describe, expect, it } from 'vitest'
import { sanitizeFileName } from '../sanitizeFileName'

describe('sanitizeFileName', () => {
	it('removes leading bracket tags', () => {
		expect(sanitizeFileName('[Test] Ciaone')).toBe('Ciaone')
		expect(sanitizeFileName('[HD]   My Title')).toBe('My Title')
	})

	it('removes the file extension', () => {
		expect(sanitizeFileName('file.mp4')).toBe('file')
		expect(sanitizeFileName('My.Movie.Title.mkv')).toBe('My.Movie.Title')
	})

	it('handles brackets and extensions together', () => {
		expect(sanitizeFileName(' [Tag] Movie.Name.avi ')).toBe('Movie.Name')
	})

	it('keeps names without extensions intact', () => {
		expect(sanitizeFileName('NoExtension')).toBe('NoExtension')
	})
})
