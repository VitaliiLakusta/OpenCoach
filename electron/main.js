const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

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
      console.log('Development mode: assuming Next.js dev server is running on port', PORT)
      setTimeout(resolve, 1000)
      return
    }

    // In production, start the Next.js server
    const nextPath = path.join(__dirname, '../node_modules/.bin/next')
    const appPath = path.join(__dirname, '..')

    console.log('Starting Next.js server...')
    console.log('Next path:', nextPath)
    console.log('App path:', appPath)

    nextServer = spawn('node', [nextPath, 'start', '-p', PORT], {
      cwd: appPath,
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    })

    nextServer.stdout.on('data', (data) => {
      console.log(`Next.js: ${data}`)
      if (data.toString().includes('Ready') || data.toString().includes('started')) {
        resolve()
      }
    })

    nextServer.stderr.on('data', (data) => {
      console.error(`Next.js Error: ${data}`)
    })

    nextServer.on('close', (code) => {
      console.log(`Next.js server process exited with code ${code}`)
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
    console.error('Failed to start Next.js server:', error)
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
  console.error('Uncaught exception:', error)
})
