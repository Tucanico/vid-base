import { describe, expect, it } from 'vitest'
import { formatDuration, formatFileSize } from '../formatters'

describe('formatFileSize', () => {
	it('returns undefined for missing input', () => {
		expect(formatFileSize(undefined)).toBeUndefined()
	})

	it('formats bytes into human readable units', () => {
		expect(formatFileSize(0)).toBe('0 B')
		expect(formatFileSize(1024)).toBe('1.00 KB')
		expect(formatFileSize(1536)).toBe('1.50 KB')
		expect(formatFileSize(1024 * 1024)).toBe('1.00 MB')
	})
})

describe('formatDuration', () => {
	it('returns undefined for missing input', () => {
		expect(formatDuration(undefined)).toBeUndefined()
	})

	it('formats minutes without seconds by default', () => {
		expect(formatDuration(65)).toBe('1m')
		expect(formatDuration(3600)).toBe('1h0m')
	})

	it('formats with seconds when requested', () => {
		expect(formatDuration(65, true)).toBe('1m5s')
		expect(formatDuration(3600, true)).toBe('1h')
		expect(formatDuration(5, true)).toBe('5s')
	})
})
