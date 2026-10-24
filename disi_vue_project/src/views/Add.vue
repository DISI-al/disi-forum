<template>
  <div class="disi-add-page">
    <router-link to="/index" class="back-link">&larr; 返回</router-link>
    <div class="post-card">
      <h2 class="h4 mb-4">发布新帖子</h2>
      <form class="post-form" @submit.prevent="handlePublish">
        <div class="mb-3">
          <label class="form-label">标题</label>
          <input v-model="form.title" type="text" class="form-control" placeholder="输入帖子标题" maxlength="200" />
        </div>

        <div class="mb-3">
          <div class="label-row">
            <label class="form-label">正文</label>
            <div class="editor-tabs">
              <button type="button" class="tab-btn" :class="{ active: !previewMode }" @click="previewMode = false">编辑</button>
              <button type="button" class="tab-btn" :class="{ active: previewMode }" @click="previewMode = true">预览</button>
            </div>
          </div>

          <div v-if="previewMode" class="md-body preview-box" v-html="previewHtml"></div>
          <textarea
            v-else
            v-model="form.content"
            class="form-control"
            rows="12"
            spellcheck="false"
            placeholder="# 标题&#10;**加粗**  *斜体*  `代码`&#10;- 列表项&#10;> 引用&#10;[链接文字](https://example.com)&#10;直接粘贴 https://example.com 也会自动变成超链接"
          ></textarea>
          <p class="editor-hint">
            支持 Markdown：<code>**加粗**</code>、<code>*斜体*</code>、<code>`代码`</code>、<code>[文字](链接)</code>、
            <code># 标题</code>、<code>- 列表</code>、<code>&gt; 引用</code>、<code>```代码块</code>；
            正文里直接写 URL 会自动变成超链接。
          </p>
        </div>

        <div class="mb-4">
          <label class="form-label">附件（图片、视频、文件）</label>
          <div class="upload-box">
            <input type="file" class="form-control" multiple @change="handleFilesChange" />
          </div>
          <div class="file-preview mt-2" v-if="files.length">
            <span v-for="(f, i) in files" :key="i" class="file-tag">{{ f.name }}</span>
          </div>
        </div>

        <div class="d-flex justify-content-end">
          <button type="submit" class="btn-publish" :disabled="loading">
            {{ loading ? '发布中...' : '发布帖子' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { publishPost } from '../api/index_api.js'
import { renderMarkdown } from '../utils/markdown.js'

const router = useRouter()
const loading = ref(false)
const files = ref([])
const previewMode = ref(false)

const form = reactive({ title: '', content: '' })

const previewHtml = computed(() => renderMarkdown(form.content))

const handleFilesChange = (e) => {
  files.value = Array.from(e.target.files || [])
}

const handlePublish = async () => {
  if (!form.title.trim() || !form.content.trim()) {
    alert('标题和内容不能为空')
    return
  }
  loading.value = true
  try {
    const postId = await publishPost(form, files.value)
    if (postId) {
      alert('发布成功！')
      router.push('/index')
    } else {
      alert('发布失败')
    }
  } catch (err) {
    alert('发布失败: ' + (err.message || '网络异常'))
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.disi-add-page {
  min-height: 100vh;
  background: #0d1117;
  padding: 2rem 1rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}

.back-link {
  display: block;
  max-width: 700px;
  margin: 0 auto 1rem;
  color: #58a6ff;
  text-decoration: none;
  font-size: 0.875rem;
}
.back-link:hover { text-decoration: underline; }

.post-card {
  width: 100%;
  max-width: 700px;
  margin: 0 auto;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  padding: 2rem;
  color: #e6edf3;
}

.form-label {
  color: #7d8590;
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.35rem;
  display: block;
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}
.label-row .form-label { margin-bottom: 0; }

.editor-tabs { display: flex; border: 1px solid #30363d; border-radius: 8px; overflow: hidden; }
.tab-btn {
  background: transparent;
  border: none;
  color: #7d8590;
  font-size: 0.75rem;
  padding: 0.22rem 0.7rem;
  cursor: pointer;
}
.tab-btn.active { background: #21262d; color: #58a6ff; }

.form-control {
  width: 100%;
  background: #21262d;
  border: 1px solid #30363d;
  color: #e6edf3;
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  font-size: 0.9rem;
}
.form-control:focus { outline: none; border-color: #58a6ff; }
textarea.form-control {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  line-height: 1.65;
  resize: vertical;
  min-height: 240px;
}

.preview-box {
  border: 1px dashed #30363d;
  border-radius: 8px;
  padding: 1rem;
  background: #0d1117;
  min-height: 240px;
}

.editor-hint {
  color: #7d8590;
  font-size: 0.75rem;
  line-height: 1.6;
  margin-top: 0.4rem;
}
.editor-hint code {
  background: #21262d;
  border-radius: 4px;
  padding: 0.05rem 0.3rem;
  font-size: 0.95em;
}

.upload-box {
  border: 1px dashed #30363d;
  border-radius: 8px;
  padding: 1rem;
  background: #21262d;
}

.file-preview { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.file-tag {
  font-size: 0.75rem;
  background: rgba(88,166,255,0.1);
  color: #58a6ff;
  border: 1px solid rgba(88,166,255,0.2);
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
}

.btn-publish {
  background: #238636;
  border: none;
  padding: 0.5rem 1.4rem;
  border-radius: 8px;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-publish:hover { background: #2ea043; }
.btn-publish:disabled { opacity: 0.5; cursor: not-allowed; }

@media (max-width: 600px) {
  .disi-add-page { padding: 1rem 0.5rem; }
  .post-card { padding: 1.25rem; border-radius: 0; }
}
</style>
