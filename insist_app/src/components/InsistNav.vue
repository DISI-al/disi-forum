<template>
  <header class="insist-nav">
    <span class="insist-mark" aria-hidden="true">&gt;_</span>
    <span class="insist-brand">INSIST</span>
    <nav class="insist-links">
      <router-link to="/" :class="{ active: active === 'home' }">主页</router-link>
      <router-link to="/collection" :class="{ active: active === 'collection' }">收藏室</router-link>
      <router-link to="/cards" :class="{ active: active === 'cards' }">卡片</router-link>
      <router-link to="/achievements" :class="{ active: active === 'achievements' }">成就</router-link>
      <router-link to="/settings" :class="{ active: active === 'settings' }">设置</router-link>
      <a :href="forumUrl" target="_blank" rel="noopener">前往论坛</a>
    </nav>
  </header>
</template>

<script setup>
defineProps({
  active: { type: String, default: '' },
})

const forumUrl = import.meta.env.VITE_FORUM_URL || 'https://forum.disi-al.com'
</script>
