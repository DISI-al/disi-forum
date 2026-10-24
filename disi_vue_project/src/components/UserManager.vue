<script setup>
/**
 * 用户管理弹窗（仅管理员）
 * - 新增用户：昵称可不填（自动生成"用户N"），口令必填
 * - 修改昵称：每行就地编辑保存
 * - 删除用户：连点两次确认
 */
import { ref, onMounted, computed } from 'vue'
import { apiListUsers, apiCreateUser, apiUpdateUserName, apiDeleteUser } from '../api/index_api.js'

const emit = defineEmits(['close', 'renamed'])

const users = ref([])
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const notice = ref('')

const newName = ref('')
const newPassword = ref('')
const draft = ref({})
const confirmId = ref('')
let confirmTimer = null

const selfId = localStorage.getItem('disi_user_id') || ''

const canSave = (u) => {
  const value = (draft.value[u.id] ?? u.name).trim()
  return value && value !== u.name
}

const clearMsg = () => { error.value = ''; notice.value = '' }

async function load() {
  loading.value = true
  clearMsg()
  try {
    const list = await apiListUsers()
    users.value = list
    draft.value = Object.fromEntries(list.map((u) => [u.id, u.name]))
  } catch (e) {
    error.value = e.message || '加载用户失败'
  } finally {
    loading.value = false
  }
}

function nextDefaultName() {
  let n = 1
  const names = new Set(users.value.map((u) => u.name))
  while (names.has(`用户${n}`)) n++
  return `用户${n}`
}

async function addUser() {
  if (busy.value) return
  const password = newPassword.value.trim()
  const name = newName.value.trim() || nextDefaultName()
  if (!password) {
    error.value = '请填写登录口令'
    return
  }
  busy.value = true
  clearMsg()
  try {
    await apiCreateUser({ username: name, password, role: 'user' })
    newName.value = ''
    newPassword.value = ''
    notice.value = `已添加「${name}」`
    await load()
    notice.value = `已添加「${name}」`
  } catch (e) {
    error.value = e.message || '添加失败'
  } finally {
    busy.value = false
  }
}

async function saveName(u) {
  const value = (draft.value[u.id] ?? '').trim()
  if (!value || value === u.name || busy.value) return
  busy.value = true
  clearMsg()
  try {
    const updated = await apiUpdateUserName(u.id, value)
    u.name = updated.name
    draft.value[u.id] = updated.name
    notice.value = '昵称已更新'
    if (u.id === selfId) emit('renamed', updated.name)
  } catch (e) {
    error.value = e.message || '修改失败'
  } finally {
    busy.value = false
  }
}

function askDelete(u) {
  clearMsg()
  if (confirmId.value === u.id) {
    confirmId.value = ''
    removeUser(u)
    return
  }
  confirmId.value = u.id
  clearTimeout(confirmTimer)
  confirmTimer = setTimeout(() => { confirmId.value = '' }, 3000)
}

async function removeUser(u) {
  if (busy.value) return
  busy.value = true
  try {
    await apiDeleteUser(u.id)
    notice.value = `已删除「${u.name}」`
    await load()
    notice.value = `已删除「${u.name}」`
  } catch (e) {
    error.value = e.message || '删除失败'
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="um-overlay" @click.self="emit('close')">
    <section class="um-panel" role="dialog" aria-label="用户管理">
      <header class="um-header">
        <h3>用户管理</h3>
        <button class="um-close" type="button" aria-label="关闭" @click="emit('close')">×</button>
      </header>

      <form class="um-add" @submit.prevent="addUser">
        <input
          v-model="newName"
          class="um-input"
          type="text"
          maxlength="50"
          placeholder="昵称（留空自动分配）"
        />
        <input
          v-model="newPassword"
          class="um-input"
          type="text"
          maxlength="100"
          placeholder="登录口令"
          autocomplete="off"
        />
        <button class="um-btn primary" type="submit" :disabled="busy">添加</button>
      </form>

      <p v-if="error" class="um-msg err">{{ error }}</p>
      <p v-else-if="notice" class="um-msg ok">{{ notice }}</p>

      <p v-if="loading" class="um-empty">加载中…</p>
      <p v-else-if="users.length === 0" class="um-empty">还没有用户</p>

      <ul v-else class="um-list">
        <li v-for="u in users" :key="u.id" class="um-row">
          <span class="um-avatar">{{ (u.name || '?').slice(0, 1) }}</span>
          <input
            class="um-input name"
            type="text"
            maxlength="50"
            :value="draft[u.id]"
            @input="draft[u.id] = $event.target.value"
            @keydown.enter.prevent="saveName(u)"
          />
          <span v-if="u.isAdmin" class="um-tag">管理员</span>
          <span v-if="u.id === selfId" class="um-tag self">你</span>
          <button
            class="um-btn"
            type="button"
            :disabled="busy || !canSave(u)"
            @click="saveName(u)"
          >保存</button>
          <button
            v-if="u.id !== selfId"
            class="um-btn danger"
            :class="{ armed: confirmId === u.id }"
            type="button"
            :disabled="busy"
            @click="askDelete(u)"
          >{{ confirmId === u.id ? '确认删除' : '删除' }}</button>
        </li>
      </ul>

      <footer class="um-foot">
        登录只认口令，昵称只用于展示；改完昵称不影响任何人登录。
      </footer>
    </section>
  </div>
</template>

<style scoped>
.um-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(1, 4, 9, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
}

.um-panel {
  width: min(640px, 100%);
  max-height: min(80vh, 720px);
  display: flex;
  flex-direction: column;
  background: var(--gh-bg-secondary, #161b22);
  border: 1px solid var(--gh-border, #30363d);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(1, 4, 9, 0.6);
  overflow: hidden;
  color: var(--gh-text-primary, #e6edf3);
}

.um-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.95rem 1.1rem;
  border-bottom: 1px solid var(--gh-border, #30363d);
}
.um-header h3 { margin: 0; font-size: 0.95rem; font-weight: 600; letter-spacing: 0.02em; }

.um-close {
  background: transparent;
  border: none;
  color: var(--gh-text-secondary, #8b949e);
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.25rem;
}
.um-close:hover { color: var(--gh-text-primary, #e6edf3); }

.um-add {
  display: flex;
  gap: 0.5rem;
  padding: 0.9rem 1.1rem;
  border-bottom: 1px solid var(--gh-border, #30363d);
}

.um-input {
  flex: 1;
  min-width: 0;
  background: var(--gh-bg-primary, #0d1117);
  border: 1px solid var(--gh-border, #30363d);
  border-radius: 6px;
  color: var(--gh-text-primary, #e6edf3);
  font-size: 0.85rem;
  padding: 0.45rem 0.6rem;
  outline: none;
}
.um-input:focus { border-color: var(--gh-text-link, #58a6ff); }
.um-input.name { flex: 1; }

.um-btn {
  flex-shrink: 0;
  background: transparent;
  border: 1px solid var(--gh-border, #30363d);
  border-radius: 6px;
  color: var(--gh-text-secondary, #8b949e);
  font-size: 0.8rem;
  padding: 0.4rem 0.7rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.um-btn:hover:not(:disabled) { color: var(--gh-text-primary, #e6edf3); border-color: #6e7681; }
.um-btn:disabled { opacity: 0.45; cursor: default; }

.um-btn.primary {
  background: #238636;
  border-color: #238636;
  color: #fff;
}
.um-btn.primary:hover:not(:disabled) { background: #2ea043; border-color: #2ea043; }

.um-btn.danger { color: #f85149; border-color: rgba(248, 81, 73, 0.45); }
.um-btn.danger:hover:not(:disabled) { background: rgba(248, 81, 73, 0.12); color: #f85149; }
.um-btn.danger.armed {
  background: #da3633;
  border-color: #da3633;
  color: #fff;
}

.um-msg { margin: 0.6rem 1.1rem 0; font-size: 0.8rem; }
.um-msg.err { color: #f85149; }
.um-msg.ok { color: #3fb950; }

.um-empty {
  margin: 0;
  padding: 1.4rem 1.1rem;
  font-size: 0.85rem;
  color: var(--gh-text-secondary, #8b949e);
}

.um-list {
  list-style: none;
  margin: 0;
  padding: 0.4rem 0;
  overflow-y: auto;
}

.um-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 1.1rem;
}
.um-row + .um-row { border-top: 1px solid rgba(48, 54, 61, 0.5); }

.um-avatar {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--gh-bg-tertiary, #21262d);
  color: var(--gh-text-secondary, #8b949e);
  font-size: 0.72rem;
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
}

.um-tag {
  flex-shrink: 0;
  font-size: 0.68rem;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  border: 1px solid var(--gh-border, #30363d);
  color: var(--gh-text-secondary, #8b949e);
}
.um-tag.self { color: var(--gh-text-link, #58a6ff); border-color: rgba(88, 166, 255, 0.4); }

.um-foot {
  padding: 0.7rem 1.1rem;
  border-top: 1px solid var(--gh-border, #30363d);
  font-size: 0.72rem;
  color: var(--gh-text-secondary, #8b949e);
}

@media (max-width: 560px) {
  .um-add { flex-wrap: wrap; }
  .um-add .um-input { flex: 1 1 45%; }
  .um-row { flex-wrap: wrap; }
  .um-row .um-input.name { flex: 1 1 55%; }
  .um-foot { font-size: 0.68rem; }
}
</style>
