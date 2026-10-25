<template>
  <div class="disi-forum">
    <div class="forum-center-container">
      <!-- 顶部导航 -->
      <nav class="navbar-main">
        <div class="nav-row">
          <!-- Logo -->
          <div class="logo-wrapper">
            <router-link to="/" class="site-logo">第四论坛</router-link>
          </div>

          <!-- 搜索框（桌面：中间  /  手机：独占第二行） -->
          <div class="search-box">
            <div class="input-group">
              <span class="input-group-text">&#x1F50D;</span>
              <input type="text" class="form-control" v-model="searchQuery" placeholder="搜索帖子..." @input="handleSearch">
            </div>
          </div>

          <!-- 右侧操作 -->
          <div class="nav-actions">
            <router-link
              v-if="currentUser.isAdmin"
              to="/users"
              class="btn btn-manage-users"
              title="用户管理"
            ><span class="btn-ico" aria-hidden="true">&#x1F465;</span><span class="btn-label">用户</span></router-link>
            <router-link to="/add" class="btn btn-add-post" title="发帖">
              <span class="btn-ico" aria-hidden="true">&#x270F;&#xFE0F;</span><span class="btn-label">发帖</span>
            </router-link>
            <a href="#" class="btn btn-logout" title="退出登录" @click.prevent="handleLogout">
              <span class="btn-ico" aria-hidden="true">&#x23FB;</span><span class="btn-label">退出登录</span>
            </a>
            <router-link to="/user" class="avatar-link">
              <div class="avatar">
                <img v-if="currentUser.avatarUrl" :src="currentUser.avatarUrl" class="avatar-img" />
                <span v-else>{{ currentUser.name?.charAt(0) || 'U' }}</span>
              </div>
            </router-link>
          </div>
        </div>
      </nav>

      <!-- 帖子列表：与顶部导航同宽（同一容器内，不再额外收窄） -->
      <main class="forum-main">
        <div class="content">
          <div v-for="post in filteredPosts" :key="post.id" class="post-card">
            <!-- 作者行 -->
            <div class="post-header">
              <div class="post-avatar">
                <img v-if="post.author?.avatarUrl" :src="post.author.avatarUrl" />
              </div>
              <span class="post-author-name">{{ post.author?.name || 'User' }}</span>
              <span class="post-time" v-if="post.createdAt">{{ formatTime(post.createdAt) }}</span>
              <span class="post-sticky" v-if="post.pinned">📌 置顶</span>
            </div>

            <!-- 标题 -->
            <router-link :to="`/post/${post.id}`" class="post-title">{{ post.title }}</router-link>

            <!-- 标签 -->
            <div class="post-tags mb-2" v-if="post.tags?.length">
              <span v-for="tag in post.tags" :key="tag" class="post-tag">#{{ tag }}</span>
            </div>

            <!-- 正文预览（Markdown 压成纯文本，超长截断） -->
            <router-link :to="`/post/${post.id}`" class="post-content-preview mb-3">{{ postPreview(post) }}</router-link>

            <!-- 媒体展示 -->
            <div class="media-block" v-if="post.media">
              <div class="media-images" v-if="post.media.images?.length">
                <img v-for="(img, i) in post.media.images" :key="i" :src="img.url" :alt="img.name" class="media-img" loading="lazy" @click="openLightbox(img.url)" />
              </div>
              <div class="media-videos" v-if="post.media.videos?.length">
                <video v-for="(vid, i) in post.media.videos" :key="i" :src="vid.url" controls class="media-video" preload="metadata"></video>
              </div>
              <div class="media-files" v-if="post.media.files?.length">
                <a v-for="(f, i) in post.media.files" :key="i" :href="f.url" class="media-file-link" target="_blank">
                  📎 {{ f.name }}
                </a>
              </div>
            </div>

            <!-- 操作栏 -->
            <div class="post-actions">
              <button class="action-btn" :class="{ active: isLiked(post) }" @click="handleLike(post.id)">
                👍 {{ post.stats?.likes || 0 }}
              </button>
              <button class="action-btn" @click="toggleCommentPanel(post.id)">
                💬 {{ post.stats?.comments || 0 }}
              </button>
              <button v-if="currentUser.isAdmin" class="action-btn" @click="handlePin(post.id)">
                {{ post.pinned ? '📌取消置顶' : '📌置顶' }}
              </button>
              <button v-if="currentUser.isAdmin || post.author?.id === currentUser.id" class="action-btn danger" @click="handleDelete(post.id)">
                删除
              </button>
            </div>

            <!-- 评论区（大改） -->
            <div class="comment-panel" v-show="commentPanels[post.id]">
              <!-- 已有评论 -->
              <div class="comment-list">
                <div v-for="comment in post.comments" :key="comment.id" class="comment-item">
                  <div class="comment-avatar">
                    <img v-if="comment.avatarUrl" :src="comment.avatarUrl" class="comment-avatar-img" />
                    <span v-else>{{ comment.userName?.charAt(0) || '?' }}</span>
                  </div>
                  <div class="comment-body">
                    <div class="comment-header">
                      <span class="comment-author">{{ comment.userName }}</span>
                    </div>
                    <div class="comment-text">{{ comment.content }}</div>
                  </div>
                  <button
                    v-if="currentUser.isAdmin || comment.userId === currentUser.id"
                    class="comment-del"
                    @click="handleDeleteComment(post.id, comment.id)"
                    title="删除"
                  >×</button>
                </div>
                <div v-if="!post.comments?.length" class="comment-empty">暂无评论，来说点什么吧</div>
              </div>

              <!-- 评论输入 -->
              <div class="comment-input-row">
                <div class="comment-input-avatar">{{ currentUser.name?.charAt(0) || 'U' }}</div>
                <input
                  type="text"
                  class="comment-input"
                  v-model="newComments[post.id]"
                  placeholder="写下你的评论..."
                  @keydown.enter="handleAddComment(post.id)"
                >
                <button class="comment-send" @click="handleAddComment(post.id)">发送</button>
              </div>
            </div>
          </div>
          <div v-if="loading && !posts.length" class="empty-state">
            帖子加载中…
          </div>
          <div v-else-if="errorMsg" class="empty-state">
            <p class="error-text">{{ errorMsg }}</p>
            <button class="action-btn" @click="loadPosts">重新加载</button>
          </div>
          <div v-else-if="!filteredPosts.length" class="empty-state">
            {{ searchQuery.trim() ? '没有匹配的帖子' : '暂无帖子' }}
          </div>
        </div>
      </main>
    </div>

    <!-- 图片灯箱 -->
    <div class="lightbox" v-if="lightboxUrl" @click="closeLightbox">
      <img :src="lightboxUrl" class="lightbox-img" @click.stop />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  apiGetPosts, apiLikePost, apiPinPost, apiDeletePost,
  apiAddComment, apiDeleteComment, apiGetCurrentUser, apiLogout
} from '../api/index_api.js'
import { makePreview } from '../utils/markdown.js'

const router = useRouter()
const posts = ref([])
const searchQuery = ref('')
const commentPanels = ref({})
const newComments = ref({})
const lightboxUrl = ref('')
const loading = ref(true)
const errorMsg = ref('')
const currentUser = ref({ id: '', name: '', role: 'user', isAdmin: false, avatarUrl: '' })

const openLightbox = (url) => { lightboxUrl.value = url }
const closeLightbox = () => { lightboxUrl.value = '' }

const filteredPosts = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()
  if (!keyword) return posts.value
  return posts.value.filter(post => {
    const title = (post.title || '').toLowerCase()
    const content = (post.content || '').toLowerCase()
    return title.includes(keyword) || content.includes(keyword)
  })
})

const postPreview = (post) => makePreview(post.content, 180)

const formatTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return d.toLocaleDateString('zh-CN')
}

const isLiked = (post) => post.meta?.likedBy?.includes(currentUser.value.id)

const handleSearch = () => {}

const findPost = (postId) => posts.value.find((p) => p.id === postId)

// 所有交互都只更新本地数据，不再每点一次就重拉整张列表（移动端流畅度的关键）
const handleLike = async (postId) => {
  const post = findPost(postId)
  if (!post) return
  try {
    await apiLikePost(postId)
    if (!post.meta) post.meta = { likedBy: [], favoritedBy: [] }
    if (!post.stats) post.stats = { likes: 0, comments: 0, favorites: 0 }
    const likedBy = post.meta.likedBy || []
    if (likedBy.includes(currentUser.value.id)) {
      post.meta.likedBy = likedBy.filter((id) => id !== currentUser.value.id)
      post.stats.likes = Math.max(0, (post.stats.likes || 0) - 1)
    } else {
      post.meta.likedBy = [...likedBy, currentUser.value.id]
      post.stats.likes = (post.stats.likes || 0) + 1
    }
  } catch (err) {
    alert('操作失败：' + (err.message || '网络异常'))
  }
}

const handlePin = async (postId) => {
  const post = findPost(postId)
  if (!post) return
  try {
    await apiPinPost(postId, !post.pinned)
    post.pinned = !post.pinned
  } catch (err) {
    alert('操作失败：' + (err.message || '网络异常'))
  }
}

const handleDelete = async (postId) => {
  if (!window.confirm('确定删除这篇帖子？')) return
  try {
    await apiDeletePost(postId)
    posts.value = posts.value.filter((p) => p.id !== postId)
  } catch (err) {
    alert('删除失败：' + (err.message || '网络异常'))
  }
}

const toggleCommentPanel = (postId) => {
  commentPanels.value[postId] = !commentPanels.value[postId]
}

const handleAddComment = async (postId) => {
  const content = newComments.value[postId]?.trim()
  if (!content) return
  const post = findPost(postId)
  try {
    const created = await apiAddComment(postId, content)
    if (post) {
      post.comments = [...(post.comments || []), created]
      if (post.stats) post.stats.comments = (post.stats.comments || 0) + 1
    }
    newComments.value[postId] = ''
  } catch (err) {
    alert('评论失败：' + (err.message || '网络异常'))
  }
}

const handleDeleteComment = async (postId, commentId) => {
  const post = findPost(postId)
  try {
    await apiDeleteComment(postId, commentId)
    if (post) {
      post.comments = (post.comments || []).filter((c) => c.id !== commentId)
      if (post.stats) post.stats.comments = Math.max(0, (post.stats.comments || 0) - 1)
    }
  } catch (err) {
    alert('删除失败：' + (err.message || '网络异常'))
  }
}

const handleLogout = () => {
  apiLogout()
  router.push('/login')
}

const loadUser = async () => {
  try {
    const u = await apiGetCurrentUser()
    // 后端在 token 失效时会返回 guest 身份，这里直接请回登录页，避免「变成游客」
    if (!u || u.id === 'guest') {
      ;['disi_token', 'disi_role', 'disi_user_id', 'disi_user_name'].forEach((k) => localStorage.removeItem(k))
      router.push('/login')
      return
    }
    currentUser.value = u
  } catch (err) {
    console.warn('获取当前用户失败，按游客处理', err)
  }
}

const loadPosts = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    posts.value = await apiGetPosts()
  } catch (err) {
    errorMsg.value = '帖子加载失败：' + (err.message || '网络异常')
  } finally {
    loading.value = false
  }
}

// 关键修复：两个请求互不阻塞。之前 apiGetCurrentUser() 一旦抛异常，
// 后面的 apiGetPosts() 就再也不会执行，页面只剩「暂无帖子」。
onMounted(() => {
  loadUser()
  loadPosts()
})
</script>

<style>
:root {
  --gh-bg-primary: #0d1117;
  --gh-bg-secondary: #161b22;
  --gh-bg-tertiary: #21262d;
  --gh-border: #30363d;
  --gh-text-primary: #e6edf3;
  --gh-text-secondary: #7d8590;
  --gh-text-link: #58a6ff;
  --gh-accent: #1f6feb;
}
</style>

<style scoped>
* { margin: 0; padding: 0; box-sizing: border-box; }

.disi-forum {
  background-color: var(--gh-bg-primary);
  color: var(--gh-text-primary);
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}

.forum-center-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

/* 导航栏 */
.navbar-main {
  border-bottom: 1px solid var(--gh-border);
  background: var(--gh-bg-primary);
  padding: 1.5rem 0;
}
.nav-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

/* Logo：图片已裁掉四周透明留白，左对齐贴住容器左边缘 */
.logo-wrapper { width: 72px; flex-shrink: 0; }
.site-logo {
  font-size: 0;
  display: block;
  width: 72px;
  height: 32px;
  background: url('../assets/Trans02-trimmed.png') left center no-repeat;
  background-size: contain;
  text-decoration: none;
}

/* 搜索框 */
.search-box { flex: 1; min-width: 0; }
.search-box .input-group {
  background: var(--gh-bg-tertiary);
  border: 1px solid var(--gh-border);
  border-radius: 8px;
  max-width: 560px;
  padding-left: 0.5rem;
}

.search-box .form-control {
  background: transparent;
  border: none;
  color: var(--gh-text-primary);
  padding: 0.5rem 0.75rem;
  font-size: 0.95rem;
}
.search-box .input-group-text { background: transparent; border: none; color: var(--gh-text-secondary); }
.search-box .form-control::placeholder { color: var(--gh-text-secondary); font-size: 0.875rem; }
.search-box .form-control:focus { box-shadow: none; }

/* 右侧操作 */
.nav-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.btn-add-post {
  background: #238636;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.4rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
}
.btn-add-post:hover { background: #2ea043; color: #fff; }

.btn-manage-users {
  display: inline-flex;
  align-items: center;
  background: var(--gh-bg-tertiary);
  color: var(--gh-text-primary);
  border: 1px solid var(--gh-border);
  border-radius: 8px;
  padding: 0.4rem 0.9rem;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
}
.btn-manage-users:hover { border-color: #6e7681; color: #fff; }

.btn-logout {
  background: transparent;
  color: #f85149;
  border: 1px solid #f85149;
  border-radius: 8px;
  padding: 0.4rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
}
.btn-logout:hover { background: #f85149; color: #fff; }

/* 手机端 */
@media (max-width: 767px) {
  .nav-row {
    flex-wrap: wrap;
    row-gap: 0.55rem;
  }
  /* Row 1: logo + actions */
  .logo-wrapper { flex: 1 1 auto; min-width: 0; }
  .site-logo { width: 56px; }
  .nav-actions { order: 2; gap: 0.4rem; flex-wrap: nowrap; }
  .btn-add-post, .btn-manage-users, .btn-logout {
    padding: 0.32rem 0.55rem;
    font-size: 0.76rem;
  }
  .avatar { width: 30px; height: 30px; }
  /* Row 2: full-width search */
  .search-box {
    order: 3;
    flex-basis: 100%;
  }
  .search-box .input-group { max-width: 100%; }
}

/* 窄屏（iPhone mini 等）：按钮只留图标，保证 logo + 三按钮 + 头像同一行 */
@media (max-width: 540px) {
  .site-logo { width: 46px; }
  .nav-actions { gap: 0.3rem; }
  .btn-label { display: none; }
  .btn-ico { margin-right: 0; }
  .btn-add-post, .btn-manage-users, .btn-logout {
    padding: 0.34rem 0.48rem;
    font-size: 0.85rem;
    line-height: 1;
  }
  .avatar { width: 28px; height: 28px; font-size: 0.78rem; }
}

/* 头像 */
.avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: var(--gh-bg-tertiary);
  display: flex; align-items: center; justify-content: center;
  font-weight: 600; font-size: 0.875rem;
  border: 1px solid var(--gh-border);
  cursor: pointer;
  overflow: hidden;
}
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-link { text-decoration: none; flex-shrink: 0; }

/* 列表区：与导航栏共用 .forum-center-container 的宽度，不再自己收窄 */
.forum-main { padding: 1rem 0 2rem; }

.content {
  background: var(--gh-bg-secondary);
  border: 1px solid var(--gh-border);
  border-radius: 8px;
  padding: 1.5rem;
  min-height: 500px;
}

/* 帖子卡片 */
.post-card {
  border-bottom: 1px solid var(--gh-border);
  padding: 1.25rem 0;
  /* 长列表优化：屏幕外的卡片跳过渲染，滚动时再绘制（移动端明显更顺） */
  content-visibility: auto;
  contain-intrinsic-size: auto 240px;
}
.post-card:last-child { border-bottom: none; }

.post-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}
.post-avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--gh-bg-tertiary);
  flex-shrink: 0;
  overflow: hidden;
}
.post-avatar img { width: 100%; height: 100%; object-fit: cover; }
.post-author-name { font-weight: 600; font-size: 0.875rem; }
.post-time { color: var(--gh-text-secondary); font-size: 0.75rem; }
.post-sticky { color: #f85149; font-size: 0.75rem; font-weight: 500; margin-left: auto; }

.post-title { display: block; color: var(--gh-text-link); font-size: 1.1rem; font-weight: 600; margin-bottom: 0.35rem; text-decoration: none; }
.post-title:hover { text-decoration: underline; }

.post-tag {
  display: inline-block;
  font-size: 0.75rem;
  color: var(--gh-text-link);
  background: rgba(88,166,255,0.1);
  border: 1px solid rgba(88,166,255,0.2);
  padding: 0.1rem 0.5rem;
  border-radius: 12px;
  margin-right: 0.3rem;
  margin-bottom: 0.3rem;
}

.post-content-preview { display: block; color: var(--gh-text-primary); font-size: 0.9rem; line-height: 1.6; text-decoration: none; white-space: pre-wrap; word-break: break-word; }
.post-content-preview:hover { color: var(--gh-text-primary); }

/* 媒体 */
.media-images { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem; }
.media-img {
  width: 120px; height: 80px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--gh-border);
  cursor: pointer;
  transition: transform 0.15s;
}
.media-img:hover { transform: scale(1.05); }

/* 灯箱 */
.lightbox {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.85);
  z-index: 9999;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.lightbox-img {
  max-width: 90vw; max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
  cursor: default;
}
.media-videos { margin-bottom: 0.5rem; }
.media-video { max-width: 100%; max-height: 300px; border-radius: 6px; border: 1px solid var(--gh-border); }
.media-file-link {
  display: inline-block;
  font-size: 0.8rem;
  color: var(--gh-text-link);
  background: var(--gh-bg-tertiary);
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--gh-border);
  margin-right: 0.5rem;
  text-decoration: none;
}
.media-file-link:hover { border-color: var(--gh-text-link); }

/* 操作栏 */
.post-actions { display: flex; gap: 0.25rem; flex-wrap: wrap; margin-top: 0.5rem; }
.action-btn {
  border: 1px solid var(--gh-border);
  background: transparent;
  color: var(--gh-text-secondary);
  border-radius: 6px;
  padding: 0.25rem 0.6rem;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
}
.action-btn:hover { color: var(--gh-text-link); border-color: var(--gh-text-link); }
.action-btn.active { color: #58a6ff; border-color: #58a6ff; background: rgba(88,166,255,0.08); }
.action-btn.danger:hover { color: #f85149; border-color: #f85149; }

/* 评论区 */
.comment-panel {
  border: 1px solid var(--gh-border);
  border-radius: 10px;
  background: var(--gh-bg-tertiary);
  margin-top: 0.75rem;
  overflow: hidden;
}

.comment-list { padding: 0.75rem 0.75rem 0; }

.comment-item {
  display: flex;
  gap: 0.6rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid rgba(48,54,61,0.6);
}
.comment-item:last-child { border-bottom: none; }

.comment-avatar {
  width: 30px; height: 30px;
  border-radius: 50%;
  background: var(--gh-bg-secondary);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 600;
  flex-shrink: 0;
  border: 1px solid var(--gh-border);
  overflow: hidden;
}
.comment-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.comment-body { flex: 1; min-width: 0; }
.comment-header { margin-bottom: 0.15rem; }
.comment-author { font-weight: 600; font-size: 0.8rem; color: var(--gh-text-link); }
.comment-text { font-size: 0.875rem; color: var(--gh-text-primary); line-height: 1.45; word-break: break-word; }

.comment-del {
  background: transparent; border: none;
  color: var(--gh-text-secondary); font-size: 1.1rem;
  cursor: pointer; padding: 0 0.25rem; flex-shrink: 0;
  align-self: flex-start;
}
.comment-del:hover { color: #f85149; }

.comment-empty { color: var(--gh-text-secondary); font-size: 0.8rem; padding: 0.5rem 0; text-align: center; }

/* 评论输入行 */
.comment-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border-top: 1px solid var(--gh-border);
  background: rgba(0,0,0,0.15);
}
.comment-input-avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--gh-bg-secondary);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 600;
  flex-shrink: 0;
  border: 1px solid var(--gh-border);
}
.comment-input {
  flex: 1;
  background: var(--gh-bg-secondary);
  border: 1px solid var(--gh-border);
  color: var(--gh-text-primary);
  border-radius: 8px;
  padding: 0.4rem 0.6rem;
  font-size: 0.85rem;
  outline: none;
  min-width: 0;
}
.comment-input:focus { border-color: var(--gh-text-link); }
.comment-send {
  background: #238636;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.4rem 0.8rem;
  font-size: 0.8rem;
  cursor: pointer;
  flex-shrink: 0;
}
.comment-send:hover { background: #2ea043; }

.empty-state { text-align: center; color: var(--gh-text-secondary); padding: 4rem 0; }
.error-text { color: #f85149; font-size: 0.9rem; margin-bottom: 0.75rem; }

/* 响应式 */
@media (max-width: 768px) {
  .forum-center-container { padding: 0 0.5rem; }
  .content { padding: 1rem; border-radius: 0; }
  .post-card { padding: 1rem 0; }
  .post-title { font-size: 1rem; }
  .media-img { width: 90px; height: 60px; }
  .btn-add-post, .btn-logout { padding: 0.35rem 0.8rem; font-size: 0.8rem; }
}
</style>
