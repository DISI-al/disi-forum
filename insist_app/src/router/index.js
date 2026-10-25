import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import InsistHome from '../views/Insist.vue'

const routes = [
  { path: '/', name: 'Home', component: InsistHome, meta: { requiresAuth: true } },
  { path: '/login', name: 'Login', component: () => import('../views/InsistLogin.vue'), meta: { public: true } },
  { path: '/collection', name: 'Collection', component: () => import('../views/InsistCollection.vue'), meta: { requiresAuth: true } },
  { path: '/skill/:id', name: 'Skill', component: () => import('../views/InsistSkill.vue'), meta: { requiresAuth: true } },
  { path: '/cards', name: 'Cards', component: () => import('../views/InsistCards.vue'), meta: { requiresAuth: true } },
  { path: '/card/:id', name: 'CardDetail', component: () => import('../views/InsistCardDetail.vue'), meta: { requiresAuth: true } },
  { path: '/achievements', name: 'Achievements', component: () => import('../views/InsistAchievements.vue'), meta: { requiresAuth: true } },
  { path: '/stats', name: 'Stats', component: () => import('../views/InsistStats.vue'), meta: { requiresAuth: true } },
  { path: '/settings', name: 'Settings', component: () => import('../views/InsistSettings.vue'), meta: { requiresAuth: true } },
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
