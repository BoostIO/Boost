import {
  app,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  Menu,
  ipcMain,
} from 'electron'
import path from 'path'
import url from 'url'
import { template } from './menu'
import { dev } from './consts'
import { onFetchPageTitle } from './ipcEventHandlers'

// global reference to mainWindow (necessary to prevent window from being garbage collected)
let mainWindow: BrowserWindow | null = null

function createMainWindow() {
  const windowOptions: BrowserWindowConstructorOptions = {
    webPreferences: { nodeIntegration: true },
    width: 1200,
    height: 800,
  }
  if (process.platform === 'darwin') {
    windowOptions.titleBarStyle = 'hiddenInset'
  }
  const window = new BrowserWindow(windowOptions)

  if (dev) {
    window.loadURL(`http://localhost:3000/app`)
  } else {
    window.loadURL(
      url.format({
        pathname: path.join(app.getAppPath(), './compiled/index.html'),
        protocol: 'file',
        slashes: true,
      })
    )
  }

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  window.on('closed', () => {
    mainWindow = null
  })
  return window
}

// quit application when all windows are closed
app.on('window-all-closed', () => {
  // on macOS it is common for applications to stay open until the user explicitly quits
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // on macOS it is common to re-create a window even after all windows have been closed
  if (mainWindow === null) {
    mainWindow = createMainWindow()
  }
})

// create main BrowserWindow when electron is ready
app.on('ready', () => {
  mainWindow = createMainWindow()
})

ipcMain.on('fetch-page-title-request', onFetchPageTitle)
