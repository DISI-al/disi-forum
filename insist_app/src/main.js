import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import './style.css'
import './styles/insist.css'

createApp(App).use(router).mount('#app')

// ---- 移动端返回：根页面交给原生（进后台），其余交给路由 ----
;(function () {
  var ROOTS = ['/', '/collection', '/cards', '/achievements', '/settings', '/login']

  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
  }

  window.__DISI_BACK__ = function () {
    var path = router.currentRoute.value.path
    if (ROOTS.indexOf(path) !== -1) return false
    var state = window.history.state || {}
    if (state.back) {
      router.back()
      return true
    }
    router.replace(ROOTS[0])
    return true
  }

  window.__DISI_IS_NATIVE__ = isNative()
})()
