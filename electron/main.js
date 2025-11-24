const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const log = require('electron-log')

// Configure logging
log.transports.file.level = 'info'
log.transports.console.level = 'info'
console.log = log.log
console.error = log.error

let mainWindow
let nextServer

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Next.js server port
const PORT = process.env.PORT || 3000

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../public/logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      // Allow loading local resources
      webSecurity: true
    },
    titleBarStyle: 'default',
    backgroundColor: '#ffffff'
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Load the Next.js app
  const startURL = isDev
    ? `http://localhost:${PORT}`
    : `http://localhost:${PORT}`

  mainWindow.loadURL(startURL)

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function startNextServer() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      // In development, assume Next.js dev server is already running
      log.info('Development mode: assuming Next.js dev server is running on port', PORT)
      setTimeout(resolve, 1000)
      return
    }

    // In production, start the Next.js server
    const appPath = app.isPackaged ? app.getAppPath() : path.join(__dirname, '..')
    const nextPath = path.join(appPath, 'node_modules', 'next', 'dist', 'bin', 'next')

    log.info('Starting Next.js server...')
    log.info('Next path:', nextPath)
    log.info('App path:', appPath)
    log.info('Exec path:', process.execPath)

    // Use process.execPath (the Electron binary) to run the script
    // We must set ELECTRON_RUN_AS_NODE to 1 to make it behave like 'node'
    nextServer = spawn(process.execPath, [nextPath, 'start', '-p', PORT.toString()], {
      cwd: appPath,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ELECTRON_RUN_AS_NODE: '1'
      }
    })

    nextServer.stdout.on('data', (data) => {
      log.info(`Next.js: ${data}`)
      if (data.toString().includes('Ready') || data.toString().includes('started')) {
        resolve()
      }
    })

    nextServer.stderr.on('data', (data) => {
      log.error(`Next.js Error: ${data}`)
    })

    nextServer.on('close', (code) => {
      log.info(`Next.js server process exited with code ${code}`)
    })

    nextServer.on('error', (err) => {
      log.error('Failed to spawn Next.js server:', err)
      reject(err)
    })

    // Fallback: resolve after 5 seconds even if we don't see "Ready"
    setTimeout(resolve, 5000)
  })
}

app.on('ready', async () => {
  try {
    await startNextServer()
    createWindow()
  } catch (error) {
    log.error('Failed to start Next.js server:', error)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (nextServer) {
    nextServer.kill()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

app.on('before-quit', () => {
  if (nextServer) {
    nextServer.kill()
  }
})

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error)
})
