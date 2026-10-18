<template>
  <div class="disi-detail-page">
    <div class="detail-container">
      <!-- 返回 -->
      <router-link to="/index" class="back-link">&larr; 返回列表</router-link>

      <div v-if="loading" class="state-tip">加载中...</div>
      <div v-else-if="error" class="state-tip error">{{ error }}</div>

      <div v-else class="post-detail-card">
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
        <h1 class="post-title">{{ post.title }}</h1>

        <!-- 标签 -->
        <div class="post-tags" v-if="post.tags?.length">
          <span v-for="tag in post.tags" :key="tag" class="post-tag">#{{ tag }}</span>
        </div>

        <!-- 完整正文（保留换行） -->
        <div class="post-content">{{ post.content }}</div>

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
          <button class="action-btn" :class="{ active: isLiked }" @click="handleLike">
            👍 {{ post.stats?.likes || 0 }}
          </button>
          <button class="action-btn" @click="focusComment">
            💬 {{ comments.length }}
          </button>
          <button v-if="currentUser.isAdmin" class="action-btn" @click="handlePin">
            {{ post.pinned ? '📌取消置顶' : '📌置顶' }}
          </button>
          <button v-if="currentUser.isAdmin || post.author?.id === currentUser.id" class="action-btn danger" @click="handleDelete">
            删除
          </button>
        </div>

        <!-- 评论区 -->
        <div class="comment-section">
          <h3 class="comment-title">评论（{{ comments.length }}）</h3>

          <div class="comment-list">
            <div v-for="comment in comments" :key="comment.id" class="comment-item">
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
                @click="handleDeleteComment(comment.id)"
                title="删除"
              >×</button>
            </div>
            <div v-if="!comments.length" class="comment-empty">暂无评论，来说点什么吧</div>
          </div>

          <!-- 评论输入 -->
          <div class="comment-input-row">
            <div class="comment-input-avatar">{{ currentUser.name?.charAt(0) || 'U' }}</div>
            <input
              ref="commentInputRef"
              type="text"
              class="comment-input"
              v-model="newComment"
              placeholder="写下你的评论..."
              @keydown.enter="handleAddComment"
            >
            <button class="comment-send" @click="handleAddComment">发送</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 图片灯箱 -->
    <div class="lightbox" v-if="lightboxUrl" @click="closeLightbox">
      <img :src="lightboxUrl" class="lightbox-img" @click.stop />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  apiGetPostDetail, apiGetComments, apiLikePost, apiPinPost, apiDeletePost,
  apiAddComment, apiDeleteComment, apiGetCurrentUser
} from '../api/index_api.js'

const route = useRoute()
const router = useRouter()

const postId = route.params.id
const post = ref({})
const comments = ref([])
const currentUser = ref({ id: '', name: '', role: 'user', isAdmin: false, avatarUrl: '' })
const loading = ref(true)
const error = ref('')
const newComment = ref('')
const lightboxUrl = ref('')
const commentInputRef = ref(null)

const isLiked = computed(() => post.value.meta?.likedBy?.includes(currentUser.value.id))

const openLightbox = (url) => { lightboxUrl.value = url }
const closeLightbox = () => { lightboxUrl.value = '' }

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

const loadDetail = async () => {
  try {
    post.value = await apiGetPostDetail(postId)
    comments.value = await apiGetComments(postId)
  } catch (err) {
    error.value = '加载失败：' + (err.message || '帖子不存在或网络异常')
  } finally {
    loading.value = false
  }
}

const handleLike = async () => {
  await apiLikePost(postId)
  post.value = await apiGetPostDetail(postId)
}

const handlePin = async () => {
  await apiPinPost(postId, !post.value.pinned)
  post.value = await apiGetPostDetail(postId)
}

const handleDelete = async () => {
  if (window.confirm('确定删除这篇帖子？')) {
    await apiDeletePost(postId)
    router.push('/index')
  }
}

const focusComment = () => {
  commentInputRef.value?.focus()
}

const handleAddComment = async () => {
  const content = newComment.value.trim()
  if (!content) return
  await apiAddComment(postId, content)
  comments.value = await apiGetComments(postId)
  newComment.value = ''
}

const handleDeleteComment = async (commentId) => {
  await apiDeleteComment(postId, commentId)
  comments.value = await apiGetComments(postId)
}

onMounted(async () => {
  const user = await apiGetCurrentUser()
  currentUser.value = user
  await loadDetail()
})
</script>

<style scoped>
* { margin: 0; padding: 0; box-sizing: border-box; }

.disi-detail-page {
  background-color: #0d1117;
  color: #e6edf3;
  min-height: 100vh;
  padding: 1.5rem 1rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}

.detail-container {
  width: 100%;
  max-width: 820px;
  margin: 0 auto;
}

.back-link {
  display: inline-block;
  color: #58a6ff;
  text-decoration: none;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}
.back-link:hover { text-decoration: underline; }

.state-tip { text-align: center; color: #7d8590; padding: 3rem 0; }
.state-tip.error { color: #f85149; }

.post-detail-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 10px;
  padding: 2rem;
}

.post-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}
.post-avatar {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: #21262d;
  flex-shrink: 0;
  overflow: hidden;
}
.post-avatar img { width: 100%; height: 100%; object-fit: cover; }
.post-author-name { font-weight: 600; font-size: 0.9rem; }
.post-time { color: #7d8590; font-size: 0.75rem; }
.post-sticky { color: #f85149; font-size: 0.75rem; font-weight: 500; margin-left: auto; }

.post-title {
  color: #e6edf3;
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  line-height: 1.3;
}

.post-tags { margin-bottom: 1rem; }
.post-tag {
  display: inline-block;
  font-size: 0.75rem;
  color: #58a6ff;
  background: rgba(88,166,255,0.1);
  border: 1px solid rgba(88,166,255,0.2);
  padding: 0.1rem 0.5rem;
  border-radius: 12px;
  margin-right: 0.3rem;
  margin-bottom: 0.3rem;
}

/* 完整正文：保留换行、自动换行 */
.post-content {
  color: #c9d1d9;
  font-size: 1rem;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 1.5rem;
}

/* 媒体 */
.media-images { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }
.media-img {
  width: 160px; height: 110px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #30363d;
  cursor: pointer;
  transition: transform 0.15s;
}
.media-img:hover { transform: scale(1.05); }
.media-videos { margin-bottom: 0.75rem; }
.media-video { max-width: 100%; max-height: 400px; border-radius: 6px; border: 1px solid #30363d; }
.media-files { margin-bottom: 0.75rem; }
.media-file-link {
  display: inline-block;
  font-size: 0.8rem;
  color: #58a6ff;
  background: #21262d;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  border: 1px solid #30363d;
  margin-right: 0.5rem;
  text-decoration: none;
}
.media-file-link:hover { border-color: #58a6ff; }

/* 操作栏 */
.post-actions { display: flex; gap: 0.35rem; flex-wrap: wrap; padding: 1rem 0; border-top: 1px solid #30363d; border-bottom: 1px solid #30363d; }
.action-btn {
  border: 1px solid #30363d;
  background: transparent;
  color: #7d8590;
  border-radius: 6px;
  padding: 0.3rem 0.7rem;
  font-size: 0.825rem;
  cursor: pointer;
  transition: all 0.15s;
}
.action-btn:hover { color: #58a6ff; border-color: #58a6ff; }
.action-btn.active { color: #58a6ff; border-color: #58a6ff; background: rgba(88,166,255,0.08); }
.action-btn.danger:hover { color: #f85149; border-color: #f85149; }

/* 评论区 */
.comment-section { margin-top: 1.5rem; }
.comment-title { font-size: 1.05rem; font-weight: 600; margin-bottom: 1rem; }

.comment-list { margin-bottom: 1rem; }
.comment-item {
  display: flex;
  gap: 0.6rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(48,54,61,0.6);
}
.comment-item:last-child { border-bottom: none; }
.comment-avatar {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: #21262d;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 600;
  flex-shrink: 0;
  border: 1px solid #30363d;
  overflow: hidden;
}
.comment-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.comment-body { flex: 1; min-width: 0; }
.comment-header { margin-bottom: 0.2rem; }
.comment-author { font-weight: 600; font-size: 0.8rem; color: #58a6ff; }
.comment-text { font-size: 0.9rem; color: #e6edf3; line-height: 1.5; word-break: break-word; white-space: pre-wrap; }
.comment-del {
  background: transparent; border: none;
  color: #7d8590; font-size: 1.1rem;
  cursor: pointer; padding: 0 0.25rem; flex-shrink: 0;
  align-self: flex-start;
}
.comment-del:hover { color: #f85149; }
.comment-empty { color: #7d8590; font-size: 0.85rem; padding: 1rem 0; text-align: center; }

.comment-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid #30363d;
  border-radius: 10px;
  background: #21262d;
}
.comment-input-avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: #161b22;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 600;
  flex-shrink: 0;
  border: 1px solid #30363d;
}
.comment-input {
  flex: 1;
  background: #161b22;
  border: 1px solid #30363d;
  color: #e6edf3;
  border-radius: 8px;
  padding: 0.45rem 0.6rem;
  font-size: 0.875rem;
  outline: none;
  min-width: 0;
}
.comment-input:focus { border-color: #58a6ff; }
.comment-send {
  background: #238636;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.45rem 0.9rem;
  font-size: 0.825rem;
  cursor: pointer;
  flex-shrink: 0;
}
.comment-send:hover { background: #2ea043; }

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

/* 响应式 */
@media (max-width: 768px) {
  .disi-detail-page { padding: 1rem 0.5rem; }
  .post-detail-card { padding: 1.25rem; border-radius: 0; }
  .post-title { font-size: 1.25rem; }
  .media-img { width: 100px; height: 70px; }
}
</style>
