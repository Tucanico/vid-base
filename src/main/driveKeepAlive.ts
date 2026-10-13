import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'

/**
 * Keeps an external drive awake while a folder on it is open, by writing a small hidden file in
 * that folder and flushing it to the drive every 30s. Most drives spin down after 2-5 minutes
 * without I/O, and the next access then hangs while they spin up.
 * The ping has to reach the drive: reading or stat-ing the folder is answered from the OS cache
 * (measured: 0 bytes of disk I/O), so it never resets the drive's idle timer. A write followed by
 * fsync always does (4 KB per ping). The file is removed when the folder is closed.
 */

const HEARTBEAT_INTERVAL_MS = 30_000
// Ignored by the Video and Movie Mode scans, which only look at media files and Excel files
const KEEP_ALIVE_FILE = '.vidbase-keepalive'

let heartbeatInterval: NodeJS.Timeout | null = null
let activePath: string | null = null

/** Register (or update) the folder path to keep alive. Starts the heartbeat if not running. */
export function startKeepAlive(folderPath: string): void {
	if (activePath && activePath !== folderPath) {
		removeKeepAliveFile(activePath)
	}
	activePath = folderPath
	if (!heartbeatInterval) {
		heartbeatInterval = setInterval(ping, HEARTBEAT_INTERVAL_MS)
	}
}

/** Stop the heartbeat, remove the keep-alive file and clear the active path. */
export function stopKeepAlive(): void {
	if (activePath) {
		removeKeepAliveFile(activePath)
	}
	activePath = null
	if (heartbeatInterval) {
		clearInterval(heartbeatInterval)
		heartbeatInterval = null
	}
}

// Synchronous, because stopKeepAlive runs while the app quits and nothing would wait for it
function removeKeepAliveFile(folderPath: string): void {
	try {
		fsSync.rmSync(path.join(folderPath, KEEP_ALIVE_FILE), { force: true })
	} catch {
		// The drive may be gone or read-only; a leftover file is harmless
	}
}

async function ping(): Promise<void> {
	if (!activePath) return
	try {
		const handle = await fs.open(path.join(activePath, KEEP_ALIVE_FILE), 'w')
		try {
			await handle.writeFile(new Date().toISOString())
			await handle.sync()
		} finally {
			await handle.close()
		}
	} catch {
		// Drive may be temporarily unreachable (or read-only) — silently ignore.
		// The retry logic in the IPC handlers will handle actual failures.
	}
}
