<script setup>
/**
 * 第四论坛 · 登录 / 注册
 * 版式沿用旧的登录页：顶部图标墙、大字标、下划线输入框。
 * 登录：口令；注册：口令 + 用户名。
 */
import { ref, computed, onMounted, nextTick } from 'vue'
import { apiLogin, apiRegister } from '../api/index_api.js'

import arduino from '../assets/logos/arduino.png'
import python from '../assets/logos/python.png'
import linux from '../assets/logos/tux.png'
import cpp from '../assets/logos/cpp.png'
import ros from '../assets/logos/ros.png'
import claude from '../assets/logos/claude.png'
import github from '../assets/logos/github.png'
import deepseek from '../assets/logos/deepseek.png'
import opencv from '../assets/logos/opencv.png'
import vue from '../assets/logos/vue.png'
import easyx from '../assets/logos/easyx.png'
import ubuntu from '../assets/logos/ubuntu.png'
import c from '../assets/logos/c.png'
import nodejs from '../assets/logos/nodejs.png'

const LOGOS = [
  { name: 'Arduino', src: arduino, href: 'https://www.arduino.cc' },
  { name: 'Python', src: python, href: 'https://www.python.org' },
  { name: 'Linux', src: linux, href: 'https://www.kernel.org' },
  { name: 'C++', src: cpp, href: 'https://isocpp.org' },
  { name: 'ROS', src: ros, href: 'https://www.ros.org' },
  { name: 'Claude', src: claude, href: 'https://claude.ai' },
  { name: 'GitHub', src: github, href: 'https://github.com' },
  { name: 'DeepSeek', src: deepseek, href: 'https://www.deepseek.com' },
  { name: 'OpenCV', src: opencv, href: 'https://opencv.org' },
  { name: 'Vue', src: vue, href: 'https://vuejs.org' },
  { name: 'EasyX', src: easyx, href: 'https://easyx.cn' },
  { name: 'Ubuntu', src: ubuntu, href: 'https://ubuntu.com' },
  { name: 'C', src: c, href: 'https://en.cppreference.com/w/c' },
  { name: 'Node.js', src: nodejs, href: 'https://nodejs.org' },
]

const mode = ref('login')
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const pwdInput = ref(null)

const isRegister = computed(() => mode.value === 'register')
const buttonText = computed(() => {
  if (loading.value) return isRegister.value ? '创建中…' : '进入中…'
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
    <nav class="wall" aria-label="常用工具与库">
      <a
        v-for="logo in LOGOS"
        :key="logo.name"
        class="logo"
        :href="logo.href"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="logo.name"
      >
        <img :src="logo.src" :alt="logo.name" draggable="false" />
      </a>
    </nav>

    <h1 class="wordmark">DISI</h1>

    <form class="form" :class="{ wide: isRegister }" @submit.prevent="submit">
      <input
        ref="pwdInput"
        v-model="password"
        class="line"
        type="password"
        :autocomplete="isRegister ? 'new-password' : 'current-password'"
        :placeholder="isRegister ? '设置口令（至少 4 位）' : ''"
        :disabled="loading"
        aria-label="口令"
      />
      <input
        v-if="isRegister"
        v-model="username"
        class="line"
        type="text"
        autocomplete="username"
        maxlength="20"
        placeholder="用户名（2–20 个字符）"
        autocapitalize="off"
        spellcheck="false"
        :disabled="loading"
        aria-label="用户名"
      />

      <button class="btn" type="submit" :disabled="loading">{{ buttonText }}</button>

      <p class="err" :class="{ show: !!error }">{{ error || '\u00a0' }}</p>

      <p class="switch">
        <a href="#" @click.prevent="switchMode">{{ isRegister ? '去登录' : '注册' }}</a>
      </p>
    </form>
  </div>
</template>

<style scoped>
* { margin: 0; padding: 0; box-sizing: border-box; }

.page {
  position: relative;
  min-height: 100vh;
  background: #0d1117;
  color: #e6edf3;
  font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  overflow: hidden;
}

/* ---------- 图标墙 ---------- */
.wall {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 46px 24px 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 22px 26px;
}

.logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  outline: none;
}

.logo img {
  width: 26px;
  height: 26px;
  opacity: 0.45;
  transform: scale(1);
  transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.18s ease;
  will-change: transform;
  user-select: none;
  -webkit-user-drag: none;
}

.logo:hover img,
.logo:focus-visible img {
  opacity: 1;
  transform: scale(1.5);
}

.logo:active img { transform: scale(1.32); }

/* ---------- 字标 ---------- */
.wordmark {
  position: absolute;
  left: 50%;
  top: 38vh;
  transform: translate(-50%, -50%);
  font-size: clamp(64px, 9.2vw, 120px);
  font-weight: 600;
  letter-spacing: 0.3em;
  margin-right: -0.3em;
  line-height: 1;
  color: #2ea043;
  user-select: none;
  white-space: nowrap;
}

/* ---------- 表单 ---------- */
.form {
  position: absolute;
  left: 50%;
  top: 61vh;
  transform: translateX(-50%);
  width: 380px;
  max-width: calc(100vw - 48px);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.form.wide { top: 56vh; }

.line {
  width: 100%;
  height: 42px;
  padding: 0 4px 8px;
  margin-bottom: 20px;
  background: transparent;
  border: none;
  border-bottom: 1px solid #6e7681;
  outline: none;
  color: #2ea043;
  font-size: 16px;
  letter-spacing: 0.06em;
  text-align: center;
  caret-color: #3fb950;
  transition: border-color 0.2s ease;
}

.line::placeholder { color: #4d5763; letter-spacing: 0.02em; }
.line:focus { border-bottom-color: #3fb950; }
.line:disabled { opacity: 0.5; }

.line::-ms-reveal,
.line::-webkit-password-toggle-button { display: none !important; }

.btn {
  width: 100%;
  height: 40px;
  margin-top: 6px;
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

.err {
  margin-top: 12px;
  height: 16px;
  font: 12px/1.3 ui-monospace, Consolas, monospace;
  letter-spacing: 0.06em;
  color: #f85149;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.err.show { opacity: 1; }

.switch {
  margin-top: 12px;
  font-size: 12.5px;
  color: #8b949e;
  text-align: center;
}

.switch a { color: #8b949e; text-decoration: none; }
.switch a:hover { color: #c9d1d9; text-decoration: underline; }

@media (max-width: 720px) {
  .wall { padding: 28px 16px 0; gap: 18px 20px; }
  .logo { width: 30px; height: 30px; }
  .logo img { width: 22px; height: 22px; }
  .logo:hover img { transform: scale(1.32); }
  .wordmark { top: 36vh; font-size: clamp(38px, 11vw, 60px); letter-spacing: 0.14em; margin-right: -0.14em; }
  .form { top: 58vh; width: 300px; }
  .form.wide { top: 52vh; }
  .line { height: 38px; font-size: 15px; }
}

@media (prefers-reduced-motion: reduce) {
  .logo img { transition: opacity 0.18s ease; }
  .logo:hover img, .logo:focus-visible img { transform: none; }
}
</style>
