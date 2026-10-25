import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import ForumLogin from '../views/ForumLogin.vue'
import Index from '../views/Index.vue'
import User from '../views/User.vue'
import PostDetail from '../views/PostDetail.vue'

const routes = [
  { path: '/', redirect: '/index' },
  { path: '/login', name: 'Login', component: ForumLogin, meta: { public: true } },
  { path: '/index', name: 'Index', component: Index, meta: { requiresAuth: true } },
  { path: '/add', component: () => import('../views/Add.vue'), meta: { requiresAuth: true } },
  { path: '/post/:id', name: 'PostDetail', component: PostDetail, meta: { requiresAuth: true } },
  { path: '/user', name: 'User', component: User, meta: { requiresAuth: true } },
  { path: '/users', name: 'Users', component: () => import('../views/Users.vue'), meta: { requiresAuth: true } },
]

const history = import.meta.env.VITE_ROUTER_MODE === 'hash' ? createWebHashHistory('/') : createWebHistory('/')

const router = createRouter({
  history,
  routes,
})

router.beforeEach((to, from, next) => {
  const hasToken = !!localStorage.getItem('disi_token')
  if (to.path === '/login') {
    hasToken ? next('/index') : next()
    return
  }
  hasToken ? next() : next('/login')
})

export default router
