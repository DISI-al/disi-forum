<script setup>
/**
 * 第四论坛 · 登录 / 注册
 * 登录：只要口令
 * 注册：先填新口令，再填用户名
 */
import { ref, computed, onMounted, nextTick } from 'vue'
import { apiLogin, apiRegister } from '../api/index_api.js'

const mode = ref('login') // login | register
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const userInput = ref(null)
const pwdInput = ref(null)

const isRegister = computed(() => mode.value === 'register')
const buttonText = computed(() => {
  if (loading.value) return isRegister.value ? '创建中…' : '验证中…'
  return isRegister.value ? '创建账号' : '进入'
})

function switchMode() {
  mode.value = isRegister.value ? 'login' : 'register'
  error.value = ''
  nextTick(() => pwdInput.value?.focus())
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
    if (password.value.length < 4) { error.value = '口令至少 4 个字符'; return }
    const name = username.value.trim()
    if (name.length < 2) { error.value = '用户名至少 2 个字符'; return }
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
    <div class="glow" aria-hidden="true"></div>

    <main class="wrap">
      <img class="mark" src="/icon.png" alt="第四论坛" draggable="false" />
      <h1 class="title">第四论坛</h1>
      <p class="sub">{{ isRegister ? '设置口令和名字，加入这个私密社区' : '输入口令进入' }}</p>

      <form class="card" @submit.prevent="submit">
        <div v-if="error" class="alert">{{ error }}</div>

        <label class="field">
          <span>口令</span>
          <input
            ref="pwdInput"
            v-model="password"
            type="password"
            :autocomplete="isRegister ? 'new-password' : 'current-password'"
            :placeholder="isRegister ? '至少 4 位' : ''"
            :disabled="loading"
          />
        </label>

        <label v-if="isRegister" class="field">
          <span>用户名</span>
          <input
            ref="userInput"
            v-model="username"
            type="text"
            autocomplete="username"
            maxlength="20"
            placeholder="2–20 个字符"
            autocapitalize="off"
            spellcheck="false"
            :disabled="loading"
          />
        </label>

        <button class="btn" type="submit" :disabled="loading">{{ buttonText }}</button>

        <p class="switch">
          <template v-if="isRegister">已有账号？<a href="#" @click.prevent="switchMode">去登录</a></template>
          <template v-else>没有账号？<a href="#" @click.prevent="switchMode">注册</a></template>
        </p>
      </form>

      <p class="foot">私密社区 · 仅限受邀成员 · 忘记口令联系管理员</p>
    </main>
  </div>
</template>

<style scoped>
* { box-sizing: border-box; }

.page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: #0a0b0d;
  color: #e9edf2;
  font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  overflow: hidden;
}

/* 背景一点点光，不至于纯黑发闷 */
.glow {
  position: absolute;
  top: -20%;
  left: 50%;
  width: 720px;
  height: 720px;
  transform: translateX(-50%);
  background: radial-gradient(circle, rgba(63, 185, 80, 0.10), rgba(63, 185, 80, 0) 62%);
  pointer-events: none;
}

.wrap {
  position: relative;
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.mark {
  width: 84px;
  height: 84px;
  border-radius: 20px;
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.55);
  user-select: none;
}

.title {
  margin: 20px 0 6px;
  font-size: 26px;
  font-weight: 500;
  letter-spacing: 0.06em;
}

.sub {
  margin: 0 0 22px;
  font-size: 13px;
  color: #8b949e;
  text-align: center;
}

.card {
  width: 100%;
  padding: 22px 22px 18px;
  background: rgba(22, 27, 34, 0.92);
  border: 1px solid #262c36;
  border-radius: 14px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
}

.alert {
  margin-bottom: 14px;
  padding: 9px 12px;
  border: 1px solid rgba(248, 81, 73, 0.4);
  border-radius: 8px;
  background: rgba(248, 81, 73, 0.09);
  color: #f85149;
  font-size: 12.5px;
  line-height: 1.5;
}

.field { display: block; margin-bottom: 15px; }

.field > span {
  display: block;
  margin-bottom: 7px;
  font-size: 12.5px;
  letter-spacing: 0.06em;
  color: #9aa4b2;
}

.field input {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  background: #0d1117;
  border: 1px solid #2b323c;
  border-radius: 9px;
  color: #e9edf2;
  font-size: 15px;
  outline: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.field input::placeholder { color: #4d5763; }

.field input:focus {
  border-color: #3fb950;
  box-shadow: 0 0 0 3px rgba(63, 185, 80, 0.16);
}

.field input:disabled { opacity: 0.6; }

.btn {
  width: 100%;
  height: 42px;
  margin-top: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 9px;
  background: linear-gradient(180deg, #2ea043, #238636);
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: filter 0.15s ease, transform 0.08s ease;
}

.btn:hover:not(:disabled) { filter: brightness(1.08); }
.btn:active:not(:disabled) { transform: translateY(1px); }
.btn:disabled { opacity: 0.65; cursor: default; }

.switch {
  margin: 15px 0 0;
  font-size: 12.5px;
  color: #8b949e;
  text-align: center;
}

.switch a { color: #58a6ff; text-decoration: none; }
.switch a:hover { text-decoration: underline; }

.foot {
  margin-top: 22px;
  font-size: 11.5px;
  letter-spacing: 0.04em;
  color: #5a636f;
  text-align: center;
}

@media (max-width: 400px) {
  .mark { width: 72px; height: 72px; border-radius: 18px; }
  .title { font-size: 23px; }
  .card { padding: 18px 16px 14px; }
}
</style>
