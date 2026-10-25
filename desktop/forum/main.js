const { app, BrowserWindow, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const http = require('node:http')

const APP_TITLE = 'DISI 论坛'
const DIST = path.join(__dirname, 'dist')
const API_BASE = process.env.DISI_API || 'https://disi-al.com'
const PORT = 18765
const SAFE_FLAG = path.join(app.getPath('userData'), 'safe-mode.flag')

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

function log(...args) {
  const line = new Date().toISOString() + ' ' + args.join(' ') + '\n'
  const targets = [
    path.join(app.getPath('userData'), 'desktop.log'),
    path.join(path.dirname(process.execPath), 'desktop.log'),
  ]
  for (const file of targets) {
    try {
      fs.appendFileSync(file, line)
    } catch (e) {
      // ignore
    }
  }
}

process.on('uncaughtException', (err) => log('[uncaught]', err && err.stack ? err.stack : String(err)))
process.on('unhandledRejection', (err) => log('[unhandled]', err && err.stack ? err.stack : String(err)))

// 上次启动渲染进程崩溃过（launch-failed / exitCode 18）→ 这次用安全模式
let safeMode = false
try {
  safeMode = fs.existsSync(SAFE_FLAG)
} catch (e) {
  safeMode = false
}
log('[start] safeMode=', safeMode)

// 手动切换渲染模式：set DISI_RENDER=software 再启动（排版优先时用）
if (process.env.DISI_RENDER === 'software') {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('disable-gpu')
}

if (safeMode) {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-software-rasterizer')
}

function markSafeMode(on) {
  try {
    if (on) fs.writeFileSync(SAFE_FLAG, String(Date.now()))
    else if (fs.existsSync(SAFE_FLAG)) fs.unlinkSync(SAFE_FLAG)
  } catch (e) {
    // ignore
  }
}

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
    server.once('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        server.listen(0, '127.0.0.1', () => resolve(server.address().port))
        return
      }
      reject(err)
    })
    server.listen(PORT, '127.0.0.1', () => resolve(server.address().port))
  })
}

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0d1117',
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

  const url = 'http://127.0.0.1:' + port + '/index.html'
  log('[boot] title=', APP_TITLE, 'url=', url)

  win.once('ready-to-show', () => {
    log('[ready]')
    markSafeMode(false)
    win.show()
  })
  // 隐藏滚动条 + 预留滚动槽，避免出现/消失时布局跳动
  win.webContents.on('dom-ready', () => {
    win.webContents
      .insertCSS('html{scrollbar-width:none;-ms-overflow-style:none;overflow-y:scroll}::-webkit-scrollbar{width:0;height:0;display:none}')
      .catch(() => {})
  })
  win.webContents.on('did-finish-load', () => log('[loaded]', win.webContents.getURL()))
  win.webContents.on('did-fail-load', (e, code, desc, u) => log('[fail-load]', code, desc, u))
  win.webContents.on('render-process-gone', (e, details) => {
    log('[render-gone]', JSON.stringify(details))
    if (details && details.reason === 'launch-failed') markSafeMode(true)
  })
  win.webContents.on('console-message', (e, level, message, line, source) => log('[console]', message, '@', source + ':' + line))

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
    if (BrowserWindow.getAllWindows().length === 0) createWindow(PORT)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
