import * as path from 'path'
import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { pathToFileURL } from 'url'
import { scanDirectory } from './metadata/scanner'
import { updateVideoTags } from './metadata/updateTags'
import { closeExiftool } from './metadata/utils'
import { loadLibrary, saveLibrary } from './metadata/library'

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
      webSecurity: false // Utile per evitare problemi CORS con file locali
    }
  })

  // ... resto di createWindow ...
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  // Questo permette di usare <img src="media://Percorso/File.jpg">
  protocol.handle('media', (request) => {
    // 1. Togli il protocollo. Gestisce sia "media://" che "media:///"
    let url = request.url.replace(/^media:\/\//, '')

    // 2. Decodifica (%20 -> spazio)
    url = decodeURIComponent(url)

    // 3. FIX PER WINDOWS
    // Se l'URL inizia con uno slash e poi una lettera di drive (es: /C:/...), togli lo slash iniziale.
    if (process.platform === 'win32' && url.startsWith('/') && /^[a-zA-Z]:/.test(url.slice(1))) {
      url = url.slice(1)
    }

    // 4. Normalizza i separatori (converte / in \ su Windows)
    const absolutePath = path.normalize(url)

    // 5. Crea l'URL file:// ufficiale
    const fileUrl = pathToFileURL(absolutePath).toString()

    // --- LOG DI DEBUG (Guardali nel terminale!) ---
    // console.log('Richiesta:', request.url)
    // console.log('Path Pulito:', absolutePath)
    // console.log('File URL:', fileUrl)
    // ----------------------------------------------

    // 6. Prova a caricare e cattura l'errore se fallisce
    return net.fetch(fileUrl).catch((e) => {
      console.error(`❌ ERRORE CARICAMENTO: ${absolutePath}`)
      console.error(`   Dettaglio: ${e.message}`)
      // Ritorna un 404 per non far esplodere la console
      return new Response('File non trovato', { status: 404 })
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

// ... resto del file (will-quit, etc) ...
app.on('will-quit', () => {
  closeExiftool()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
