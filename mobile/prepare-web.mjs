// 把前端构建产物复制到移动端工程，并注入移动端需要的运行时设置
// 用法：node mobile/prepare-web.mjs forum|insist
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const apps = {
  forum: {
    src: 'forum_app/dist',
    out: 'mobile/forum/www',
    api: 'https://forum.disi-al.com',
    statusBar: '#0d1117',
    background: '#010409',
  },
  insist: {
    src: 'insist_app/dist',
    out: 'mobile/insist/www',
    api: 'https://forum.disi-al.com',
    statusBar: '#050505',
    background: '#000000',
  },
}

const which = process.argv[2]
if (!apps[which]) {
  console.error('用法: node mobile/prepare-web.mjs forum|insist')
  process.exit(1)
}

const app = apps[which]
const from = path.join(root, app.src)
const to = path.join(root, app.out)

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
    // 移动端（Capacitor）运行时配置
    window.__DISI_API_BASE__ = ${JSON.stringify(app.api)};
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
  <script>
    // 原生能力：状态栏配色、启动图收起、Android 返回键接路由
    (function () {
      // ---- 记录页面栈深度（hash 路由看不到 history 长度，自己数）----
      var depth = 0;
      var pushState = history.pushState;
      var replaceState = history.replaceState;
      history.pushState = function () {
        depth++;
        return pushState.apply(history, arguments);
      };
      history.replaceState = function () {
        return replaceState.apply(history, arguments);
      };
      window.addEventListener('popstate', function () {
        if (depth > 0) depth--;
      });

      function bridge() {
        var C = window.Capacitor;
        if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return null;
        return C.Plugins || null;
      }

      var attached = false;

      function attach() {
        if (attached) return true;
        var P = bridge();
        if (!P || !P.App) return false;
        attached = true;

        // 1) 状态栏
        try {
          if (P.StatusBar) {
            P.StatusBar.setStyle({ style: 'DARK' });
            if (P.StatusBar.setBackgroundColor) {
              P.StatusBar.setBackgroundColor({ color: ${JSON.stringify(app.statusBar)} });
            }
          }
        } catch (e) {}

        // 2) 启动图
        var hideSplash = function () {
          try { P.SplashScreen && P.SplashScreen.hide(); } catch (e) {}
        };
        setTimeout(hideSplash, 400);
        window.addEventListener('load', function () { setTimeout(hideSplash, 150); });

        // 3) Android 返回键：能退就退一层，退无可退才进后台
        try {
          P.App.addListener('backButton', function () {
            if (depth > 0) {
              window.history.back();
            } else {
              try { P.App.minimizeApp(); } catch (e) {}
            }
          });
        } catch (e) {}
        return true;
      }

      // 桥接可能晚于 DOM 就绪，轮询 3 秒
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        if (attach() || tries > 30) clearInterval(timer);
      }, 100);
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
      } else {
        attach();
      }
    })();
  </script>
`

if (!html.includes('__DISI_API_BASE__')) {
  html = html.replace('</head>', injection + '</head>')
} else {
  html = html.replace(/window\.__DISI_API_BASE__ = "[^"]*"/, `window.__DISI_API_BASE__ = ${JSON.stringify(app.api)}`)
}

// viewport-fit=cover（安全区生效的前提）
if (!html.includes('viewport-fit=cover')) {
  html = html.replace(
    /(<meta name="viewport" content="[^"]*")/,
    '$1, viewport-fit=cover"'
  ).replace(', viewport-fit=cover""', ', viewport-fit=cover"')
}

fs.writeFileSync(indexPath, html)
console.log(`已准备 ${which}: ${app.src} -> ${app.out}（API: ${app.api}）`)
