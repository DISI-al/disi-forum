<script setup>
/**
 * 登录页 —— 图标墙 + 单口令
 * 顶部一排常用工具/框架图标（黑白），悬停放大，点击在新标签打开官网。
 */
import { ref, onMounted, nextTick } from 'vue'
import { apiLogin } from '../api/index_api.js'

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

const input = ref(null)
const loading = ref(false)
const pwd = ref('')
const error = ref('')

async function doLogin() {
  if (loading.value) return
  const value = pwd.value.trim()
  if (!value) {
    input.value?.focus()
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await apiLogin(value)
    localStorage.setItem('disi_token', res.token)
    localStorage.setItem('disi_role', res.user.role)
    localStorage.setItem('disi_user_id', res.user.id)
    localStorage.setItem('disi_user_name', res.user.name)
    window.location.href = '/index'
  } catch (err) {
    error.value = err?.message || '口令错误，请重试'
    pwd.value = ''
    loading.value = false
    await nextTick()
    input.value?.focus()
  }
}

onMounted(() => {
  input.value?.focus()
})
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

    <form class="form" @submit.prevent="doLogin">
      <input
        ref="input"
        v-model="pwd"
        class="pw"
        :class="{ busy: loading }"
        type="password"
        autocomplete="current-password"
        autocapitalize="off"
        spellcheck="false"
        :disabled="loading"
        aria-label="口令"
      />
      <p class="err" :class="{ show: !!error }">{{ error || '\u00a0' }}</p>
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

.logo:active img {
  transform: scale(1.32);
}

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
  color: #e6edf3;
  user-select: none;
  white-space: nowrap;
}

/* ---------- 输入 ---------- */
.form {
  position: absolute;
  left: 50%;
  top: 66vh;
  transform: translateX(-50%);
  width: 360px;
  max-width: calc(100vw - 48px);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pw {
  width: 100%;
  height: 40px;
  padding: 0 4px 6px;
  background: transparent;
  border: none;
  border-bottom: 1px solid #21262d;
  outline: none;
  color: #e6edf3;
  font-size: 18px;
  letter-spacing: 0.32em;
  text-align: center;
  caret-color: #e6edf3;
  transition: border-color 0.2s ease;
}

.pw:focus { border-bottom-color: #484f58; }
.pw.busy { opacity: 0.5; }

.pw::-ms-reveal,
.pw::-webkit-password-toggle-button { display: none !important; }

.err {
  margin-top: 14px;
  height: 16px;
  font: 12px/1.3 ui-monospace, Consolas, monospace;
  letter-spacing: 0.08em;
  color: #f85149;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.err.show { opacity: 1; }

@media (max-width: 720px) {
  .wall { padding: 28px 16px 0; gap: 18px 20px; }
  .logo { width: 30px; height: 30px; }
  .logo img { width: 22px; height: 22px; }
  .logo:hover img { transform: scale(1.32); }
  .wordmark { top: 34vh; }
  .form { top: 64vh; width: 260px; }
  .pw { font-size: 16px; }
}

@media (prefers-reduced-motion: reduce) {
  .logo img { transition: opacity 0.18s ease; }
  .logo:hover img, .logo:focus-visible img { transform: none; }
}
</style>
