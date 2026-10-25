import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
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

router.beforeEach((to, from, next) => {
  const hasToken = !!localStorage.getItem('disi_token')
  if (to.path === '/login') {
    hasToken ? next('/') : next()
    return
  }
  hasToken ? next() : next('/login')
})

export default router
