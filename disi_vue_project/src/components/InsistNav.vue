<template>
  <header class="insist-nav">
    <span class="insist-mark" aria-hidden="true">&gt;_</span>
    <span class="insist-brand">INSIST</span>
    <nav class="insist-links">
      <router-link to="/insist" :class="{ active: active === 'home' }">主页</router-link>
      <router-link to="/insist/collection" :class="{ active: active === 'collection' }">收藏室</router-link>
      <router-link to="/insist/cards" :class="{ active: active === 'cards' }">卡片</router-link>
      <router-link to="/insist/achievements" :class="{ active: active === 'achievements' }">成就</router-link>
      <router-link to="/insist/settings" :class="{ active: active === 'settings' }">设置</router-link>
      <router-link to="/index">返回论坛</router-link>
    </nav>
  </header>
</template>

<script setup>
defineProps({
  active: { type: String, default: '' },
})
</script>
