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
  { path: '/insist', name: 'Insist', component: () => import('../views/Insist.vue'), meta: { requiresAuth: true } },
  { path: '/insist/collection', name: 'InsistCollection', component: () => import('../views/InsistCollection.vue'), meta: { requiresAuth: true } },
  { path: '/insist/skill/:id', name: 'InsistSkill', component: () => import('../views/InsistSkill.vue'), meta: { requiresAuth: true } },
  { path: '/insist/cards', name: 'InsistCards', component: () => import('../views/InsistCards.vue'), meta: { requiresAuth: true } },
  { path: '/insist/card/:id', name: 'InsistCardDetail', component: () => import('../views/InsistCardDetail.vue'), meta: { requiresAuth: true } },
  { path: '/insist/achievements', name: 'InsistAchievements', component: () => import('../views/InsistAchievements.vue'), meta: { requiresAuth: true } },
  { path: '/insist/achievement/:id', name: 'InsistAchievementDetail', component: () => import('../views/InsistAchievementDetail.vue'), meta: { requiresAuth: true } },
  { path: '/insist/settings', name: 'InsistSettings', component: () => import('../views/InsistSettings.vue'), meta: { requiresAuth: true } },
  // 旧入口：/dao/space 现在直接进入 INSIST
  { path: '/dao/space', redirect: '/insist' },
  // 新空间入口（预留）：后续独立应用挂到 /dao 下时，删掉这两个占位路由即可
  // /dao 允许游客浏览（只看到引言页），长按开锁时再要求登录
  { path: '/dao', name: 'Dao', component: () => import('../views/Dao.vue'), meta: { public: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 登录守卫：未登录只能看登录页和公开页（/dao 引言页）
router.beforeEach((to, from, next) => {
  const hasToken = !!localStorage.getItem('disi_token')
  if (to.path === '/login') {
    hasToken ? next('/index') : next()
    return
  }
  if (to.meta.public) {
    next()
    return
  }
  hasToken ? next() : next('/login')
})

export default router
