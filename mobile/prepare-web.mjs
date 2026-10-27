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
    /* ---- 刘海屏 / 底部横条安全区 ---- */
    html {
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
    }
    body {
      padding-top: var(--safe-top);
      padding-bottom: var(--safe-bottom);
      touch-action: manipulation;   /* 去掉双击放大 */
    }

    /* ---- iOS 聚焦输入框会自动放大页面，字号 < 16px 时更明显 ---- */
    input,
    textarea,
    select,
    [contenteditable="true"] {
      font-size: 16px !important;
    }

    /* ---- 移动端不显示滚动条 ---- */
    html { scrollbar-width: none; -ms-overflow-style: none; }
    ::-webkit-scrollbar { width: 0; height: 0; }

    /* ---- 防止固定定位元素在键盘弹出时被顶起后再也回不来 ---- */
    .fixed-bottom { transform: translateZ(0); }
  </style>
  <script>
    // 原生能力：状态栏配色、启动图收起、返回键 / 左缘滑动返回
    (function () {
      function bridge() {
        var C = window.Capacitor;
        if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return null;
        return C.Plugins || null;
      }

      // 统一返回：交给页面路由，路由说「这是根页面」时才进后台
      function goBack(P) {
        var handled = false;
        try {
          if (typeof window.__DISI_BACK__ === 'function') {
            handled = window.__DISI_BACK__();
          }
        } catch (e) {}

        if (handled) return;

        // 页面脚本还没就绪（或路由没接管）：用 history.state 兜底
        var st = window.history.state || {};
        if (st.back) {
          window.history.back();
          return;
        }
        try {
          if (P && P.App && P.App.minimizeApp) P.App.minimizeApp();
        } catch (e) {}
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

        // 3) Android 物理返回键 / 系统返回手势
        try {
          P.App.addListener('backButton', function () { goBack(P); });
        } catch (e) {}

        // 4) iOS：屏幕左缘往右滑 = 返回
        var startX = 0, startY = 0, tracking = false;
        document.addEventListener(
          'touchstart',
          function (e) {
            if (e.touches.length !== 1) return;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            tracking = startX <= 28;
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
            var dx = t.clientX - startX;
            var dy = Math.abs(t.clientY - startY);
            if (dx > 70 && dy < 60) goBack(P);
          },
          { passive: true }
        );
        return true;
      }

      // 桥接可能晚于脚本执行：立刻试一次 + 轮询 10 秒
      attach();
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        if (attach() || tries > 100) clearInterval(timer);
      }, 100);
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
      }
    })();
  </script>
`

if (!html.includes('__DISI_API_BASE__')) {
  html = html.replace('</head>', injection + '</head>')
} else {
  html = html.replace(/window\.__DISI_API_BASE__ = "[^"]*"/, `window.__DISI_API_BASE__ = ${JSON.stringify(app.api)}`)
}

// viewport：原生环境锁定缩放（浏览器里不动，保留无障碍缩放）
const nativeViewport = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
if (html.includes('name="viewport"')) {
  html = html.replace(/<meta name="viewport" content="[^"]*"[^>]*>/, `<meta name="viewport" content="${nativeViewport}">`)
} else {
  html = html.replace('</head>', `  <meta name="viewport" content="${nativeViewport}">\n</head>`)
}

fs.writeFileSync(indexPath, html)
console.log(`已准备 ${which}: ${app.src} -> ${app.out}（API: ${app.api}）`)
