const { app, BrowserWindow, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const http = require('node:http')

const APP_TITLE = 'INSIST'
const DIST = path.join(__dirname, 'dist')
const API_BASE = process.env.DISI_API || 'https://disi-al.com'

// 部分 Windows 环境（管理员运行 / 杀软 / 虚拟机）下 Chromium 沙箱或 GPU 进程会启动失败，
// 表现为白屏 + 闪退（render-gone: launch-failed / exitCode 18）
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')

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

function createServer() {
  const distRoot = path.resolve(DIST) + path.sep
  const server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname)
      let filePath = path.join(DIST, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''))
      if (!path.resolve(filePath).startsWith(distRoot)) {
        res.writeHead(403)
        res.end('forbidden')
        return
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST, 'index.html')
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' })
      fs.createReadStream(filePath).pipe(res)
    } catch (err) {
      log('[http-error]', err && err.stack ? err.stack : String(err))
      res.writeHead(500)
      res.end('error')
    }
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

function createWindow(port) {
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

  const url = 'http://127.0.0.1:' + port + '/index.html#/login'
  log('[boot] title=', APP_TITLE, 'url=', url, 'indexExists=', fs.existsSync(path.join(DIST, 'index.html')))

  win.once('ready-to-show', () => {
    log('[ready]')
    win.show()
  })
  win.webContents.on('did-finish-load', () => log('[loaded]', win.webContents.getURL()))
  win.webContents.on('did-fail-load', (e, code, desc, u) => log('[fail-load]', code, desc, u))
  win.webContents.on('render-process-gone', (e, details) => log('[render-gone]', JSON.stringify(details)))
  win.webContents.on('console-message', (e, level, message) => log('[console]', message))

  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith('http://') || target.startsWith('https://')) shell.openExternal(target)
    return { action: 'deny' }
  })

  win.loadURL(url)
  return win
}

app.whenReady().then(async () => {
  try {
    const port = await createServer()
    log('[server] port=', port, 'dist=', DIST)
    createWindow(port)
  } catch (err) {
    log('[fatal]', err && err.stack ? err.stack : String(err))
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(0)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
