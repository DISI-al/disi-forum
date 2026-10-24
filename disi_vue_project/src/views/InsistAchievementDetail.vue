<script setup>
/**
 * INSIST · 成就卡详情
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import InsistNav from '../components/InsistNav.vue'
import { achievements, lockedAchievements } from '../insist/mock.js'

const route = useRoute()
const achievement = computed(() => achievements.find((a) => a.id === route.params.id) || achievements[0])
const locked = computed(() => lockedAchievements.find((a) => a.id === route.params.id))
const gradeOf = (tier) => ['入门级', '熟练级', '精通级', '专家级'][tier - 1]
</script>

<template>
  <div class="insist-page">
    <InsistNav active="achievements" />

    <main class="insist-main">
      <nav class="crumb">
        <router-link to="/insist">← 主页</router-link>
        <span>/</span>
        <router-link to="/insist/achievements">成就墙</router-link>
      </nav>

      <section class="head" :class="locked ? 'is-locked' : 'tier-' + achievement.tier">
        <div class="head-top">
          <span class="grade">{{ locked ? '未解锁' : gradeOf(achievement.tier) }}</span>
          <span class="date mono">{{ locked ? locked.hint : achievement.date }}</span>
        </div>
        <h1 class="name">{{ locked ? locked.name : achievement.name }}</h1>
        <p class="desc">{{ locked ? '按规则解锁后自动发放，无需手动录入。' : (achievement.desc || '暂无描述') }}</p>
      </section>

      <section class="insist-block" v-if="!locked">
        <div class="insist-block-head"><h2>用途</h2></div>
        <ul class="rules">
          <li>可作为晋升凭证：熟练 → 精通需要「精通级」及以上，精通 → 专家需要「专家级」。</li>
          <li>系统自动发放的成就来自累计数据；现实奖项可手动录入。</li>
        </ul>
      </section>

      <div class="actions">
        <router-link to="/insist/achievements" class="insist-btn">返回成就墙</router-link>
      </div>
    </main>
  </div>
</template>

<style scoped>
.crumb { display: flex; gap: 0.45rem; align-items: center; margin-top: 1.2rem; font-size: 0.74rem; }
.crumb a { color: #7a7a7a; text-decoration: none; }
.crumb a:hover { color: #ededed; }
.crumb span { color: #3f3f3f; }

.head {
  margin-top: 0.9rem;
  padding: 1.1rem 1.2rem;
  border: 1px solid #2a2a2a;
  border-radius: 10px;
  background: #070707;
}
.head.tier-4 { border-color: #5a5a5a; box-shadow: 0 0 26px rgba(255, 255, 255, 0.05); }
.head.tier-3 { border-color: #3a3a3a; }
.head.is-locked { opacity: 0.6; border-style: dashed; }

.head-top { display: flex; justify-content: space-between; font-size: 0.66rem; color: #7a7a7a; }
.name { margin-top: 0.5rem; font-size: 1.7rem; font-weight: 600; }
.desc { margin-top: 0.5rem; font-size: 0.82rem; color: #8a8a8a; line-height: 1.7; }

.rules { list-style: none; margin-top: 0.5rem; }
.rules li {
  position: relative;
  padding: 0.35rem 0 0.35rem 0.9rem;
  font-size: 0.76rem;
  color: #8a8a8a;
  line-height: 1.7;
}
.rules li::before { content: '·'; position: absolute; left: 0.2rem; color: #4a4a4a; }

.actions { margin-top: 2rem; }
</style>
