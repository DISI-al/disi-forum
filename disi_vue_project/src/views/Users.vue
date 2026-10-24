<script setup>
/**
 * 用户管理页（仅管理员）
 * 路由 /users，从首页「用户」按钮进入
 * - 新增用户：昵称可不填（自动生成「用户N」），口令必填
 * - 修改昵称：每行就地编辑保存（登录只认口令，改昵称不影响登录）
 * - 删除用户：连点两次确认
 */
import { ref, onMounted } from 'vue'
import { apiListUsers, apiCreateUser, apiUpdateUserName, apiDeleteUser } from '../api/index_api.js'

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
const isAdmin = localStorage.getItem('disi_role') === 'admin'

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
    if (u.id === selfId) localStorage.setItem('disi_user_name', updated.name)
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
    await load()
    notice.value = `已删除「${u.name}」`
  } catch (e) {
    error.value = e.message || '删除失败'
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  if (!isAdmin) {
    error.value = '只有管理员可以管理用户'
    loading.value = false
    return
  }
  load()
})
</script>

<template>
  <div class="disi-forum">
    <div class="forum-center-container">
      <nav class="sub-nav">
        <router-link to="/index" class="back-link">← 返回论坛</router-link>
      </nav>

      <section class="users-card">
        <header class="users-head">
          <h1>用户管理</h1>
          <span class="users-count">{{ users.length }} 位用户</span>
        </header>

        <p v-if="!isAdmin" class="msg err">{{ error }}</p>

        <template v-else>
          <form class="add-row" @submit.prevent="addUser">
            <input
              v-model="newName"
              class="input"
              type="text"
              maxlength="50"
              placeholder="昵称（留空自动分配）"
            />
            <input
              v-model="newPassword"
              class="input"
              type="text"
              maxlength="100"
              placeholder="登录口令"
              autocomplete="off"
            />
            <button class="btn primary" type="submit" :disabled="busy">添加用户</button>
          </form>

          <p v-if="error" class="msg err">{{ error }}</p>
          <p v-else-if="notice" class="msg ok">{{ notice }}</p>

          <p v-if="loading" class="empty">加载中…</p>
          <p v-else-if="users.length === 0" class="empty">还没有用户</p>

          <ul v-else class="user-list">
            <li v-for="u in users" :key="u.id" class="user-row">
              <span class="avatar">{{ (u.name || '?').slice(0, 1) }}</span>
              <input
                class="input name"
                type="text"
                maxlength="50"
                :value="draft[u.id]"
                @input="draft[u.id] = $event.target.value"
                @keydown.enter.prevent="saveName(u)"
              />
              <span v-if="u.isAdmin" class="tag">管理员</span>
              <span v-if="u.id === selfId" class="tag self">你</span>
              <button class="btn" type="button" :disabled="busy || !canSave(u)" @click="saveName(u)">保存</button>
              <button
                v-if="u.id !== selfId"
                class="btn danger"
                :class="{ armed: confirmId === u.id }"
                type="button"
                :disabled="busy"
                @click="askDelete(u)"
              >{{ confirmId === u.id ? '确认删除' : '删除' }}</button>
            </li>
          </ul>

          <footer class="users-foot">
            登录只认口令，昵称只用于展示；用户也可以在自己的「我的」页面改昵称。
          </footer>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
* { margin: 0; padding: 0; box-sizing: border-box; }

.disi-forum {
  background: #0d1117;
  color: #e6edf3;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  display: grid;
  place-content: center;
  padding: 2rem 1rem;
}

.forum-center-container {
  width: min(760px, calc(100vw - 2rem));
}

.sub-nav { padding: 0 0 0.75rem; }
.back-link {
  color: var(--gh-text-link, #58a6ff);
  text-decoration: none;
  font-size: 0.875rem;
}
.back-link:hover { text-decoration: underline; }

.users-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  overflow: hidden;
}

.users-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 1.1rem 1.25rem;
  border-bottom: 1px solid #30363d;
}
.users-head h1 { font-size: 1rem; font-weight: 600; margin: 0; }
.users-count { font-size: 0.78rem; color: #8b949e; }

.add-row {
  display: flex;
  gap: 0.5rem;
  padding: 0.9rem 1.25rem;
  border-bottom: 1px solid #30363d;
}

.input {
  flex: 1;
  min-width: 0;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #e6edf3;
  font-size: 0.85rem;
  padding: 0.45rem 0.6rem;
  outline: none;
}
.input:focus { border-color: #58a6ff; }
.input.name { flex: 1; }

.btn {
  flex-shrink: 0;
  background: transparent;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #8b949e;
  font-size: 0.8rem;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.btn:hover:not(:disabled) { color: #e6edf3; border-color: #6e7681; }
.btn:disabled { opacity: 0.45; cursor: default; }

.btn.primary { background: #238636; border-color: #238636; color: #fff; }
.btn.primary:hover:not(:disabled) { background: #2ea043; border-color: #2ea043; }

.btn.danger { color: #f85149; border-color: rgba(248, 81, 73, 0.45); }
.btn.danger:hover:not(:disabled) { background: rgba(248, 81, 73, 0.12); color: #f85149; }
.btn.danger.armed { background: #da3633; border-color: #da3633; color: #fff; }

.msg { margin: 0.7rem 1.25rem 0; font-size: 0.8rem; }
.msg.err { color: #f85149; }
.msg.ok { color: #3fb950; }

.empty {
  margin: 0;
  padding: 1.5rem 1.25rem;
  font-size: 0.85rem;
  color: #8b949e;
}

.user-list { list-style: none; margin: 0; padding: 0.3rem 0; }

.user-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem;
}
.user-row + .user-row { border-top: 1px solid rgba(48, 54, 61, 0.5); }

.avatar {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #21262d;
  color: #8b949e;
  font-size: 0.72rem;
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
}

.tag {
  flex-shrink: 0;
  font-size: 0.68rem;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  border: 1px solid #30363d;
  color: #8b949e;
}
.tag.self { color: #58a6ff; border-color: rgba(88, 166, 255, 0.4); }

.users-foot {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid #30363d;
  font-size: 0.72rem;
  color: #8b949e;
}

@media (max-width: 560px) {
  .add-row { flex-wrap: wrap; }
  .add-row .input { flex: 1 1 45%; }
  .user-row { flex-wrap: wrap; }
  .user-row .input.name { flex: 1 1 55%; }
  .users-foot { font-size: 0.68rem; }
}
</style>
