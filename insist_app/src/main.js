import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import './style.css'
import './styles/insist.css'

createApp(App).use(router).mount('#app')

// ---- 移动端：把「返回」交给路由（Android 返回键 / iOS 左缘滑动都会调到这里）----
;(function () {
  if (!window.Capacitor || typeof window.Capacitor.isNativePlatform !== 'function') return
  if (!window.Capacitor.isNativePlatform()) return

  window.__DISI_BACK__ = function () {
    var state = window.history.state || {}
    // vue-router 在 history.state 里记录 back，有它就说明还有上一层
    if (state.back) {
      router.back()
      return true
    }
    return false
  }
})()

