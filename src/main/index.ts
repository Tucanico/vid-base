import * as path from 'path'
import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { pathToFileURL } from 'url'
import { scanDirectory } from './metadata/scanner'
import { updateVideoTags } from './metadata/updateTags'
import { closeExiftool } from './metadata/utils'
import { loadLibrary, saveLibrary, deleteVideoEntry } from './metadata/library'

app.whenReady().then(() => {
	electronApp.setAppUserModelId('com.electron')

	function createWindow(): void {
		const mainWindow = new BrowserWindow({
			width: 900,
			height: 670,
			show: false,
			autoHideMenuBar: true,
			...(process.platform === 'linux' ? { icon } : {}),
			webPreferences: {
				preload: join(__dirname, '../preload/index.js'),
				sandbox: false,
				webSecurity: false // Useful to avoid CORS issues with local files
			}
		})

		// ... rest of createWindow ...
		mainWindow.on('ready-to-show', () => {
			mainWindow.show()
		})

		mainWindow.webContents.setWindowOpenHandler((details) => {
			shell.openExternal(details.url)
			return { action: 'deny' }
		})

		if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
			mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
		} else {
			mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
		}
	}

	// This allows using <img src="media://Path/To/File.jpg">
	protocol.handle('media', (request) => {
		// 1. Remove the protocol. Handles both "media://" and "media:///"
		let url = request.url.replace(/^media:\/\//, '')

		// 2. Decode (%20 -> space)
		url = decodeURIComponent(url)

		// 3. FIX FOR WINDOWS
		// If the URL starts with a slash followed by a drive letter (e.g., /C:/...), remove the leading slash.
		if (process.platform === 'win32' && url.startsWith('/') && /^[a-zA-Z]:/.test(url.slice(1))) {
			url = url.slice(1)
		}

		// 4. Normalize separators (converts / to \ on Windows)
		const absolutePath = path.normalize(url)

		// 5. Create the official file:// URL
		const fileUrl = pathToFileURL(absolutePath).toString()

		// --- DEBUG LOG (Check them in the terminal!) ---
		// console.log('Request:', request.url)
		// console.log('Clean Path:', absolutePath)
		// console.log('File URL:', fileUrl)
		// ----------------------------------------------

		// 6. Attempt to load and catch error if it fails
		return net.fetch(fileUrl).catch((e) => {
			console.error(`❌ LOADING ERROR: ${absolutePath}`)
			console.error(`   Detail: ${e.message}`)
			// Returns a 404 to prevent console explosion
			return new Response('File not found', { status: 404 })
		})
	})

	app.on('browser-window-created', (_, window) => {
		optimizer.watchWindowShortcuts(window)
	})

	ipcMain.handle('dialog:openDirectory', async () => {
		const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
		if (canceled) return null
		return filePaths[0]
	})

	ipcMain.handle('db:load', async (_, folderPath) => await loadLibrary(folderPath))
	ipcMain.handle('db:save', async (_, folderPath, videos) => await saveLibrary(folderPath, videos))
	ipcMain.handle('videos:scan', async (_, folderPath) => await scanDirectory(folderPath))
	ipcMain.handle(
		'videos:delete',
		async (_, folderPath, videoId) => await deleteVideoEntry(folderPath, videoId)
	)
	ipcMain.on('video:open', (_, filePath) => shell.openPath(filePath))
	ipcMain.handle(
		'videos:updateTags',
		async (_, filePath, tags) => await updateVideoTags(filePath, tags)
	)

	createWindow()

	app.on('activate', function () {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

// ... rest of the file (will-quit, etc) ...
app.on('will-quit', () => {
	closeExiftool()
})

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit()
	}
})
