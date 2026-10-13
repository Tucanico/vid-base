import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isTransientDriveError, withRetry } from '../driveRetry'

const fsError = (code: string): NodeJS.ErrnoException =>
	Object.assign(new Error(`${code}: failed`), { code })

describe('isTransientDriveError', () => {
	it('is true for drive I/O error codes', () => {
		for (const code of ['EIO', 'EAGAIN', 'EBUSY', 'ETIMEDOUT', 'EREMOTEIO']) {
			expect(isTransientDriveError(fsError(code))).toBe(true)
		}
	})

	it('is false for other errors', () => {
		expect(isTransientDriveError(fsError('ENOENT'))).toBe(false)
		expect(isTransientDriveError(fsError('EACCES'))).toBe(false)
		expect(isTransientDriveError(new SyntaxError('bad JSON'))).toBe(false)
		expect(isTransientDriveError(null)).toBe(false)
		expect(isTransientDriveError('EIO')).toBe(false)
	})
})

describe('withRetry', () => {
	beforeEach(() => {
		vi.spyOn(console, 'warn').mockImplementation(() => {})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('returns the result without retrying when fn succeeds', async () => {
		const fn = vi.fn().mockResolvedValue('ok')
		await expect(withRetry(fn, 3, 1)).resolves.toBe('ok')
		expect(fn).toHaveBeenCalledTimes(1)
	})

	it('retries a transient drive error and returns once fn succeeds', async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(fsError('EIO'))
			.mockRejectedValueOnce(fsError('EBUSY'))
			.mockResolvedValue('ok')
		await expect(withRetry(fn, 3, 1)).resolves.toBe('ok')
		expect(fn).toHaveBeenCalledTimes(3)
	})

	it('gives up after maxAttempts and throws the last error', async () => {
		const fn = vi.fn().mockRejectedValue(fsError('EIO'))
		await expect(withRetry(fn, 3, 1)).rejects.toMatchObject({ code: 'EIO' })
		expect(fn).toHaveBeenCalledTimes(3)
	})

	it('does not retry other errors', async () => {
		const fn = vi.fn().mockRejectedValue(fsError('ENOENT'))
		await expect(withRetry(fn, 3, 1)).rejects.toMatchObject({ code: 'ENOENT' })
		expect(fn).toHaveBeenCalledTimes(1)
	})
})
