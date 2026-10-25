const { app, BrowserWindow, shell, Tray, Menu, nativeImage } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const http = require('node:http')

const APP_TITLE = 'INSIST'
const DIST = path.join(__dirname, 'dist')
const API_BASE = process.env.DISI_API || 'https://disi-al.com'
const PORT = 18765
const SAFE_FLAG = path.join(app.getPath('userData'), 'safe-mode.flag')

// 任务栏/跳转列表显示应用名而不是 Electron
try { app.setAppUserModelId('com.disi.insist') } catch (e) {}

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

let mainWindow = null
let tray = null

function log(...args) {
  const line = new Date().toISOString() + ' ' + args.join(' ') + '\n'
  for (const file of [path.join(app.getPath('userData'), 'desktop.log'), path.join(path.dirname(process.execPath), 'desktop.log')]) {
    try {
      fs.appendFileSync(file, line)
    } catch (e) {
      // ignore
    }
  }
}

process.on('uncaughtException', (err) => log('[uncaught]', err && err.stack ? err.stack : String(err)))
process.on('unhandledRejection', (err) => log('[unhandled]', err && err.stack ? err.stack : String(err)))

let safeMode = false
try {
  safeMode = fs.existsSync(SAFE_FLAG)
} catch (e) {
  safeMode = false
}
log('[start] safeMode=', safeMode)

// 手动切换渲染模式：set DISI_RENDER=software 再启动
if (process.env.DISI_RENDER === 'software' || safeMode) {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('disable-gpu')
}

function iconFile() {
  const dir = path.dirname(process.execPath)
  const candidates = [
    path.join(dir, 'app.ico'),
    path.join(__dirname, 'build', 'icon.ico'),
    path.join(process.resourcesPath || '', 'app.ico'),
  ]
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c
    } catch (e) {
      // ignore
    }
  }
  return candidates[1]
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

function setupTray(win) {
  try {
    const image = nativeImage.createFromPath(iconFile())
    tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  } catch (err) {
    log('[tray-error]', String(err))
    return
  }

  tray.setToolTip(APP_TITLE)

  const buildMenu = () =>
    Menu.buildFromTemplate([
      { label: '打开应用', click: () => { win.show(); win.focus(); } },
      { type: 'separator' },
      {
        label: '开机自启',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked, path: process.execPath })
          tray.setContextMenu(buildMenu())
        },
      },
      { type: 'separator' },
      { label: '退出应用', click: () => { app.isQuitting = true; app.quit(); } },
    ])

  tray.setContextMenu(buildMenu())
  tray.on('click', () => {
    if (win.isVisible()) win.hide()
    else { win.show(); win.focus(); }
  })
  tray.on('right-click', () => tray.setContextMenu(buildMenu()))
}

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#050505',
    title: APP_TITLE,
    icon: iconFile(),
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
  log('[boot] title=', APP_TITLE, 'url=', url)

  win.webContents.on('dom-ready', () => {
    win.webContents
      .insertCSS('html{scrollbar-width:none;-ms-overflow-style:none;overflow-y:scroll}::-webkit-scrollbar{width:0;height:0;display:none}')
      .catch(() => {})
  })

  win.once('ready-to-show', () => {
    log('[ready]')
    markSafeMode(false)
    win.show()
  })
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      win.hide()
      log('[close] hide to tray')
    }
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

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    try {
      const port = await createServer()
      log('[server] port=', port, 'dist=', DIST)
      mainWindow = createWindow(port)
      setupTray(mainWindow)
    } catch (err) {
      log('[fatal]', err && err.stack ? err.stack : String(err))
      app.quit()
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(PORT)
    })
  })
}

app.on('before-quit', () => {
  app.isQuitting = true
})

app.on('window-all-closed', () => {
  // 托盘常驻：关闭窗口不退出，从托盘菜单退出
})
