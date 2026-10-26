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
    // 原生能力：状态栏配色、启动图收起、返回键 / 左缘滑动返回
    (function () {
      function bridge() {
        var C = window.Capacitor;
        if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return null;
        return C.Plugins || null;
      }

      var attached = false;

      // 统一返回：优先交给页面路由，退无可退才进后台
      function goBack(P) {
        var handled = false;
        try {
          if (typeof window.__DISI_BACK__ === 'function') handled = window.__DISI_BACK__();
        } catch (e) {}
        if (!handled) {
          try { P && P.App && P.App.minimizeApp && P.App.minimizeApp(); } catch (e) {}
        }
      }

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

        // 3) Android 物理返回键
        try {
          P.App.addListener('backButton', function () { goBack(P); });
        } catch (e) {}

        // 4) iOS：从屏幕左缘往右滑 = 返回（WKWebView 本身不带手势）
        var touchX = 0, touchY = 0, tracking = false;
        document.addEventListener(
          'touchstart',
          function (e) {
            if (e.touches.length !== 1) return;
            touchX = e.touches[0].clientX;
            touchY = e.touches[0].clientY;
            tracking = touchX <= 28; // 只在左缘 28px 内起手
          },
          { passive: true }
        );
        document.addEventListener(
          'touchend',
          function (e) {
            if (!tracking) return;
            tracking = false;
            var t = e.changedTouches && e.changedTouches[0];
            if (!t) return;
            var dx = t.clientX - touchX;
            var dy = Math.abs(t.clientY - touchY);
            if (dx > 70 && dy < 60) goBack(P);
          },
          { passive: true }
        );
        return true;
      }

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
