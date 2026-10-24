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
          <div class="user-name">
            <template v-if="editingName">
              <input
                v-model="nameDraft"
                class="name-input"
                type="text"
                maxlength="50"
                @keydown.enter.prevent="saveName"
                @keydown.esc="cancelName"
              />
              <button class="name-btn" type="button" :disabled="savingName" @click="saveName">保存</button>
              <button class="name-btn ghost" type="button" @click="cancelName">取消</button>
            </template>
            <template v-else>
              <span>{{ user.name || '未登录' }}</span>
              <button class="name-edit" type="button" title="修改昵称" aria-label="修改昵称" @click="startName">✎</button>
            </template>
          </div>
          <p v-if="nameError" class="name-error">{{ nameError }}</p>
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

        <!-- 入口：TALENT 被故障切片打散，露出红色 INSIST -->
        <router-link to="/dao" class="talent-door" aria-label="Talent 还是 Insist？进入新空间">
          <span class="talent-word legend" aria-hidden="true">TALENT</span>
          <span class="talent-word bottom" aria-hidden="true">INSIST<span class="caret">&gt;</span></span>
          <span class="glitch" aria-hidden="true">
            <span
              v-for="slice in slices"
              :key="slice.i"
              class="slice"
              :style="{ top: slice.top, height: slice.height, '--i': slice.i, '--dx': slice.dx, '--d': slice.delay }"
            >
              <span class="slice-inner">
                <span class="talent-word top">TALENT</span>
              </span>
            </span>
          </span>
        </router-link>
      </section>

      <!-- 帖子列表：与上方个人信息卡片同宽 -->
      <main class="forum-main">
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
import { apiGetCurrentUser, apiGetPosts, apiDeletePost, apiUploadAvatar, apiGetLikesCount, apiUpdateUserName } from '../api/index_api.js'
import { makePreview } from '../utils/markdown.js'

const router = useRouter()
const user = ref({ id: '', name: '', role: 'user', isAdmin: false, avatarUrl: '' })
const userPosts = ref([])
const totalLikes = ref(0)
const avatarInput = ref(null)

/* ---------- 修改自己的昵称 ---------- */
const editingName = ref(false)
const nameDraft = ref('')
const savingName = ref(false)
const nameError = ref('')

function startName() {
  if (!user.value.id) return
  nameDraft.value = user.value.name
  nameError.value = ''
  editingName.value = true
}

function cancelName() {
  editingName.value = false
  nameError.value = ''
}

async function saveName() {
  const value = nameDraft.value.trim()
  if (!value || value === user.value.name || savingName.value) {
    if (!value) nameError.value = '昵称不能为空'
    return
  }
  savingName.value = true
  nameError.value = ''
  try {
    const updated = await apiUpdateUserName(user.value.id, value)
    user.value.name = updated.name
    localStorage.setItem('disi_user_name', updated.name)
    editingName.value = false
  } catch (e) {
    nameError.value = e.message || '修改失败'
  } finally {
    savingName.value = false
  }
}

const triggerAvatar = () => { avatarInput.value?.click() }

const handleAvatarChange = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  const res = await apiUploadAvatar(file)
  if (res.avatarUrl) {
    user.value.avatarUrl = res.avatarUrl
  }
}

const postPreview = (post) => makePreview(post.content, 120)

/* TALENT 的故障切片：6 条横向切片，交替左右错位、依次淡出 */
const SLICE_COUNT = 6
const slices = Array.from({ length: SLICE_COUNT }, (_, i) => {
  const h = 100 / SLICE_COUNT
  const dir = i % 2 ? 1 : -1
  return {
    i,
    top: `${(i * h).toFixed(3)}%`,
    height: `${h}%`,
    dx: `${dir * (8 + i * 3)}px`,
    delay: `${i * 25}ms`,
  }
})

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
  if (!window.confirm('确定删除这篇帖子？')) return
  try {
    await apiDeletePost(postId)
    userPosts.value = userPosts.value.filter((p) => p.id !== postId)
  } catch (err) {
    alert('删除失败：' + (err.message || '网络异常'))
  }
}

onMounted(async () => {
  // 三个请求彼此独立：用户信息失败也不该让帖子列表空掉
  const [userRes, postsRes, likeRes] = await Promise.allSettled([
    apiGetCurrentUser(),
    apiGetPosts(),
    apiGetLikesCount(),
  ])
  if (userRes.status === 'fulfilled') user.value = userRes.value
  if (postsRes.status === 'fulfilled') {
    userPosts.value = postsRes.value.filter((p) => p.author?.id === user.value.id)
  }
  if (likeRes.status === 'fulfilled') totalLikes.value = likeRes.value.likesCount || 0
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
  position: relative;
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
.user-name {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.3rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.name-edit {
  background: transparent;
  border: 1px solid var(--gh-border, #30363d);
  border-radius: 6px;
  color: var(--gh-text-secondary, #8b949e);
  font-size: 0.8rem;
  line-height: 1;
  padding: 0.28rem 0.42rem;
  cursor: pointer;
  transition: all 0.15s ease;
}
.name-edit:hover { color: var(--gh-text-primary, #e6edf3); border-color: #6e7681; }

.name-input {
  width: 12em;
  max-width: 100%;
  background: var(--gh-bg-primary, #0d1117);
  border: 1px solid var(--gh-border, #30363d);
  border-radius: 6px;
  color: var(--gh-text-primary, #e6edf3);
  font-size: 1rem;
  font-weight: 600;
  padding: 0.3rem 0.55rem;
  outline: none;
}
.name-input:focus { border-color: var(--gh-text-link, #58a6ff); }

.name-btn {
  background: #238636;
  border: 1px solid #238636;
  border-radius: 6px;
  color: #fff;
  font-size: 0.78rem;
  padding: 0.3rem 0.6rem;
  cursor: pointer;
}
.name-btn:hover:not(:disabled) { background: #2ea043; border-color: #2ea043; }
.name-btn:disabled { opacity: 0.5; cursor: default; }
.name-btn.ghost {
  background: transparent;
  border-color: var(--gh-border, #30363d);
  color: var(--gh-text-secondary, #8b949e);
}
.name-btn.ghost:hover { color: var(--gh-text-primary, #e6edf3); border-color: #6e7681; }

.name-error {
  margin: 0 0 0.4rem;
  font-size: 0.75rem;
  color: #f85149;
}
.user-badges { margin-bottom: 0.75rem; }

/* ===== 入口：TALENT 故障切片 → 红色 INSIST =====
   没有门板、没有边框：只有一层被切成 6 条的 TALENT。
   悬停时切片交替左右错位、依次淡出，露出下面的 INSIST。 */
.talent-door {
  --door-w: 200px;
  --door-h: 80px;
  --slice-count: 6;
  position: relative;
  flex: none;
  width: var(--door-w);
  height: var(--door-h);
  margin-left: auto;
  overflow: hidden;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}
.talent-door:focus-visible {
  outline: 2px solid #58a6ff;
  outline-offset: 4px;
}

.talent-word {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  white-space: nowrap;
  user-select: none;
  /* TALENT 与 INSIST 完全同一套字：同色、同字号、同字重，只有单词不同 */
  color: #a3adb8;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-indent: 0.1em;
}

/* 真相：只换词，不换排版；加箭头后整体宽度仍与 TALENT 对齐 */
.talent-word.bottom {
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.1em;
  opacity: 0;
  transform: scale(0.94);
  letter-spacing: 0.065em;
  text-indent: 0;
  transition: opacity 0.14s ease, transform 0.14s ease;
}
.caret {
  flex: none;
  opacity: 0.9;
}

/* 切片层：只覆盖文字那一行（30px），否则大部分切片切不到字 */
.glitch {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 30px;
  transform: translateY(-50%);
  z-index: 2;
}
.slice {
  position: absolute;
  left: 0;
  right: 0;
  overflow: hidden;
  transition: transform 0.16s ease, opacity 0.16s ease;
}
.slice-inner {
  position: absolute;
  left: 0;
  right: 0;
  height: calc(var(--slice-count) * 100%);
  top: calc(-1 * var(--i) * 100%);
  display: grid;
  place-items: center;
}

/* 悬停 / 键盘聚焦：碎掉 */
.talent-door:hover .slice,
.talent-door:focus-visible .slice {
  transform: translateX(var(--dx));
  opacity: 0;
  transition: transform 0.38s cubic-bezier(0.2, 0.9, 0.2, 1), opacity 0.3s ease;
  transition-delay: var(--d);
}
.talent-door:hover .talent-word.bottom,
.talent-door:focus-visible .talent-word.bottom {
  opacity: 1;
  transform: scale(1);
  transition: opacity 0.3s ease 0.16s, transform 0.42s cubic-bezier(0.16, 1, 0.3, 1) 0.14s;
}

/* 只在触屏 / 窄屏上出现的静态小字 */
.talent-word.legend { display: none; }

/* 触屏 / 窄屏：静态两行，不做故障动效 */
@media (max-width: 600px), (hover: none) {
  .talent-door {
    height: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.4rem 0 0.2rem;
  }
  .glitch { display: none; }
  .talent-word { position: static; inset: auto; }
  .talent-word.legend {
    display: block;
    font-size: 26px;
  }
  .talent-word.bottom { font-size: 26px; opacity: 1; transform: none; }
}
@media (max-width: 640px) {
  .user-card {
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 1.5rem 1.1rem;
    gap: 1rem;
  }
  .user-meta { align-items: center; width: 100%; }
  .user-name { justify-content: center; }
  .user-stats { justify-content: center; }
  .talent-door { width: 100%; flex-basis: 100%; margin: 0.9rem 0 0; }
}

/* 系统要求减少动效：改成淡入淡出，不做位移 */
@media (prefers-reduced-motion: reduce) {
  .slice { transition: opacity 0.2s linear; }
  .talent-door:hover .slice,
  .talent-door:focus-visible .slice {
    transform: none;
    transition: opacity 0.2s linear;
    transition-delay: 0ms;
  }
  .talent-word.bottom { transition: opacity 0.2s linear; }
  .talent-door:hover .talent-word.bottom,
  .talent-door:focus-visible .talent-word.bottom { transition: opacity 0.2s linear; }
}
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

/* 帖子区：与用户卡片共用容器宽度 */
.forum-main { padding: 1rem 0 2rem; }

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
