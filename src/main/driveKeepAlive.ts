import * as fs from 'fs/promises'

/**
 * Keeps an external drive awake by periodically stat-ing the active folder.
 * Most drives spin down after 2-5 minutes of inactivity; a 30s ping is enough
 * to prevent that without any measurable overhead.
 */

const HEARTBEAT_INTERVAL_MS = 30_000

let heartbeatInterval: NodeJS.Timeout | null = null
let activePath: string | null = null

/** Register (or update) the folder path to keep alive. Starts the heartbeat if not running. */
export function startKeepAlive(folderPath: string): void {
	activePath = folderPath
	if (!heartbeatInterval) {
		heartbeatInterval = setInterval(ping, HEARTBEAT_INTERVAL_MS)
	}
}

/** Stop the heartbeat and clear the active path. */
export function stopKeepAlive(): void {
	activePath = null
	if (heartbeatInterval) {
		clearInterval(heartbeatInterval)
		heartbeatInterval = null
	}
}

async function ping(): Promise<void> {
	if (!activePath) return
	try {
		await fs.stat(activePath)
	} catch {
		// Drive may be temporarily unreachable — silently ignore.
		// The retry logic in the IPC handlers will handle actual failures.
	}
}
