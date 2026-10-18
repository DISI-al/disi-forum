<script setup>
import { ref, onMounted } from 'vue'
import { apiLogin } from '../api/index_api.js'

const input = ref(null)
const loading = ref(false)
const pwd = ref('')

const doLogin = async () => {
  if (loading.value || !pwd.value.trim()) return
  loading.value = true
  try {
    const res = await apiLogin(pwd.value.trim())
    localStorage.setItem('disi_token', res.token)
    localStorage.setItem('disi_role', res.user.role)
    localStorage.setItem('disi_user_id', res.user.id)
    localStorage.setItem('disi_user_name', res.user.name)
    window.location.href = '/index'
  } catch (err) {
    alert('密码错误或网络异常')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (input.value) {
    input.value.focus()
    input.value.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && pwd.value.trim()) doLogin()
    })
  }
})
</script>

<template>
  <h1 class="only">DISI</h1>

  <video id="bg-video" autoplay muted loop playsinline>
    <source src="../assets/bg.mp4" type="video/mp4">
  </video>

  <div class="login-box">
    <input
      ref="input"
      v-model="pwd"
      id="pw-input"
      type="password"
      placeholder=" "
      autocomplete="off"
      autocapitalize="off"
    />
    <button class="start-btn" :disabled="loading" @click="doLogin">
      {{ loading ? '...' : '' }}
    </button>
  </div>
</template>

<style scoped>
#bg-video {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  z-index: -1;
}

.only { font-size: 0; }

.login-box {
  position: fixed;
  bottom: 22vh;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

#pw-input {
  width: 380px;
  height: 40px;
  font-size: 22px;
  text-align: center;
  color: #8cc581;
  background: transparent;
  border: none;
  outline: none;
  border-bottom: 1px solid rgba(0,0,0,0.35);
}

#pw-input::-ms-reveal,
#pw-input::-webkit-password-toggle-button { display: none !important; }

.start-btn {
  width: 200px; height: 36px;
  font-size: 14px;
  color: rgba(140,197,129,0.6);
  background: transparent;
  border: none; outline: none;
  border-bottom: 1px solid rgba(0,0,0,0.25);
  cursor: pointer; transition: all 0.3s;
  padding: 0; font-weight: 400;
}
.start-btn:hover { color: rgba(140,197,129,0.95); border-bottom-color: rgba(140,197,129,0.4); }
.start-btn:disabled { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 480px) {
  #pw-input { width: 280px; font-size: 18px; }
  .start-btn { width: 160px; }
}
</style>
