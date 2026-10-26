import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import './style.css'
import './styles/markdown.css'

createApp(App).use(router).mount('#app')

// ---- 移动端返回：根页面交给原生（进后台），其余交给路由 ----
;(function () {
  var ROOTS = ['/index', '/user', '/login']

  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
  }

  window.__DISI_BACK__ = function () {
    var path = router.currentRoute.value.path
    if (ROOTS.indexOf(path) !== -1) return false        // 根页面：不处理，让原生进后台
    var state = window.history.state || {}
    if (state.back) {
      router.back()
      return true
    }
    router.replace(ROOTS[0])
    return true
  }

  // 非原生环境（浏览器/桌面端）下也定义，避免 undefined 判断散落各处
  window.__DISI_IS_NATIVE__ = isNative()
})()
