const { app, BrowserWindow, protocol, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const APP_TITLE = 'INSIST'
const APP_SCHEME = 'insist'
const DIST = path.join(__dirname, 'dist')
const API_BASE = process.env.DISI_API || 'https://disi-al.com'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

let logFile = null
function log(...args) {
  try {
    if (!logFile) logFile = path.join(app.getPath('userData'), 'desktop.log')
    fs.appendFileSync(logFile, new Date().toISOString() + ' ' + args.join(' ') + '\n')
  } catch (e) {
    // ignore logging failures
  }
}

process.on('uncaughtException', (err) => log('[uncaught]', err && err.stack ? err.stack : String(err)))
process.on('unhandledRejection', (err) => log('[unhandled]', err && err.stack ? err.stack : String(err)))

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
])

function resolveFile(requestUrl) {
  const url = new URL(requestUrl)
  let pathname = decodeURIComponent(url.pathname)
  if (!pathname || pathname === '/') pathname = '/index.html'

  let filePath = path.join(DIST, pathname)
  const distRoot = path.resolve(DIST) + path.sep
  if (!path.resolve(filePath).startsWith(distRoot)) return null

  try {
    if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html')
  } catch (e) {
    return path.join(DIST, 'index.html')
  }
  if (!fs.existsSync(filePath)) return path.join(DIST, 'index.html')
  return filePath
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#050505',
    title: APP_TITLE,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      additionalArguments: ['--disi-api=' + API_BASE],
    },
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.on('did-fail-load', (e, code, desc, url) => log('[fail-load]', code, desc, url))
  win.webContents.on('render-process-gone', (e, details) => log('[render-gone]', JSON.stringify(details)))
  win.webContents.on('console-message', (e, level, message) => log('[console]', message))

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  const target = `${APP_SCHEME}://app/index.html`
  log('[boot] dist=', DIST, 'target=', target, 'indexExists=', fs.existsSync(path.join(DIST, 'index.html')))
  win.loadURL(target)
  return win
}

app.whenReady().then(() => {
  protocol.handle(APP_SCHEME, async (request) => {
    try {
      const filePath = resolveFile(request.url)
      if (!filePath) return new Response('forbidden', { status: 403 })
      const data = await fs.promises.readFile(filePath)
      const ext = path.extname(filePath).toLowerCase()
      return new Response(data, {
        status: 200,
        headers: { 'content-type': MIME[ext] || 'application/octet-stream' },
      })
    } catch (err) {
      log('[protocol-error]', request.url, err && err.stack ? err.stack : String(err))
      return new Response('not found', { status: 404 })
    }
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
