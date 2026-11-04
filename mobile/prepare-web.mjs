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
    background: '#0d1117',
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
      --app-bg: ${JSON.stringify(app.background)};
      background: var(--app-bg);    /* 越界滚动时露出的就是应用底色 */
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
      overscroll-behavior-y: contain;
    }
    body {
      background: var(--app-bg);
      min-height: 100%;
      padding-top: var(--safe-top);
      padding-bottom: var(--safe-bottom);
      touch-action: manipulation;   /* 去掉双击放大 */
      overscroll-behavior-y: contain;
    }

    /* ---- iOS 聚焦输入框会自动放大页面，字号 < 16px 时更明显 ---- */
    input,
    textarea,
    select,
    [contenteditable="true"] {
      font-size: 16px !important;
    }

    /* ---- 兜底：越界滚动区域也铺满应用底色 ---- */
    body::before {
      content: '';
      position: fixed;
      left: 0;
      right: 0;
      top: -60vh;
      bottom: -60vh;
      background: var(--app-bg);
      z-index: -2;
      pointer-events: none;
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

        // 4) 下拉刷新（列表页顶部下拉 70px 触发）
        (function () {
          var startY = 0, pulling = false, ready = false;
          var bar = document.createElement('div');
          bar.style.cssText =
            'position:fixed;left:0;right:0;top:0;height:44px;display:flex;align-items:center;justify-content:center;' +
            'font-size:12px;color:#8a8a8a;background:transparent;transform:translateY(-44px);' +
            'transition:transform .18s ease;z-index:9999;pointer-events:none;';
          bar.textContent = '下拉刷新';
          document.body.appendChild(bar);

          function reset() {
            bar.style.transform = 'translateY(-44px)';
            bar.textContent = '下拉刷新';
            pulling = false;
            ready = false;
          }

          document.addEventListener('touchstart', function (e) {
            if (e.touches.length !== 1) return;
            if (window.scrollY > 0) return;
            startY = e.touches[0].clientY;
            pulling = true;
          }, { passive: true });

          document.addEventListener('touchmove', function (e) {
            if (!pulling) return;
            var dy = e.touches[0].clientY - startY;
            if (dy <= 0) { reset(); return; }
            var shown = Math.min(44, dy * 0.5);
            bar.style.transform = 'translateY(' + (shown - 44) + 'px)';
            ready = dy > 70;
            bar.textContent = ready ? '松开刷新' : '下拉刷新';
          }, { passive: true });

          document.addEventListener('touchend', function () {
            if (!pulling) return;
            if (ready) {
              bar.textContent = '刷新中…';
              bar.style.transform = 'translateY(0)';
              window.dispatchEvent(new Event('disi:refresh'));
              // 页面没接管就整体重载（SPA 资源有缓存，速度很快）
              setTimeout(function () {
                if (!window.__DISI_REFRESH_HANDLED__) location.reload();
              }, 320);
            } else {
              reset();
            }
            pulling = false;
          }, { passive: true });
        })();

        // 5) iOS：屏幕左缘往右滑 = 返回
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
