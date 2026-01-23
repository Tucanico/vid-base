import * as path from 'path'
import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net, screen } from 'electron'
import * as dotenv from 'dotenv'

// Load environment variables from .env file (silent mode to suppress logs)
// Suppress dotenv console output by temporarily overriding console.log
const originalLog = console.log
const originalInfo = console.info
console.log = (...args: unknown[]) => {
	const message = args[0]?.toString() || ''
	if (!message.includes('[dotenv]') && !message.includes('injecting env')) {
		originalLog(...args)
	}
}
console.info = (...args: unknown[]) => {
	const message = args[0]?.toString() || ''
	if (!message.includes('[dotenv]') && !message.includes('injecting env')) {
		originalInfo(...args)
	}
}
dotenv.config()
console.log = originalLog
console.info = originalInfo
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { pathToFileURL } from 'url'
import { scanDirectoryWithLibrary } from './VideoMode/metadata/scanner'
import { updateVideoTags } from './VideoMode/metadata/updateTags'
import { closeExiftool } from './metadata/utils'
import { loadLibrary, saveLibrary, removeVideoEntryFromLibrary } from './VideoMode/metadata/library'
import { parseMovieExcel, findExcelFile } from './MovieMode/metadata/movieParser'
import { cleanupOrphans } from './VideoMode/metadata/cleanup'

// This method will be called when Electron has finished initialization and is ready to create browser windows
// Some APIs can only be used after this event occurs
app.whenReady().then(() => {
	// Global variable to store the currently active library root path
	let currentLibraryRootPath: string | null = null

	// Set app user model id for windows
	electronApp.setAppUserModelId('com.vidbase.app')

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
				sandbox: false,
				webSecurity: false // Useful to avoid CORS issues with local files
			}
		})

		// Shows the window once it's ready to prevent a visual flash
		mainWindow.on('ready-to-show', () => {
			mainWindow.show()
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

		// 2. Decode URI-encoded characters (e.g., %20 -> space)
		url = decodeURIComponent(url)

		// 3. Fix for Windows paths that start with a slash (e.g., /C:/...)
		if (process.platform === 'win32' && url.startsWith('/') && /^[a-zA-Z]:/.test(url.slice(1))) {
			url = url.slice(1)
		}

		// 4. Normalize path separators for the current OS (e.g., converts / to \ on Windows)
		const absolutePath = path.normalize(url)

		// 5. Create a proper file:// URL from the absolute path
		const fileUrl = pathToFileURL(absolutePath).toString()

		// 6. Fetch the file and return it. Catches errors if the file doesn't exist
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
		return currentLibraryRootPath
	})

	// IPC handler to load the video library from a given folder path
	ipcMain.handle('db:load', async (_, folderPath) => await loadLibrary(folderPath))
	// IPC handler to save the video library to a given folder path
	ipcMain.handle('db:save', async (_, folderPath, videos) => {
		const existingLibrary = await loadLibrary(folderPath)
		await saveLibrary(folderPath, videos, existingLibrary)
	})
	// IPC handler to scan a directory for new videos
	// Uses library.json metadata when available, but always scans for new files
	ipcMain.handle('videos:scan', async (event, folderPath) => {
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
	// IPC listener to open a video file in the default system player
	ipcMain.on('video:open', (_, filePath) => shell.openPath(filePath))
	// IPC handler to update the tags of a video file
	ipcMain.handle(
		'videos:updateTags',
		async (_, filePath, tags, favourited) => await updateVideoTags(filePath, tags, favourited)
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
	// IPC handler to load movies from an Excel file
	ipcMain.handle('movies:load', async (_, folderPath: string, moviesFolderPath?: string) => {
		const excelPath = await findExcelFile(folderPath)
		if (!excelPath) {
			throw new Error('No Excel file found in the selected folder')
		}
		return await parseMovieExcel(excelPath, moviesFolderPath || folderPath)
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
	closeExiftool()
})

// Quit when all windows are closed
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit()
	}
})
