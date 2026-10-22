// The library folders opened recently, newest first, kept in the renderer's localStorage so the start
// screen can offer them again after a restart. Storage can be unavailable or hold anything: every
// read and write is guarded, and a bad value is treated as an empty list

export type RecentFolder = { mode: 'videos' | 'movies'; folder: string; openedAt: number }

const STORAGE_KEY = 'vidbase.recentFolders'
const MAX_RECENT_FOLDERS = 8

const isRecentFolder = (value: unknown): value is RecentFolder =>
	!!value &&
	typeof value === 'object' &&
	((value as RecentFolder).mode === 'videos' || (value as RecentFolder).mode === 'movies') &&
	typeof (value as RecentFolder).folder === 'string' &&
	typeof (value as RecentFolder).openedAt === 'number'

/** The recent folders, newest first
 *  @returns The list (empty if nothing is stored, or storage is unavailable)
 */
export function getRecentFolders(): RecentFolder[] {
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
		return Array.isArray(parsed) ? parsed.filter(isRecentFolder) : []
	} catch {
		return []
	}
}

function saveRecentFolders(folders: RecentFolder[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(folders))
	} catch {
		// Storage unavailable: the list is simply not remembered
	}
}

/** Puts a folder at the top of the recent folders (once per mode and folder)
 *  @param mode The mode it was opened in
 *  @param folder The folder
 */
export function addRecentFolder(mode: RecentFolder['mode'], folder: string): void {
	const others = getRecentFolders().filter((f) => !(f.mode === mode && f.folder === folder))
	saveRecentFolders(
		[{ mode, folder, openedAt: Date.now() }, ...others].slice(0, MAX_RECENT_FOLDERS)
	)
}

/** Removes a folder from the recent folders
 *  @param mode The mode it was opened in
 *  @param folder The folder
 */
export function removeRecentFolder(mode: RecentFolder['mode'], folder: string): void {
	saveRecentFolders(getRecentFolders().filter((f) => !(f.mode === mode && f.folder === folder)))
}

/** The message shown when a library folder cannot be opened because it is not there
 *  @param folder The folder
 *  @returns The message
 */
export const folderUnavailableMessage = (folder: string): string =>
	`"${folder}" is not available. If it is on an external drive or in a VeraCrypt vault, connect the drive or mount the vault, then try again.`
