import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Index from '../views/Index.vue'
import User from '../views/User.vue'
import PostDetail from '../views/PostDetail.vue'

const routes = [
  { path: '/', redirect: '/index' },
  { path: '/login', name: 'Login', component: Login },
  { path: '/index', name: 'Index', component: Index, meta: { requiresAuth: true } },
  { path: '/add', component: () => import('../views/Add.vue'), meta: { requiresAuth: true } },
  { path: '/post/:id', name: 'PostDetail', component: PostDetail, meta: { requiresAuth: true } },
  { path: '/user', name: 'User', component: User, meta: { requiresAuth: true } },
  { path: '/users', name: 'Users', component: () => import('../views/Users.vue'), meta: { requiresAuth: true } },
  // 新空间入口（预留）：后续独立应用挂到 /dao 下时，删掉这两个占位路由即可
  { path: '/dao', name: 'Dao', component: () => import('../views/Dao.vue') },
  { path: '/dao/space', name: 'DaoSpace', component: () => import('../views/DaoSpace.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 登录守卫：未登录只能看登录页
router.beforeEach((to, from, next) => {
  const hasToken = !!localStorage.getItem('disi_token')
  if (to.path === '/login') {
    hasToken ? next('/index') : next()
  } else {
    hasToken ? next() : next('/login')
  }
})

export default router
