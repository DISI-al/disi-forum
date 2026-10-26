import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import { prefetch } from '../insist/cache.js'
import { apiOverview, apiSkills, apiCards, apiStats, apiSettings } from '../api/insist_api.js'
import InsistLogin from '../views/InsistLogin.vue'
import InsistCollection from '../views/InsistCollection.vue'
import InsistSkill from '../views/InsistSkill.vue'
import InsistCards from '../views/InsistCards.vue'
import InsistCardDetail from '../views/InsistCardDetail.vue'
import InsistAchievements from '../views/InsistAchievements.vue'
import InsistStats from '../views/InsistStats.vue'
import InsistSettings from '../views/InsistSettings.vue'
import InsistHome from '../views/Insist.vue'

const routes = [
  { path: '/', name: 'Home', component: InsistHome, meta: { requiresAuth: true } },
  { path: '/login', name: 'Login', component: InsistLogin, meta: { public: true } },
  { path: '/collection', name: 'Collection', component: InsistCollection, meta: { requiresAuth: true } },
  { path: '/skill/:id', name: 'Skill', component: InsistSkill, meta: { requiresAuth: true } },
  { path: '/cards', name: 'Cards', component: InsistCards, meta: { requiresAuth: true } },
  { path: '/card/:id', name: 'CardDetail', component: InsistCardDetail, meta: { requiresAuth: true } },
  { path: '/achievements', name: 'Achievements', component: InsistAchievements, meta: { requiresAuth: true } },
  { path: '/stats', name: 'Stats', component: InsistStats, meta: { requiresAuth: true } },
  { path: '/settings', name: 'Settings', component: InsistSettings, meta: { requiresAuth: true } },
]

const history = import.meta.env.VITE_ROUTER_MODE === 'hash' ? createWebHashHistory('/') : createWebHistory('/')

const router = createRouter({
  history,
  routes,
})

// 换页前先把目标页数据取好（旧页面继续显示），新页面直接用缓存渲染，避免空壳闪烁
const preloaders = {
  '/': () => Promise.allSettled([
    prefetch('overview', apiOverview),
    prefetch('skills', apiSkills),
    prefetch('cards', apiCards),
  ]),
  '/collection': () => prefetch('skills', apiSkills),
  '/cards': () => Promise.allSettled([prefetch('cards', apiCards), prefetch('skills', apiSkills)]),
  '/achievements': () => Promise.allSettled([
    prefetch('ach', () => apiCards({ kind: 'achievement' })),
    prefetch('skills', apiSkills),
  ]),
  '/stats': () => Promise.allSettled([
    prefetch('stats', () => apiStats(14)),
    prefetch('skills', apiSkills),
  ]),
  '/settings': () => prefetch('settings', apiSettings),
}

router.beforeEach(async (to, from, next) => {
  const hasToken = !!localStorage.getItem('disi_token')
  // 登录页优先：即使本地有 token 也先展示登录页
  if (to.path === '/login') {
    next()
    return
  }
  if (!hasToken) {
    next('/login')
    return
  }

  const loader = preloaders[to.path]
  if (loader) {
    try {
      await loader()
    } catch (e) {
      // 预取失败交给页面自己处理
    }
  }
  next()
})

export default router
