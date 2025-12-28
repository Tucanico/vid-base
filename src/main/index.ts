import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron' // Aggiunto dialog
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { scanDirectory, closeExiftool } from './scanner' // Importiamo lo scanner

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

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

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // --- NUOVI HANDLER IPC ---

  // 1. Apre il dialogo per scegliere la cartella
  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (canceled) return null
    return filePaths[0]
  })

  // 2. Esegue la scansione (chiama la funzione in scanner.ts)
  ipcMain.handle('videos:scan', async (_, folderPath) => {
    return await scanDirectory(folderPath)
  })

  // 3. Apre il video con il player di sistema
  ipcMain.on('video:open', (_, filePath) => {
    shell.openPath(filePath)
  })

  // -------------------------

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Pulizia ExifTool quando l'app si chiude
app.on('will-quit', () => {
  closeExiftool()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
