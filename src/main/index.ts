import * as path from 'path'
import * as fs from 'fs'
import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net, screen } from 'electron'
import * as dotenv from 'dotenv'

// Load environment variables from a .env file
// quiet: dotenv 17 otherwise prints a line on every load. Don't patch console.log to hide it: the
// console is wrapped below to also write to the log file, and restoring it would undo that
const loadEnvFile = (envPath?: string): void => {
	dotenv.config({ path: envPath, quiet: true })
}

loadEnvFile()
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import log from 'electron-log/main'
import icon from '../../resources/icon.png?asset'
import { pathToFileURL } from 'url'
import { scanDirectoryWithLibrary } from './VideoMode/metadata/scanner'
import { updateVideoTags } from './VideoMode/metadata/updateTags'
import { closeExiftool } from './metadata/utils'
import { renameVideoFile } from './VideoMode/metadata/rename'
import { previewFrame, setThumbnailFrame } from './VideoMode/metadata/thumbnailFrame'
import {
	loadLibrary,
	saveLibrary,
	saveSavedViews,
	removeVideoEntryFromLibrary
} from './VideoMode/metadata/library'
import { SavedView } from '../shared/types/library'
import {
	parseMovieExcel,
	findExcelFile,
	createMovieArchivioFromFolders
} from './MovieMode/metadata/movieParser'
import { cleanupOrphans } from './VideoMode/metadata/cleanup'
import { startKeepAlive, stopKeepAlive } from './driveKeepAlive'
import { withRetry } from './driveRetry'

// Lets the renderer's electron-log (src/renderer/src/main.tsx) send its messages to this process,
// so renderer errors are written to the log file too. Without it they only reach DevTools
log.initialize()
log.transports.file.resolvePath = () => path.join(app.getPath('userData'), 'logs/main.log')
log.transports.file.level = 'info'
log.transports.console.level = is.dev ? 'debug' : 'info'
log.catchErrors({ showDialog: false })

const consoleLog = console.log
const consoleInfo = console.info
const consoleWarn = console.warn
const consoleError = console.error
console.log = (...args: unknown[]) => {
	log.info(...args)
	consoleLog(...args)
}
console.info = (...args: unknown[]) => {
	log.info(...args)
	consoleInfo(...args)
}
console.warn = (...args: unknown[]) => {
	log.warn(...args)
	consoleWarn(...args)
}
console.error = (...args: unknown[]) => {
	log.error(...args)
	consoleError(...args)
}

// This method will be called when Electron has finished initialization and is ready to create browser windows
// Some APIs can only be used after this event occurs
app.whenReady().then(() => {
	// Global variable to store the currently active library root path
	let currentLibraryRootPath: string | null = null

	// Set app user model id for windows
	electronApp.setAppUserModelId('com.vidbase.app')

	// Load user-specific env file (for packaged apps)
	const userEnvPath = path.join(app.getPath('userData'), '.env')
	if (fs.existsSync(userEnvPath)) {
		loadEnvFile(userEnvPath)
	} else if (!process.env.TMDB_API_KEY) {
		console.warn(
			`TMDB_API_KEY is not set. Create ${userEnvPath} with TMDB_API_KEY=... to enable TMDb.`
		)
	}

	// Creates the main browser window
	function createWindow(): void {
		// Get the primary display's work area size (screen size minus taskbar/dock)
		const primaryDisplay = screen.getPrimaryDisplay()
		const { height } = primaryDisplay.workAreaSize

		// Create the browser window
		const mainWindow = new BrowserWindow({
			width: 1080, // 20% wider than 900
			height: height, // Use full screen height
			show: false,
			title: 'VidBase',
			autoHideMenuBar: true,
			icon: icon, // Set icon for all platforms
			webPreferences: {
				preload: join(__dirname, '../preload/index.js'),
				// The sandbox stays off: the preload bundle needs Node (with it on, window.api is missing).
				// Web security stays on: local files reach the page through the media:// protocol
				sandbox: false
			}
		})

		// Shows the window once it's ready to prevent a visual flash
		mainWindow.on('ready-to-show', () => {
			mainWindow.show()
		})

		mainWindow.webContents.on('before-input-event', (event, input) => {
			const isToggle =
				input.key === 'F12' ||
				((input.control || input.meta) && input.shift && input.key.toUpperCase() === 'I')
			if (isToggle) {
				event.preventDefault()
				if (mainWindow.webContents.isDevToolsOpened()) {
					mainWindow.webContents.closeDevTools()
				} else {
					mainWindow.webContents.openDevTools({ mode: 'detach' })
				}
			}
		})

		// Opens external links in the default web browser
		mainWindow.webContents.setWindowOpenHandler((details) => {
			shell.openExternal(details.url)
			return { action: 'deny' }
		})

		// Load the remote URL for development or the local html file for production
		if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
			mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
		} else {
			mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
		}
	}

	// Custom protocol to serve media files from the local filesystem
	// This allows using `<img src="media:///C:/path/to/file.jpg">` in the renderer
	protocol.handle('media', (request) => {
		// 1. Remove the protocol prefix. Handles both "media://" and "media:///"
		let url = request.url.replace(/^media:\/\//, '')

		// 2. Drop the query: the renderer adds "?v=..." to a file that changed on disk (a new thumbnail) so
		// Chromium loads it again instead of showing the copy it keeps in memory. A "?" in a file name is
		// URL-encoded by the renderer (see mediaUrl), so it is not cut here
		url = url.split('?')[0]

		// 3. Decode URI-encoded characters (e.g., %20 -> space)
		url = decodeURIComponent(url)

		// 4. Fix for Windows paths that start with a slash (e.g., /C:/...)
		if (process.platform === 'win32' && url.startsWith('/') && /^[a-zA-Z]:/.test(url.slice(1))) {
			url = url.slice(1)
		}

		// 5. Normalize path separators for the current OS (e.g., converts / to \ on Windows)
		const absolutePath = path.normalize(url)

		// 6. Create a proper file:// URL from the absolute path
		const fileUrl = pathToFileURL(absolutePath).toString()

		// 7. Fetch the file and return it. Catches errors if the file doesn't exist
		return net.fetch(fileUrl).catch((e) => {
			console.error(`❌ LOADING ERROR: ${absolutePath}`)
			console.error(`   Detail: ${e.message}`)
			// Return a 404 response to prevent browser errors
			return new Response('File not found', { status: 404 })
		})
	})

	// Watch for and apply default window shortcuts
	app.on('browser-window-created', (_, window) => {
		optimizer.watchWindowShortcuts(window)
	})

	// IPC handler to show an "open directory" dialog
	ipcMain.handle('dialog:openDirectory', async () => {
		const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
		if (canceled) return null
		currentLibraryRootPath = filePaths[0] // Store the root path
		startKeepAlive(currentLibraryRootPath) // Keep the drive awake
		return currentLibraryRootPath
	})
	// Whether a folder is available: false while its drive is disconnected or its VeraCrypt vault is
	// not mounted
	const isFolder = (folderPath: string): Promise<boolean> =>
		fs.promises.stat(folderPath).then(
			(stats) => stats.isDirectory(),
			() => false
		)
	// IPC handler to tell whether a folder is available (for the recent folders on the start screen)
	ipcMain.handle('folder:exists', async (_, folderPath: string) => isFolder(folderPath))
	// IPC handler to open a library folder without the dialog (a recent folder): does what picking it
	// in the dialog does. Returns false if the folder is not available
	ipcMain.handle('folder:use', async (_, folderPath: string) => {
		if (!(await isFolder(folderPath))) return false
		currentLibraryRootPath = folderPath
		startKeepAlive(folderPath)
		return true
	})
	// IPC handler for the app's version; packaged builds get a build number, see scripts/package.mjs
	ipcMain.handle('app:version', () => ({ version: app.getVersion(), isPackaged: app.isPackaged }))

	// IPC handler to load the video library from a given folder path
	ipcMain.handle('db:load', async (_, folderPath) => withRetry(() => loadLibrary(folderPath)))
	// IPC handler to save the video library to a given folder path
	ipcMain.handle('db:save', async (_, folderPath, videos) => {
		await withRetry(async () => {
			const existingLibrary = await loadLibrary(folderPath)
			await saveLibrary(folderPath, videos, existingLibrary)
		})
	})
	// IPC handler to scan a directory for new videos
	// Uses library.json metadata when available, but always scans for new files
	ipcMain.handle('videos:scan', async (event, folderPath) => {
		return withRetry(async () => {
			// Load existing library if it exists
			const existingLibrary = await loadLibrary(folderPath)
			// Run cleanup FIRST (before saving new library, so it can detect orphaned entries)
			await cleanupOrphans(folderPath)
			// Scan directory using smart scan (uses library metadata when available)
			const videos = await scanDirectoryWithLibrary(
				folderPath,
				existingLibrary ? existingLibrary.files : null,
				(processed, total) => {
					const percent = total > 0 ? Math.round((processed / total) * 100) : 0
					event.sender.send('videos:scanProgress', { processed, total, percent })
				}
			)
			// Save library with updated categories and tags
			await saveLibrary(folderPath, videos, existingLibrary)
			return videos
		})
	})
	// IPC listener to open a video file in the default system player
	ipcMain.on('video:open', (_, filePath) => shell.openPath(filePath))
	// IPC listener to show a video file in the system file manager, selected when the file manager supports it
	ipcMain.on('video:showInFolder', (_, filePath: string) => shell.showItemInFolder(filePath))
	// IPC handler to save a library's saved searches
	ipcMain.handle('library:saveViews', async (_, folderPath: string, savedViews: SavedView[]) =>
		withRetry(() => saveSavedViews(folderPath, savedViews))
	)
	// IPC handlers to choose a video's thumbnail: a quick preview of a frame, and setting it
	ipcMain.handle('video:previewFrame', async (_, filePath: string, seconds: number) =>
		previewFrame(filePath, seconds)
	)
	ipcMain.handle(
		'video:setThumbnail',
		async (_, folderPath: string, videoId: string, seconds: number) =>
			setThumbnailFrame(folderPath, videoId, seconds)
	)
	// IPC handler to rename a video or photo: the file, its thumbnail and its library entry. Not wrapped in
	// withRetry: a second attempt after a partial rename would no longer find the file
	ipcMain.handle(
		'video:rename',
		async (_, folderPath: string, videoId: string, newBaseName: string) =>
			renameVideoFile(folderPath, videoId, newBaseName)
	)
	// IPC handler to update the tags of a video file
	ipcMain.handle('videos:updateTags', async (_, filePath, tags, favourited) =>
		withRetry(() => updateVideoTags(filePath, tags, favourited))
	)
	// IPC handler to delete a video file and its thumbnail
	ipcMain.handle(
		'video:delete',
		async (_, filePath: string, thumbnailPath: string, videoId: string) => {
			try {
				if (!currentLibraryRootPath) {
					throw new Error('Current library root path is not set.')
				}
				await shell.trashItem(filePath)
				if (thumbnailPath) {
					await shell.trashItem(thumbnailPath)
				}
				await removeVideoEntryFromLibrary(currentLibraryRootPath, videoId)
				return true // Indicate success
			} catch (error) {
				console.error(`Failed to trash files or remove library entry: ${error}`)
				return false // Indicate failure
			}
		}
	)
	// Asks the user before an existing Archivio.xlsx is replaced by a new archive built from the
	// folders. Returns true to replace it; false keeps it, and it is loaded instead
	const confirmArchiveOverwrite = async (
		window: BrowserWindow | null,
		filePath: string
	): Promise<boolean> => {
		const options = {
			type: 'warning' as const,
			title: 'VidBase',
			message: `${path.basename(filePath)} already exists in this folder`,
			detail:
				'VidBase could not find a movie archive here and was about to create a new one from the movie folders. Replacing the existing file loses what the folders and TMDb cannot rebuild, such as the LQ, CHECK and NOTE columns.',
			buttons: ['Keep and load it', 'Replace it'],
			defaultId: 0,
			cancelId: 0
		}
		const { response } = window
			? await dialog.showMessageBox(window, options)
			: await dialog.showMessageBox(options)
		return response === 1
	}
	// IPC handler to load movies from an Excel file
	ipcMain.handle('movies:load', async (event, folderPath: string, moviesFolderPath?: string) => {
		startKeepAlive(folderPath) // Keep the drive awake for movie mode too
		return withRetry(async () => {
			const moviesRoot = moviesFolderPath || folderPath
			const excelPath = await findExcelFile(folderPath)
			if (excelPath) {
				return await parseMovieExcel(excelPath, moviesRoot)
			}

			const createdExcelPath = await createMovieArchivioFromFolders(
				moviesRoot,
				folderPath,
				(filePath) =>
					confirmArchiveOverwrite(BrowserWindow.fromWebContents(event.sender), filePath)
			)
			return await parseMovieExcel(createdExcelPath, moviesRoot)
		})
	})
	// IPC handler to open a folder in the file explorer
	ipcMain.on('folder:open', (_, folderPath: string) => {
		shell.openPath(folderPath)
	})

	// Create the main window when the app is ready
	createWindow()

	// On macOS, re-create a window when the dock icon is clicked and there are no other windows open
	app.on('activate', function () {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

// Ensures the exiftool process is closed when the app is about to quit
app.on('will-quit', () => {
	stopKeepAlive()
	closeExiftool()
})

// Quit when all windows are closed
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit()
	}
})
