<template>
  <div class="disi-detail-page">
    <div class="detail-container">
      <!-- 顶部 -->
      <div class="detail-topbar">
        <router-link to="/index" class="back-link">&larr; 返回列表</router-link>
        <button v-if="!editing && !loading && !error && post.title" class="copy-btn" @click="copyContent">
          {{ copied ? '✓ 已复制' : '📋 复制正文' }}
        </button>
      </div>

      <div v-if="loading" class="state-tip">加载中...</div>

      <div v-else-if="error" class="state-tip error">
        <p class="error-text">{{ error }}</p>
        <button class="btn-ghost" @click="loadDetail">重新加载</button>
      </div>

      <div v-else class="post-detail-card">
        <!-- ==================== 编辑态（作者本人） ==================== -->
        <template v-if="editing">
          <div class="editor-head">
            <h2 class="editor-title">编辑帖子</h2>
            <div class="editor-tabs">
              <button class="tab-btn" :class="{ active: !previewMode }" @click="previewMode = false">编辑</button>
              <button class="tab-btn" :class="{ active: previewMode }" @click="previewMode = true">预览</button>
            </div>
          </div>

          <input v-model="editTitle" class="editor-title-input" maxlength="200" placeholder="标题" />

          <div v-if="previewMode" class="md-body preview-box" v-html="editPreviewHtml"></div>
          <template v-else>
            <textarea
              ref="editorRef"
              v-model="editContent"
              class="editor-textarea"
              spellcheck="false"
              placeholder="支持 Markdown 语法&#10;&#10;# 标题&#10;**加粗**  *斜体*  ~~删除线~~  `行内代码`&#10;- 列表项&#10;> 引用&#10;[链接文字](https://example.com)&#10;直接粘贴 https://example.com 也会自动变成超链接"
            ></textarea>
            <p class="editor-hint">
              Markdown 语法：<code>**加粗**</code>、<code>*斜体*</code>、<code>`代码`</code>、<code>[文字](链接)</code>、
              <code># 标题</code>、<code>- 列表</code>、<code>&gt; 引用</code>、<code>```代码块</code>；
              直接写 URL 也会自动变成可点击链接。
            </p>
          </template>

          <div class="editor-actions">
            <button class="btn-primary" :disabled="saving" @click="saveEdit">{{ saving ? '保存中…' : '保存修改' }}</button>
            <button class="btn-ghost" :disabled="saving" @click="cancelEdit">取消</button>
          </div>
        </template>

        <!-- ==================== 阅读态 ==================== -->
        <template v-else>
          <!-- 作者行 -->
          <div class="post-header">
            <div class="post-avatar">
              <img v-if="post.author?.avatarUrl" :src="post.author.avatarUrl" loading="lazy" alt="" />
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

          <!-- 正文：Markdown 渲染，可选中复制 -->
          <div class="md-body post-content" v-html="contentHtml"></div>

          <!-- 媒体展示 -->
          <div class="media-block" v-if="post.media">
            <div class="media-images" v-if="post.media.images?.length">
              <img
                v-for="(img, i) in post.media.images"
                :key="i"
                :src="img.url"
                :alt="img.name"
                class="media-img"
                loading="lazy"
                decoding="async"
                @click="openLightbox(img.url)"
              />
            </div>
            <div class="media-videos" v-if="post.media.videos?.length">
              <video v-for="(vid, i) in post.media.videos" :key="i" :src="vid.url" controls class="media-video" preload="metadata"></video>
            </div>
            <div class="media-files" v-if="post.media.files?.length">
              <a v-for="(f, i) in post.media.files" :key="i" :href="f.url" class="media-file-link" target="_blank" rel="noopener">
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
            <button class="action-btn" @click="copyContent">
              {{ copied ? '✓ 已复制' : '📋 复制正文' }}
            </button>
            <button v-if="currentUser.isAdmin" class="action-btn" @click="handlePin">
              {{ post.pinned ? '📌取消置顶' : '📌置顶' }}
            </button>
            <button v-if="canEdit" class="action-btn" @click="startEdit">
              ✏️ 编辑
            </button>
            <button v-if="currentUser.isAdmin || canEdit" class="action-btn danger" @click="handleDelete">
              删除
            </button>
          </div>

          <!-- 评论区 -->
          <div class="comment-section">
            <h3 class="comment-title">评论（{{ comments.length }}）</h3>

            <div class="comment-list">
              <div v-for="comment in comments" :key="comment.id" class="comment-item">
                <div class="comment-avatar">
                  <img v-if="comment.avatarUrl" :src="comment.avatarUrl" class="comment-avatar-img" loading="lazy" alt="" />
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
        </template>
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
  apiAddComment, apiDeleteComment, apiGetCurrentUser, apiUpdatePost
} from '../api/index_api.js'
import { renderMarkdown, extractTags } from '../utils/markdown.js'

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
const editorRef = ref(null)

// 复制
const copied = ref(false)

// 编辑态
const editing = ref(false)
const saving = ref(false)
const previewMode = ref(false)
const editTitle = ref('')
const editContent = ref('')

const contentHtml = computed(() => renderMarkdown(post.value.content || ''))
const editPreviewHtml = computed(() => renderMarkdown(editContent.value))
const isLiked = computed(() => post.value.meta?.likedBy?.includes(currentUser.value.id))
const canEdit = computed(() => Boolean(currentUser.value.id) && currentUser.value.id === post.value.author?.id)

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

const loadUser = async () => {
  try {
    currentUser.value = await apiGetCurrentUser()
  } catch (err) {
    console.warn('获取当前用户失败，按游客处理', err)
  }
}

const loadDetail = async () => {
  loading.value = true
  error.value = ''
  try {
    // 详情和评论并行请求，少一次 RTT
    const [detail, commentList] = await Promise.all([
      apiGetPostDetail(postId),
      apiGetComments(postId),
    ])
    post.value = detail
    comments.value = commentList
  } catch (err) {
    error.value = '加载失败：' + (err.message || '帖子不存在或网络异常')
  } finally {
    loading.value = false
  }
}

/** 复制正文：优先用 Clipboard API，HTTP 环境下回退到 execCommand */
const copyText = async (text) => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (err) {
      /* 非安全上下文会抛错，继续走回退方案 */
    }
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch (err) {
    return false
  }
}

const copyContent = async () => {
  const ok = await copyText(post.value.content || '')
  if (ok) {
    copied.value = true
    setTimeout(() => { copied.value = false }, 1600)
  } else {
    alert('复制失败，请长按正文选择文本复制')
  }
}

const handleLike = async () => {
  try {
    await apiLikePost(postId)
    if (!post.value.meta) post.value.meta = { likedBy: [], favoritedBy: [] }
    if (!post.value.stats) post.value.stats = { likes: 0, comments: 0, favorites: 0 }
    const likedBy = post.value.meta.likedBy || []
    if (likedBy.includes(currentUser.value.id)) {
      post.value.meta.likedBy = likedBy.filter((id) => id !== currentUser.value.id)
      post.value.stats.likes = Math.max(0, (post.value.stats.likes || 0) - 1)
    } else {
      post.value.meta.likedBy = [...likedBy, currentUser.value.id]
      post.value.stats.likes = (post.value.stats.likes || 0) + 1
    }
  } catch (err) {
    alert('操作失败：' + (err.message || '网络异常'))
  }
}

const handlePin = async () => {
  try {
    await apiPinPost(postId, !post.value.pinned)
    post.value.pinned = !post.value.pinned
  } catch (err) {
    alert('操作失败：' + (err.message || '网络异常'))
  }
}

const handleDelete = async () => {
  if (!window.confirm('确定删除这篇帖子？')) return
  try {
    await apiDeletePost(postId)
    router.push('/index')
  } catch (err) {
    alert('删除失败：' + (err.message || '网络异常'))
  }
}

const focusComment = () => {
  commentInputRef.value?.focus()
}

const handleAddComment = async () => {
  const content = newComment.value.trim()
  if (!content) return
  try {
    const created = await apiAddComment(postId, content)
    comments.value = [...comments.value, created]
    newComment.value = ''
  } catch (err) {
    alert('评论失败：' + (err.message || '网络异常'))
  }
}

const handleDeleteComment = async (commentId) => {
  try {
    await apiDeleteComment(postId, commentId)
    comments.value = comments.value.filter((c) => c.id !== commentId)
  } catch (err) {
    alert('删除失败：' + (err.message || '网络异常'))
  }
}

/* ---------------- 正文编辑（Markdown） ---------------- */
const startEdit = () => {
  editTitle.value = post.value.title || ''
  editContent.value = post.value.content || ''
  previewMode.value = false
  editing.value = true
}

const cancelEdit = () => {
  editing.value = false
}

const saveEdit = async () => {
  const title = editTitle.value.trim()
  if (!title) {
    alert('标题不能为空')
    return
  }
  saving.value = true
  try {
    const updated = await apiUpdatePost(postId, {
      title,
      content: editContent.value,
      tags: extractTags(editContent.value),
    })
    post.value = { ...post.value, ...updated }
    editing.value = false
  } catch (err) {
    alert('保存失败：' + (err.message || '网络异常'))
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  // 互不阻塞：就算取用户信息失败，正文照常加载
  loadUser()
  loadDetail()
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

.detail-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.back-link {
  display: inline-block;
  color: #58a6ff;
  text-decoration: none;
  font-size: 0.875rem;
}
.back-link:hover { text-decoration: underline; }

.copy-btn {
  background: transparent;
  border: 1px solid #30363d;
  color: #7d8590;
  border-radius: 6px;
  padding: 0.25rem 0.6rem;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
}
.copy-btn:hover { color: #58a6ff; border-color: #58a6ff; }

.state-tip { text-align: center; color: #7d8590; padding: 3rem 0; }
.state-tip.error { color: #f85149; }
.error-text { margin-bottom: 0.75rem; }

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
  word-break: break-word;
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

/* 正文容器：排版交给全局 .md-body，这里只保证可选中、可复制 */
.post-content {
  margin-bottom: 1.5rem;
  -webkit-user-select: text;
  user-select: text;
  -webkit-touch-callout: default;
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

/* 编辑态 */
.editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.editor-title { font-size: 1.1rem; font-weight: 600; }
.editor-tabs { display: flex; border: 1px solid #30363d; border-radius: 8px; overflow: hidden; }
.tab-btn {
  background: transparent;
  border: none;
  color: #7d8590;
  font-size: 0.8rem;
  padding: 0.3rem 0.85rem;
  cursor: pointer;
}
.tab-btn.active { background: #21262d; color: #58a6ff; }

.editor-title-input {
  width: 100%;
  background: #0d1117;
  border: 1px solid #30363d;
  color: #e6edf3;
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  font-size: 1.05rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  outline: none;
}
.editor-title-input:focus { border-color: #58a6ff; }

.editor-textarea {
  width: 100%;
  min-height: 340px;
  resize: vertical;
  background: #0d1117;
  border: 1px solid #30363d;
  color: #e6edf3;
  border-radius: 8px;
  padding: 0.85rem;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.9rem;
  line-height: 1.65;
  outline: none;
}
.editor-textarea:focus { border-color: #58a6ff; }

.preview-box {
  border: 1px dashed #30363d;
  border-radius: 8px;
  padding: 1rem;
  background: #0d1117;
  min-height: 120px;
}

.editor-hint {
  color: #7d8590;
  font-size: 0.75rem;
  line-height: 1.6;
  margin-top: 0.5rem;
}
.editor-hint code {
  background: #21262d;
  border-radius: 4px;
  padding: 0.05rem 0.3rem;
  font-size: 0.95em;
}

.editor-actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
.btn-primary {
  background: #238636;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.45rem 1.1rem;
  font-size: 0.875rem;
  cursor: pointer;
}
.btn-primary:hover { background: #2ea043; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost {
  background: transparent;
  color: #7d8590;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 0.45rem 1.1rem;
  font-size: 0.875rem;
  cursor: pointer;
}
.btn-ghost:hover { color: #e6edf3; border-color: #7d8590; }

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
  .editor-textarea { min-height: 260px; }
}
</style>
