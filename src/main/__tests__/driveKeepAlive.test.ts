import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startKeepAlive, stopKeepAlive } from '../driveKeepAlive'

const exists = (file: string): Promise<boolean> =>
	fs.access(file).then(
		() => true,
		() => false
	)

let first: string
let second: string

beforeEach(async () => {
	first = await fs.mkdtemp(path.join(os.tmpdir(), 'vidbase-keepalive-'))
	second = await fs.mkdtemp(path.join(os.tmpdir(), 'vidbase-keepalive-'))
	vi.useFakeTimers()
})

afterEach(async () => {
	stopKeepAlive()
	vi.useRealTimers()
	await fs.rm(first, { recursive: true, force: true })
	await fs.rm(second, { recursive: true, force: true })
})

describe('driveKeepAlive', () => {
	it('writes the keep-alive file in the open folder every 30s', async () => {
		startKeepAlive(first)
		const file = path.join(first, '.vidbase-keepalive')
		expect(await exists(file)).toBe(false)
		await vi.advanceTimersByTimeAsync(30_000)
		await vi.waitFor(async () => expect(await exists(file)).toBe(true))
	})

	it('removes the file when stopped', async () => {
		startKeepAlive(first)
		await vi.advanceTimersByTimeAsync(30_000)
		await vi.waitFor(async () =>
			expect(await exists(path.join(first, '.vidbase-keepalive'))).toBe(true)
		)
		stopKeepAlive()
		expect(await exists(path.join(first, '.vidbase-keepalive'))).toBe(false)
	})

	it('moves to another folder, removing the file from the previous one', async () => {
		startKeepAlive(first)
		await vi.advanceTimersByTimeAsync(30_000)
		await vi.waitFor(async () =>
			expect(await exists(path.join(first, '.vidbase-keepalive'))).toBe(true)
		)
		startKeepAlive(second)
		expect(await exists(path.join(first, '.vidbase-keepalive'))).toBe(false)
		await vi.advanceTimersByTimeAsync(30_000)
		await vi.waitFor(async () =>
			expect(await exists(path.join(second, '.vidbase-keepalive'))).toBe(true)
		)
	})
})
