const { app, BrowserWindow, shell, Tray, Menu, nativeImage, ipcMain, screen } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const http = require('node:http')

const APP_TITLE = 'DISI INSIST'
const APP_ID = 'com.disi.insist'
const DIST = path.join(__dirname, 'dist')
const API_BASE = process.env.DISI_API || 'https://disi-al.com'
const PORT = 18765
const SAFE_FLAG = path.join(app.getPath('userData'), 'safe-mode.flag')

const LABEL_OPEN = '开启应用'
const LABEL_AUTOSTART = '开机自启'
const LABEL_QUIT = '退出应用'

const THEME = { bg: '#050505', fg: '#ededed', accent: '#ededed', accentText: '#000000' }

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
let trayMenu = null

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

try {
  app.setAppUserModelId(APP_ID)
} catch (e) {
  // ignore
}

// 卸载器会在目录里放 uninstalling.flag，看到就直接退出，避免卸载后还能运行
// 卸载标记：只有在最近 10 分钟内写入时才生效（避免历史残留误杀）
try {
  const flag = path.join(path.dirname(process.execPath), 'uninstalling.flag')
  if (fs.existsSync(flag)) {
    const age = Date.now() - fs.statSync(flag).mtimeMs
    if (age < 10 * 60 * 1000) app.quit()
    else fs.unlinkSync(flag)
  }
} catch (e) {
  // ignore
}

let safeMode = false
try {
  safeMode = fs.existsSync(SAFE_FLAG)
} catch (e) {
  safeMode = false
}

if (process.env.DISI_RENDER === 'software' || safeMode) {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('disable-gpu')
}

function iconFile() {
  const dir = path.dirname(process.execPath)
  const candidates = [path.join(dir, 'app.ico'), path.join(__dirname, 'build', 'icon.ico'), path.join(process.resourcesPath || '', 'app.ico')]
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





function trayMenuHtml() {
  const auto = app.getLoginItemSettings().openAtLogin
  const row = (label, action, active) =>
    '<button class="row' + (active ? ' on' : '') + '" onclick="window.trayPick(\'' + action + '\')">' + label + '</button>'
  return (
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    '*{margin:0;padding:0;box-sizing:border-box;user-select:none}' +
    'html,body{height:100%;width:100%;background:transparent;overflow:hidden;' +
    'font:13px "Microsoft YaHei UI",sans-serif}' +
    'body{padding:6px;display:flex;flex-direction:column;gap:2px;' +
    'background:' + THEME.bg + ';border:1px solid rgba(255,255,255,.16);border-radius:8px}' +
    '.row{flex:1;display:flex;align-items:center;justify-content:center;' +
    'background:transparent;border:0;border-radius:5px;color:' + THEME.fg + ';' +
    'font:13px "Microsoft YaHei UI",sans-serif;cursor:default;width:100%}' +
    '.row:hover{background:rgba(255,255,255,.12)}' +
    '.row.on{color:#f85149}' +
    '</style></head><body>' +
    row(LABEL_OPEN, 'open', false) +
    row(LABEL_AUTOSTART, 'autostart', auto) +
    row(LABEL_QUIT, 'quit', false) +
    '</body></html>'
  )
}

function closeTrayMenu() {
  if (trayMenu && !trayMenu.isDestroyed()) trayMenu.close()
  trayMenu = null
}

function openTrayMenu(win) {
  if (trayMenu && !trayMenu.isDestroyed()) { closeTrayMenu(); return }

  const width = 168
  const height = 128
  const point = screen.getCursorScreenPoint()
  const area = screen.getDisplayNearestPoint(point).workArea
  let x = Math.round(point.x - width / 2)
  let y = Math.round(point.y - height - 8)
  x = Math.max(area.x + 4, Math.min(x, area.x + area.width - width - 4))
  if (y < area.y + 4) y = Math.round(point.y + 12)

  const htmlPath = path.join(app.getPath('userData'), 'tray-menu.html')
  try { fs.writeFileSync(htmlPath, trayMenuHtml()) } catch (e) { log('[menu-html]', String(e)) }

  trayMenu = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    hasShadow: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'trayPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  trayMenu.setAlwaysOnTop(true)
  trayMenu.setMenuBarVisibility(false)
  trayMenu.loadFile(htmlPath)
  trayMenu.once('ready-to-show', () => {
    trayMenu.show()
    trayMenu.focus()
    // 3.5 秒无操作自动关闭（任务栏自动隐藏等场景）
    setTimeout(() => {
      try { closeTrayMenu() } catch (e) { }
    }, 6000)

    // 轮询兜底：一旦失去焦点（点了别处、溢出面板收起等）就关闭
    const timer = setInterval(() => {
      if (!trayMenu || trayMenu.isDestroyed()) {
        clearInterval(timer)
        return
      }
      if (!trayMenu.isFocused()) {
        clearInterval(timer)
        closeTrayMenu()
      }
    }, 120)
  })
  trayMenu.on('blur', () => closeTrayMenu())
  trayMenu.on('closed', () => { trayMenu = null })
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
  tray.on('click', () => openTrayMenu(win))
  tray.on('right-click', () => openTrayMenu(win))

  ipcMain.on('tray-action', (event, action) => {
    closeTrayMenu()
    if (action === 'open') {
      win.show()
      win.focus()
    } else if (action === 'autostart') {
      const next = !app.getLoginItemSettings().openAtLogin
      app.setLoginItemSettings({ openAtLogin: next, path: process.execPath })
      log('[autostart]', next)
    } else if (action === 'quit') {
      app.isQuitting = true
      app.quit()
    }
  })
}

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: THEME.bg,
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    } else {
      try { createWindow(PORT) } catch (e) { log('[recreate-fail]', String(e)) }
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
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow(PORT)
      if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus() }
    })

    // 保险：启动 2 秒后如果没窗口可见，强制显示一次
    setTimeout(() => {
      try {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
          mainWindow.show()
          mainWindow.focus()
        }
      } catch (e) { log('[show-fallback]', String(e)) }
    }, 2000)
  })
}

app.on('before-quit', () => {
  app.isQuitting = true
  closeTrayMenu()
})

app.on('window-all-closed', () => {
  // 托盘常驻
})
