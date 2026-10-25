import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import Add from '../views/Add.vue'
import Users from '../views/Users.vue'

import ForumLogin from '../views/ForumLogin.vue'
import Index from '../views/Index.vue'
import User from '../views/User.vue'
import PostDetail from '../views/PostDetail.vue'
import { prefetch } from '../utils/cache.js'
import { apiGetPosts, apiGetCurrentUser, apiGetPostDetail } from '../api/index_api.js'

const routes = [
  { path: '/', redirect: '/index' },
  { path: '/login', name: 'Login', component: ForumLogin, meta: { public: true } },
  { path: '/index', name: 'Index', component: Index, meta: { requiresAuth: true } },
  { path: '/add', component: Add, meta: { requiresAuth: true } },
  { path: '/post/:id', name: 'PostDetail', component: PostDetail, meta: { requiresAuth: true } },
  { path: '/user', name: 'User', component: User, meta: { requiresAuth: true } },
  { path: '/users', name: 'Users', component: Users, meta: { requiresAuth: true } },
]

const history = import.meta.env.VITE_ROUTER_MODE === 'hash' ? createWebHashHistory('/') : createWebHistory('/')

const router = createRouter({
  history,
  routes,
})

// 换页前先取数据，旧页面保持显示，避免空壳闪烁
router.beforeEach(async (to, from, next) => {
  const hasToken = !!localStorage.getItem('disi_token')
  if (to.path === '/login') {
    hasToken ? next('/index') : next()
    return
  }
  if (!hasToken) {
    next('/login')
    return
  }

  try {
    if (to.path === '/index') {
      await prefetch('forum:posts', apiGetPosts)
      await prefetch('forum:me', apiGetCurrentUser)
    } else if (to.path === '/user') {
      await prefetch('forum:me', apiGetCurrentUser)
      await prefetch('forum:myPosts', apiGetPosts)
    } else if (to.name === 'PostDetail') {
      await prefetch('forum:post:' + to.params.id, () => apiGetPostDetail(to.params.id))
    }
  } catch (e) {
    // 预取失败交给页面自己处理
  }
  next()
})

export default router
