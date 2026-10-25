<script setup>
/**
 * 第四论坛 · 网页/手机登录页（GitHub 风格）
 * 默认口令登录；切到「注册」则用户名 + 新口令，注册成功直接登录。
 */
import { ref, computed, onMounted, nextTick } from 'vue'
import { apiLogin, apiRegister } from '../api/index_api.js'

const mode = ref('login') // login | register
const username = ref('')
const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref('')
const userInput = ref(null)
const pwdInput = ref(null)

const isRegister = computed(() => mode.value === 'register')
const title = computed(() => (isRegister.value ? '创建账号' : '登录到 第四论坛'))
const buttonText = computed(() => {
  if (loading.value) return isRegister.value ? '创建中…' : '登录中…'
  return isRegister.value ? '创建账号' : '登录'
})

function switchMode() {
  mode.value = isRegister.value ? 'login' : 'register'
  error.value = ''
  confirm.value = ''
  nextTick(() => (isRegister.value ? userInput.value : pwdInput.value)?.focus())
}

function store(res) {
  localStorage.setItem('disi_token', res.token)
  localStorage.setItem('disi_role', res.user.role)
  localStorage.setItem('disi_user_id', res.user.id)
  localStorage.setItem('disi_user_name', res.user.name)
  window.location.href = '/index'
}

async function submit() {
  if (loading.value) return
  error.value = ''

  if (isRegister.value) {
    const name = username.value.trim()
    if (name.length < 2) { error.value = '用户名至少 2 个字符'; return }
    if (password.value.length < 4) { error.value = '口令至少 4 个字符'; return }
    if (password.value !== confirm.value) { error.value = '两次输入的口令不一致'; return }
    loading.value = true
    try {
      return store(await apiRegister(name, password.value))
    } catch (e) {
      error.value = e?.message || '注册失败'
      loading.value = false
      return
    }
  }

  const pwd = password.value.trim()
  if (!pwd) { pwdInput.value?.focus(); return }
  loading.value = true
  try {
    return store(await apiLogin(pwd))
  } catch (e) {
    error.value = e?.message || '口令错误，请重试'
    password.value = ''
    loading.value = false
    await nextTick()
    pwdInput.value?.focus()
  }
}

onMounted(() => pwdInput.value?.focus())
</script>

<template>
  <div class="page">
    <main class="wrap">
      <img class="mark" src="/icon.png" alt="第四论坛" draggable="false" />

      <h1 class="title">{{ title }}</h1>
      <p class="sub">私密社区，仅限受邀成员使用</p>

      <form class="card" @submit.prevent="submit">
        <div v-if="error" class="alert">{{ error }}</div>

        <label v-if="isRegister" class="field">
          <span>用户名</span>
          <input
            ref="userInput"
            v-model="username"
            type="text"
            autocomplete="username"
            maxlength="20"
            autocapitalize="off"
            spellcheck="false"
            :disabled="loading"
          />
        </label>

        <label class="field">
          <span>口令<span v-if="isRegister" class="hint">（新口令）</span></span>
          <input
            ref="pwdInput"
            v-model="password"
            type="password"
            :autocomplete="isRegister ? 'new-password' : 'current-password'"
            :disabled="loading"
          />
        </label>

        <label v-if="isRegister" class="field">
          <span>确认口令</span>
          <input v-model="confirm" type="password" autocomplete="new-password" :disabled="loading" />
        </label>

        <button class="btn" type="submit" :disabled="loading">{{ buttonText }}</button>

        <p class="switch">
          {{ isRegister ? '已经有账号？' : '没有账号？' }}
          <a href="#" @click.prevent="switchMode">{{ isRegister ? '去登录' : '注册一个' }}</a>
        </p>
      </form>

      <p class="foot">登录即表示你已获得管理员许可 · 忘记口令请联系管理员</p>
    </main>
  </div>
</template>

<style scoped>
* { box-sizing: border-box; }

.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  background: #0d1117;
  color: #e6edf3;
  font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.wrap {
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.mark {
  width: 72px;
  height: 72px;
  border-radius: 16px;
  user-select: none;
}

.title {
  margin: 18px 0 6px;
  font-size: 24px;
  font-weight: 400;
  letter-spacing: 0.01em;
  text-align: center;
}

.sub {
  margin: 0 0 20px;
  font-size: 13px;
  color: #8b949e;
  text-align: center;
}

.card {
  width: 100%;
  padding: 20px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
}

.alert {
  margin-bottom: 14px;
  padding: 9px 12px;
  border: 1px solid rgba(248, 81, 73, 0.45);
  border-radius: 6px;
  background: rgba(248, 81, 73, 0.1);
  color: #f85149;
  font-size: 12.5px;
  line-height: 1.5;
}

.field {
  display: block;
  margin-bottom: 14px;
}

.field > span {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #e6edf3;
}

.field .hint {
  color: #8b949e;
  font-weight: 400;
}

.field input {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #e6edf3;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.field input:focus {
  border-color: #58a6ff;
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.18);
}

.field input:disabled { opacity: 0.6; }

.btn {
  width: 100%;
  height: 34px;
  margin-top: 4px;
  border: 1px solid rgba(240, 246, 252, 0.1);
  border-radius: 6px;
  background: #238636;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn:hover:not(:disabled) { background: #2ea043; }
.btn:active:not(:disabled) { background: #1f7a30; }
.btn:disabled { opacity: 0.6; cursor: default; }

.switch {
  margin: 16px 0 0;
  font-size: 13px;
  color: #8b949e;
  text-align: center;
}

.switch a {
  color: #58a6ff;
  text-decoration: none;
}

.switch a:hover { text-decoration: underline; }

.foot {
  margin-top: 20px;
  font-size: 11.5px;
  color: #6e7681;
  text-align: center;
  line-height: 1.6;
}

@media (max-width: 380px) {
  .title { font-size: 21px; }
  .card { padding: 16px; }
}
</style>
