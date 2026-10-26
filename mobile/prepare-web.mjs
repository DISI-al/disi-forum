// 把前端构建产物复制到移动端工程，并注入移动端需要的运行时设置
// 用法：node mobile/prepare-web.mjs forum|insist
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const apps = {
  forum: { src: 'forum_app/dist', out: 'mobile/forum/www', api: 'https://forum.disi-al.com' },
  insist: { src: 'insist_app/dist', out: 'mobile/insist/www', api: 'https://forum.disi-al.com' },
}

const which = process.argv[2]
if (!apps[which]) {
  console.error('用法: node mobile/prepare-web.mjs forum|insist')
  process.exit(1)
}

const { src, out, api } = apps[which]
const from = path.join(root, src)
const to = path.join(root, out)

if (!fs.existsSync(path.join(from, 'index.html'))) {
  console.error(`找不到构建产物：${from}\n请先运行对应前端的 vite build`)
  process.exit(1)
}

fs.rmSync(to, { recursive: true, force: true })
fs.mkdirSync(to, { recursive: true })
fs.cpSync(from, to, { recursive: true })

const indexPath = path.join(to, 'index.html')
let html = fs.readFileSync(indexPath, 'utf8')

const injection = `  <script>
    // 移动端（Capacitor）运行时：接口指向线上后端
    window.__DISI_API_BASE__ = ${JSON.stringify(api)};
    window.__DISI_MOBILE__ = true;
  </script>
  <style>
    /* 刘海屏 / 底部横条安全区 */
    html { --safe-top: env(safe-area-inset-top, 0px); --safe-bottom: env(safe-area-inset-bottom, 0px); }
    body { padding-top: var(--safe-top); padding-bottom: var(--safe-bottom); }
    /* 移动端不显示滚动条 */
    html { scrollbar-width: none; -ms-overflow-style: none; }
    ::-webkit-scrollbar { width: 0; height: 0; }
  </style>
`

if (!html.includes('__DISI_API_BASE__')) {
  html = html.replace('</head>', injection + '</head>')
} else {
  html = html.replace(/window\.__DISI_API_BASE__ = "[^"]*"/, `window.__DISI_API_BASE__ = ${JSON.stringify(api)}`)
}

// viewport-fit=cover（安全区生效的前提）
if (!html.includes('viewport-fit=cover')) {
  html = html.replace(
    /(<meta name="viewport" content="[^"]*")/,
    '$1, viewport-fit=cover"'
  ).replace(', viewport-fit=cover""', ', viewport-fit=cover"')
}

fs.writeFileSync(indexPath, html)
console.log(`已准备 ${which}: ${src} -> ${out}（API: ${api}）`)
