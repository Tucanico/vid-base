/** The media:// URL at which the main process serves a local file (protocol.handle('media') in
 *  src/main/index.ts). Each path segment is URL-encoded, so names with "?", "#" or "%" work.
 *  `version` is added as a query the main process ignores: when it changes, Chromium loads the file
 *  again (e.g. a thumbnail chosen anew) instead of showing the copy it keeps in memory
 *  @param filePath The absolute path of the file
 *  @param version Changes whenever the file is replaced
 *  @returns The URL to use as an image source
 */
export const mediaUrl = (filePath: string, version?: number): string =>
	`media:///${filePath.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/')}${
		version ? `?v=${version}` : ''
	}`
