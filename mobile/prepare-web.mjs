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
      function ready(fn) {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          setTimeout(fn, 0);
        } else {
          document.addEventListener('DOMContentLoaded', fn);
        }
      }

      function nativeBridge() {
        var C = window.Capacitor;
        if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return null;
        return (C.Plugins || {});
      }

      ready(function () {
        var P = nativeBridge();
        if (!P) return;

        // 1) 状态栏
        try {
          if (P.StatusBar) {
            P.StatusBar.setStyle({ style: 'DARK' });
            if (P.StatusBar.setBackgroundColor) {
              P.StatusBar.setBackgroundColor({ color: ${JSON.stringify(app.statusBar)} });
            }
          }
        } catch (e) {}

        // 2) 启动图：首屏渲染后收起（最多等 1.2s）
        var hideSplash = function () {
          try { P.SplashScreen && P.SplashScreen.hide(); } catch (e) {}
        };
        setTimeout(hideSplash, 600);
        window.addEventListener('load', function () { setTimeout(hideSplash, 200); });

        // 3) Android 物理返回键：有历史就回退，在根页面则退到后台
        var routerEntry = function () {
          var h = (location.hash || '').replace(/^#/, '');
          return h === '' || h === '/' ;
        };
        try {
          P.App && P.App.addListener('backButton', function () {
            if (window.history.length > 1 && !routerEntry()) {
              window.history.back();
            } else if (P.App.minimizeApp) {
              P.App.minimizeApp();
            }
          });
        } catch (e) {}

        // 4) 兜底：iOS 侧滑返回时保持页面滚动位置
        window.addEventListener('popstate', function () {
          document.documentElement.style.scrollBehavior = 'auto';
        });
      });
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
