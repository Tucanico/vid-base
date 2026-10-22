import * as fs from 'fs/promises'
import * as path from 'path'
import { VideoFile } from '../../../shared/types/video'
import { isTransientDriveError } from '../../driveRetry'

// How an entry is stored in library.json. relativePath and relativeThumbnailPath are relative to the
// library folder (where library.json is), with "/" separators, so the library keeps working when the
// drive is mounted somewhere else: another computer, Windows E:\ vs Linux /run/media/..., a
// VeraCrypt drive letter. filePath and thumbnailPath stay absolute for older VidBase versions, which
// only read those (and so only work on the computer that last saved the library)
export type StoredVideoFile = VideoFile & { relativePath?: string; relativeThumbnailPath?: string }

// Absolute on any system: "/x", "C:\x", "C:/x" or "\\server\share"
const isAbsoluteAnywhere = (p: string): boolean =>
	p.startsWith('/') || p.startsWith('\\') || /^[a-zA-Z]:[\\/]/.test(p)

// Path segments, splitting on both separators (a stored path can come from either system)
const segmentsOf = (p: string): string[] => p.split(/[\\/]+/).filter(Boolean)

/** The path of `absolutePath` inside `root`, with "/" separators
 *  @param root The library folder
 *  @param absolutePath An absolute path
 *  @returns The relative path, or null if `absolutePath` is not inside `root`
 */
export function toRelative(root: string, absolutePath: string): string | null {
	const relative = path.relative(root, absolutePath)
	if (!relative || path.isAbsolute(relative)) return null
	const segments = relative.split(path.sep)
	if (segments[0] === '..') return null
	return segments.join('/')
}

// Whether a path exists. Drive errors are rethrown, so that loadLibrary fails (and is retried)
// instead of leaving the paths unconverted, which would make every file look missing
async function exists(p: string): Promise<boolean> {
	try {
		await fs.access(p)
		return true
	} catch (error) {
		if (isTransientDriveError(error)) throw error
		return false
	}
}

/** Finds the folder the absolute paths of a library saved elsewhere started from, by looking for a
 *  few of its files under `root`. E.g. "E:\Videos\Holidays\a.mp4", with root
 *  "/run/media/juber/Juber/Videos" containing "Holidays/a.mp4", gives the segments of "E:\Videos"
 *  @param root The library folder
 *  @param foreignPaths Absolute paths that are not inside `root`
 *  @returns The old folder's path segments, or null if none of the first files is found
 */
async function findOldRoot(root: string, foreignPaths: string[]): Promise<string[] | null> {
	for (const foreign of foreignPaths.slice(0, 20)) {
		const segments = segmentsOf(foreign)
		for (let k = 1; k < segments.length; k++) {
			if (await exists(path.join(root, ...segments.slice(k)))) return segments.slice(0, k)
		}
	}
	return null
}

const startsWithSegments = (segments: string[], prefix: string[]): boolean =>
	prefix.length < segments.length &&
	prefix.every((part, i) => part.toLowerCase() === segments[i].toLowerCase())

/** Turns the entries read from library.json into entries with absolute paths under `root`.
 *  The relative paths are used when present. Older libraries only have absolute paths: those inside
 *  `root` are kept, and those from another location are moved under `root` (see findOldRoot)
 *  @param root The library folder
 *  @param stored The entries as read from library.json
 *  @returns The entries, with absolute paths and without the relative fields
 */
export async function resolveStoredPaths(
	root: string,
	stored: StoredVideoFile[]
): Promise<VideoFile[]> {
	const isForeign = (p: string | undefined): p is string =>
		!!p && isAbsoluteAnywhere(p) && toRelative(root, p) === null
	const foreign = stored
		.filter((file) => !file.relativePath && isForeign(file.filePath))
		.map((file) => file.filePath)
	const oldRoot = foreign.length > 0 ? await findOldRoot(root, foreign) : null

	const resolve = (
		relative: string | undefined,
		absolute: string | undefined
	): string | undefined => {
		if (relative) return path.join(root, ...relative.split('/'))
		if (!isForeign(absolute)) return absolute
		const segments = segmentsOf(absolute)
		if (oldRoot && startsWithSegments(segments, oldRoot)) {
			return path.join(root, ...segments.slice(oldRoot.length))
		}
		return absolute
	}

	return stored.map(({ relativePath, relativeThumbnailPath, ...file }) => ({
		...file,
		filePath: resolve(relativePath, file.filePath) ?? file.filePath,
		thumbnailPath: resolve(relativeThumbnailPath, file.thumbnailPath)
	}))
}

/** Adds the paths relative to `root` to entries about to be saved in library.json
 *  @param root The library folder
 *  @param files The entries, with absolute paths
 *  @returns The entries to store
 */
export function toStoredFiles(root: string, files: VideoFile[]): StoredVideoFile[] {
	return files.map((file) => {
		const relativePath = toRelative(root, file.filePath)
		const relativeThumbnailPath = file.thumbnailPath ? toRelative(root, file.thumbnailPath) : null
		return {
			...file,
			...(relativePath ? { relativePath } : {}),
			...(relativeThumbnailPath ? { relativeThumbnailPath } : {})
		}
	})
}
