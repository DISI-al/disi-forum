<template>
  <div class="disi-forum">
    <div class="forum-center-container">
      <!-- 返回导航 -->
      <nav class="sub-nav">
        <router-link to="/index" class="back-link">← 返回论坛</router-link>
      </nav>

      <!-- 个人信息卡片 -->
      <section class="user-card">
        <div class="avatar-section">
          <div class="avatar-main" @click="triggerAvatar" title="点击更换头像">
            <img v-if="user.avatarUrl" :src="user.avatarUrl" class="avatar-main-img" />
            <span v-else class="avatar-main-text">{{ user.name?.charAt(0) || 'U' }}</span>
            <div class="avatar-overlay">📷</div>
          </div>
          <input type="file" ref="avatarInput" accept="image/*" @change="handleAvatarChange" style="display:none" />
        </div>

        <div class="user-meta">
          <div class="user-name">{{ user.name || '未登录' }}</div>
          <div class="user-badges">
            <span class="badge" :class="user.isAdmin ? 'badge-admin' : 'badge-user'">
              {{ user.isAdmin ? '管理员' : '成员' }}
            </span>
          </div>
          <div class="user-stats">
            <div class="stat-item">
              <span class="stat-num">{{ userPosts.length }}</span>
              <span class="stat-label">帖子</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-num">{{ totalLikes }}</span>
              <span class="stat-label">获赞</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 帖子列表 -->
      <main class="container-xl mt-3">
        <div class="content">
          <h3 class="section-title">我的帖子</h3>
          <div v-for="post in userPosts" :key="post.id" class="post-card">
            <div class="post-header">
              <span class="post-title-simple">{{ post.title }}</span>
              <span class="post-sticky" v-if="post.pinned">📌</span>
              <span class="post-date">{{ formatTime(post.createdAt) }}</span>
            </div>
            <p class="post-preview">{{ postPreview(post) }}</p>
            <div class="media-block" v-if="post.media">
              <div class="media-images" v-if="post.media.images?.length">
                <img v-for="(img, i) in post.media.images" :key="i" :src="img.url" :alt="img.name" class="media-img" loading="lazy" />
              </div>
              <div class="media-videos" v-if="post.media.videos?.length">
                <video v-for="(vid, i) in post.media.videos" :key="i" :src="vid.url" controls class="media-video" preload="metadata"></video>
              </div>
              <div class="media-files" v-if="post.media.files?.length">
                <a v-for="(f, i) in post.media.files" :key="i" :href="f.url" class="media-file-link" target="_blank">📎 {{ f.name }}</a>
              </div>
            </div>
            <div class="post-actions">
              <span class="stat-chip">👍 {{ post.stats?.likes || 0 }}</span>
              <span class="stat-chip">💬 {{ post.stats?.comments || 0 }}</span>
              <button class="action-btn danger" @click="handleDelete(post.id)">删除</button>
            </div>
          </div>
          <div v-if="!userPosts.length" class="empty-state">暂无帖子</div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiGetCurrentUser, apiGetPosts, apiDeletePost, apiUploadAvatar, apiGetLikesCount } from '../api/index_api.js'

const router = useRouter()
const user = ref({ id: '', name: '', role: 'user', isAdmin: false, avatarUrl: '' })
const userPosts = ref([])
const totalLikes = ref(0)
const avatarInput = ref(null)

const triggerAvatar = () => { avatarInput.value?.click() }

const handleAvatarChange = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  const res = await apiUploadAvatar(file)
  if (res.avatarUrl) {
    user.value.avatarUrl = res.avatarUrl
  }
}

const postPreview = (post) => {
  if (!post.content) return ''
  return post.content.length > 120 ? post.content.slice(0, 120) + '...' : post.content
}

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

const handleDelete = async (postId) => {
  if (window.confirm('确定删除这篇帖子？')) {
    await apiDeletePost(postId)
    const allPosts = await apiGetPosts()
    userPosts.value = allPosts.filter(p => p.author?.id === user.value.id)
  }
}

onMounted(async () => {
  user.value = await apiGetCurrentUser()
  const allPosts = await apiGetPosts()
  userPosts.value = allPosts.filter(p => p.author?.id === user.value.id)
  try {
    const res = await apiGetLikesCount()
    totalLikes.value = res.likesCount || 0
  } catch (e) { /* 忽略 */ }
})
</script>

<style scoped>
* { margin: 0; padding: 0; box-sizing: border-box; }

.disi-forum {
  background: #0d1117;
  color: #e6edf3;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}

.forum-center-container {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 0 1rem;
}

.sub-nav {
  padding: 1rem 0;
}
.back-link {
  color: var(--gh-text-link, #58a6ff);
  text-decoration: none;
  font-size: 0.875rem;
}
.back-link:hover { text-decoration: underline; }

/* 用户卡片 */
.user-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  padding: 2rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.avatar-section { position: relative; flex-shrink: 0; }
.avatar-main {
  width: 80px; height: 80px;
  border-radius: 50%;
  background: #21262d;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid #30363d;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.avatar-main:hover .avatar-overlay { opacity: 1; }
.avatar-main-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-main-text { font-size: 2rem; font-weight: 600; }
.avatar-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.5rem;
  opacity: 0;
  transition: opacity 0.2s;
  border-radius: 50%;
}

.user-meta { flex: 1; min-width: 0; }
.user-name { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.3rem; }
.user-badges { margin-bottom: 0.75rem; }
.badge {
  display: inline-block;
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
  font-weight: 500;
}
.badge-admin { background: rgba(248,81,73,0.15); color: #f85149; }
.badge-user  { background: rgba(88,166,255,0.1); color: #58a6ff; }

.user-stats { display: flex; align-items: center; gap: 0; }
.stat-item { text-align: center; padding: 0 1rem; }
.stat-num { display: block; font-size: 1.25rem; font-weight: 700; }
.stat-label { font-size: 0.75rem; color: #7d8590; }
.stat-divider { width: 1px; height: 30px; background: #30363d; }

.section-title { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: #e6edf3; }

/* 帖子 */
.content {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 1.5rem;
  min-height: 300px;
}

.post-card {
  border-bottom: 1px solid #30363d;
  padding: 0.85rem 0;
}
.post-card:last-child { border-bottom: none; }

.post-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; }
.post-title-simple { font-weight: 600; font-size: 0.95rem; color: #58a6ff; }
.post-sticky { font-size: 0.75rem; }
.post-date { font-size: 0.7rem; color: #7d8590; margin-left: auto; }

.post-preview { color: #7d8590; font-size: 0.8rem; line-height: 1.45; margin-bottom: 0.35rem; }

.post-actions { display: flex; gap: 0.5rem; align-items: center; }
.stat-chip { font-size: 0.75rem; color: #7d8590; }
.action-btn {
  border: 1px solid #30363d;
  background: transparent;
  color: #7d8590;
  border-radius: 5px;
  padding: 0.15rem 0.5rem;
  font-size: 0.7rem;
  cursor: pointer;
}
.action-btn.danger:hover { color: #f85149; border-color: #f85149; }

/* 媒体 */
.media-images { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.4rem; }
.media-img { width: 100px; height: 66px; object-fit: cover; border-radius: 5px; border: 1px solid #30363d; }
.media-video { max-width: 100%; max-height: 200px; border-radius: 5px; border: 1px solid #30363d; }
.media-file-link {
  display: inline-block;
  font-size: 0.75rem;
  color: #58a6ff;
  background: #21262d;
  padding: 0.2rem 0.5rem;
  border-radius: 5px;
  border: 1px solid #30363d;
  margin-right: 0.4rem;
  text-decoration: none;
}

.empty-state { text-align: center; color: #7d8590; padding: 3rem 0; font-size: 0.9rem; }

@media (max-width: 600px) {
  .user-card { padding: 1.5rem; gap: 1rem; justify-content: center; text-align: center; }
  .user-meta { flex-basis: 100%; }
  .user-stats { justify-content: center; }
  .content { padding: 1rem; border-radius: 0; }
}
</style>
